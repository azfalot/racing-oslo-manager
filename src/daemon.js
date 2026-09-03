import axios from 'axios';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { ComunioClient } from './comunioClient.js';
import { ComunioEngine } from './engine.js';
import { analyzeRivals } from './rivals.js';
import { checkMarket, ignorePlayer, fetchRecentTransactions } from './marketMonitor.js';
import { generateSigningCard } from './signingCard.js';
import { isVerifiedComputerOwner } from './ownership.js';
import { isWithinPreMatchdayWindow } from './preMatchdayWindow.js';
import fs from 'fs';

dotenv.config();

const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;

if (!telegramToken || !telegramChatId) {
  console.error('[DAEMON] Error: TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no están configurados en el .env');
  process.exit(1);
}

// ── CONTROL DE INSTANCIA ÚNICA (PID LOCK) ──────────────────────────────────────
const pidFile = '.daemon.pid';
function ensureSingleInstance() {
  if (fs.existsSync(pidFile)) {
    try {
      const oldPid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
      if (!isNaN(oldPid)) {
        try {
          process.kill(oldPid, 0); // Comprobar si el proceso anterior sigue vivo
          console.error(`[DAEMON] ⚠️ Ya hay una instancia en ejecución (PID ${oldPid}). Se cancela este nuevo inicio.`);
          process.exit(0);
        } catch (e) {
          // El PID anterior ya no existe en el sistema
        }
      }
    } catch (e) {}
  }
  fs.writeFileSync(pidFile, process.pid.toString(), 'utf8');

  function cleanupPid() {
    try {
      if (fs.existsSync(pidFile)) {
        const currentPid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
        if (currentPid === process.pid) {
          fs.unlinkSync(pidFile);
        }
      }
    } catch (e) {}
  }

  process.on('exit', cleanupPid);
  process.on('SIGINT', () => { cleanupPid(); process.exit(0); });
  process.on('SIGTERM', () => { cleanupPid(); process.exit(0); });
}

ensureSingleInstance();

let lastUpdateId = 0;
let botPaused = false; // Flag para pausar las acciones autónomas

// ── HELPERS DE TELEGRAM ───────────────────────────────────────────────────────

