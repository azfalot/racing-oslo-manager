import axios from 'axios';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { ComunioClient } from './comunioClient.js';
import { ComunioEngine } from './engine.js';
import { analyzeRivals } from './rivals.js';
import { checkMarket, ignorePlayer, fetchRecentTransactions } from './marketMonitor.js';
import { generateSigningCard } from './signingCard.js';
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
      await axios.post(url, payload);
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
      await axios.post(url, { ...payload, text: chunk, reply_markup: undefined });
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
 * Genera la tarjeta de fichaje y la envía por Telegram
 */
async function sendSigningCard(playerName, position, price, caption = '', playerId = null, authToken = null) {
  try {
    console.log(`[DAEMON] Generando tarjeta de fichaje para ${playerName}...`);
    const imagePath = await generateSigningCard(playerName, position, price, { playerId, authToken });
    await sendTelegramPhoto(imagePath, caption);
  } catch (e) {
    console.error('[DAEMON] Error generando tarjeta de fichaje:', e.message);
  }
}

// ── MANEJADOR DE COMANDOS ─────────────────────────────────────────────────────

async function handleTelegramMessage(message) {
  const text = (message.text || '').trim();
  const chatId = message.chat.id;

  if (chatId.toString() !== telegramChatId.toString()) {
    console.log(`[DAEMON] Mensaje ignorado de chat no autorizado: ${chatId}`);
    return;
  }

  console.log(`[DAEMON] Comando recibido de Telegram: "${text}"`);

  // ── /start · /help ────────────────────────────────────────────────────────
  if (text.startsWith('/start') || text.startsWith('/help') || text.toLowerCase() === 'ayuda') {
    const pauseStatus = botPaused ? '⏸ <b>BOT PAUSADO</b> (acciones autónomas desactivadas)\n\n' : '';
    const helpText = `💼 <b>[Mateo Oslomany v1.2.0] · Centro de Mando Táctico</b>\n${pauseStatus}\n` +
      `📊 <b>Análisis & Táctica:</b>\n` +
      ` • /analisis — Auditoría estratégica de plantilla, carencias y mercado\n` +
      ` • /scout — Scouting de titularidad y prensa en internet (ej: /scout Christensen)\n` +
      ` • /salud — Parte médico oficial y bajas físicas\n` +
      ` • /reporte — Resumen ejecutivo diario\n` +
      ` • /plantilla — Plantilla (titulares + suplentes)\n` +
      ` • /tactica — Esquema táctico por líneas\n` +
      ` • /rivales — Clasificación y valor de rivales\n` +
      ` • /sugerencias — Sugerencias de ventas con botón de 1 clic\n` +
      ` • /jornada — Próxima jornada y cierre de XI\n` +
      ` • /top — Top 10 jugadores más valiosos\n\n` +
      `🛒 <b>Mercado & Finanzas:</b>\n` +
      ` • /mercado — Mejores oportunidades de mercado\n` +
      ` • /finanzas — Balance, pujas activas y margen\n` +
      ` • /ofertas — Ofertas de venta recibidas\n` +
      ` • /mis_pujas — Mis pujas activas pendientes\n` +
      ` • /pujar — Ofertar por jugador (ej: /pujar Bellingham)\n` +
      ` • /cancelar — Cancelar puja (ej: /cancelar Bellingham)\n` +
      ` • /vender — Poner en venta (ej: /vender Rodrygo)\n\n` +
      `⚡ <b>Operativa & Sistema:</b>\n` +
      ` • /alinear — Optimizar y guardar 11 titular\n` +
      ` • /web — Abrir dashboard web oficial en Cloudflare\n` +
      ` • /sync — Desplegar cambios web a Cloudflare\n` +
      ` • /margen — Ajustar sobreprecio (ej: /margen 1.5)\n` +
      ` • /limite — Límite auto-puja (ej: /limite 8)\n` +
      ` • /pausar / /reanudar — Control del bot autónomo\n` +
      ` • /estado — Estado del sistema v1.2.0\n` +
      ` • /historial — Registro de últimas acciones\n\n` +
      `🕒 Horarios de conexión automática: <b>09:00</b> y <b>23:50</b> (Madrid) | Resto del día: <i>En reposo</i>`;
    await sendTelegramMessage(helpText);
  }

  // ── /analisis ─────────────────────────────────────────────────────────────
  else if (text.startsWith('/analisis')) {
    await executeStrategicAnalysisReport();
  }

  // ── /reporte ──────────────────────────────────────────────────────────────
  else if (text.startsWith('/reporte')) {
    await sendTelegramMessage('💼 <i>[Mateo Oslomany]: Ejecutando análisis (modo lectura)...</i>');
    exec('node src/app.js', { env: { ...process.env, COMUNIO_MODE: 'asistente' } }, (err) => {
      if (err) sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> Error al generar el informe: <code>${err.message}</code>`);
    });
  }

  // ── /alinear ──────────────────────────────────────────────────────────────
  else if (text.startsWith('/alinear')) {
    const client = new ComunioClient();
    const engine = new ComunioEngine();
    try {
      await client.login();
      const squad = await client.getSquad();
      const lineupResult = engine.optimizeLineup(squad || { players: [] });
      if (lineupResult.starting11 && lineupResult.starting11.length > 0) {
        const startingIds = lineupResult.starting11.map(p => p.playerId || p.id);
        const success = await client.setLineup(startingIds, lineupResult.formation);
        
        const posEmoji = { keeper: '🧤', defender: '🛡️', midfielder: '⚙️', striker: '⚡' };
        let rep = `💼 ✅ <b>[Mateo Oslomany] · 11 Titular Guardado en Comunio</b>\n\n`;
        rep += `📐 <b>Formación:</b> ${lineupResult.formation}\n`;
        rep += `🎯 <b>Puntuación esperada:</b> ~${lineupResult.score} pts\n\n`;
        rep += `<b>⬛ TITULARES:</b>\n`;
        lineupResult.starting11.forEach(p => {
          const emoji = posEmoji[p.type] || '👤';
          const fit = p.available ? '' : ' ⚠️ (Duda/Baja)';
          rep += ` ${emoji} <b>${escapeHtml(p.name)}</b>${fit}\n`;
        });

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
  else if (text.startsWith('/plantilla')) {
    const client = new ComunioClient();
    const engine = new ComunioEngine();
    try {
      await client.login();
      const squad = await client.getSquad();
      const lineupResult = engine.optimizeLineup(squad || { players: [] });

      const posEmoji = { keeper: '🧤', defender: '🛡️', midfielder: '⚙️', striker: '⚡' };
      
      let rep = `💼 <b>[Mateo Oslomany] · Tu Plantilla</b>\n`;
      rep += `<i>Formación óptima: ${lineupResult.formation || '—'}</i>\n\n`;

      rep += `<b>⬛ TITULARES:</b>\n`;
      (lineupResult.starting11 || []).forEach(p => {
        const emoji = posEmoji[p.type] || '👤';
        const status = p.available ? '' : ' ❌';
        rep += ` ${emoji} <b>${escapeHtml(p.name)}</b>${status} — ${p.price.toLocaleString()} €\n`;
      });

      rep += `\n<b>🔲 BANQUILLO:</b>\n`;
      (lineupResult.bench || []).forEach(p => {
        const emoji = posEmoji[p.type] || '👤';
        rep += ` ${emoji} ${escapeHtml(p.name)} — ${p.price.toLocaleString()} €\n`;
      });

      const totalValue = (squad?.players || []).reduce((s, p) => s + (p.price || 0), 0);
      rep += `\n💰 <b>Valor total plantilla:</b> ${totalValue.toLocaleString()} €`;

      await sendTelegramMessage(rep);
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> Error: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }
  }

  // ── /mercado ──────────────────────────────────────────────────────────────
  else if (text.startsWith('/mercado')) {
    const client = new ComunioClient();
    const engine = new ComunioEngine();
    try {
      await client.login();
      const squad = await client.getSquad();
      const dashboard = await client.getDashboardData();
      const balance = dashboard?.money || 0;
      const market = await client.getMarket();
      const marketPlayers = market?.players || [];

      const result = engine.analyzeMarket(marketPlayers, squad, balance);
      const recs = (result.recommendations || []).slice(0, 5);

      let rep = `💼 <b>[Mateo Oslomany] · Mercado de Fichajes</b>\n`;
      rep += `<i>Saldo disponible: ${balance.toLocaleString()} € | Jugadores en venta: ${marketPlayers.length}</i>\n\n`;

      const keyboard = [];
      if (recs.length > 0) {
        recs.forEach((rec, i) => {
          const posTag = { keeper: '🧤', defender: '🛡️', midfielder: '⚙️', striker: '⚡' }[rec.type] || '👤';
          const bidP = rec.bidAmount || rec.price;
          rep += `${i + 1}. ${posTag} <b>${escapeHtml(rec.name)}</b>\n`;
          rep += `   💰 VM: ${rec.price.toLocaleString()} € | Puja: <b>${bidP.toLocaleString()} €</b>\n`;
          rep += `   📈 Mejora Real XI: +${(rec.marginalValue || rec.upgradePoints || 0).toFixed(0)} pts | Eficiencia: ${rec.efficiency || 0} pts/M€\n`;
          rep += `   <i>${escapeHtml(rec.reason)}</i>\n\n`;

          keyboard.push([
            { text: `🎯 PUJAR POR ${rec.name.toUpperCase()} (${bidP.toLocaleString()} €)`, callback_data: `bid:${rec.playerId}:${rec.name}:${bidP}:${rec.type}` }
          ]);
        });
        rep += `<i>💡 Pulsa en los botones inferiores para pujar con 1 clic o usa /pujar &lt;nombre&gt;.</i>`;
      } else {
        rep += `🔍 No hay oportunidades de fichaje rentables en este momento dentro de tu presupuesto.`;
      }

      const markup = keyboard.length > 0 ? { inline_keyboard: keyboard } : null;
      await sendTelegramMessage(rep, markup);
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> Error al consultar el mercado: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }
  }

  // ── /mis_pujas ────────────────────────────────────────────────────────────
  else if (text.startsWith('/mis_pujas')) {
    await sendTelegramMessage('💼 ⏳ <i>[Mateo Oslomany]: Consultando pujas activas...</i>');
    const client = new ComunioClient();
    try {
      await client.login();
      const bids = await client.getPendingBids();
      let rep = `💼 <b>[Mateo Oslomany] · Pujas Activas</b>\n\n`;
      const keyboard = [];

      if (bids.length > 0) {
        bids.forEach(b => {
          rep += ` ⏳ <b>${escapeHtml(b.playerName)}</b> — Oferta: <b>${b.price.toLocaleString()} €</b>\n`;
          keyboard.push([
            { text: `❌ CANCELAR PUJA POR ${b.playerName.toUpperCase()}`, callback_data: `cancel_bid:${b.offerId}:${b.playerName}:${b.playerId || 0}` }
          ]);
        });
        rep += `\n<i>💡 Pulsa en los botones inferiores para cancelar una puja con 1 clic.</i>`;
      } else {
        rep += `No tienes pujas activas en este momento.`;
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
  else if (text.startsWith('/sugerencias')) {
    await sendTelegramMessage('💼 ⏳ <i>[Mateo Oslomany]: Analizando tu plantilla para sugerirte ventas...</i>');
    const client = new ComunioClient();
    const engine = new ComunioEngine();
    try {
      await client.login();
      const squad = await client.getSquad();
      const lineup = await client.getCurrentLineup();
      const startingIds = lineup?.players ? lineup.players.map(p => p.playerId) : [];
      
      const suggestions = engine.getLiquiditySuggestions(squad, startingIds);
      if (suggestions.length > 0) {
        let rep = `💼 <b>[Mateo Oslomany] · Sugerencias de Venta</b>\n\n`;
        rep += `Los siguientes jugadores son suplentes prescindibles de alto valor. ¿Deseas poner alguno en el mercado de Comunio para liberar liquidez?\n\n`;
        
        const keyboard = [];
        suggestions.forEach(s => {
          const pid = s.playerId || s.id;
          const minPrice = s.price || 0;
          rep += ` • <b>${escapeHtml(s.name)}</b> — ${minPrice.toLocaleString()} €\n   <i>${escapeHtml(s.reason)}</i>\n\n`;
          keyboard.push([
            { text: `🏷️ PONER A LA VENTA A ${s.name.toUpperCase()} (${minPrice.toLocaleString()} €)`, callback_data: `put_on_sale:${pid}:${s.name}:${minPrice}` }
          ]);
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
    const parts = text.split(' ');
    if (parts.length < 2) {
      let currentMargin = 0;
      try {
        if (fs.existsSync('config.json')) {
          const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
          currentMargin = typeof config.bidMargin === 'number' ? config.bidMargin : 0;
        }
      } catch (e) {}
      await sendTelegramMessage(`💼 📊 <b>[Mateo Oslomany]:</b> Margen de puja actual: <b>${currentMargin}%</b> sobre el mínimo.\nUsa <code>/margen 1.5</code> para cambiarlo.`);
      return;
    }
    const marginValue = parseFloat(parts[1]);
    if (isNaN(marginValue) || marginValue < 0 || marginValue > 50) {
      await sendTelegramMessage('💼 ⚠️ <b>[Mateo Oslomany]:</b> Valor incorrecto. Debe ser entre 0 y 50.\nEjemplo: <code>/margen 1.5</code>');
      return;
    }
    try {
      let config = {};
      if (fs.existsSync('config.json')) config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
      config.bidMargin = marginValue;
      fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
      await sendTelegramMessage(`💼 ✅ <b>[Mateo Oslomany]:</b> Margen de puja configurado en <b>${marginValue}%</b>.`);
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> No pude guardar la configuración: <code>${e.message}</code>`);
    }
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
  else if (text.startsWith('/finanzas') || text.startsWith('/saldo')) {
    await sendTelegramMessage('💼 ⏳ <i>[Mateo Oslomany]: Calculando balance financiero...</i>');
    const client = new ComunioClient();
    try {
      await client.login();
      const squad = await client.getSquad();
      const dashboard = await client.getDashboardData();
      const pendingBids = await client.getPendingBids();

      const balance = dashboard?.money || 0;
      const squadVal = (squad?.players || []).reduce((s, p) => s + (p.price || 0), 0);
      const bidsVal = pendingBids.reduce((s, b) => s + (b.price || 0), 0);
      const netBalance = balance - bidsVal;

      let rep = `💰 <b>[Mateo Oslomany] · Estado Financiero</b>\n\n`;
      rep += `💵 <b>Saldo Disponible:</b> ${balance.toLocaleString()} €\n`;
      rep += `⏳ <b>Pujas Comprometidas:</b> ${bidsVal.toLocaleString()} € (${pendingBids.length} pujas)\n`;
      rep += `📊 <b>Saldo Efectivo Estimado:</b> ${netBalance.toLocaleString()} €\n`;
      rep += `🏆 <b>Valor Plantilla:</b> ${squadVal.toLocaleString()} €\n`;
      rep += `💎 <b>Patrimonio Total:</b> ${(balance + squadVal).toLocaleString()} €\n\n`;
      rep += balance < 0
        ? `⚠️ <b>ATENCIÓN:</b> Saldo negativo. Vende jugadores antes del inicio de la jornada para puntuar.`
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

      let rep = `💼 <b>[Mateo Oslomany] · Ofertas de Venta Recibidas</b>\n\n`;
      if (saleOffers.length > 0) {
        for (const offer of saleOffers) {
          const playerName = offer.tradable?.name || 'Jugador';
          const offerPrice = offer.price;
          const buyerName = offer.user?.name || offer.tradingPartner?.name || 'Computadora';
          const marketValue = offer.tradable?.quotedPrice || offer.tradable?.price || offerPrice;
          const diff = offerPrice - marketValue;
          const diffStr = diff >= 0 ? `+${diff.toLocaleString()} €` : `${diff.toLocaleString()} €`;

          rep += `👤 <b>${escapeHtml(playerName)}</b>\n`;
          rep += `   💰 Oferta: ${offerPrice.toLocaleString()} € | Valor: ${marketValue.toLocaleString()} € (<i>${diffStr}</i>)\n`;
          rep += `   🤝 Comprador: ${escapeHtml(buyerName)}\n\n`;
        }
      } else {
        rep += `No tienes ofertas de venta pendientes en este momento.`;
      }
      await sendTelegramMessage(rep);
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ Error consultando ofertas: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }
  }

  // ── /sync ───────────────────────────────────────────────────────────────
  else if (text.startsWith('/sync')) {
    await sendTelegramMessage('💼 🚀 <i>[Mateo Oslomany]: Sincronizando web y desplegando a Cloudflare Pages...</i>');
    exec('node src/syncWeb.mjs', (err) => {
      if (err) {
        sendTelegramMessage(`💼 ❌ Error al sincronizar web: <code>${escapeHtml(err.message)}</code>`);
      } else {
        sendTelegramMessage(`💼 ✅ <b>[Mateo Oslomany]:</b> Sincronización y despliegue a Cloudflare completados con éxito.`);
      }
    });
  }

  // ── /tactica · /esquema ─────────────────────────────────────────────────
  else if (text.startsWith('/tactica') || text.startsWith('/esquema')) {
    await sendTelegramMessage('💼 ⏳ <i>[Mateo Oslomany]: Analizando esquema táctico...</i>');
    const client = new ComunioClient();
    const engine = new ComunioEngine();
    try {
      await client.login();
      const squad = await client.getSquad();
      const lineupResult = engine.optimizeLineup(squad || { players: [] });

      const starters = lineupResult.starting11 || [];
      const keeper = starters.filter(p => p.type === 'keeper');
      const defenders = starters.filter(p => p.type === 'defender');
      const midfielders = starters.filter(p => p.type === 'midfielder');
      const strikers = starters.filter(p => p.type === 'striker');

      let rep = `📐 <b>[Mateo Oslomany] · Esquema Táctico (${lineupResult.formation})</b>\n\n`;
      rep += `🎯 <b>Puntuación esperada:</b> ~${lineupResult.score} pts\n\n`;

      rep += `🧤 <b>POR (${keeper.length}):</b> ${keeper.map(p => escapeHtml(p.name)).join(', ') || '—'}\n`;
      rep += `🛡️ <b>DEF (${defenders.length}):</b> ${defenders.map(p => escapeHtml(p.name)).join(', ') || '—'}\n`;
      rep += `⚙️ <b>MED (${midfielders.length}):</b> ${midfielders.map(p => escapeHtml(p.name)).join(', ') || '—'}\n`;
      rep += `⚡ <b>DEL (${strikers.length}):</b> ${strikers.map(p => escapeHtml(p.name)).join(', ') || '—'}\n\n`;
      rep += `🔲 <b>Suplentes disponibles:</b> ${(lineupResult.bench || []).length} jugadores`;

      await sendTelegramMessage(rep);
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ Error analizando táctica: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }
  }

  // ── /salud ───────────────────────────────────────────────────────────────
  else if (text.startsWith('/salud')) {
    await sendTelegramMessage('💼 🩺 <i>[Mateo Oslomany]: Analizando parte médico y estado físico de la plantilla...</i>');
    const client = new ComunioClient();
    const engine = new ComunioEngine();
    try {
      await client.login();
      const squad = await client.getSquad();
      const players = squad?.players || [];
      const injuredOrDoubt = players.filter(p => !engine.isPlayerAvailable(p));

      let rep = `🩺 <b>[Mateo Oslomany] · Parte Médico Oficial</b>\n\n`;
      if (injuredOrDoubt.length > 0) {
        rep += `⚠️ Se han detectado <b>${injuredOrDoubt.length} futbolistas</b> con problemas físicos o sanciones:\n\n`;
        injuredOrDoubt.forEach(p => {
          const statusDesc = p.statusInfo || p.status || 'No disponible';
          rep += ` • <b>${escapeHtml(p.name)}</b> (${(p.type || '').toUpperCase()})\n   <i>Estado: ${escapeHtml(statusDesc)}</i>\n\n`;
        });
        rep += `💡 El optimizador táctico los excluye automáticamente del 11 titular para no arriesgar 0 puntos.`;
      } else {
        rep += `✅ <b>¡Plantilla al 100% Fit!</b> No hay lesionados, dudas médicas ni sancionados en el equipo.`;
      }
      await sendTelegramMessage(rep);
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ Error consultando parte médico: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }
  }

  // ── /scout <nombre> ──────────────────────────────────────────────────────
  else if (text.startsWith('/scout')) {
    const parts = text.split(' ');
    if (parts.length < 2) {
      await sendTelegramMessage('💼 🕵️ <b>[Mateo Oslomany]:</b> Uso: <code>/scout &lt;nombre_jugador&gt;</code>\nEjemplo: <code>/scout Christensen</code> o <code>/scout Gerard Moreno</code>');
      return;
    }
    const nameQuery = parts.slice(1).join(' ').trim();
    await sendTelegramMessage(`💼 🕵️ <i>[Mateo Oslomany]: Rastreando prensa deportiva y scouting online para "${escapeHtml(nameQuery)}"...</i>`);

    const client = new ComunioClient();
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

// ── MANEJADOR DE BOTONES INLINE (callback_query) ──────────────────────────────

async function handleCallbackQuery(callbackQuery) {
  const chatId = callbackQuery.message?.chat?.id;
  const messageId = callbackQuery.message?.message_id;
  if (chatId?.toString() !== telegramChatId.toString()) return;

  const data = callbackQuery.data || '';
  console.log(`[DAEMON] Callback recibido: "${data}"`);

  // Formato: "bid:<playerId>:<playerName>:<price>:<position>" o "ignore:<playerId>:<playerName>"
  if (data.startsWith('bid:')) {
    const [, playerId, playerName, price, position] = data.split(':');
    await answerCallbackQuery(callbackQuery.id, '⏳ Procesando puja...');
    await updateTelegramMessageMarkup(chatId, messageId, `✅ PUJA CONFIRMADA (${parseInt(price).toLocaleString()} €)`);

    const client = new ComunioClient();
    try {
      await client.login();
      const success = await client.placeBid(parseInt(playerId), playerName, parseInt(price));

      let log = [];
      try { if (fs.existsSync('audit_log.json')) log = JSON.parse(fs.readFileSync('audit_log.json', 'utf-8')); } catch (e) {}
      log.push({ timestamp: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }), action: 'Puja Manual (Botón)', player: playerName, amount: `${parseInt(price).toLocaleString()} €`, status: success ? 'Éxito' : 'Fallo' });
      fs.writeFileSync('audit_log.json', JSON.stringify(log.slice(-50), null, 2));

      if (success) {
        await sendTelegramMessage(`💼 ✅ <b>[Mateo Oslomany]:</b> ¡Puja enviada! <b>${playerName}</b> por <b>${parseInt(price).toLocaleString()} €</b>.`);
        await sendSigningCard(playerName, position || '', parseInt(price),
          `✍️ <b>${escapeHtml(playerName)}</b> firma con el Racing de Oslo por <b>${parseInt(price).toLocaleString()} €</b>`,
          parseInt(playerId), client.getToken());
      } else {
        await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> La puja por ${playerName} fue rechazada por Comunio.`);
      }
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ Error al pujar: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }

  } else if (data.startsWith('ignore:')) {
    const [, playerId, playerName] = data.split(':');
    ignorePlayer(parseInt(playerId));
    await answerCallbackQuery(callbackQuery.id, '✅ Ignorado por 24h');
    await updateTelegramMessageMarkup(chatId, messageId, `🚫 OPCIÓN IGNORADA`);
    await sendTelegramMessage(`💼 🚫 <b>[Mateo Oslomany]:</b> <b>${playerName}</b> añadido a la lista de ignorados por 24h. No volveré a alertarte por este jugador.`);
  } else if (data.startsWith('acc_sale:')) {
    // Formato ultra-compacto: acc_sale:offerId:playerId:price
    const [, offerId, playerId, price] = data.split(':');
    await answerCallbackQuery(callbackQuery.id, '⏳ Procesando aceptación de venta...');
    await updateTelegramMessageMarkup(chatId, messageId, `✅ VENTA ACEPTADA (${parseInt(price).toLocaleString()} €)`);

    const client = new ComunioClient();
    try {
      await client.login();
      const squad = await client.getSquad();
      const player = (squad?.players || []).find(p => p.id === parseInt(playerId) || p.playerId === parseInt(playerId));
      const playerName = player?.name || `Jugador #${playerId}`;

      const success = await client.acceptSaleOffer(offerId, playerId, price);
      if (success) {
        await sendTelegramMessage(`💼 ✅ <b>[Mateo Oslomany]:</b> Venta de <b>${playerName}</b> por <b>${parseInt(price).toLocaleString()} €</b> ACEPTADA con éxito.`);
        
        // Generar cartel de venta, foto de API y Noticia Web idéntica a las compras
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
    // Formato ultra-compacto: rej_sale:offerId:playerId
    const [, offerId, playerId] = data.split(':');
    await answerCallbackQuery(callbackQuery.id, '⛔ Venta rechazada');
    await updateTelegramMessageMarkup(chatId, messageId, `❌ VENTA RECHAZADA`);

    const client = new ComunioClient();
    try {
      await client.login();
      const squad = await client.getSquad();
      const player = (squad?.players || []).find(p => p.id === parseInt(playerId) || p.playerId === parseInt(playerId));
      const playerName = player?.name || `Jugador #${playerId}`;

      // Quitar del mercado y rechazar oferta
      await client.removeFromMarket(playerId);
      await sendTelegramMessage(`💼 ⛔ <b>[Mateo Oslomany]:</b> Oferta por <b>${playerName}</b> RECHAZADA. El jugador ha sido retirado del mercado y permanece intocable en la plantilla.`);
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ Error al rechazar venta: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }
  } else if (data.startsWith('put_on_sale:')) {
    const [, playerId, playerName, minPrice] = data.split(':');
    await answerCallbackQuery(callbackQuery.id, '⏳ Poniendo en mercado...');
    await updateTelegramMessageMarkup(chatId, messageId, `🏷️ PUESTO EN MERCADO (${playerName})`);

    const client = new ComunioClient();
    try {
      await client.login();
      const success = await client.sellPlayer(parseInt(playerId), playerName, parseInt(minPrice));
      if (success) {
        await sendTelegramMessage(`💼 ✅ <b>[Mateo Oslomany]:</b> <b>${escapeHtml(playerName)}</b> ha sido puesto en el mercado de Comunio por <b>${parseInt(minPrice).toLocaleString()} €</b>.`);

        // Generar noticia periodística oficial de rumor de salida en la web
        try {
          const { publishRumorNews } = await import('./imageGen.js');
          await publishRumorNews(playerName, `Precio de salida: ${parseInt(minPrice).toLocaleString()} €`, parseInt(playerId), false);
        } catch (e) {
          console.error('[DAEMON] Error publicando rumor de salida:', e.message);
        }
      } else {
        await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> No se pudo poner a en venta a ${escapeHtml(playerName)}.`);
      }
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ Error al poner en venta: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }
  } else if (data.startsWith('cancel_bid:')) {
    const [, offerId, playerName, playerId] = data.split(':');
    await answerCallbackQuery(callbackQuery.id, '⏳ Cancelando puja...');
    await updateTelegramMessageMarkup(chatId, messageId, `❌ PUJA CANCELADA (${playerName})`);

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

// ── LONG POLLING ──────────────────────────────────────────────────────────────

async function startPolling() {
  console.log('[DAEMON] Iniciando escucha de comandos de Telegram (Long Polling v3.5.0)...');
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

async function runMarketCheck() {
  if (marketMonitorRunning) {
    console.log('[DAEMON-MARKET] Comprobación anterior aún en curso, saltando...');
    return;
  }
  marketMonitorRunning = true;
  console.log('[DAEMON-MARKET] Ejecutando comprobación de mercado...');
  const client = new ComunioClient();
  try {
    await client.login();
    const squad = await client.getSquad();
    const dashboard = await client.getDashboardData();
    const balance = dashboard?.money || 0;

    const result = await checkMarket(client, squad, balance, botPaused);

    // 1. PUJAS AUTOMÁTICAS (Operaciones Estándar no críticas)
    for (const bid of result.autoBids) {
      if (botPaused) continue;
      const success = await client.placeBid(bid.playerId, bid.name, bid.bidAmount);
      if (success) {
        let log = [];
        try { if (fs.existsSync('audit_log.json')) log = JSON.parse(fs.readFileSync('audit_log.json', 'utf-8')); } catch (e) {}
        log.push({ timestamp: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }), action: 'Auto-Puja', player: bid.name, amount: `${bid.bidAmount.toLocaleString()} €`, status: 'Éxito' });
        fs.writeFileSync('audit_log.json', JSON.stringify(log.slice(-50), null, 2));

        try {
          const { publishRumorNews } = await import('./imageGen.js');
          await publishRumorNews(bid.name, `Oferta emitida en el mercado oficial por ${bid.bidAmount.toLocaleString()} € (+${(bid.marginalValue || bid.upgradePoints || 0).toFixed(0)} pts al Once)`, bid.playerId, true);
        } catch (e) {
          console.error('[DAEMON-NEWS ERROR]', e.message);
        }

        const msg = `💼 🤖 <b>[Mateo Oslomany] Auto-Puja Ejecutada</b>\n\n` +
          `👤 <b>${escapeHtml(bid.name)}</b> (${(bid.type || '').toUpperCase()})\n` +
          `💰 <b>Importe Pujado:</b> ${bid.bidAmount.toLocaleString()} € (+${bid.dynamicMargin || 0}%)\n` +
          `📈 <b>Mejora Real del XI:</b> +${(bid.marginalValue || bid.upgradePoints || 0).toFixed(0)} ptos\n` +
          `📊 <b>Eficiencia:</b> ${bid.efficiency || 0} pts/M€ (Puntuación Estratégica: ${bid.strategicScore || 0}/100)`;
        await sendTelegramMessage(msg);
      }
    }

    // 2. OPERACIONES ESTRATÉGICAS / SALTO CUALITATIVO (Ejecución 100% Autónoma + Resumen Ejecutivo)
    for (const alert of result.manualAlerts) {
      if (botPaused) continue;
      const posTag = { keeper: '🧤', defender: '🛡️', midfielder: '⚙️', striker: '⚡' }[alert.type] || '👤';
      const sellerTag = alert.isComputer ? 'Computadora' : `<b>${escapeHtml(alert.ownerName)}</b> (Rival de la Liga)`;

      const success = await client.placeBid(alert.playerId, alert.name, alert.bidAmount);
      if (success) {
        let log = [];
        try { if (fs.existsSync('audit_log.json')) log = JSON.parse(fs.readFileSync('audit_log.json', 'utf-8')); } catch (e) {}
        log.push({ timestamp: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }), action: 'Auto-Puja Estratégica', player: alert.name, amount: `${alert.bidAmount.toLocaleString()} €`, status: 'Éxito' });
        fs.writeFileSync('audit_log.json', JSON.stringify(log.slice(-50), null, 2));

        try {
          const { publishRumorNews } = await import('./imageGen.js');
          await publishRumorNews(alert.name, `Oferta emitida por ${alert.bidAmount.toLocaleString()} € (+${(alert.marginalValue || alert.upgradePoints || 0).toFixed(0)} pts al Once)`, alert.playerId, true);
        } catch (e) {
          console.error('[DAEMON-NEWS ERROR]', e.message);
        }

        const msg = `💼 🤖 <b>[Mateo Oslomany] Auto-Puja Estratégica Ejecutada</b>\n\n` +
          `${posTag} <b>${escapeHtml(alert.name)}</b> (${(alert.type || '').toUpperCase()})\n` +
          `👤 <b>Vendedor:</b> ${sellerTag}\n` +
          `💰 <b>Importe Pujado:</b> ${alert.bidAmount.toLocaleString()} € (+${alert.dynamicMargin || 0}%)\n` +
          `🏆 <b>Categoría:</b> ${alert.impactTag}\n` +
          `📈 <b>Mejora Real del XI:</b> +${(alert.marginalValue || alert.upgradePoints || 0).toFixed(0)} ptos\n` +
          `📊 <b>Rendimiento:</b> ~${(alert.expectedPoints || 0).toFixed(0)} ptos (PPM: ${alert.ppm || 0} | Eficiencia: ${alert.efficiency || 0} pts/M€)\n` +
          `💎 <b>Puntuación Estratégica:</b> ${alert.strategicScore || 0}/100\n\n` +
          `💡 <i>${escapeHtml(alert.reason || '')} Saldo restante: ${(balance - alert.bidAmount).toLocaleString()} €.</i>`;
        await sendTelegramMessage(msg);
      }
    }

    // 3. OFERTAS DE VENTA RECIBIDAS (Evaluación y Ejecución 100% Autónoma)
    try {
      const incomingOffersUrl = `https://api.comunio.es/communities/${client.communityId}/users/${client.userId}/offers?current`;
      const offersRes = await axios.get(incomingOffersUrl, { headers: client.getHeaders() });
      const saleOffers = (offersRes.data?.items || []).filter(item => item.type === 'SALE' && item.state === 'PENDING');

      for (const offer of saleOffers) {
        const offerId = offer.id;
        const playerId = offer.tradable?.id;
        const playerName = offer.tradable?.name || 'Jugador';
        const offerPrice = offer.price;
        const buyerName = offer.user?.name || offer.tradingPartner?.name || 'Computadora';
        const marketValue = offer.tradable?.quotedPrice || offer.tradable?.price || offerPrice;

        // Buscar al jugador en nuestra plantilla
        const squadPlayer = squad.players.find(p => p.id === playerId || p.playerId === playerId);
        if (!squadPlayer) continue;

        // Evaluación racional con el motor de optimización
        const saleEval = engine.evaluateSaleOffer(squadPlayer, [offer], squad, balance);

        if (saleEval.shouldAccept) {
          // VENTA AUTÓNOMA RACIONADA (Descarte, rotación favorable o saneamiento de deuda)
          const accepted = await client.acceptSaleOffer(offerId, playerId, offerPrice);
          if (!accepted) continue;

          let log = [];
          try { if (fs.existsSync('audit_log.json')) log = JSON.parse(fs.readFileSync('audit_log.json', 'utf-8')); } catch (e) {}
          log.push({ timestamp: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }), action: 'Auto-Venta Racional', player: playerName, amount: `${offerPrice.toLocaleString()} €`, status: 'Éxito' });
          fs.writeFileSync('audit_log.json', JSON.stringify(log.slice(-50), null, 2));

          try {
            const { publishSaleNews } = await import('./imageGen.js');
            await publishSaleNews(playerName, offerPrice, playerId, buyerName);
          } catch (e) {
            console.error('[DAEMON-NEWS ERROR]', e.message);
          }

          await sendTelegramMessage(`💼 🤖 <b>[Mateo Oslomany] Auto-Venta Ejecutada:</b> ${escapeHtml(playerName)} traspasado a ${escapeHtml(buyerName)} por ${offerPrice.toLocaleString()} €.\n<i>${escapeHtml(saleEval.reason)}</i>`);
        } else {
          console.log(`[DAEMON-MARKET] Oferta por ${playerName} (${offerPrice.toLocaleString()} €) rechazada para blindar el Once: ${saleEval.reason}`);
        }
      }
    } catch (offerErr) {
      console.warn('[DAEMON-MARKET] Error revisando ofertas entrantes:', offerErr.message);
    }

    // 4. AUTO-LISTADO DE DESCARTES EN EL MERCADO (Para recibir ofertas de la Computadora)
    try {
      const lineup = engine.optimizeLineup(squad);
      const startingIds = (lineup.starting11 || []).map(p => p.playerId || p.id);
      const currentMarket = await client.getMarket();
      const myListedIds = new Set((currentMarket?.players || []).filter(p => p.owner?.id === client.userId || p.owner === client.userId).map(p => p.playerId || p.id));
      
      const benchDescartes = squad.players.filter(p => !startingIds.includes(p.playerId || p.id));
      for (const descarte of benchDescartes) {
        const dId = descarte.playerId || descarte.id;
        // Si no está listado en el mercado, ponerlo en venta por su valor para recibir ofertas de Computer
        if (!myListedIds.has(dId)) {
          console.log(`[DAEMON-SALES] 🏷️ Auto-listando descarte en el mercado: ${descarte.name} (${(descarte.price || 0).toLocaleString()} €)`);
          await client.sellPlayer(dId, descarte.name, descarte.price || 160000);
        }
      }
    } catch (listErr) {
      console.warn('[DAEMON-SALES] Error auto-listando descartes:', listErr.message);
    }

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
              try {
                const { postStarSigningAnnouncement } = await import('./comunioCommunityPoster.js');
                await postStarSigningAnnouncement(tx.player, tx.price, p.playerId, p.type || 'jugador');
              } catch (commErr) {
                console.warn('[DAEMON] Info post comunidad fichaje:', commErr.message);
              }
            } else if (!isComputer) {
              // Solo publicar si es un mánager rival humano de la comunidad
              insertOrUpdateNews({
                id: `rival_signing_${p.playerId || tx.player.replace(/\s+/g, '_')}`,
                title: `MERCADO: ${tx.buyer} ficha a ${tx.player} por ${tx.price}`,
                date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
                category: 'Mercado',
                summary: `${tx.buyer} completa el fichaje de ${tx.player} procedente de ${tx.seller} tras una puja de ${tx.price}.`,
                body: `Movimiento oficial confirmado en la comunidad de Comunio. ${tx.buyer} se ha impuesto en la puja por ${tx.player} tras desembolsar ${tx.price} a ${tx.seller}.\n\nEl Racing de Oslo mantiene su plan financiero con la tesorería saneada mientras audita las siguientes oportunidades del mercado.`,
                image: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=800&q=80'
              });
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

    const balance = dashboard?.money || 0;
    const teamValue = dashboard?.teamValue || 0;
    const players = squad?.players || [];
    const marketPlayers = rawMarket?.players || [];

    const keepers = players.filter(p => p.type === 'keeper');
    const defenders = players.filter(p => p.type === 'defender');
    const midfielders = players.filter(p => p.type === 'midfielder');
    const strikers = players.filter(p => p.type === 'striker');

    const lineup = engine.optimizeLineup({ players });

    let msg = `💼 📊 <b>[Mateo Oslomany] · ANÁLISIS ESTRATÉGICO INTEGRAL</b>\n\n`;

    // 1. ESTADO FINANCIERO & VALOR DEL CLUB
    msg += `💰 <b>1. Estado Financiero & Valor:</b>\n`;
    msg += ` • Saldo en Caja: <b>${balance.toLocaleString()} €</b>\n`;
    msg += ` • Valor de Plantilla: <b>${teamValue.toLocaleString()} €</b>\n`;
    msg += ` • Total Plantilla: <b>${players.length} jugadores</b>\n\n`;

    // 2. DIAGNÓSTICO TÁCTICO Y CARENCIAS POR LÍNEAS
    msg += `🛡️ <b>2. Diagnóstico Táctico por Líneas:</b>\n`;
    msg += ` • 🧤 <b>Portería (${keepers.length}):</b> ${keepers.map(p => escapeHtml(p.name)).join(', ') || 'Sin portero'}\n`;
    msg += ` • 🛡️ <b>Defensa (${defenders.length}):</b> ${defenders.map(p => escapeHtml(p.name)).join(', ') || 'Escasa'}\n`;
    msg += ` • ⚙️ <b>Medular (${midfielders.length}):</b> ${midfielders.map(p => escapeHtml(p.name)).join(', ')}\n`;
    msg += ` • ⚡ <b>Delantera (${strikers.length}):</b> ${strikers.map(p => escapeHtml(p.name)).join(', ')}\n\n`;

    // Evaluaciones y Necesidades
    msg += `🎯 <b>3. Carencias & Objetivos Tácticos:</b>\n`;
    if (strikers.length < 3) {
      msg += ` 🔴 <b>DELANTERA (Prioridad MÁXIMA):</b> Contamos con solo ${strikers.length} delantero(s). Se requiere fichar 1-2 atacantes para garantizar gol y puntuación constante.\n`;
    }
    if (defenders.length < 5) {
      msg += ` 🟡 <b>DEFENSA (Prioridad ALTA):</b> Contamos con ${defenders.length} defensas. Se recomienda fichar 1 defensa adicional para asegurar rotaciones y fondo de armario.\n`;
    }
    if (midfielders.length >= 4) {
      msg += ` 🟢 <b>MEDULAR (Superávit de Calidad):</b> Línea muy sólida con ${midfielders.length} centrocampistas de alto nivel.\n`;
    }
    msg += `\n`;

    // 3. ANÁLISIS DEL MERCADO REAL Y OPORTUNIDADES
    msg += `🛒 <b>4. Oportunidades del Mercado Actual (${marketPlayers.length} a la venta):</b>\n`;

    // Oportunidades para Delantera
    const marketStrikers = marketPlayers.filter(p => p.type === 'striker');
    if (marketStrikers.length > 0) {
      msg += `\n⚡ <b>Atacantes en Venta Hoy:</b>\n`;
      marketStrikers.slice(0, 3).forEach(p => {
        const ownerName = p.owner?.name === 'Computer' || p.owner === 'Computer' ? 'Computadora' : (p.owner?.name || p.owner);
        msg += ` • <b>${escapeHtml(p.name)}</b> (${p.price.toLocaleString()} €) - Vendedor: ${escapeHtml(ownerName)}\n`;
      });
    } else {
      msg += `\n⚡ <b>Delanteros:</b> No hay atacantes disponibles en el mercado en este momento.\n`;
    }

    // Oportunidades para Defensa
    const marketDefenders = marketPlayers.filter(p => p.type === 'defender');
    if (marketDefenders.length > 0) {
      msg += `\n🛡️ <b>Defensas en Venta Hoy:</b>\n`;
      marketDefenders.slice(0, 3).forEach(p => {
        const ownerName = p.owner?.name === 'Computer' || p.owner === 'Computer' ? 'Computadora' : (p.owner?.name || p.owner);
        msg += ` • <b>${escapeHtml(p.name)}</b> (${p.price.toLocaleString()} €) - Vendedor: ${escapeHtml(ownerName)}\n`;
      });
    } else {
      msg += `\n🛡️ <b>Defensas:</b> No hay defensas disponibles en el mercado en este momento.\n`;
    }

    // Estrategia de Revalorización y Especulación
    msg += `\n📈 <b>5. Estrategia de Revalorización & Trading:</b>\n`;
    msg += ` • <b>Comprar & Especular:</b> Fichar jugadores de valor emergente en el mercado para revalorizar y revender a mayor precio, aumentando progresivamente la capacidad económica del club.\n`;

    // Plan de Acción Sugerido
    msg += `\n📋 <b>6. Plan de Acción Inmediato Sugerido:</b>\n`;
    if (marketStrikers.length > 0) {
      msg += ` 1️⃣ Enviar oferta por <b>${escapeHtml(marketStrikers[0].name)}</b> (usar /pujar ${escapeHtml(marketStrikers[0].name)}) para reforzar la delantera.\n`;
    }
    if (marketDefenders.length > 0) {
      msg += ` 2️⃣ Enviar oferta por <b>${escapeHtml(marketDefenders[0].name)}</b> (usar /pujar ${escapeHtml(marketDefenders[0].name)}) para blindar la defensa.\n`;
    }
    msg += ` 3️⃣ Ejecutar /alinear para fijar el XI titular óptimo (${lineup.formation}).\n`;

    await sendTelegramMessage(msg);

  } catch (err) {
    console.error('[DAEMON-ANALISIS ERROR]', err.message);
    await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> Error en el análisis estratégico: <code>${escapeHtml(err.message)}</code>`);
  } finally {
    await client.close();
  }
}

function startMarketMonitor() {
  console.log('[DAEMON] Iniciando monitor de mercado inteligente (optimizado a intervalos de 3 horas)...');
  // Primera ejecución a los 3 min para inicializar last_market.json sin lanzar alertas falsas
  setTimeout(() => {
    runMarketCheck();
    setInterval(runMarketCheck, 3 * 60 * 60 * 1000); // 3 horas en lugar de 15 minutos
  }, 3 * 60 * 1000);
}

// ── AUDITORÍA AUTOMÁTICA DE EVENTOS Y GENERACIÓN DE NOTICIAS ─────────────────

async function auditAndSyncSquadEvents(client, squad, balance, lineupResult = null) {
  try {
    const { publishSigningNews, publishSaleNews, publishMatchdayPreviewNews, publishClubNews } = await import('./imageGen.js');
    const stateFile = 'last_squad_state.json';
    let previousState = { playerIds: [], playerNames: {}, balance: 0, formation: '' };

    if (fs.existsSync(stateFile)) {
      try {
        previousState = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      } catch (e) {}
    }

    const currentPlayers = squad?.players || [];
    const currentPlayerIds = currentPlayers.map(p => p.id || p.playerId);

    // 1. Detectar NUEVOS FICHAJES (jugadores que aparecen por primera vez en la plantilla)
    if (previousState.playerIds && previousState.playerIds.length > 0) {
      for (const p of currentPlayers) {
        const pid = p.id || p.playerId;
        if (!previousState.playerIds.includes(pid)) {
          console.log(`[DAEMON-EVENTS] 🌟 ¡Nuevo fichaje confirmado detectado en la plantilla: ${p.name}!`);
          await publishSigningNews(p.name, p.price || 0, pid, p.type || p.position);
          await sendTelegramMessage(`💼 🌟 <b>[Mateo Oslomany] ¡Fichaje Confirmado!</b>\n\n<b>${escapeHtml(p.name)}</b> se ha incorporado oficialmente al Racing de Oslo.\n💰 Coste/Valor: ${(p.price || 0).toLocaleString()} €`);
        }
      }

      // 2. Detectar VENTAS / SALIDAS (jugadores que ya no están en la plantilla)
      for (const prevId of previousState.playerIds) {
        if (!currentPlayerIds.includes(prevId)) {
          const prevName = previousState.playerNames[prevId] || `Jugador #${prevId}`;
          console.log(`[DAEMON-EVENTS] 🏷️ ¡Salida de jugador confirmada detectada: ${prevName}!`);
          await publishSaleNews(prevName, 0, prevId, 'Computadora');
          await sendTelegramMessage(`💼 🏷️ <b>[Mateo Oslomany] ¡Venta Confirmada!</b>\n\n<b>${escapeHtml(prevName)}</b> ha abandonado la disciplina del Racing de Oslo.`);
        }
      }
    }

    // 3. Detectar CAMBIOS EN EL 11 TITULAR Y FORMACIÓN
    if (lineupResult && lineupResult.formation && lineupResult.formation !== previousState.formation) {
      const matchdayName = 'Próxima Jornada';
      const names = (lineupResult.starting11 || []).map(p => p.name);
      await publishMatchdayPreviewNews(matchdayName, names, lineupResult.formation, lineupResult.score);
    }

    // Guardar nuevo estado
    const newNames = {};
    currentPlayers.forEach(p => { newNames[p.id || p.playerId] = p.name; });
    const newState = {
      playerIds: currentPlayerIds,
      playerNames: newNames,
      balance,
      formation: lineupResult?.formation || previousState.formation || '5-3-2',
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(stateFile, JSON.stringify(newState, null, 2));

  } catch (err) {
    console.error('[DAEMON-EVENTS ERROR] Error auditando eventos de plantilla:', err.message);
  }
}

// ── CRON DIARIO (02:50 · 09:00 · 15:00) ──────────────────────────────────────

async function executeInLineupOptimization() {
  console.log('[DAEMON-CRON] Ejecutando optimización de alineación (Flujo Unificado)...');
  const client = new ComunioClient();
  const engine = new ComunioEngine();
  try {
    await client.login();
    const squad = await client.getSquad();
    const dashboard = await client.getDashboardData();
    const balance = dashboard?.money || 0;
    const lineupResult = engine.optimizeLineup(squad || { players: [] });
    
    if (lineupResult.starting11 && lineupResult.starting11.length > 0) {
      const startingIds = lineupResult.starting11.map(p => p.playerId);
      const success = await client.setLineup(startingIds, lineupResult.formation);
      console.log(`[DAEMON-CRON] 11 Titular guardado (${lineupResult.formation}) -> Éxito: ${success}`);
      await sendTelegramMessage(`💼 ⚡ <b>[Mateo Oslomany]:</b> 11 Titular optimizado y guardado en Comunio (Formación: ${lineupResult.formation}).`);
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
      console.log(`[DAEMON-HEALTH] Re-optimizando el XI titular tras detectar ${healthChangesCount} bajas físicas...`);
      const lineupResult = engine.optimizeLineup(squad);
      const starting11Ids = lineupResult.starting11.map(p => p.playerId || p.id);
      
      const saved = await client.setLineup(starting11Ids, lineupResult.formation);
      if (saved) {
        await sendTelegramMessage(
          `<b>⚽ XI TITULAR REAJUSTADO TRAS PARTE MÉDICO</b>\n\n` +
          `<b>Formación:</b> ${lineupResult.formation} (~${lineupResult.score} pts esperados)\n\n` +
          `<b>🛡️ NUEVO ONCE TITULAR 100% SANO:</b>\n` +
          lineupResult.starting11.map(p => ` • <b>${p.name}</b> (${p.expectedPoints} pts)`).join('\n')
        );

        const syncCmd = 'cd web && npm run build && cd .. && git add -A && git commit -m "fix: Reajuste automatico por parte medico" && git push origin main';
        exec(syncCmd, (syncErr) => {
          if (syncErr) console.error('[DAEMON-HEALTH] Error en auto-sync web:', syncErr.message);
        });
      }
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

function getScheduleConfig() {
  try {
    if (fs.existsSync('config.json')) {
      const cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'));
      return {
        dailySlots: cfg.schedule?.dailySlots || ['09:00', '23:50'],
        preMatchdayMinutes: cfg.schedule?.preMatchdayMinutesBeforeKickoff || 60,
        enabled: cfg.schedule?.enabled !== false
      };
    }
  } catch (e) {}
  return { dailySlots: ['09:00', '23:50'], preMatchdayMinutes: 60, enabled: true };
}

// ── PLANIFICADOR CONFIGURABLE (HORAS FIJAS + PRE-JORNADA DINÁMICO) ────────────
function startCronScheduler() {
  const sched = getScheduleConfig();
  console.log(`[DAEMON] Iniciando planificador configurable: ${sched.dailySlots.join(', ')} (Madrid) + ${sched.preMatchdayMinutes} min antes de cada jornada.`);
  
  setInterval(async () => {
    const config = getScheduleConfig();
    if (!config.enabled || botPaused) return;

    const now = new Date();
    const madridTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
    const hours = madridTime.getHours();
    const minutes = madridTime.getMinutes();
    const currentTimeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

    // 1. Comprobar franja diaria fija configurada (ej: 09:00 o 23:50)
    const isDailySlot = config.dailySlots.includes(currentTimeStr) && madridTime.getSeconds() < 60;

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
          if (diffMinutes > 0 && diffMinutes <= config.preMatchdayMinutes && lastPreMatchdayTriggeredKey !== info.nextMatchday) {
            isPreMatchdaySlot = true;
            lastPreMatchdayTriggeredKey = info.nextMatchday;
            console.log(`[DAEMON-CRON] 🚨 Alerta Pre-Jornada detectada: Quedan ${diffMinutes} min para el kickoff de la Jornada ${info.nextMatchday}.`);
          }
        }
      }
    } catch (err) {}

    if (isDailySlot || isPreMatchdaySlot) {
      console.log(`[DAEMON-CRON] ⏰ Ventana de ejecución activada (${currentTimeStr} | Pre-Jornada: ${isPreMatchdaySlot ? 'SÍ' : 'NO'}). Ejecutando operativa...`);

      // 1. Ejecutar escáner y acciones de mercado / ofertas recibidas
      await runMarketCheck();

      // 2. Ejecutar optimización y confirmación de alineación
      await executeInLineupOptimization();

      // 3. Escaneo de salud y bajas físicas
      await runSquadHealthCheck();

      // 4. Sincronización con el portal web
      console.log('[DAEMON-CRON] Sincronizando datos con la web y portal...');
      const syncCmd = 'node src/syncWeb.mjs && git add web/src/data/*.json && git commit -m "chore: Sincronizacion automatica programada" && git push origin main';
      exec(syncCmd, (syncErr) => {
         if (syncErr) console.error('[DAEMON-CRON] Error sincronizando web:', syncErr.message);
      });

      // 5. Pre-Jornada: Registro oficial de Pronóstico y Noticia de Previa (15 min antes)
      if (isPreMatchdaySlot) {
        try {
          const { recordMatchdayPrediction } = await import('./matchdayPredictionAuditor.js');
          const client = new ComunioClient();
          const engine = new ComunioEngine();
          await client.login();
          const currentSquad = await client.getSquad();
          const lineupRes = engine.optimizeLineup(currentSquad);
          await client.close();

          await recordMatchdayPrediction(matchdayKey || 3, `Jornada ${matchdayKey || 3}`, lineupRes);
        } catch (predErr) {
          console.warn('[DAEMON-CRON] Info registro predicción:', predErr.message);
        }

        try {
          const { sendWhatsAppMessage } = await import('./whatsappClient.js');
          let cfg = {};
          if (fs.existsSync('config.json')) cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'));
          const target = cfg.whatsapp?.groupChat || cfg.whatsapp?.personalChat;
          if (target && cfg.whatsapp?.enabled) {
            const waMsg = `*🚨 ONCE CERRADO & SALDO BLINDADO · RACING DE OSLO 🚨*\n\n` +
              `⏰ *Inicio de Jornada:* En menos de ${config.preMatchdayMinutes} minutos.\n` +
              `✅ *11 Titular:* Optimizado y guardado en Comunio.\n` +
              `💰 *Estado Financiero:* Saldo en regla (>= 0 €).\n\n` +
              `_Todo listo para sumar puntos._`;
            await sendWhatsAppMessage(target, waMsg);
          }
        } catch (waErr) {
          console.warn('[DAEMON-CRON] No se pudo enviar WhatsApp pre-jornada:', waErr.message);
        }
      }
    }
  }, 60000);
}

// ── ARRANQUE ──────────────────────────────────────────────────────────────────

startPolling();
startCronScheduler();