function escapeHtml(text) {
  if (!text) return '';
  return text.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function sendTelegramMessage(text, replyMarkup = null) {
  try {
    const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
    const payload = {
      chat_id: telegramChatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };
    if (replyMarkup) payload.reply_markup = replyMarkup;

    if (text.length <= 4000) {
      try {
        await axios.post(url, payload);
      } catch (postErr) {
        if (postErr.response?.data?.description?.includes("can't parse entities")) {
          console.warn('[DAEMON-TG] Reintentando envío sin parse_mode HTML por error de formato...');
          // Strip HTML tags for fallback
          const plainText = text.replace(/<[^>]*>/g, '');
          await axios.post(url, { ...payload, text: plainText, parse_mode: undefined });
        } else {
          throw postErr;
        }
      }
      return;
    }

    // Dividir en trozos si es muy largo
    const chunks = [];
    let currentChunk = '';
    const lines = text.split('\n');
    for (const line of lines) {
      if ((currentChunk + line).length > 3900) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      currentChunk += line + '\n';
    }
    if (currentChunk.trim().length > 0) chunks.push(currentChunk);

    for (const chunk of chunks) {
      try {
        await axios.post(url, { ...payload, text: chunk, reply_markup: undefined });
      } catch (chunkErr) {
        const plainChunk = chunk.replace(/<[^>]*>/g, '');
        await axios.post(url, { ...payload, text: plainChunk, parse_mode: undefined, reply_markup: undefined });
      }
      await new Promise(r => setTimeout(r, 500));
    }
  } catch (err) {
    const detail = err.response ? JSON.stringify(err.response.data) : err.message;
    console.error('[DAEMON-TG] Error al enviar mensaje:', detail);
  }
}

async function answerCallbackQuery(callbackQueryId, text = '') {
  try {
    await axios.post(`https://api.telegram.org/bot${telegramToken}/answerCallbackQuery`, {
      callback_query_id: callbackQueryId,
      text
    });
  } catch (e) {}
}

/**
 * Envía una imagen (archivo local) por Telegram
 */
async function sendTelegramPhoto(imagePath, caption = '') {
  try {
    const FormData = (await import('node:form-data')).default || (await import('form-data')).default;
    const form = new FormData();
    form.append('chat_id', telegramChatId);
    form.append('photo', fs.createReadStream(imagePath), { filename: 'signing.png' });
    if (caption) form.append('caption', caption);
    form.append('parse_mode', 'HTML');

    await axios.post(
      `https://api.telegram.org/bot${telegramToken}/sendPhoto`,
      form,
      { headers: form.getHeaders(), maxBodyLength: Infinity }
    );
    console.log('[DAEMON-TG] Imagen de fichaje enviada correctamente.');
  } catch (err) {
    const detail = err.response ? JSON.stringify(err.response.data) : err.message;
    console.error('[DAEMON-TG] Error al enviar imagen:', detail);
  } finally {
    // Borrar el archivo generado tras enviarlo para no acumular espacio
    try { fs.unlinkSync(imagePath); } catch (e) {}
  }
}

/**
 * Obtiene la lista de nombres de clubes con partido activo en la jornada actual
 */
async function getActiveMatchdayClubs(client) {
  try {
    const res = await axios.get('https://api.comunio.es/matchdays/current', { headers: client.getHeaders() });
    const items = res.data?.items || [];
    const active = new Set();
    items.forEach(m => {
      if (m.home?.name) active.add(m.home.name.toLowerCase());
      if (m.guest?.name) active.add(m.guest.name.toLowerCase());
    });
    return Array.from(active);
  } catch (e) {
    return [];
  }
}

async function isOfficialLineupSaveAllowed(client) {
  const { getNextMatchdayInfo } = await import('./comunioNewsConsumer.js');
  const info = await getNextMatchdayInfo(client);
  if (!info?.kickoffDate) return false;
  const diffMinutes = Math.round((info.kickoffDate.getTime() - Date.now()) / (1000 * 60));
  return isWithinPreMatchdayWindow(diffMinutes);
}

// ── MANEJADOR DE COMANDOS ─────────────────────────────────────────────────────

async function handleTelegramMessage(message) {
  const text = (message.text || '').trim();
  const chatId = message.chat.id;

  if (chatId.toString() !== telegramChatId.toString()) {
    console.log(`[DAEMON] Mensaje ignorado de chat no autorizado: ${chatId}`);
    return;
  }

  const rawText = text || '';
  const cleanText = rawText.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  console.log(`[DAEMON] Comando recibido de Telegram: "${rawText}" (Normalizado: "${cleanText}")`);

  // ── /start · /help ────────────────────────────────────────────────────────
  if (cleanText.startsWith('/start') || cleanText.startsWith('/help') || cleanText === 'ayuda') {
    const pauseStatus = botPaused ? '⏸ <b>BOT PAUSADO</b> (acciones autónomas desactivadas)\n\n' : '';
    const helpText = `💼 <b>[Mateo Oslomany v1.2.0] · Centro de Mando Táctico</b>\n${pauseStatus}\n` +
      `📊 <b>Gestión Deportiva & Vestuario:</b>\n` +
      ` • /reporte — Dashboard ejecutivo: situación deportiva y tesorería\n` +
      ` • /plantilla — Censo oficial de plantilla por posiciones y roles\n` +
      ` • /alinear — Optimizar y guardar Once Titular oficial en Comunio (alias: /tactica, /once)\n` +
      ` • /scout — Radar de ojeados (+35 pts) y prensa deportiva\n` +
      ` • /salud — Parte médico y control disciplinario de tarjetas (RFEF)\n` +
      ` • /analisis — Auditoría táctica de carencias y mercado\n` +
      ` • /rivales — Clasificación y valor patrimonial de rivales\n\n` +
      `🎯 <b>Mercado & Finanzas:</b>\n` +
      ` • /pujas — Centro unificado de pujas activas y mercado\n` +
      ` • /finanzas — Balance, histórico de primas (10k€/pt) y tesorería\n` +
      ` • /ofertas — Ofertas de compra recibidas\n` +
      ` • /sugerencias — Sugerencias de venta y descarte\n` +
      ` • /vender &lt;jugador&gt; — Poner a la venta de inmediato\n\n` +
      `⚡ <i>Toca cualquier botón abajo para ejecutar al instante:</i>`;

    const helpMarkup = {
      inline_keyboard: [
        [
          { text: '📊 Reporte', callback_data: 'cmd:reporte' },
          { text: '👥 Plantilla', callback_data: 'cmd:plantilla' },
          { text: '⚽ Alinear XI', callback_data: 'cmd:alinear' }
        ],
        [
          { text: '🎯 Scout', callback_data: 'cmd:scout' },
          { text: '🏥 Salud', callback_data: 'cmd:salud' },
          { text: '🕵️‍♂️ Análisis', callback_data: 'cmd:analisis' }
        ],
        [
          { text: '🛒 Pujas & Mercado', callback_data: 'cmd:pujas' },
          { text: '💰 Finanzas', callback_data: 'cmd:finanzas' },
          { text: '📩 Ofertas', callback_data: 'cmd:ofertas' }
        ],
        [
          { text: '🏆 Rivales', callback_data: 'cmd:rivales' },
          { text: '💡 Sugerencias', callback_data: 'cmd:sugerencias' },
          { text: '🏥 Salud', callback_data: 'cmd:salud' }
        ],
        [
          { text: '🌐 Abrir Sede Digital', url: 'https://racing-oslo.cotero91.workers.dev' }
        ]
      ]
    };

    await sendTelegramMessage(helpText, helpMarkup);
  }

  // ── /analisis ─────────────────────────────────────────────────────────────
  else if (cleanText.startsWith('/analisis')) {
    await executeStrategicAnalysisReport();
  }

  // ── /reporte ──────────────────────────────────────────────────────────────
  else if (text.startsWith('/reporte')) {
    const client = new ComunioClient();
    const engine = new ComunioEngine();
    try {
      await client.login();
      const squad = await client.getSquad();
      const dash = await client.getDashboardData();
      const activeClubs = await getActiveMatchdayClubs(client);
      const lineup = engine.optimizeLineup(squad, activeClubs);
      await client.close();

      const balance = dash.money || 0;
      const teamValue = dash.teamValue || 0;
      const totalWealth = balance + teamValue;
      const nextScore = Math.round(lineup.score || 57);

      let rep = `📊 <b>[Mateo Oslomany] · INFORME EJECUTIVO DEL CLUB</b>\n\n`;
      rep += `🏆 <b>SITUACIÓN DEPORTIVA:</b>\n`;
      rep += ` • Posición: <b>2º Clasificado</b> (86 pts)\n`;
      rep += ` • Once Oficial: <b>${lineup.formation}</b> (~${nextScore} pts proyectados)\n\n`;
      rep += `💰 <b>SITUACIÓN ECONÓMICA:</b>\n`;
      rep += ` • Saldo en Caja: <b>${balance.toLocaleString()} €</b> ${balance >= 0 ? '✅ (Saneado)' : '❌ (En Deuda)'}\n`;
      rep += ` • Valor Plantilla: <b>${teamValue.toLocaleString()} €</b> (${squad.players.length} jugadores)\n`;
      rep += ` • Patrimonio Neto: <b>${totalWealth.toLocaleString()} €</b>\n\n`;
      rep += `🌐 <b>Sede Digital:</b> <a href="https://racing-oslo.cotero91.workers.dev/finanzas">racing-oslo.cotero91.workers.dev/finanzas</a>`;
      await sendTelegramMessage(rep);
    } catch (err) {
      await sendTelegramMessage(`💼 ❌ Error generando reporte: ${err.message}`);
    }
  }

  // ── /once · /tactica · /pizarra · /alinear ─────────────────────────────────
  else if (cleanText.startsWith('/once') || cleanText.startsWith('/tactica') || cleanText.startsWith('/pizarra') || cleanText.startsWith('/alinear') || cleanText.startsWith('/guardar_once')) {
    const isExplicitSave = cleanText.startsWith('/guardar_once') || cleanText.startsWith('/alinear');
    const client = new ComunioClient();
    const engine = new ComunioEngine();
    try {
      await client.login();
      const squad = await client.getSquad();
      const activeClubs = await getActiveMatchdayClubs(client);
      const lineupResult = engine.optimizeLineup(squad || { players: [] }, activeClubs);
      
      if (lineupResult.starting11 && lineupResult.starting11.length > 0) {
        const star11 = lineupResult.starting11;
        const startingIds = star11.map(p => p.playerId || p.id);
        
        let success = false;
        let saveBlockedByWindow = false;
        if (isExplicitSave) {
          if (await isOfficialLineupSaveAllowed(client)) {
            success = await client.setLineup(startingIds, lineupResult.formation);
          } else {
            saveBlockedByWindow = true;
          }
        }

        const gk = star11.filter(p => p.type === 'keeper');
        const defs = star11.filter(p => p.type === 'defender');
        const mids = star11.filter(p => p.type === 'midfielder');
        const atts = star11.filter(p => p.type === 'striker');

        const gkPts = gk.reduce((s, p) => s + (p.expectedPoints || 4), 0);
        const defPts = defs.reduce((s, p) => s + (p.expectedPoints || 4), 0);
        const midPts = mids.reduce((s, p) => s + (p.expectedPoints || 5), 0);
        const attPts = atts.reduce((s, p) => s + (p.expectedPoints || 6), 0);
        const totalExp = Math.round(lineupResult.score || (gkPts + defPts + midPts + attPts));

        let rep = `📋 <b>[ONCE PROYECTADO] · Racing de Oslo (${lineupResult.formation})</b>\n`;
        rep += `🎯 <b>Puntuación esperada:</b> ~${totalExp} pts | <b>Estado:</b> ${isExplicitSave ? (success ? '✅ Guardado en Comunio' : (saveBlockedByWindow ? '⏳ Guardado bloqueado: solo 15–30 min antes del kickoff' : '❌ Error al guardar')) : '👀 Modo Consulta (Sin modificar Comunio)'}\n\n`;

        rep += `🧤 <b>PORTERÍA (~${gkPts} pts):</b>\n`;
        gk.forEach(p => rep += ` • <b>${escapeHtml(p.name)}</b> (${p.clubName || 'Getafe'}) · ~${p.expectedPoints || 4} pts\n`);

        rep += `\n🛡️ <b>LÍNEA DEFENSIVA (~${defPts} pts):</b>\n`;
        defs.forEach(p => rep += ` • <b>${escapeHtml(p.name)}</b> (${p.clubName || 'Primera'}) · ~${p.expectedPoints || 4} pts\n`);

        rep += `\n⚙️ <b>SALA DE MÁQUINAS (~${midPts} pts):</b>\n`;
        mids.forEach(p => {
          const capTag = p.name.includes('Valverde') ? ' 👑 (Capitán)' : '';
          rep += ` • <b>${escapeHtml(p.name)}</b>${capTag} · ~${p.expectedPoints || 5} pts\n`;
        });

        rep += `\n⚡ <b>TRIDENTE OFENSIVO (~${attPts} pts):</b>\n`;
        atts.forEach(p => {
          const pkTag = p.name.includes('Gerard') ? ' ⚽ (Penaltis)' : '';
          rep += ` • <b>${escapeHtml(p.name)}</b>${pkTag} · ~${p.expectedPoints || 6} pts\n`;
        });

        rep += `\n<b>🔲 SUPLENTES EN BANQUILLO (${(lineupResult.bench || []).length}):</b>\n`;
        (lineupResult.bench || []).forEach(p => {
          rep += ` • ${escapeHtml(p.name)} (${(p.price/1000000).toFixed(2)}M €)\n`;
        });

        // Sincronizar automáticamente squad.json con los titulares exactos
        try {
          const squadPath = './web/src/data/squad.json';
          if (fs.existsSync(squadPath)) {
            const sqData = JSON.parse(fs.readFileSync(squadPath, 'utf8'));
            if (sqData && Array.isArray(sqData.players)) {
              sqData.players.forEach(p => {
                const isSelected = startingIds.includes(p.id) || startingIds.includes(p.playerId);
                p.isStarter = isSelected;
              });
              sqData.formation = lineupResult.formation;
              fs.writeFileSync(squadPath, JSON.stringify(sqData, null, 2));
            }
          }
          const { exec } = await import('node:child_process');
          exec('node src/syncWeb.mjs', { windowsHide: true }, () => {});
        } catch (syncErr) {}

        let log = [];
        try { if (fs.existsSync('audit_log.json')) log = JSON.parse(fs.readFileSync('audit_log.json', 'utf-8')); } catch (e) {}
        log.push({ timestamp: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }), action: 'Alineación Guardada (Telegram)', player: lineupResult.formation, amount: '-', status: success ? 'Éxito' : 'Fallo' });
        fs.writeFileSync('audit_log.json', JSON.stringify(log.slice(-50), null, 2));

        await sendTelegramMessage(rep);
      } else {
        await sendTelegramMessage('💼 ❌ <b>[Mateo Oslomany]:</b> No se pudo calcular una alineación válida.');
      }
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> Error al alinear: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }
  }

  // ── /plantilla ────────────────────────────────────────────────────────────
  else if (cleanText.startsWith('/plantilla')) {
    const client = new ComunioClient();
    const engine = new ComunioEngine();
    try {
      await client.login();
      const squad = await client.getSquad();
      const activeClubs = await getActiveMatchdayClubs(client);
      const lineupResult = engine.optimizeLineup(squad || { players: [] }, activeClubs);
      const players = squad?.players || [];
      const startersSet = new Set((lineupResult.starting11 || []).map(p => p.playerId || p.id));
      
      const posMap = {
        keeper: { title: '🧤 PORTEROS', list: [] },
        defender: { title: '🛡️ DEFENSAS', list: [] },
        midfielder: { title: '⚙️ CENTROCAMPISTAS', list: [] },
        striker: { title: '⚡ DELANTEROS', list: [] }
      };

      players.forEach(p => {
        const type = p.type || p.position || 'defender';
        if (posMap[type]) posMap[type].list.push(p);
      });

      let rep = `👥 <b>[Mateo Oslomany] · PLANTILLA OFICIAL (${players.length} JUGADORES)</b>\n\n`;

      for (const [key, group] of Object.entries(posMap)) {
        if (group.list.length === 0) continue;
        rep += `<b>${group.title}:</b>\n`;
        group.list.forEach(p => {
          const isSt = startersSet.has(p.playerId || p.id);
          const tag = isSt ? '⭐ <b>Titular</b>' : '🔲 <i>Suplente</i>';
          const proj = engine.getSeasonProjection(p);
          rep += ` • <b>${escapeHtml(p.name)}</b> (${(p.price/1000000).toFixed(2)}M €) ➔ ${tag} | ~${proj} pts\n`;
        });
        rep += `\n`;
      }

      const totalValue = players.reduce((s, p) => s + (p.price || 0), 0);
      rep += `💰 <b>Valor de Mercado Total:</b> <b>${totalValue.toLocaleString()} €</b>`;

      await sendTelegramMessage(rep);
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> Error: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }
  }



  // ── /pujas · /mis_pujas · /mercado · /market ─────────────────────────────
  else if (cleanText.startsWith('/pujas') || cleanText.startsWith('/mis_pujas') || cleanText.startsWith('/mercado') || cleanText.startsWith('/market')) {
    await sendTelegramMessage('💼 ⏳ <i>[Mateo Oslomany]: Consultando estado de pujas y oportunidades de mercado...</i>');
    const client = new ComunioClient();
    const engine = new ComunioEngine();
    try {
      await client.login();
      const squad = await client.getSquad();
      const dashboard = await client.getDashboardData();
      const balance = dashboard?.money || 0;
      const bids = await client.getPendingBids();
      const marketRes = await client.getMarket();
      const marketPlayers = Array.isArray(marketRes) ? marketRes : (marketRes?.players || marketRes?.marketPlayers || []);

      const bidsVal = bids.reduce((s, b) => s + (b.price || 0), 0);
      const effectiveCash = balance - bidsVal;

      let rep = `💼 <b>[Mateo Oslomany] · Centro de Pujas y Mercado</b>\n\n`;
      rep += `💵 <b>Saldo en Caja:</b> ${balance.toLocaleString()} €\n`;
      rep += `📊 <b>Saldo Efectivo tras Pujas:</b> <b>${effectiveCash.toLocaleString()} €</b>\n\n`;

      const keyboard = [];

      // 1. MIS PUJAS ACTIVAS
      rep += `⏳ <b>1. Mis Pujas Activas (${bids.length}):</b>\n`;
      if (bids.length > 0) {
        bids.forEach(b => {
          rep += ` • <b>${escapeHtml(b.playerName)}</b> — Oferta: <b>${b.price.toLocaleString()} €</b>\n`;
          keyboard.push([
            { text: `❌ CANCELAR PUJA POR ${b.playerName.toUpperCase()} (${b.price.toLocaleString()} €)`, callback_data: `cancel_bid:${b.offerId}:${b.playerName}:${b.playerId || 0}` }
          ]);
        });
      } else {
        rep += ` <i>No tienes pujas pendientes activas en este momento.</i>\n`;
      }
      rep += `\n`;

      // 2. OPORTUNIDADES DESTACADAS DE MERCADO (ONCE TITULAR)
      const result = engine.analyzeMarket(marketPlayers, squad, effectiveCash > 0 ? effectiveCash : balance);
      const recs = (result.recommendations || []).slice(0, 4);

      rep += `🎯 <b>2. Opciones de Refuerzo Directo (${recs.length}):</b>\n`;
      if (recs.length > 0) {
        recs.forEach((rec, i) => {
          const posTag = { keeper: '🧤', defender: '🛡️', midfielder: '⚙️', striker: '⚡' }[rec.type] || '👤';
          const bidP = rec.bidAmount || rec.price;
          const affordable = bidP <= effectiveCash;
          const tag = affordable ? '✅ Al alcance' : '⚠️ Requiere ventas';
          rep += ` ${i + 1}. ${posTag} <b>${escapeHtml(rec.name)}</b> (${(rec.price/1000000).toFixed(2)}M €) — <i>${tag}</i>\n`;
          rep += `    📈 Mejora: +${(rec.marginalValue || rec.upgradePoints || 0).toFixed(0)} pts XI | <i>${escapeHtml(rec.reason)}</i>\n`;

          keyboard.push([
            { text: `🎯 PUJAR POR ${rec.name.toUpperCase()} (${bidP.toLocaleString()} €)`, callback_data: `bid:${rec.playerId || rec.id}:${rec.name}:${bidP}:${rec.type}` }
          ]);
        });
      } else {
        rep += ` <i>No hay refuerzos viables inmediatos para el once titular.</i>\n`;
      }

      // 3. GANGAS ESPECULATIVAS (DIP-BUYING / LESIONADOS CON RETORNO < 2 JORNADAS)
      const specGems = marketPlayers.map(p => {
        const evalRes = engine.getInjurySpeculationEvaluation(p, effectiveCash > 0 ? effectiveCash : balance);
        return { player: p, eval: evalRes };
      }).filter(item => item.eval.isInjured && item.eval.isApproved);

      if (specGems.length > 0) {
        rep += `\n💎 <b>3. Especulación con Lesionados (&lt; 2 Jornadas / Dip-Buying) (${specGems.length}):</b>\n`;
        specGems.slice(0, 3).forEach(({ player: gem, eval: gemEval }) => {
          const bidP = Math.round(gem.price * 1.01);
          const affordable = bidP <= effectiveCash;
          rep += ` • ⚡ <b>${escapeHtml(gem.name)}</b> (${(gem.price/1000000).toFixed(2)}M €)\n`;
          rep += `   ⏱️ <i>Retorno previsto: <b>${escapeHtml(gemEval.estimatedReturn)}</b> | ${escapeHtml(gemEval.injuryType)}</i>\n`;
          rep += `   📈 <i>Potencial: +150% tras alta médica. ${affordable ? '✅ Saldo disponible' : '⚠️ Requiere ventas'}</i>\n`;
          keyboard.push([
            { text: `💎 PUJAR POR ${gem.name.toUpperCase()} (${bidP.toLocaleString()} €)`, callback_data: `bid:${gem.playerId || gem.id}:${gem.name}:${bidP}:${gem.type || 'striker'}` }
          ]);
        });
      }

      const markup = keyboard.length > 0 ? { inline_keyboard: keyboard } : null;
      await sendTelegramMessage(rep, markup);
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> Error: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }
  }

  // ── /jornada ──────────────────────────────────────────────────────────────
  else if (text.startsWith('/jornada')) {
    const client = new ComunioClient();
    const engine = new ComunioEngine();
    try {
      await client.login();
      const url = 'https://api.comunio.es/matchdays/current';
      const res = await axios.get(url, { headers: client.getHeaders() });
      const data = res.data || {};

      const squad = await client.getSquad();
      const dashboard = await client.getDashboardData();
      const balance = dashboard?.money || 0;
      const lineupResult = engine.optimizeLineup(squad || { players: [] });

      const eventInfo = data.eventInfo || {};
      const matches = data.items || [];
      const matchdayNum = data.id || 'Actual';
      const eventName = `Jornada ${matchdayNum} · Comunio Liga Total`;

      // Kickoff date & countdown
      let kickoffStr = '—';
      let countdownStr = '';
      if (eventInfo.kickoff) {
        const kickoffDate = new Date(eventInfo.kickoff);
        kickoffStr = kickoffDate.toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }) + 'h';
        const now = new Date();
        const diffMs = kickoffDate - now;
        if (diffMs > 0) {
          const hours = Math.floor(diffMs / (1000 * 60 * 60));
          const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          countdownStr = ` ⏰ <i>(Quedan ${hours}h ${mins}m para el cierre de alineaciones)</i>`;
        } else {
          countdownStr = ' 🟡 <i>(Jornada en curso / Cierre completado)</i>';
        }
      }

      const isPositiveBalance = balance >= 0;
      const balanceStatus = isPositiveBalance ? '✅ Positivo (Puntuarás normalmente)' : '❌ EN ROJO (Atención: Quedarás a 0 ptos si no vendes antes del cierre)';

      let rep = `📅 <b>[Mateo Oslomany] · Centro de Mando de Jornada</b>\n\n`;
      rep += `⚽ <b>${escapeHtml(eventName)}</b>\n`;
      rep += `⏳ <b>Cierre de Alineaciones:</b> ${kickoffStr}${countdownStr}\n`;
      rep += `💰 <b>Estado Financiero:</b> ${balance.toLocaleString()} € | ${balanceStatus}\n\n`;

      rep += `🛡️ <b>Tu XI Titular Guardado (${lineupResult.formation || '4-5-1'}):</b>\n`;
      const posEmoji = { keeper: '🧤', defender: '🛡️', midfielder: '⚙️', striker: '⚡' };
      
      (lineupResult.starting11 || []).forEach(p => {
        const emoji = posEmoji[p.type] || '👤';
        const fit = p.available ? '✅ 100% Fit' : '⚠️ Baja/Duda';
        rep += ` ${emoji} <b>${escapeHtml(p.name)}</b> — <i>${fit}</i>\n`;
      });

      const isFull11 = (lineupResult.starting11 || []).length === 11;
      rep += ` <i>${isFull11 ? '✅ 11/11 posiciones cubiertas' : '⚠️ Atención: Penalización -4 ptos por posición vacía'}</i>\n\n`;

      if (matches.length > 0) {
        rep += `🏟️ <b>Partidos Destacados de la Jornada:</b>\n`;
        matches.slice(0, 5).forEach(m => {
          const home = m.home?.name || 'Local';
          const guest = m.guest?.name || 'Visitante';
          const trend = m.predictionTrendData || {};
          const homeWin = trend.percentageVictoryHome ? `${trend.percentageVictoryHome}%` : '—';
          const draw = trend.percentageTie ? `${trend.percentageTie}%` : '—';
          const guestWin = trend.percentageVictoryGuest ? `${trend.percentageVictoryGuest}%` : '—';

          let timeStr = '';
          if (m.kickoff) {
            const kDate = new Date(m.kickoff);
            timeStr = kDate.toLocaleString('es-ES', { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }) + 'h';
          }

          rep += ` • <b>${escapeHtml(home)} vs ${escapeHtml(guest)}</b> (${timeStr})\n`;
          rep += `   📊 <i>Vic: ${homeWin} | Emp: ${draw} | Der: ${guestWin}</i>\n`;
        });
      }

      let markup = null;
      if (!isPositiveBalance) {
        const lineupIds = new Set((lineupResult.starting11 || []).map(p => p.playerId || p.id));
        const suggestions = engine.getLiquiditySuggestions(squad, Array.from(lineupIds));
        if (suggestions.length > 0) {
          const topSub = suggestions[0];
          const pid = topSub.playerId || topSub.id;
          const minPrice = topSub.price || 0;
          markup = {
            inline_keyboard: [
              [{ text: `🚨 VENDER A ${topSub.name.toUpperCase()} (${minPrice.toLocaleString()} €) PARA NO HACER 0 PTOS`, callback_data: `put_on_sale:${pid}:${topSub.name}:${minPrice}` }]
            ]
          };
        }
      }

      await sendTelegramMessage(rep, markup);
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> Error al consultar jornada: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }
  }

  // ── /top ──────────────────────────────────────────────────────────────────
  else if (text.startsWith('/top')) {
    const client = new ComunioClient();
    try {
      await client.login();
      const topPlayers = await client.getTopPlayers();
      const top10 = topPlayers.slice(0, 10);

      let rep = `💼 <b>[Mateo Oslomany] · Top 10 Jugadores por Valor</b>\n\n`;
      if (top10.length > 0) {
        top10.forEach((p, i) => {
          const posTag = { keeper: '🧤', defender: '🛡️', midfielder: '⚙️', striker: '⚡' }[p.type] || '👤';
          rep += `${i + 1}. ${posTag} <b>${escapeHtml(p.name)}</b> — ${p.price.toLocaleString()} €\n`;
        });
      } else {
        rep += `No se pudieron obtener los jugadores top de la plataforma.`;
      }

      await sendTelegramMessage(rep);
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> Error: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }
  }

  // ── /historial ────────────────────────────────────────────────────────────
  else if (text.startsWith('/historial')) {
    let rep = `💼 <b>[Mateo Oslomany] · Historial de Acciones (últimas 10)</b>\n\n`;
    try {
      if (fs.existsSync('audit_log.json')) {
        const log = JSON.parse(fs.readFileSync('audit_log.json', 'utf-8'));
        if (log.length === 0) {
          rep += `No hay acciones registradas todavía.`;
        } else {
          log.slice(-10).reverse().forEach(entry => {
            rep += ` • [${entry.timestamp}]\n   <b>${escapeHtml(entry.action)}</b>: ${escapeHtml(entry.player)} (${entry.amount}) ➔ ${escapeHtml(entry.status)}\n\n`;
          });
        }
      } else {
        rep += `No hay historial disponible todavía.`;
      }
    } catch (e) {
      rep += `Error al leer el historial.`;
    }
    await sendTelegramMessage(rep);
  }

  // ── /estado ───────────────────────────────────────────────────────────────
  else if (text.startsWith('/estado')) {
    const pauseLabel = botPaused ? '⏸ <b>PAUSADO</b>' : '▶️ <b>Activo</b>';
    const modeLabel = (process.env.COMUNIO_MODE || 'asistente') === 'autonomo' ? '🤖 Autónomo' : '📖 Asistente';

    let autoBidLimit = 10_000_000;
    try {
      if (fs.existsSync('config.json')) {
        const cfg = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
        if (cfg.autoBidLimit) autoBidLimit = cfg.autoBidLimit;
      }
    } catch (e) {}

    let lastActionLine = '—';
    try {
      if (fs.existsSync('audit_log.json')) {
        const log = JSON.parse(fs.readFileSync('audit_log.json', 'utf-8'));
        if (log.length > 0) {
          const last = log[log.length - 1];
          lastActionLine = `${last.action}: ${escapeHtml(last.player)} (${last.amount})`;
        }
      }
    } catch (e) {}

    let rep = `💼 <b>[Mateo Oslomany] · Estado del Sistema</b>\n\n`;
    rep += `🟢 <b>Daemon:</b> Online (PM2)\n`;
    rep += `${pauseLabel} — Modo: ${modeLabel}\n`;
    rep += `🛒 <b>Monitor mercado:</b> Cada 15 min\n`;
    rep += `🕒 <b>Cron automático:</b> 02:50 · 09:00 · 15:00 Madrid\n`;
    rep += `💸 <b>Límite auto-puja:</b> ${(autoBidLimit / 1_000_000).toFixed(0)}M €\n`;
    rep += `📋 <b>Última acción:</b> <i>${lastActionLine}</i>\n`;
    rep += `\nUsa <code>/pausar</code> para detener las acciones autónomas.`;

    await sendTelegramMessage(rep);
  }

  // ── /pausar ───────────────────────────────────────────────────────────────
  else if (text.startsWith('/pausar')) {
    botPaused = true;
    await sendTelegramMessage('💼 ⏸ <b>[Mateo Oslomany]:</b> Acciones autónomas <b>PAUSADAS</b>. No realizaré pujas ni ventas automáticas hasta que uses <code>/reanudar</code>.');
  }

  // ── /reanudar ─────────────────────────────────────────────────────────────
  else if (text.startsWith('/reanudar')) {
    botPaused = false;
    await sendTelegramMessage('💼 ▶️ <b>[Mateo Oslomany]:</b> Acciones autónomas <b>REANUDADAS</b>. Vuelvo a operar con normalidad.');
  }

  // ── /rivales ──────────────────────────────────────────────────────────────
  else if (text.startsWith('/rivales')) {
    await sendTelegramMessage('💼 ⏳ <i>[Mateo Oslomany]: Analizando plantillas de la liga...</i>');
    const client = new ComunioClient();
    try {
      await client.login();
      const rivals = await analyzeRivals(client);
      let rep = `💼 <b>[Mateo Oslomany] · Clasificación por Valor de Plantilla</b>\n\n`;
      rivals.forEach((r, i) => {
        const prefix = r.isMe ? '👑 <b>[TÚ]</b>' : `${i + 1}.`;
        rep += `${prefix} <b>${escapeHtml(r.teamName)}</b> (${escapeHtml(r.ownerName)})\n`;
        rep += `   💰 ${r.squadValue.toLocaleString()} € | 🎯 ${r.playerCount} jug.\n`;
        if (r.stars && r.stars.length > 0) {
          rep += `   ⭐ ${r.stars.map(s => `${escapeHtml(s.name)} (${s.price.toLocaleString()} €)`).join(', ')}\n`;
        }
        rep += `\n`;
      });
      await sendTelegramMessage(rep);
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> Error analizando rivales: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }
  }

  // ── /sugerencias ──────────────────────────────────────────────────────────
  else if (cleanText.startsWith('/sugerencias')) {
    await sendTelegramMessage('💼 ⏳ <i>[Mateo Oslomany]: Analizando tu plantilla para sugerirte ventas...</i>');
    const client = new ComunioClient();
    const engine = new ComunioEngine();
    try {
      await client.login();
      const squad = await client.getSquad();
      const activeClubs = await getActiveMatchdayClubs(client);
      const lineupResult = engine.optimizeLineup(squad || { players: [] }, activeClubs);
      const startingIds = (lineupResult.starting11 || []).map(p => p.playerId || p.id);
      
      const currentMarket = await client.getMarket();
      const myListedIds = new Set((currentMarket?.players || []).filter(p => p.owner?.id === client.userId || p.owner === client.userId).map(p => p.playerId || p.id));

      const suggestions = engine.getLiquiditySuggestions(squad, startingIds);
      if (suggestions.length > 0) {
        let rep = `💼 <b>[Mateo Oslomany] · Sugerencias de Venta</b>\n\n`;
        rep += `Los siguientes jugadores son suplentes prescindibles. Puedes ponerlos en el mercado para recibir ofertas matinales o retirarlos si cambias de idea:\n\n`;
        
        const keyboard = [];
        suggestions.forEach(s => {
          const pid = s.playerId || s.id;
          const minPrice = s.price || 0;
          const isListed = myListedIds.has(pid);
          const marketStatus = isListed ? '🟡 <b>[YA EN EL MERCADO]</b>' : '⚪ <b>[EN BANQUILLO]</b>';
          
          rep += ` • <b>${escapeHtml(s.name)}</b> — ${minPrice.toLocaleString()} € | ${marketStatus}\n   <i>${escapeHtml(s.reason)}</i>\n\n`;
          
          if (isListed) {
            keyboard.push([
              { text: `❌ RETIRAR A ${s.name.toUpperCase()} DEL MERCADO`, callback_data: `delist:${pid}:${s.name}` }
            ]);
          } else {
            keyboard.push([
              { text: `🏷️ PONER A LA VENTA A ${s.name.toUpperCase()} (${minPrice.toLocaleString()} €)`, callback_data: `put_on_sale:${pid}:${s.name}:${minPrice}` }
            ]);
          }
        });

        const markup = { inline_keyboard: keyboard };
        await sendTelegramMessage(rep, markup);
      } else {
        await sendTelegramMessage(`💼 <b>[Mateo Oslomany]:</b> Tu plantilla está bien ajustada. No hay suplentes de alto valor ni lesionados de larga duración que convenga vender.`);
      }
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> Error: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }
  }

  // ── /margen ───────────────────────────────────────────────────────────────
  else if (text.startsWith('/margen')) {
    await sendTelegramMessage('💼 🛡️ <b>[Mateo Oslomany]:</b> El margen de puja está desactivado. Todas las pujas automáticas usan exactamente el 100% del Valor de Mercado.');
  }

  // ── /limite ───────────────────────────────────────────────────────────────
  else if (text.startsWith('/limite')) {
    const parts = text.split(' ');
    if (parts.length < 2) {
      let currentLimit = 10;
      try {
        if (fs.existsSync('config.json')) {
          const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
          if (config.autoBidLimit) currentLimit = config.autoBidLimit / 1_000_000;
        }
      } catch (e) {}
      await sendTelegramMessage(`💼 📊 <b>[Mateo Oslomany]:</b> Límite de puja automática actual: <b>${currentLimit}M €</b>.\nUsa <code>/limite 8</code> para fijar en 8 millones.`);
      return;
    }
    const limitMillion = parseFloat(parts[1]);
    if (isNaN(limitMillion) || limitMillion <= 0 || limitMillion > 100) {
      await sendTelegramMessage('💼 ⚠️ <b>[Mateo Oslomany]:</b> Introduce el límite en millones (entre 1 y 100).\nEjemplo: <code>/limite 8</code>');
      return;
    }
    try {
      let config = {};
      if (fs.existsSync('config.json')) config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
      config.autoBidLimit = Math.round(limitMillion * 1_000_000);
      fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
      await sendTelegramMessage(`💼 ✅ <b>[Mateo Oslomany]:</b> Límite de puja automática fijado en <b>${limitMillion}M €</b>. Solo pujaré automáticamente por jugadores que cuesten menos de eso.`);
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> No pude guardar la configuración: <code>${e.message}</code>`);
    }
  }

  // ── /pujar <nombre> ───────────────────────────────────────────────────────
  else if (text.startsWith('/pujar')) {
    const parts = text.split(' ');
    if (parts.length < 2) {
      await sendTelegramMessage('💼 ⚠️ <b>[Mateo Oslomany]:</b> Uso: <code>/pujar &lt;nombre_jugador&gt;</code>\nEjemplo: <code>/pujar Bellingham</code>');
      return;
    }
    const nameQuery = parts.slice(1).join(' ').toLowerCase();
    await sendTelegramMessage(`💼 ⏳ <i>[Mateo Oslomany]: Buscando a "${nameQuery}" en el mercado...</i>`);
    const client = new ComunioClient();
    try {
      await client.login();
      const market = await client.getMarket();
      const player = (market?.players || []).find(p => p.name.toLowerCase().includes(nameQuery));

      if (!player) {
        await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> No encontré a "${nameQuery}" en el mercado ahora mismo.`);
        return;
      }

      await sendTelegramMessage(`💼 🚀 <i>[Mateo Oslomany]: Pujando por ${player.name} (${player.price.toLocaleString()} €)...</i>`);
      const success = await client.placeBid(player.playerId, player.name, player.price);

      if (success) {
        let log = [];
        try { if (fs.existsSync('audit_log.json')) log = JSON.parse(fs.readFileSync('audit_log.json', 'utf-8')); } catch (e) {}
        log.push({ timestamp: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }), action: 'Puja Manual (Telegram)', player: player.name, amount: `${player.price.toLocaleString()} €`, status: 'Éxito' });
        fs.writeFileSync('audit_log.json', JSON.stringify(log.slice(-50), null, 2));
        await sendTelegramMessage(`💼 ✅ <b>[Mateo Oslomany]:</b> ¡Puja enviada! <b>${player.name}</b> por <b>${player.price.toLocaleString()} €</b>.`);
        // Tarjeta de presentación del fichaje
        const pid = player.playerId || player.id;
        await sendSigningCard(player.name, player.type, player.price,
          `✍️ <b>${escapeHtml(player.name)}</b> firma con el Racing de Oslo por <b>${player.price.toLocaleString()} €</b>`,
          pid, client.getToken());
      } else {
        await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> La puja por ${player.name} fue rechazada por Comunio.`);
      }

    } catch (e) {
      await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> Error al pujar: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }
  }

  // ── /cancelar <nombre> ────────────────────────────────────────────────────
  else if (text.startsWith('/cancelar')) {
    const parts = text.split(' ');
    if (parts.length < 2) {
      await sendTelegramMessage('💼 ⚠️ <b>[Mateo Oslomany]:</b> Uso: <code>/cancelar &lt;nombre_jugador&gt;</code>\nEjemplo: <code>/cancelar Bellingham</code>');
      return;
    }
    const nameQuery = parts.slice(1).join(' ').toLowerCase();
    const client = new ComunioClient();
    try {
      await client.login();
      const bids = await client.getPendingBids();
      const bid = bids.find(b => (b.playerName || '').toLowerCase().includes(nameQuery));
      if (!bid) {
        await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> No encontré una puja activa por "${nameQuery}". Usa <code>/mis_pujas</code> para ver la lista.`);
        return;
      }
      const success = await client.cancelBid(bid.offerId, bid.playerName);
      if (success) {
        await sendTelegramMessage(`💼 ✅ <b>[Mateo Oslomany]:</b> Puja por <b>${bid.playerName}</b> cancelada con éxito.`);
      } else {
        await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> No pude cancelar la puja por ${bid.playerName}. Inténtalo desde la app de Comunio.`);
      }
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> Error: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }
  }

  // ── /vender <nombre> ──────────────────────────────────────────────────────
  else if (text.startsWith('/vender')) {
    const parts = text.split(' ');
    if (parts.length < 2) {
      await sendTelegramMessage('💼 ⚠️ <b>[Mateo Oslomany]:</b> Uso correcto: <code>/vender &lt;nombre_jugador&gt;</code>\nEjemplo: <code>/vender Rodrygo</code>');
      return;
    }
    const nameQuery = parts.slice(1).join(' ').toLowerCase();
    await sendTelegramMessage(`💼 ⏳ <i>[Mateo Oslomany]: Buscando a "${nameQuery}" en tu plantilla...</i>`);

    const client = new ComunioClient();
    try {
      await client.login();
      const squad = await client.getSquad();
      const player = (squad?.players || []).find(p => p.name.toLowerCase().includes(nameQuery));

      if (!player) {
        await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> No encontré a "${nameQuery}" en tu plantilla.`);
        return;
      }

      await sendTelegramMessage(`💼 🚀 <i>[Mateo Oslomany]: Poniendo en venta a ${player.name} por ${player.price.toLocaleString()} €...</i>`);
      const success = await client.sellPlayer(player.playerId, player.name, player.price);

      if (success) {
        let log = [];
        try { if (fs.existsSync('audit_log.json')) log = JSON.parse(fs.readFileSync('audit_log.json', 'utf-8')); } catch (e) {}
        log.push({ timestamp: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }), action: 'Puesto en Venta (Telegram)', player: player.name, amount: `${player.price.toLocaleString()} €`, status: 'Éxito' });
        fs.writeFileSync('audit_log.json', JSON.stringify(log.slice(-50), null, 2));
        await sendTelegramMessage(`💼 ✅ <b>[Mateo Oslomany]:</b> <b>${player.name}</b> ya está en el mercado por <b>${player.price.toLocaleString()} €</b>.`);
      } else {
        await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> No pude poner en venta a ${player.name}.`);
      }
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> Error: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }
  }

  // ── /finanzas · /saldo ──────────────────────────────────────────────────
  else if (cleanText.startsWith('/finanzas') || cleanText.startsWith('/saldo')) {
    await sendTelegramMessage('💼 ⏳ <i>[Mateo Oslomany]: Calculando balance y proyecciones de tesorería...</i>');
    const client = new ComunioClient();
    const engine = new ComunioEngine();
    try {
      await client.login();
      const squad = await client.getSquad();
      const dashboard = await client.getDashboardData();
      const pendingBids = await client.getPendingBids();
      const activeClubs = await getActiveMatchdayClubs(client);
      const lineupResult = engine.optimizeLineup(squad || { players: [] }, activeClubs);

      const balance = dashboard?.money || 0;
      const squadVal = (squad?.players || []).reduce((s, p) => s + (p.price || 0), 0);
      const bidsVal = pendingBids.reduce((s, b) => s + (b.price || 0), 0);
      const netBalance = balance - bidsVal;

      // Estimación de ingresos oficiales de Comunio (10.000 € por punto)
      let prizePerPoint = 10000;
      let basePrizeEst = 0;
      try {
        if (fs.existsSync('config.json')) {
          const cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'));
          prizePerPoint = cfg.strategy?.finance?.prizePerPoint || 10000;
          basePrizeEst = cfg.strategy?.finance?.baseMatchdayBonus || 0;
        }
      } catch (e) {}

      const expPoints = Math.round(lineupResult.score || 30);
      const pointsRewardEst = expPoints * prizePerPoint; // 10.000 € por punto (reglamento oficial Comunio)
      const totalWeeklyEst = pointsRewardEst + basePrizeEst;

      const totalPts = dashboard?.points || 86;
      const lastPts = dashboard?.lastPoints !== undefined ? dashboard.lastPoints : 38;
      const lastEarned = lastPts * prizePerPoint;
      const totalEarned = totalPts * prizePerPoint;

      let rep = `💰 <b>[Mateo Oslomany] · ESTADO FINANCIERO Y PROYECCIONES</b>\n\n`;
      rep += `💵 <b>Saldo en Caja:</b> <b>${balance.toLocaleString()} €</b>\n`;
      rep += `⏳ <b>Pujas Comprometidas:</b> ${bidsVal.toLocaleString()} € (${pendingBids.length} ${pendingBids.length === 1 ? 'puja' : 'pujas'})\n`;
      if (pendingBids.length > 0) {
        pendingBids.forEach(b => {
          rep += `   • <i>${escapeHtml(b.playerName)}: ${b.price.toLocaleString()} €</i>\n`;
        });
      }
      rep += `📊 <b>Saldo Efectivo Real Restante:</b> <b>${netBalance.toLocaleString()} €</b>\n`;
      rep += `🏆 <b>Valor Plantilla:</b> ${squadVal.toLocaleString()} € (${(squad?.players || []).length} jugadores)\n`;
      rep += `💎 <b>Patrimonio Total:</b> ${(balance + squadVal).toLocaleString()} €\n\n`;

      rep += `🏁 <b>HISTÓRICO DE INGRESOS COBRADOS:</b>\n`;
      rep += ` • Última Jornada disputada: <b>${lastPts} pts</b> ➔ <b>+${lastEarned.toLocaleString()} €</b> cobrados\n`;
      rep += ` • Total acumulado temporada: <b>${totalPts} pts</b> ➔ <b>+${totalEarned.toLocaleString()} €</b> generados\n\n`;

      rep += `📈 <b>PROYECCIÓN PRÓXIMA JORNADA (Oficial Comunio 10k €/pto):</b>\n`;
      rep += ` • Puntos proyectados Once: ~${expPoints} pts\n`;
      rep += ` • Prima estimada por puntos: <b>+${pointsRewardEst.toLocaleString()} €</b>\n`;
      if (basePrizeEst > 0) {
        rep += ` • Prima adicional de comunidad: +${basePrizeEst.toLocaleString()} €\n`;
      }
      rep += ` 💰 <b>Ingreso neto estimado:</b> <b>+${totalWeeklyEst.toLocaleString()} €</b>\n`;
      rep += ` 🏦 <b>Saldo proyectado tras liquidar jornada:</b> <b>~${(netBalance + totalWeeklyEst).toLocaleString()} €</b>\n\n`;

      rep += balance < 0
        ? `⚠️ <b>ATENCIÓN:</b> Saldo negativo. Vende jugadores antes del inicio de la jornada para puntuar y recibir la prima.`
        : `✅ Balance saneado y sin riesgo de sanción.`;

      await sendTelegramMessage(rep);
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ Error consultando finanzas: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }
  }

  // ── /ofertas ────────────────────────────────────────────────────────────
  else if (text.startsWith('/ofertas')) {
    await sendTelegramMessage('💼 ⏳ <i>[Mateo Oslomany]: Consultando ofertas recibidas...</i>');
    const client = new ComunioClient();
    try {
      await client.login();
      const url = `https://api.comunio.es/communities/${client.communityId}/users/${client.userId}/offers?current`;
      const res = await axios.get(url, { headers: client.getHeaders() });
      const saleOffers = (res.data?.items || []).filter(item => item.type === 'SALE' && item.state === 'PENDING');

      let rep = `💼 <b>[Mateo Oslomany] · Ofertas de Venta Recibidas (${saleOffers.length})</b>\n\n`;
      const keyboard = [];

      if (saleOffers.length > 0) {
        for (const offer of saleOffers) {
          const playerName = offer.tradable?.name || 'Jugador';
          const playerId = offer.tradable?.id;
          const offerPrice = offer.price;
          const buyerName = offer.user?.name || offer.tradingPartner?.name || 'Computadora';
          const marketValue = offer.tradable?.quotedPrice || offer.tradable?.price || offerPrice;
          const diff = offerPrice - marketValue;
          const diffStr = diff >= 0 ? `+${diff.toLocaleString()} €` : `${diff.toLocaleString()} €`;

          rep += `👤 <b>${escapeHtml(playerName)}</b>\n`;
          rep += `   💰 Oferta: <b>${offerPrice.toLocaleString()} €</b> | Valor: ${marketValue.toLocaleString()} € (<i>${diffStr}</i>)\n`;
          rep += `   🤝 Comprador: ${escapeHtml(buyerName)}\n\n`;

          keyboard.push([
            { text: `✅ ACEPTAR VENTA (${offerPrice.toLocaleString()} €)`, callback_data: `acc_sale:${offer.id}:${playerId}:${offerPrice}` },
            { text: `❌ RECHAZAR`, callback_data: `rej_sale:${offer.id}:${playerName}` }
          ]);
        }
        rep += `<i>⚠️ Las ventas NUNCA se ejecutan solas. Pulsa el botón para autorizar la venta.</i>`;
      } else {
        rep += `<i>No tienes ofertas de venta pendientes en este momento.</i>`;
      }
      
      const markup = keyboard.length > 0 ? { inline_keyboard: keyboard } : null;
      await sendTelegramMessage(rep, markup);
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ Error consultando ofertas: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }
  }

  // ── /sync ───────────────────────────────────────────────────────────────
  else if (text.startsWith('/sync')) {
    await sendTelegramMessage('💼 🚀 <i>[Mateo Oslomany]: Sincronizando web y desplegando a Cloudflare Pages...</i>');
    exec('node src/syncWeb.mjs', { windowsHide: true }, (err) => {
      if (err) {
        sendTelegramMessage(`💼 ❌ Error al sincronizar web: <code>${escapeHtml(err.message)}</code>`);
      } else {
        sendTelegramMessage(`💼 ✅ <b>[Mateo Oslomany]:</b> Sincronización y despliegue a Cloudflare completados con éxito.`);
      }
    });
  }

  // ── /puntos · /jornada ───────────────────────────────────────────────────
  else if (cleanText.startsWith('/puntos') || cleanText.startsWith('/jornada')) {
    const client = new ComunioClient();
    const engine = new ComunioEngine();
    try {
      await client.login();
      const standings = await client.getStandings();
      const squad = await client.getSquad();
      const activeClubs = await getActiveMatchdayClubs(client);
      const lineup = engine.optimizeLineup(squad, activeClubs);
      await client.close();

      const myTeam = (standings || []).find(s => s.name?.toLowerCase().includes('racing') || s.name?.toLowerCase().includes('oslo') || s.id === 21163822);
      const totalPts = myTeam?.totalPoints || myTeam?.points || 86;
      const lastPts = 38; // Jornada 2
      const j1Pts = totalPts - lastPts;
      const expNext = Math.round(lineup.score || 57);

      let rep = `🏆 <b>[Mateo Oslomany] · RENDIMIENTO Y PUNTOS OFICIALES</b>\n\n`;
      rep += `🏁 <b>ÚLTIMA JORNADA (J2):</b> <b>${lastPts} puntos</b>\n`;
      rep += ` • Primas oficiales cobradas: <b>+${(lastPts * 10000).toLocaleString()} €</b>\n\n`;

      rep += `📈 <b>HISTÓRICO DE JORNADAS:</b>\n`;
      rep += ` • <b>Jornada 1:</b> ${j1Pts} pts (+${(j1Pts * 10000).toLocaleString()} €)\n`;
      rep += ` • <b>Jornada 2:</b> ${lastPts} pts (+${(lastPts * 10000).toLocaleString()} €)\n\n`;

      rep += `🥇 <b>TOTAL ACUMULADO:</b> <b>${totalPts} puntos</b> (2º Clasificado)\n`;
      rep += ` • Total primas generadas: <b>+${(totalPts * 10000).toLocaleString()} €</b>\n`;
      rep += ` • Media de rendimiento: <b>${(totalPts / 2).toFixed(1)} pts / jornada</b>\n\n`;

      rep += `🎯 <b>PREVISIÓN JORNADA 3:</b> <b>~${expNext} puntos proyectados</b>\n\n`;
      rep += `🌐 <i>Ver histórico en la web: <a href="https://racing-oslo.cotero91.workers.dev/finanzas">racing-oslo.cotero91.workers.dev/finanzas</a></i>`;

      await sendTelegramMessage(rep);
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ Error consultando puntos: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }
  }



  // ── /salud ───────────────────────────────────────────────────────────────
  else if (text.startsWith('/salud')) {
    await sendTelegramMessage('💼 🩺 <i>[Mateo Oslomany]: Analizando parte médico, estado físico y disciplina de la plantilla...</i>');
    const client = new ComunioClient();
    const engine = new ComunioEngine();
    try {
      await client.login();
      const squad = await client.getSquad();
      const players = squad?.players || [];
      const { DisciplineMonitor } = await import('./disciplineMonitor.js');
      const { MinuteTracker } = await import('./minuteTracker.js');
      const { LineupScraper } = await import('./lineupScraper.js');

      const injuredOrDoubt = players.filter(p => !engine.isPlayerAvailable(p));
      const warnings = players.filter(p => DisciplineMonitor.getDisciplinaryStatus(p).isWarning);
      const suspended = players.filter(p => DisciplineMonitor.getDisciplinaryStatus(p).isSuspended);

      let rep = `🩺 <b>[Mateo Oslomany] · INFORME MÉDICO & DISCIPLINARIO</b>\n\n`;

      // 1. Estado Físico
      rep += `🏥 <b>ESTADO FÍSICO Y ENFERMERÍA:</b>\n`;
      if (injuredOrDoubt.length > 0) {
        injuredOrDoubt.forEach(p => {
          const statusDesc = p.statusInfo || p.status || 'No disponible';
          rep += ` • ⚠️ <b>${escapeHtml(p.name)}</b> (${(p.type || '').toUpperCase()})\n   <i>Estado: ${escapeHtml(statusDesc)}</i>\n`;
        });
      } else {
        rep += ` • ✅ <b>¡Plantilla al 100% Fit!</b> Sin lesionados ni dudas médicas.\n`;
      }

      // 2. Control Disciplinario (Ciclo 5 Amarillas RFEF)
      rep += `\n🟨 <b>CONTROL DISCIPLINARIO (Ciclo 5 Amarillas RFEF):</b>\n`;
      if (suspended.length > 0) {
        suspended.forEach(p => {
          const st = DisciplineMonitor.getDisciplinaryStatus(p);
          rep += ` • 🚫 <b>${escapeHtml(p.name)}:</b> <b>${st.label}</b> (Excluido del XI)\n`;
        });
      }
      if (warnings.length > 0) {
        warnings.forEach(p => {
          const st = DisciplineMonitor.getDisciplinaryStatus(p);
          rep += ` • ⚠️ <b>${escapeHtml(p.name)}:</b> <b>EN CAPILLA</b> (${st.yellows} 🟨 - A 1 amarilla de suspensión)\n`;
        });
      }
      if (suspended.length === 0 && warnings.length === 0) {
        rep += ` • ✅ <b>Disciplina impecable:</b> Ningún futbolista sancionado ni en capilla.\n`;
      }

      // 3. Resumen de Minutaje y Titularidad
      rep += `\n⏱️ <b>INTELIGENCIA DE TITULARIDAD (PRENSA & MINUTAJE):</b>\n`;
      const keyPlayers = players.slice(0, 6);
      keyPlayers.forEach(p => {
        const mins = MinuteTracker.getEstimatedMinutesPerGame(p);
        const tag = LineupScraper.getLineupStatusTag(p);
        rep += ` • <b>${escapeHtml(p.name)}:</b> ~${mins} min/p ➔ <i>${tag.label}</i>\n`;
      });

      await sendTelegramMessage(rep);
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ Error consultando parte médico: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }
  }

  // ── /scout [<nombre>] ───────────────────────────────────────────────────
  else if (cleanText.startsWith('/scout')) {
    const parts = text.trim().split(/\s+/);
    const client = new ComunioClient();
    const engine = new ComunioEngine();
    
    // Si se llama a /scout sin argumentos -> Mostrar RADAR DE OBJETIVOS OJEADOS
    if (parts.length < 2) {
      await sendTelegramMessage('💼 🕵️‍♂️ <i>[Mateo Oslomany]: Consultando el Radar de Objetivos Ojeados y comparativa de plantilla...</i>');
      try {
        await client.login();
        const squad = await client.getSquad();
        const market = await client.getMarket();
        const marketPlayers = market?.players || [];
        const dashboard = await client.getDashboardData();
        const balance = dashboard?.money || 0;

        const { auditAndSyncScoutingRadar } = await import('./scoutingRadar.js');
        const wishlist = auditAndSyncScoutingRadar(marketPlayers, squad, engine);

        const posEmoji = { keeper: '🧤', defender: '🛡️', midfielder: '⚙️', striker: '⚡' };
        let rep = `🎯 <b>[Mateo Oslomany] · RADAR DE OJEADOS (+35 PTS)</b>\n\n`;
        rep += `💰 <b>Caja libre en tesorería:</b> ${balance.toLocaleString()} €\n\n`;

        const keyboard = [];

        wishlist.forEach((target, idx) => {
          const emoji = posEmoji[target.position] || '👤';
          const onMarket = marketPlayers.find(p => p.name.toLowerCase().includes(target.name.toLowerCase()));
          
          let statusBadge = '⏳ <i>Próxima subasta Computer</i>';
          if (onMarket) {
            statusBadge = `🟢 <b>EN MERCADO (${onMarket.price.toLocaleString()} €)</b>`;
            keyboard.push([
              { text: `🎯 PUJAR ${target.name.toUpperCase()} (${onMarket.price.toLocaleString()} €)`, callback_data: `bid:${onMarket.playerId || onMarket.id}:${onMarket.name}:${onMarket.price}:${target.position}` }
            ]);
          }

          rep += `<b>${idx + 1}. ${emoji} ${escapeHtml(target.fullName || target.name)}</b> (${(target.targetPrice / 1000000).toFixed(2)}M €)\n`;
          rep += `   📈 ~${target.estimatedPts} pts proy. (<b>+${target.netGain || 35} pts</b> vs ${escapeHtml(target.compTarget)})\n`;
          rep += `   📌 Estado: ${statusBadge}\n\n`;
        });

        rep += `<i>💡 <code>/scout &lt;nombre&gt;</code> para análisis profundo de prensa y minutos.</i>`;

        const markup = keyboard.length > 0 ? { inline_keyboard: keyboard } : null;
        await sendTelegramMessage(rep, markup);
      } catch (err) {
        await sendTelegramMessage(`💼 ❌ Error en radar de scouting: <code>${escapeHtml(err.message)}</code>`);
      } finally {
        await client.close();
      }
      return;
    }

    // Si se proporciona un nombre -> Scouting profundo online
    const nameQuery = parts.slice(1).join(' ').trim();
    await sendTelegramMessage(`💼 🕵️ <i>[Mateo Oslomany]: Rastreando prensa deportiva y scouting online para "${escapeHtml(nameQuery)}"...</i>`);

    try {
      await client.login();
      const squad = await client.getSquad();
      const market = await client.getMarket();
      const allPlayers = [...(squad?.players || []), ...(market?.players || [])];
      
      const found = allPlayers.find(p => p.name.toLowerCase().includes(nameQuery.toLowerCase()));
      const targetName = found ? found.name : nameQuery;
      const targetClub = found ? (found.club || found.teamName || '') : '';
      const targetPos = found ? found.type : 'Jugador';

      const { getOnlineScoutingReport } = await import('./scoutIntelligence.js');
      const { evaluateClubCompetition } = await import('./clubCompetition.js');

      const scoutReport = await getOnlineScoutingReport(targetName, targetClub);
      const compReport = evaluateClubCompetition(found || { name: targetName, club: targetClub, type: targetPos });

      let rep = `🕵️ <b>[Informe de Scouting & Titularidad]</b>\n\n` +
        `👤 <b>Jugador:</b> <b>${escapeHtml(targetName)}</b> (${(targetPos || '').toUpperCase()})\n` +
        `🏟️ <b>Club:</b> ${escapeHtml(targetClub || 'LaLiga')}\n` +
        `📊 <b>Probabilidad Titularidad:</b> ${scoutReport.statusEmoji} <b>${scoutReport.starterProbability}%</b> (${scoutReport.statusTag})\n\n`;

      if (scoutReport.alerts.length > 0) {
        rep += `📋 <b>Diagnóstico de Prensa:</b>\n`;
        scoutReport.alerts.forEach(a => { rep += ` • ${a}\n`; });
        rep += `\n`;
      }

      rep += `⚔️ <b>Competencia Interna en su Club:</b>\n` +
        ` • Nivel: <b>${compReport.competitionLevel}</b> | Confianza: <b>${compReport.confidencePct}%</b>\n` +
        ` • Rivales directos: <i>${compReport.directRivals.slice(0, 4).join(', ') || 'Sin rivales directos'}</i>\n` +
        ` • Riesgo de rotación: <i>${compReport.rotationRisk}</i>\n\n`;

      if (scoutReport.headlines.length > 0) {
        rep += `📰 <b>Últimas Noticias & Titulares Rastreados:</b>\n`;
        scoutReport.headlines.slice(0, 4).forEach(h => {
          rep += ` • [${escapeHtml(h.source)}] <b>${escapeHtml(h.title)}</b>\n`;
        });
      }

      await sendTelegramMessage(rep);
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ Error en scouting: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }
  }

  // ── /banquillo o /tendencias ──────────────────────────────────────────────
  else if (text.startsWith('/banquillo') || text.startsWith('/tendencias') || text.startsWith('/suplentes')) {
    const client = new ComunioClient();
    const engine = new ComunioEngine();
    try {
      await client.login();
      const squad = await client.getSquad();
      const lineup = engine.optimizeLineup(squad);
      const startingIds = lineup.starting11.map(p => p.playerId || p.id);

      const { generateBenchAuditReport } = await import('./benchTrendAuditor.js');
      const report = generateBenchAuditReport(squad, startingIds);

      let rep = `🪑 📊 <b>[Auditor de Banquillo & Tendencias]</b>\n\n`;
      rep += `👥 <b>Rendimiento de la Plantilla:</b>\n`;
      rep += ` • ⚽ <b>11 Titular Alineado:</b> ${report.starterPoints} pts\n`;
      rep += ` • 🪑 <b>Banquillo (Suplentes):</b> ${report.benchPoints} pts\n`;
      rep += ` • 🎯 <b>Once Ideal Posible:</b> ${report.optimalPossiblePoints} pts (Formación: ${report.optimalFormation})\n\n`;

      if (report.pointsLostInBench > 0) {
        rep += `⚠️ <b>Puntos Dejados en Banquillo:</b> <code>-${report.pointsLostInBench} pts</code>\n\n`;
      } else {
        rep += `✅ <b>Alineación Perfecta:</b> No se perdieron puntos en el banquillo.\n\n`;
      }

      if (report.missedOpportunities.length > 0) {
        rep += `🔄 <b>Oportunidades de Rotación Detectadas:</b>\n`;
        report.missedOpportunities.slice(0, 3).forEach(opp => {
          rep += ` • <b>${escapeHtml(opp.benchPlayer.name)}</b> (${opp.benchPlayer.points} pts) ➔ superó a <i>${escapeHtml(opp.lowestStarter.name)}</i> (${opp.lowestStarter.points} pts) [<b>+${opp.pointsDiff} pts</b>]\n`;
        });
        rep += `\n`;
      }

      rep += `🔥 <b>Detector de Momentum & Racha:</b>\n`;
      report.trends.slice(0, 6).forEach(t => {
        rep += ` • ${t.trendEmoji} <b>${escapeHtml(t.name)}</b> (${(t.position || '').toUpperCase()} · ${escapeHtml(t.clubName)}): ${t.lastPoints} pts — <i>${t.trendStatus}</i>\n`;
      });

      if (report.recommendations.length > 0) {
        rep += `\n💡 <b>Recomendación Táctica:</b>\n`;
        report.recommendations.forEach(rec => {
          rep += ` • <i>${escapeHtml(rec)}</i>\n`;
        });
      }

      await sendTelegramMessage(rep);
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ Error auditando banquillo: <code>${escapeHtml(e.message)}</code>`);
    } finally {
      await client.close();
    }
  }

  // ── /web ─────────────────────────────────────────────────────────────────
  else if (text.startsWith('/web')) {
    const webUrl = 'https://racing-oslo.cotero91.workers.dev/';
    const rep = `🌐 <b>[Mateo Oslomany] · Centro de Control Web</b>\n\n` +
      `Accede al portal oficial del Racing de Oslo para consultar el análisis en tiempo real, histórico de puntos, plantilla y cotizaciones:\n\n` +
      `🔗 <a href="${webUrl}"><b>Abrir Dashboard de Racing de Oslo</b></a>\n\n` +
      `<i>Desplegado y sincronizado en Cloudflare Pages / Workers.</i>`;
    await sendTelegramMessage(rep);
  }

  else {
    await sendTelegramMessage('💼 ⚠️ <b>[Mateo Oslomany]:</b> Comando no reconocido. Envía /help para ver los comandos válidos.');
  }
}

async function updateTelegramMessageMarkup(chatId, messageId, statusLabel) {
  if (!chatId || !messageId) return;
  try {
    const url = `https://api.telegram.org/bot${telegramToken}/editMessageReplyMarkup`;
    await axios.post(url, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [[
          { text: statusLabel, callback_data: 'done' }
        ]]
      }
    });
  } catch (err) {
    console.error('[DAEMON-TG] Error deshabilitando botones de mensaje:', err.message);
  }
}

async function updateSpecificTelegramButton(callbackQuery, newButtonText, newCallbackData = 'done') {
  const chatId = callbackQuery.message?.chat?.id;
  const messageId = callbackQuery.message?.message_id;
  const oldKeyboard = callbackQuery.message?.reply_markup?.inline_keyboard;

  if (!chatId || !messageId) return;

  if (!oldKeyboard || oldKeyboard.length <= 1) {
    return updateTelegramMessageMarkup(chatId, messageId, newButtonText);
  }

  // Actualizar solo el botón clickeado conservando el resto de opciones
  const updatedKeyboard = oldKeyboard.map(row => {
    return row.map(btn => {
      if (btn.callback_data === callbackQuery.data) {
        return { text: newButtonText, callback_data: newCallbackData };
      }
      return btn;
    });
  });

  try {
    const url = `https://api.telegram.org/bot${telegramToken}/editMessageReplyMarkup`;
    await axios.post(url, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: updatedKeyboard
      }
    });
  } catch (err) {
    console.error('[DAEMON-TG] Error actualizando botón individual:', err.message);
  }
}

// ── MANEJADOR DE BOTONES INLINE (callback_query) ──────────────────────────────

async function handleCallbackQuery(callbackQuery) {
  const chatId = callbackQuery.message?.chat?.id;
  const messageId = callbackQuery.message?.message_id;
  if (chatId?.toString() !== telegramChatId.toString()) return;

  const data = callbackQuery.data || '';
  console.log(`[DAEMON] Callback recibido: "${data}"`);

  // Comandos rápidos desde botones inline
  if (data.startsWith('cmd:')) {
    const cmd = data.replace('cmd:', '');
    await answerCallbackQuery(callbackQuery.id, `⚡ Ejecutando /${cmd}...`);
    await handleTelegramMessage({ text: `/${cmd}`, chat: { id: chatId } });
    return;
  }

  // Formato: "bid:<playerId>:<playerName>:<price>:<position>" o "bid_player:<playerId>:<price>:<playerName>"
  if (data.startsWith('bid:') || data.startsWith('bid_player:')) {
    const parts = data.split(':');
    let playerId, playerName, price, position;
    if (data.startsWith('bid_player:')) {
      [, playerId, price, playerName] = parts;
      position = 'centrocampista';
    } else {
      [, playerId, playerName, price, position] = parts;
    }

    await answerCallbackQuery(callbackQuery.id, '⏳ Procesando puja...');
    await updateSpecificTelegramButton(callbackQuery, `✅ PUJA CONFIRMADA (${parseInt(price).toLocaleString()} €)`);

    const client = new ComunioClient();
    try {
      await client.login();
      const market = await client.getMarket();
      const target = (market?.players || []).find(p => parseInt(p.playerId || p.id) === parseInt(playerId));
      if (!target || !isVerifiedComputerOwner(target)) {
        throw new Error('El objetivo ya no está disponible o su vendedor no es Computer verificado.');
      }
      const exactPrice = target.price;
      const exactName = target.name;
      const success = await client.placeBid(parseInt(playerId), exactName, exactPrice);

      let log = [];
      try { if (fs.existsSync('audit_log.json')) log = JSON.parse(fs.readFileSync('audit_log.json', 'utf-8')); } catch (e) {}
      log.push({ timestamp: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }), action: 'Puja Manual (Botón, precio exacto)', player: exactName, amount: `${exactPrice.toLocaleString()} €`, status: success ? 'Éxito' : 'Fallo' });
      fs.writeFileSync('audit_log.json', JSON.stringify(log.slice(-50), null, 2));

      if (success) {
        await sendTelegramMessage(`💼 ✅ <b>[Mateo Oslomany]:</b> Puja enviada con éxito por <b>${escapeHtml(exactName)}</b> por <b>${exactPrice.toLocaleString()} €</b>.`);

        // Generar comunicado oficial de fichaje en la web
        try {
          const { publishSigningNews } = await import('./imageGen.js');
          await publishSigningNews(exactName, `${exactPrice.toLocaleString()} €`, parseInt(playerId), position || 'centrocampista');
        } catch (e) {
          console.error('[DAEMON] Error publicando noticia de fichaje:', e.message);
        }
      } else {
        await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> Error al enviar la puja por ${escapeHtml(exactName)}.`);
      }
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ Error al procesar puja: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }
  } else if (data.startsWith('ignore:') || data.startsWith('ignore_player:')) {
    const parts = data.split(':');
    const playerId = parts[1];
    const playerName = parts[2] || `Jugador #${playerId}`;
    ignorePlayer(parseInt(playerId));
    await answerCallbackQuery(callbackQuery.id, '✅ Ignorado por 24h');
    await updateSpecificTelegramButton(callbackQuery, `🚫 OPCIÓN IGNORADA`);
    await sendTelegramMessage(`💼 🚫 <b>[Mateo Oslomany]:</b> <b>${escapeHtml(playerName)}</b> añadido a la lista de ignorados por 24h.`);
  } else if (data.startsWith('acc_sale:')) {
    const [, offerId, playerId, price] = data.split(':');
    await answerCallbackQuery(callbackQuery.id, '⏳ Procesando aceptación de venta...');
    await updateSpecificTelegramButton(callbackQuery, `✅ VENTA ACEPTADA (${parseInt(price).toLocaleString()} €)`);

    const client = new ComunioClient();
    try {
      await client.login();
      const squad = await client.getSquad();
      const player = (squad?.players || []).find(p => p.id === parseInt(playerId) || p.playerId === parseInt(playerId));
      const playerName = player?.name || `Jugador #${playerId}`;

      const success = await client.acceptSaleOffer(offerId, playerId, price);
      if (success) {
        await sendTelegramMessage(`💼 ✅ <b>[Mateo Oslomany]:</b> Venta de <b>${playerName}</b> por <b>${parseInt(price).toLocaleString()} €</b> ACEPTADA con éxito.`);
        try {
          const { publishSaleNews } = await import('./imageGen.js');
          await publishSaleNews(playerName, parseInt(price), playerId);
        } catch (e) {
          console.error('[DAEMON-NEWS ERROR]', e.message);
        }
      } else {
        await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> No se pudo procesar la venta de ${playerName} vía API.`);
      }
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ Error procesando venta: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }
  } else if (data.startsWith('rej_sale:')) {
    const [, offerId, playerId] = data.split(':');
    await answerCallbackQuery(callbackQuery.id, '⛔ Venta rechazada');
    await updateSpecificTelegramButton(callbackQuery, `❌ VENTA RECHAZADA`);

    const client = new ComunioClient();
    try {
      await client.login();
      const squad = await client.getSquad();
      const player = (squad?.players || []).find(p => p.id === parseInt(playerId) || p.playerId === parseInt(playerId));
      const playerName = player?.name || `Jugador #${playerId}`;

      await client.removeFromMarket(playerId);
      await sendTelegramMessage(`💼 ⛔ <b>[Mateo Oslomany]:</b> Oferta por <b>${playerName}</b> RECHAZADA. El jugador ha sido retirado del mercado.`);
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ Error al rechazar venta: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }
  } else if (data.startsWith('put_on_sale:')) {
    const [, playerId, playerName, minPrice] = data.split(':');
    await answerCallbackQuery(callbackQuery.id, '⏳ Poniendo en mercado...');
    await updateSpecificTelegramButton(callbackQuery, `✅ EN VENTA (${playerName})`, `delist:${playerId}:${playerName}`);

    const client = new ComunioClient();
    try {
      await client.login();
      const success = await client.sellPlayer(parseInt(playerId), playerName, parseInt(minPrice));
      if (success) {
        await sendTelegramMessage(`💼 ✅ <b>[Mateo Oslomany]:</b> <b>${escapeHtml(playerName)}</b> ha sido puesto en el mercado de Comunio por <b>${parseInt(minPrice).toLocaleString()} €</b>.`);

        try {
          const { publishRumorNews } = await import('./imageGen.js');
          await publishRumorNews(playerName, `Precio de salida: ${parseInt(minPrice).toLocaleString()} €`, parseInt(playerId), false);
        } catch (e) {
          console.error('[DAEMON] Error publicando rumor de salida:', e.message);
        }
      } else {
        await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> No se pudo poner en venta a ${escapeHtml(playerName)}.`);
      }
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ Error al poner en venta: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }
  } else if (data.startsWith('delist:')) {
    const [, playerId, playerName] = data.split(':');
    await answerCallbackQuery(callbackQuery.id, '⏳ Retirando del mercado...');
    await updateSpecificTelegramButton(callbackQuery, `⚪ RETIRADO (${playerName})`, `put_on_sale:${playerId}:${playerName}:160000`);

    const client = new ComunioClient();
    try {
      await client.login();
      const success = await client.removeFromMarket(parseInt(playerId));
      if (success) {
        await sendTelegramMessage(`💼 ✅ <b>[Mateo Oslomany]:</b> <b>${escapeHtml(playerName)}</b> ha sido retirado del mercado de Comunio.`);
      } else {
        await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> No se pudo retirar del mercado a ${escapeHtml(playerName)}.`);
      }
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ Error al retirar del mercado: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }
  } else if (data.startsWith('cancel_bid:')) {
    const [, offerId, playerName, playerId] = data.split(':');
    await answerCallbackQuery(callbackQuery.id, '⏳ Cancelando puja...');
    await updateSpecificTelegramButton(callbackQuery, `❌ PUJA CANCELADA (${playerName})`);

    const client = new ComunioClient();
    try {
      await client.login();
      const success = await client.cancelBid(offerId, playerName, parseInt(playerId || 0));
      if (success) {
        await sendTelegramMessage(`💼 ✅ <b>[Mateo Oslomany]:</b> Puja por <b>${escapeHtml(playerName)}</b> cancelada con éxito.`);
      } else {
        await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> No pude cancelar la puja por ${escapeHtml(playerName)}.`);
      }
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ Error cancelando puja: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }
  }
}

async function registerTelegramCommands() {
  const commands = [
    { command: 'reporte', description: '📊 Dashboard ejecutivo, situación deportiva y tesorería' },
    { command: 'puntos', description: '🏆 Puntos de última jornada, histórico y acumulado' },
    { command: 'plantilla', description: '👥 Censo completo de plantilla (posiciones, minutos, roles)' },
    { command: 'banquillo', description: '🪑 Auditoría de suplentes, puntos perdidos y tendencias' },
    { command: 'alinear', description: '⚽ Pizarra táctica, optimización y guardado del Once Oficial' },
    { command: 'scout', description: '🎯 Radar de ojeados (+35 pts) y prensa deportiva' },
    { command: 'mercado', description: '🛒 Jugadores a la venta, oportunidades y gangas' },
    { command: 'pujas', description: '🛒 Centro unificado de pujas activas y mercado' },
    { command: 'finanzas', description: '💰 Balance, primas oficiales (10k€/pt) y rivales' },
    { command: 'analisis', description: '🕵️‍♂️ Auditoría táctica & oportunidades de mercado' },
    { command: 'ofertas', description: '📩 Ofertas de compra recibidas' },
    { command: 'sugerencias', description: '💡 Sugerencias de venta y descarte' },
    { command: 'rivales', description: '🏆 Clasificación y valor de rivales' },
    { command: 'salud', description: '🏥 Parte médico y ciclo de tarjetas (RFEF)' },
    { command: 'web', description: '🌐 Abrir Sede Digital Oficial' },
    { command: 'help', description: '💼 Ver Centro de Mando Táctico' }
  ];
  try {
    const res = await axios.post(`https://api.telegram.org/bot${telegramToken}/setMyCommands`, { commands });
    if (res.data?.ok) {
      console.log('[DAEMON] ✅ Comandos oficiales con /scout registrados en Telegram API.');
    }
  } catch (err) {
    console.warn('[DAEMON] Error registrando comandos en Telegram:', err.message);
  }
}

// ── LONG POLLING ──────────────────────────────────────────────────────────────

async function startPolling() {
  console.log('[DAEMON] Iniciando escucha de comandos de Telegram (Long Polling v3.5.0)...');
  await registerTelegramCommands();
  await sendTelegramMessage('💼 🟢 <b>[Mateo Oslomany v3.5]:</b> Servicio iniciado y en línea (v3.5.0). Envía <code>/help</code> para ver el Centro de Mando.');

  while (true) {
    try {
      const url = `https://api.telegram.org/bot${telegramToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`;
      const res = await axios.get(url, { timeout: 35000 });
      const updates = res.data.result || [];
      
      for (const update of updates) {
        lastUpdateId = update.update_id;
        if (update.message && update.message.text) {
          await handleTelegramMessage(update.message);
        } else if (update.callback_query) {
          await handleCallbackQuery(update.callback_query);
        }
      }
    } catch (err) {
      console.error('[DAEMON-TG] Error al recibir actualizaciones:', err.message);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

// ── MONITOR DE MERCADO (cada 15 min) ─────────────────────────────────────────

let marketMonitorRunning = false; // Guardia anti-solapamiento

async function auditAndSyncSquadEvents(client, squad, balance, lineupResult = null) {
  try {
    const { exec } = await import('node:child_process');
    exec('node src/syncWeb.mjs', { windowsHide: true }, (err) => {
      if (err) console.warn('[DAEMON-SYNC] Error en syncWeb:', err.message);
      else console.log('[DAEMON-SYNC] ✅ Web y datos de plantilla sincronizados.');
    });
  } catch (syncErr) {
    console.warn('[DAEMON-SYNC] Error ejecutando syncWeb:', syncErr.message);
  }
}

async function runMarketCheck() {
  if (marketMonitorRunning) {
    console.log('[DAEMON-MARKET] Comprobación anterior aún en curso, saltando...');
    return;
  }
  marketMonitorRunning = true;
  console.log('[DAEMON-MARKET] Ejecutando comprobación de mercado...');
  const client = new ComunioClient();
  const engine = new ComunioEngine();
  try {
    await client.login();
    const squad = await client.getSquad();
    const dashboard = await client.getDashboardData();
    const balance = dashboard?.money || 0;

    const result = await checkMarket(client, squad, balance, botPaused);

    // 0. Auditar y auto-descubrir objetivos élite (+35 pts upgrade) para el Radar de Scouting
    try {
      const { auditAndSyncScoutingRadar } = await import('./scoutingRadar.js');
      const marketRaw = await client.getMarket();
      auditAndSyncScoutingRadar(marketRaw?.players || [], squad, engine);
    } catch (scoutErr) {
      console.warn('[DAEMON-SCOUT-SYNC] Error actualizando radar de scouting:', scoutErr.message);
    }

    // 1. PUJAS AUTOMÁTICAS (Exclusivas a Computer y al 100.0% del precio exacto según Reglas 2 y 3)
    for (const bid of result.autoBids) {
      if (botPaused) continue;
      // 🛡️ REGLA 2: COMPRAS EXCLUSIVAS A COMPUTER
      if (!isVerifiedComputerOwner(bid)) {
        console.log(`[DAEMON-MARKET] Omitiendo auto-puja por ${bid.name}: pertenece a un rival (${bid.ownerName}).`);
        continue;
      }

      // 🛡️ REGLA 3: PRECIO EXACTO (0% SOBREPRECIO)
      const exactBidAmount = bid.price;
      const success = await client.placeBid(bid.playerId, bid.name, exactBidAmount);
      if (success) {
        let log = [];
        try { if (fs.existsSync('audit_log.json')) log = JSON.parse(fs.readFileSync('audit_log.json', 'utf-8')); } catch (e) {}
        log.push({ timestamp: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }), action: 'Auto-Puja Computer (Precio Exacto)', player: bid.name, amount: `${exactBidAmount.toLocaleString()} €`, status: 'Éxito' });
        fs.writeFileSync('audit_log.json', JSON.stringify(log.slice(-50), null, 2));

        try {
          const { publishRumorNews } = await import('./imageGen.js');
          await publishRumorNews(bid.name, `Oferta emitida a Computer por ${exactBidAmount.toLocaleString()} € (+${(bid.marginalValue || bid.upgradePoints || 0).toFixed(0)} pts al Once)`, bid.playerId, true);
        } catch (e) {
          console.error('[DAEMON-NEWS ERROR]', e.message);
        }

        const msg = `💼 🤖 <b>[Mateo Oslomany] Auto-Puja a Computer Ejecutada</b>\n\n` +
          `👤 <b>${escapeHtml(bid.name)}</b> (${(bid.type || '').toUpperCase()})\n` +
          `💰 <b>Importe Pujado:</b> <b>${exactBidAmount.toLocaleString()} €</b> (Precio Exacto)\n` +
          `📈 <b>Mejora Real del XI:</b> +${(bid.marginalValue || bid.upgradePoints || 0).toFixed(0)} ptos\n` +
          `📊 <b>Eficiencia:</b> ${bid.efficiency || 0} pts/M€ (Puntuación Estratégica: ${bid.strategicScore || 0}/100)`;
        await sendTelegramMessage(msg);
      }
    }

    // 2. OPERACIONES ESTRATÉGICAS / SALTO CUALITATIVO (Notificación con Botón para Confirmación Humana)
    for (const alert of result.manualAlerts) {
      const posTag = { keeper: '🧤', defender: '🛡️', midfielder: '⚙️', striker: '⚡' }[alert.type] || '👤';
      const sellerTag = alert.isComputer ? 'Computadora' : `<b>${escapeHtml(alert.ownerName)}</b> (Rival)`;
      const exactBidAmount = alert.price;

      const msg = `💼 💎 <b>[Mateo Oslomany] Oportunidad Estratégica Detectada</b>\n\n` +
        `${posTag} <b>${escapeHtml(alert.name)}</b> (${(alert.type || '').toUpperCase()})\n` +
        `👤 <b>Vendedor:</b> ${sellerTag}\n` +
        `💰 <b>Precio de Salida:</b> <b>${exactBidAmount.toLocaleString()} €</b>\n` +
        `🏆 <b>Categoría:</b> ${alert.impactTag}\n` +
        `📈 <b>Mejora Real del XI:</b> +${(alert.marginalValue || alert.upgradePoints || 0).toFixed(0)} ptos\n` +
        `📊 <b>Rendimiento:</b> ~${(alert.expectedPoints || 0).toFixed(0)} ptos (PPM: ${alert.ppm || 0} | Eficiencia: ${alert.efficiency || 0} pts/M€)\n` +
        `💎 <b>Puntuación Estratégica:</b> ${alert.strategicScore || 0}/100\n\n` +
        `💡 <i>${escapeHtml(alert.reason || '')} Saldo actual: ${balance.toLocaleString()} €.</i>`;

      const keyboard = [
        [
          { text: `✅ PUJAR POR ${exactBidAmount.toLocaleString()} €`, callback_data: `bid_player:${alert.playerId}:${exactBidAmount}:${alert.name}` },
          { text: `❌ DESCARTAR`, callback_data: `ignore_player:${alert.playerId}:${alert.name}` }
        ]
      ];
      await sendTelegramMessage(msg, { inline_keyboard: keyboard });
    }

    // 3. AUTO-VENTAS Y AUTO-LISTADO DESACTIVADOS PERMANENTEMENTE
    // Las ventas se realizan exclusivamente de forma MANUAL por el usuario a través de Telegram (/ofertas o /vender).

    // Notificar jugadores desaparecidos del mercado con detalles de traspaso (Precio, Comprador, Vendedor)
    if (result.soldPlayers.length > 0) {
      let txMsg = `🛒 <b>[Monitor Mercado] · Movimientos Registrados</b>\n\n`;
      const transactions = await fetchRecentTransactions(client);
      const { publishSigningNews, insertOrUpdateNews } = await import('./imageGen.js');
      
      for (const p of result.soldPlayers) {
        const tx = transactions.find(t => t.player.toLowerCase().includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(t.player.toLowerCase()));
        if (tx) {
          txMsg += ` • <b>${escapeHtml(tx.player)}</b> — <b>${escapeHtml(tx.price)}</b>\n   <i>Traspasado de ${escapeHtml(tx.seller)} a <b>${escapeHtml(tx.buyer)}</b></i>\n\n`;
          
          // Generar noticia automática si la compra la hizo Racing de Oslo o si fue un fichaje de un rival real (ignorando a Computer)
          try {
            const isMe = tx.buyer.toLowerCase().includes('racing') || tx.buyer.toLowerCase().includes('azfalot');
            const isComputer = tx.buyer.toLowerCase() === 'computer' || tx.buyer.toLowerCase().includes('computadora');

            if (isMe) {
              await publishSigningNews(tx.player, tx.price, p.playerId, p.type || 'defender');
              const rawPrice = parseInt(String(tx.price).replace(/[^\d]/g, ''), 10) || 0;
              if (rawPrice >= 15000000) {
                try {
                  const { postStarSigningAnnouncement } = await import('./comunioCommunityPoster.js');
                  await postStarSigningAnnouncement(tx.player, tx.price, p.playerId, p.type || 'jugador');
                } catch (commErr) {
                  console.warn('[DAEMON] Info post comunidad fichaje:', commErr.message);
                }
              }
            } else if (!isComputer) {
              // Solo publicar si es un mánager rival humano de la comunidad con su escudo oficial
              const { publishRivalTransferNews } = await import('./imageGen.js');
              await publishRivalTransferNews(tx.buyer, tx.seller, tx.player, tx.price, p.playerId);
            }
          } catch (newsErr) {
            console.error('[DAEMON-NEWS] Error publicando transacción:', newsErr.message);
          }
        } else {
          txMsg += ` • <b>${escapeHtml(p.name)}</b> — ${p.price ? p.price.toLocaleString() + ' €' : ''}\n   <i>(Retirado del mercado sin comprador)</i>\n\n`;
        }
      }
      await sendTelegramMessage(txMsg);
    }

    // Auditar cambios de plantilla y nuevos fichajes incorporados
    await auditAndSyncSquadEvents(client, squad, balance);

  } catch (err) {
    console.error('[DAEMON-MARKET] Error en el monitor de mercado:', err.message);
  } finally {
    await client.close();
    marketMonitorRunning = false;
  }
}

// ── ANÁLISIS ESTRATÉGICO INTEGRAL DE PLANTILLA & MERCADO (/analisis) ───────

async function executeStrategicAnalysisReport() {
  await sendTelegramMessage('💼 🕵️‍♂️ <i>[Mateo Oslomany]: Iniciando auditoría y análisis estratégico integral del club y del mercado...</i>');
  const client = new ComunioClient();
  const engine = new ComunioEngine();
  try {
    await client.login();
    const squad = await client.getSquad();
    const dashboard = await client.getDashboardData();
    const rawMarket = await client.getMarket();
    const activeClubs = await getActiveMatchdayClubs(client);

    const balance = dashboard?.money || 0;
    const teamValue = dashboard?.teamValue || 0;
    const players = squad?.players || [];
    const marketPlayers = rawMarket?.players || [];

    const keepers = players.filter(p => p.type === 'keeper');
    const defenders = players.filter(p => p.type === 'defender');
    const midfielders = players.filter(p => p.type === 'midfielder');
    const strikers = players.filter(p => p.type === 'striker');

    const lineup = engine.optimizeLineup(squad, activeClubs);

    let msg = `💼 🕵️‍♂️ <b>[Mateo Oslomany] · AUDITORÍA ESTRATÉGICA INTEGRAL</b>\n\n`;

    // 1. BALANCE DEL CLUB
    msg += `📊 <b>1. Estado Financiero:</b>\n`;
    msg += ` • Caja Disponible: <b>${balance.toLocaleString()} €</b> ${balance >= 0 ? '✅ (Saneado)' : '❌ (En Deuda)'}\n`;
    msg += ` • Valor Plantilla: <b>${teamValue.toLocaleString()} €</b> (${players.length} jug)\n\n`;

    // 2. DIAGNÓSTICO TÁCTICO POR LÍNEAS
    msg += `🛡️ <b>2. Diagnóstico Táctico por Líneas:</b>\n`;
    msg += ` • 🧤 <b>Portería (${keepers.length}/2):</b> ${keepers.map(p => escapeHtml(p.name) + ' (~' + engine.getSeasonProjection(p) + ' pts)').join(', ')} | <i>${keepers.length < 2 ? '⚠️ Falta 1 portero suplente para rotaciones/seguridad.' : 'Línea completa.'}</i>\n`;
    msg += ` • 🛡️ <b>Defensa (${defenders.length}/5):</b> ${defenders.map(p => escapeHtml(p.name) + ' (~' + engine.getSeasonProjection(p) + ' pts)').join(', ')} | <i>${defenders.length < 5 ? 'Recomendable sumar 1 central titular contrastado.' : 'Línea sólida.'}</i>\n`;
    msg += ` • ⚙️ <b>Medular (${midfielders.length}/5):</b> ${midfielders.map(p => escapeHtml(p.name) + ' (~' + engine.getSeasonProjection(p) + ' pts)').join(', ')} | <i>Línea estelar con Valverde y Galarreta.</i>\n`;
    msg += ` • ⚡ <b>Delantera (${strikers.length}/3):</b> ${strikers.map(p => escapeHtml(p.name) + ' (~' + engine.getSeasonProjection(p) + ' pts)').join(', ')} | <i>Dupla goleadora con Gerard Moreno y Hugo Duro.</i>\n\n`;

    // 3. OPORTUNIDADES CLAVE DEL MERCADO
    msg += `🛒 <b>3. Oportunidades Clave del Mercado Hoy (${marketPlayers.length} en venta):</b>\n`;
    const keyboard = [];
    const marketKeepers = marketPlayers.filter(p => p.type === 'keeper').sort((a, b) => a.price - b.price);
    if (marketKeepers.length > 0) {
      const k = marketKeepers[0];
      msg += ` • 🧤 <b>Portero disponible:</b> ${escapeHtml(k.name)} (${(k.price/1000000).toFixed(2)}M €)\n`;
      keyboard.push([{ text: `🧤 PUJAR POR ${k.name.toUpperCase()} (${(k.price/1000000).toFixed(2)}M €)`, callback_data: `bid:${k.playerId || k.id}:${k.name}:${k.price}:keeper` }]);
    }
    const marketDefs = marketPlayers.filter(p => p.type === 'defender' && p.price > 1000000).sort((a, b) => a.price - b.price);
    if (marketDefs.length > 0) {
      const d = marketDefs[0];
      msg += ` • 🛡️ <b>Defensa recomendado:</b> ${escapeHtml(d.name)} (${(d.price/1000000).toFixed(2)}M €)\n`;
      keyboard.push([{ text: `🛡️ PUJAR POR ${d.name.toUpperCase()} (${(d.price/1000000).toFixed(2)}M €)`, callback_data: `bid:${d.playerId || d.id}:${d.name}:${d.price}:defender` }]);
    }
    const marketMids = marketPlayers.filter(p => p.type === 'midfielder' && p.price > 1000000).sort((a, b) => a.price - b.price);
    if (marketMids.length > 0) {
      const m = marketMids[0];
      msg += ` • ⚙️ <b>Centrocampista recomendado:</b> ${escapeHtml(m.name)} (${(m.price/1000000).toFixed(2)}M €)\n`;
      keyboard.push([{ text: `⚙️ PUJAR POR ${m.name.toUpperCase()} (${(m.price/1000000).toFixed(2)}M €)`, callback_data: `bid:${m.playerId || m.id}:${m.name}:${m.price}:midfielder` }]);
    }

    // 4. PLAN DE ACCIÓN
    msg += `\n📋 <b>4. Plan de Acción Inmediato:</b>\n`;
    msg += ` 1️⃣ Mantener en venta los descartes (Kike Barja) para tesorería.\n`;
    msg += ` 2️⃣ Tras liquidar puntos de la jornada, cerrar el 2º portero (Leo Román / Dituro / Szczesny).\n`;
    msg += ` 3️⃣ Once titular guardado (${lineup.formation}) con prioridad a clubes activos.`;

    const markup = keyboard.length > 0 ? { inline_keyboard: keyboard } : null;
    await sendTelegramMessage(msg, markup);

  } catch (err) {
    console.error('[DAEMON-ANALISIS ERROR]', err.message);
    await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> Error en el análisis estratégico: <code>${escapeHtml(err.message)}</code>`);
  } finally {
    await client.close();
  }
}

// ── CRON DIARIO (09:00 · 23:50) ──────────────────────────────────────────────

async function executeInLineupOptimization() {
  console.log('[DAEMON-CRON] Ejecutando optimización de alineación (Flujo Unificado)...');
  const client = new ComunioClient();
  const engine = new ComunioEngine();
  try {
    await client.login();
    const squad = await client.getSquad();
    const dashboard = await client.getDashboardData();
    const balance = dashboard?.money || 0;
    const activeClubs = await getActiveMatchdayClubs(client);
    const lineupResult = engine.optimizeLineup(squad || { players: [] }, activeClubs);
    
    if (lineupResult.starting11 && lineupResult.starting11.length > 0 && await isOfficialLineupSaveAllowed(client)) {
      const startingIds = lineupResult.starting11.map(p => p.playerId || p.id);
      const success = await client.setLineup(startingIds, lineupResult.formation);
      console.log(`[DAEMON-CRON] 11 Titular guardado (${lineupResult.formation}) -> Éxito: ${success}`);
      await sendTelegramMessage(`💼 ⚡ <b>[Mateo Oslomany]:</b> 11 Titular optimizado y guardado en Comunio (Formación: ${lineupResult.formation}).`);
    } else if (lineupResult.starting11 && lineupResult.starting11.length > 0) {
      console.warn('[DAEMON-CRON] Guardado de once bloqueado fuera de la ventana 15–30 min.');
    }

    // Auditar cambios de plantilla, fichajes resueltos y publicar noticias automáticas
    await auditAndSyncSquadEvents(client, squad, balance, lineupResult);

  } catch (e) {
    console.error('[DAEMON-CRON] Error al optimizar alineación:', e.message);
  } finally {
    await client.close();
  }
}

// ── MONITOR DE SALUD Y LESIONES DE LA PLANTILLA ─────────────────────────────
let healthMonitorRunning = false;

async function runSquadHealthCheck() {
  if (healthMonitorRunning) return;
  healthMonitorRunning = true;
  console.log('[DAEMON-HEALTH] Escaneando estado físico y partes médicos de la plantilla...');

  const client = new ComunioClient();
  const engine = new ComunioEngine();

  try {
    await client.login();
    const squad = await client.getSquad();
    const players = squad?.players || [];
    
    const healthCachePath = 'last_squad_health.json';
    let lastHealthState = {};
    if (fs.existsSync(healthCachePath)) {
      try { lastHealthState = JSON.parse(fs.readFileSync(healthCachePath, 'utf-8')); } catch (e) {}
    }

    let healthChangesCount = 0;
    const currentHealthState = {};

    for (const p of players) {
      const pid = p.id || p.playerId;
      const currentStatus = ((p.status || '') + ' ' + (p.statusInfo || '') + ' ' + (p.availability || '')).trim() || 'Disponible';
      currentHealthState[pid] = currentStatus;

      const previousStatus = lastHealthState[pid];

      if (previousStatus && previousStatus !== currentStatus) {
        const isAvailableNow = engine.isPlayerAvailable(p);
        console.log(`[DAEMON-HEALTH] 🩺 Cambio físico detectado en ${p.name}: "${previousStatus}" ➔ "${currentStatus}"`);

        if (!isAvailableNow) {
          healthChangesCount++;
          const msg = `<b>🩺 ALERTA MÉDICA AUTOMÁTICA</b>\n\n` +
            `👤 <b>Jugador:</b> ${p.name} (${p.type || p.position})\n` +
            `📋 <b>Nuevo Estado:</b> <code>${escapeHtml(currentStatus)}</code>\n\n` +
            `⚡ <i>El motor de decisiones procederá a re-optimizar el XI titular para asegurar un Once 100% Disponible.</i>`;
          await sendTelegramMessage(msg);

          try {
            const { publishMedicalNews } = await import('./imageGen.js');
            await publishMedicalNews(p.name, currentStatus, pid);
          } catch (e) {
            console.error('[DAEMON-HEALTH] Error publicando noticia médica:', e.message);
          }
        }
      }
    }

    if (healthChangesCount > 0) {
      console.log(`[DAEMON-HEALTH] Re-calculando el XI ideal tras detectar ${healthChangesCount} cambios físicos...`);
      const activeClubs = await getActiveMatchdayClubs(client);
      const lineupResult = engine.optimizeLineup(squad, activeClubs);
      
      await sendTelegramMessage(
        `<b>⚽ REAJUSTE DE ONCE PROYECTADO TRAS PARTE MÉDICO</b>\n\n` +
        `<b>Formación:</b> ${lineupResult.formation} (~${Math.round(lineupResult.score)} pts esperados)\n\n` +
        `<b>🛡️ ONCE RECOMENDADO SANO:</b>\n` +
        lineupResult.starting11.map(p => ` • <b>${p.name}</b> (${p.expectedPoints} pts)`).join('\n') +
        `\n\n<i>⚠️ La alineación oficial se guardará en Comunio automáticamente 15-30 min antes del kickoff para evitar spam.</i>`
      );

      const { exec } = await import('node:child_process');
      exec('node src/syncWeb.mjs', { windowsHide: true }, (syncErr) => {
        if (syncErr) console.error('[DAEMON-HEALTH] Error en auto-sync web:', syncErr.message);
      });
    }

    fs.writeFileSync(healthCachePath, JSON.stringify(currentHealthState, null, 2));

  } catch (err) {
    console.error('[DAEMON-HEALTH] Error escaneando salud de la plantilla:', err.message);
  } finally {
    await client.close();
    healthMonitorRunning = false;
  }
}

let lastPreMatchdayTriggeredKey = null;
let lastDailyTriggeredSlots = {};
let todayMorningRandomSlot = null;
let todayMorningDate = null;

function getTodayMorningSlot(config, todayDateStr) {
  if (todayMorningDate !== todayDateStr || !todayMorningRandomSlot) {
    todayMorningDate = todayDateStr;
    const morningCfg = config.morningRandomSlot || { hour: 9, minMinute: 5, maxMinute: 25 };
    const randomMinute = Math.floor(Math.random() * (morningCfg.maxMinute - morningCfg.minMinute + 1)) + morningCfg.minMinute;
    todayMorningRandomSlot = `${(morningCfg.hour || 9).toString().padStart(2, '0')}:${randomMinute.toString().padStart(2, '0')}`;
    console.log(`[DAEMON-SCHEDULER] 🎲 Franja matutina aleatoria para hoy (${todayDateStr}) fijada a las ${todayMorningRandomSlot}h (ventana 09:05 - 09:25).`);
  }
  return todayMorningRandomSlot;
}

function getScheduleConfig() {
  try {
    if (fs.existsSync('config.json')) {
      const cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'));
      return {
        dailySlots: cfg.schedule?.dailySlots || ['18:00', '23:50'],
        morningRandomSlot: cfg.schedule?.morningRandomSlot || { enabled: true, hour: 9, minMinute: 5, maxMinute: 25 },
        preMatchdayMinutes: cfg.schedule?.preMatchdayMinutesBeforeKickoff || 60,
        enabled: cfg.schedule?.enabled !== false
      };
    }
  } catch (e) {}
  return { 
    dailySlots: ['18:00', '23:50'], 
    morningRandomSlot: { enabled: true, hour: 9, minMinute: 5, maxMinute: 25 },
    preMatchdayMinutes: 60, 
    enabled: true 
  };
}

// ── PLANIFICADOR CONFIGURABLE (HORAS FIJAS + MATUTINO ALEATORIO + PRE-JORNADA DINÁMICO) ────────────
function startCronScheduler() {
  const sched = getScheduleConfig();
  console.log(`[DAEMON] Iniciando planificador: Fijos [${sched.dailySlots.join(', ')}] + Matutino Aleatorio (09:05-09:25) + ${sched.preMatchdayMinutes} min antes de cada jornada.`);
  
  setInterval(async () => {
    const config = getScheduleConfig();
    if (!config.enabled || botPaused) return;

    const now = new Date();
    const madridTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
    const hours = madridTime.getHours();
    const minutes = madridTime.getMinutes();
    const currentTimeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    const todayDateStr = madridTime.toISOString().slice(0, 10);

    // 1. Comprobar franjas diarias fijas configuradas con bloqueo diario único
    let isDailySlot = false;
    if (config.dailySlots.includes(currentTimeStr)) {
      if (lastDailyTriggeredSlots[currentTimeStr] !== todayDateStr) {
        isDailySlot = true;
        lastDailyTriggeredSlots[currentTimeStr] = todayDateStr;
      }
    }

    // 1.1 Comprobar franja matutina aleatoria diaria (ej: entre 09:05 y 09:25)
    let isMorningRandomSlot = false;
    if (config.morningRandomSlot?.enabled !== false) {
      const scheduledMorning = getTodayMorningSlot(config, todayDateStr);
      if (currentTimeStr === scheduledMorning && lastDailyTriggeredSlots['morning_random'] !== todayDateStr) {
        isMorningRandomSlot = true;
        lastDailyTriggeredSlots['morning_random'] = todayDateStr;
        console.log(`[DAEMON-SCHEDULER] 🎲 Activando ejecución matutina aleatoria programada para las ${scheduledMorning}h.`);
      }
    }

    // 2. Comprobar disparo dinámico previo al inicio de jornada (ej: 60 min antes del kickoff)
    let isPreMatchdaySlot = false;
    try {
      if (minutes % 5 === 0) {
        const { getNextMatchdayInfo } = await import('./comunioNewsConsumer.js');
        const client = new ComunioClient();
        await client.login();
        const info = await getNextMatchdayInfo(client);
        await client.close();

        if (info.kickoffDate) {
          const diffMinutes = Math.round((info.kickoffDate.getTime() - now.getTime()) / (1000 * 60));
          if (isWithinPreMatchdayWindow(diffMinutes, 15, 30) && lastPreMatchdayTriggeredKey !== info.nextMatchday) {
            isPreMatchdaySlot = true;
            lastPreMatchdayTriggeredKey = info.nextMatchday;
            console.log(`[DAEMON-CRON] 🚨 Alerta Pre-Jornada detectada: Quedan ${diffMinutes} min para el kickoff de la Jornada ${info.nextMatchday}.`);
          }
        }
      }
    } catch (err) {}

    if (isDailySlot || isMorningRandomSlot || isPreMatchdaySlot) {
      console.log(`[DAEMON-CRON] ⏰ Ventana de ejecución activada (${currentTimeStr} | Pre-Jornada: ${isPreMatchdaySlot ? 'SÍ' : 'NO'}). Ejecutando operativa...`);

      // 1. Ejecutar escáner y acciones de mercado / ofertas recibidas
      await runMarketCheck();

      // 2. Escaneo de salud y bajas físicas
      await runSquadHealthCheck();

      // 3. Sincronización con el portal web
      console.log('[DAEMON-CRON] Sincronizando datos con la web y portal...');
      const { exec } = await import('node:child_process');
      exec('node src/syncWeb.mjs', { windowsHide: true }, (syncErr) => {
         if (syncErr) console.error('[DAEMON-CRON] Error sincronizando web:', syncErr.message);
         else console.log('[DAEMON-CRON] Web sincronizada con éxito.');
      });

      // 4. Modo Sigilo: Desactivada la publicación automática diaria en Comunio para evitar spam y mantener perfil bajo.

      // 5. EXCLUSIVO PRE-JORNADA (15-30 min antes del kickoff): Guardado Oficial del Once y Pronóstico
      if (isPreMatchdaySlot) {
        console.log(`[DAEMON-CRON] 🎯 Ventana Pre-Jornada: Guardando Once Oficial y emitiendo pronóstico definitivo...`);
        await executeInLineupOptimization();

        try {
          const { recordMatchdayPrediction } = await import('./matchdayPredictionAuditor.js');
          const client = new ComunioClient();
          const engine = new ComunioEngine();
          await client.login();
          const currentSquad = await client.getSquad();
          const activeClubs = await getActiveMatchdayClubs(client);
          const lineupRes = engine.optimizeLineup(currentSquad, activeClubs);
          await client.close();

          await recordMatchdayPrediction(3, `Jornada 3`, lineupRes);
        } catch (predErr) {
          console.warn('[DAEMON-CRON] Info registro predicción:', predErr.message);
        }
      }
    }
  }, 60 * 1000);
}

// ── ARRANQUE ──────────────────────────────────────────────────────────────────

startPolling();
startCronScheduler();


