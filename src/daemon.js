import axios from 'axios';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { ComunioClient } from './comunioClient.js';
import { ComunioEngine } from './engine.js';
import { analyzeRivals } from './rivals.js';
import { checkMarket, ignorePlayer } from './marketMonitor.js';
import { generateSigningCard } from './signingCard.js';
import fs from 'fs';

dotenv.config();

const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;

if (!telegramToken || !telegramChatId) {
  console.error('[DAEMON] Error: TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no están configurados en el .env');
  process.exit(1);
}

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
    const helpText = `💼 <b>[Mateo Oslomany]:</b> ¡Hola! Soy tu Director Deportivo.\n${pauseStatus}\n` +
      `📊 <b>Análisis:</b>\n` +
      ` • <code>/reporte</code> — Resumen ejecutivo del día\n` +
      ` • <code>/plantilla</code> — Tu plantilla completa (titulares + suplentes)\n` +
      ` • <code>/rivales</code> — Clasificación y valor de rivales\n` +
      ` • <code>/sugerencias</code> — Jugadores que conviene vender\n` +
      ` • <code>/jornada</code> — Próxima jornada y fecha de cierre\n` +
      ` • <code>/top</code> — Jugadores más valiosos de la plataforma\n\n` +
      `🛒 <b>Mercado:</b>\n` +
      ` • <code>/mercado</code> — Mejores oportunidades ahora mismo (top 5)\n` +
      ` • <code>/mis_pujas</code> — Tus pujas activas pendientes\n` +
      ` • <code>/pujar &lt;nombre&gt;</code> — Puja manual por un jugador del mercado\n` +
      ` • <code>/cancelar &lt;nombre&gt;</code> — Cancela una puja activa\n\n` +
      `⚡ <b>Acción:</b>\n` +
      ` • <code>/alinear</code> — Optimiza y guarda tu 11 titular\n` +
      ` • <code>/vender &lt;nombre&gt;</code> — Pone en venta a un jugador\n` +
      ` • <code>/margen &lt;%&gt;</code> — Configura el sobreprecio de pujas\n` +
      ` • <code>/limite &lt;millones&gt;</code> — Límite de puja automática (def: 10M)\n\n` +
      `⚙️ <b>Control:</b>\n` +
      ` • <code>/pausar</code> / <code>/reanudar</code> — Pausa/reactiva acciones autónomas\n` +
      ` • <code>/estado</code> — Estado del sistema y última ejecución\n` +
      ` • <code>/historial</code> — Últimas 10 acciones del bot\n\n` +
      `🕒 Ejecuciones automáticas: <b>02:50</b>, <b>09:00</b> y <b>15:00</b> (Madrid).\n` +
      `🛒 Monitor de mercado: cada <b>15 minutos</b>.`;
    await sendTelegramMessage(helpText);
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
    await sendTelegramMessage('💼 ⚡ <i>[Mateo Oslomany]: Optimizando el 11 titular y lanzando pujas de mercado...</i>');
    exec('node src/app.js', { env: { ...process.env, COMUNIO_MODE: 'autonomo' } }, (err) => {
      if (err) sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> Error al aplicar cambios: <code>${err.message}</code>`);
    });
  }

  // ── /plantilla ────────────────────────────────────────────────────────────
  else if (text.startsWith('/plantilla')) {
    await sendTelegramMessage('💼 ⏳ <i>[Mateo Oslomany]: Descargando tu plantilla...</i>');
    const client = new ComunioClient();
    const engine = new ComunioEngine();
    try {
      await client.login();
      const squad = await client.getSquad();
      const currentLineup = await client.getCurrentLineup();
      const lineupResult = engine.optimizeLineup(squad || { players: [] });
      const startingIds = new Set((lineupResult.starting11 || []).map(p => p.playerId));

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
    await sendTelegramMessage('💼 ⏳ <i>[Mateo Oslomany]: Escaneando el mercado de fichajes...</i>');
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

      if (recs.length > 0) {
        recs.forEach((rec, i) => {
          const posTag = { keeper: '🧤', defender: '🛡️', midfielder: '⚙️', striker: '⚡' }[rec.type] || '👤';
          rep += `${i + 1}. ${posTag} <b>${escapeHtml(rec.name)}</b>\n`;
          rep += `   💰 ${rec.price.toLocaleString()} € | PPM: ${rec.ppm}\n`;
          rep += `   📈 Mejora: +${rec.upgradePoints.toFixed(0)} ptos\n`;
          rep += `   <i>${escapeHtml(rec.reason)}</i>\n\n`;
        });
        rep += `Usa <code>/pujar &lt;nombre&gt;</code> para ofertar manualmente.`;
      } else {
        rep += `🔍 No hay oportunidades de fichaje rentables en este momento dentro de tu presupuesto.`;
      }

      await sendTelegramMessage(rep);
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
      if (bids.length > 0) {
        bids.forEach(b => {
          rep += ` ⏳ <b>${escapeHtml(b.playerName)}</b> — Oferta: ${b.price.toLocaleString()} €\n`;
        });
        rep += `\nUsa <code>/cancelar &lt;nombre&gt;</code> para retirar una puja.`;
      } else {
        rep += `No tienes pujas activas en este momento.`;
      }
      await sendTelegramMessage(rep);
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> Error: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }
  }

  // ── /jornada ──────────────────────────────────────────────────────────────
  else if (text.startsWith('/jornada')) {
    await sendTelegramMessage('💼 ⏳ <i>[Mateo Oslomany]: Consultando calendario de jornadas...</i>');
    const client = new ComunioClient();
    try {
      await client.login();
      const matchdays = await client.getMatchdays();

      if (!matchdays || matchdays.length === 0) {
        await sendTelegramMessage('💼 ❌ <b>[Mateo Oslomany]:</b> No pude obtener el calendario de jornadas de la API.');
        return;
      }

      const upcoming = matchdays.filter(md => !md.finished).slice(0, 4);

      let rep = `💼 <b>[Mateo Oslomany] · Calendario de Jornadas</b>\n\n`;
      upcoming.forEach(md => {
        const dateMatch = (md.eventInfo || '').match(/kickoff=(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2})/);
        let dateStr = '—';
        if (dateMatch) {
          const d = new Date(dateMatch[1]);
          dateStr = d.toLocaleString('es-ES', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }) + 'h';
        }
        const status = md.started ? '🟡 En curso' : '🔵 Pendiente';
        rep += ` ${status} <b>Jornada ${md.matchdayKey}</b> — ${dateStr}\n`;
      });

      // Próxima jornada con tiempo restante
      const next = matchdays.find(md => !md.finished && !md.started);
      if (next) {
        const dateMatch = (next.eventInfo || '').match(/kickoff=(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2})/);
        if (dateMatch) {
          const kickoff = new Date(dateMatch[1]);
          const now = new Date();
          const diff = kickoff - now;
          if (diff > 0) {
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            rep += `\n⏰ <b>Tiempo hasta la Jornada ${next.matchdayKey}:</b> ${days}d ${hours}h`;
          }
        }
      }

      await sendTelegramMessage(rep);
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> Error: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }
  }

  // ── /top ──────────────────────────────────────────────────────────────────
  else if (text.startsWith('/top')) {
    await sendTelegramMessage('💼 ⏳ <i>[Mateo Oslomany]: Consultando los jugadores más valiosos de la plataforma...</i>');
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
      let rep = `💼 <b>[Mateo Oslomany] · Sugerencias de Venta</b>\n\n`;
      if (suggestions.length > 0) {
        suggestions.forEach(s => {
          rep += ` • <b>${escapeHtml(s.name)}</b> — ${s.price.toLocaleString()} €\n   <i>${escapeHtml(s.reason)}</i>\n\n`;
        });
      } else {
        rep += `Tu plantilla está bien ajustada. No hay suplentes de alto valor ni lesionados de larga duración que convenga vender.`;
      }
      await sendTelegramMessage(rep);
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

  else {
    await sendTelegramMessage('💼 ⚠️ <b>[Mateo Oslomany]:</b> Comando no reconocido. Envía <code>/help</code> para ver los comandos válidos.');
  }
}

// ── MANEJADOR DE BOTONES INLINE (callback_query) ──────────────────────────────

async function handleCallbackQuery(callbackQuery) {
  const chatId = callbackQuery.message?.chat?.id;
  if (chatId?.toString() !== telegramChatId.toString()) return;

  const data = callbackQuery.data || '';
  console.log(`[DAEMON] Callback recibido: "${data}"`);

  // Formato: "bid:<playerId>:<playerName>:<price>:<position>" o "ignore:<playerId>:<playerName>"
  if (data.startsWith('bid:')) {
    const [, playerId, playerName, price, position] = data.split(':');
    await answerCallbackQuery(callbackQuery.id, '⏳ Procesando puja...');

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
    await sendTelegramMessage(`💼 🚫 <b>[Mateo Oslomany]:</b> <b>${playerName}</b> añadido a la lista de ignorados por 24h. No volveré a alertarte por este jugador.`);
  }
}

// ── LONG POLLING ──────────────────────────────────────────────────────────────

async function startPolling() {
  console.log('[DAEMON] Iniciando escucha de comandos de Telegram (Long Polling)...');
  await sendTelegramMessage('💼 🟢 <b>[Mateo Oslomany]:</b> Servicio iniciado y en línea (v2). Envía <code>/help</code> para ver mis comandos.');

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

    // Notificar pujas automáticas realizadas
    for (const bid of result.autoBids) {
      const msg = bid.success
        ? `🛒 <b>[Monitor Mercado]</b> Auto-puja enviada: <b>${escapeHtml(bid.name)}</b> por <b>${bid.bidAmount.toLocaleString()} €</b>\n📈 Mejora: +${bid.upgradePoints.toFixed(0)} ptos sobre tu peor ${bid.type}`
        : `🛒 <b>[Monitor Mercado]</b> Auto-puja FALLIDA por <b>${escapeHtml(bid.name)}</b> (${bid.bidAmount.toLocaleString()} €)`;
      await sendTelegramMessage(msg);
      // Enviar tarjeta de presentación si la puja tuvo éxito
      if (bid.success) {
        const pid = bid.playerId || bid.id;
        await sendSigningCard(bid.name, bid.type, bid.price,
          `✍️ <b>${escapeHtml(bid.name)}</b> firma con el Racing de Oslo por <b>${bid.bidAmount.toLocaleString()} €</b>`,
          pid, client.getToken());
      }
    }

    // Alertas manuales con botones inline
    for (const alert of result.manualAlerts) {
      const posTag = { keeper: '🧤', defender: '🛡️', midfielder: '⚙️', striker: '⚡' }[alert.type] || '👤';
      const msg = `🛒 <b>[Mercado]</b> Nuevo jugador · ¿Pujo?\n\n${posTag} <b>${escapeHtml(alert.name)}</b> (${alert.type})\n💰 Precio: ${alert.price.toLocaleString()} €\n📈 Mejora: +${alert.upgradePoints.toFixed(0)} ptos\n<i>${escapeHtml(alert.reason)}</i>`;
      const markup = {
        inline_keyboard: [[
          { text: '✅ PUJAR', callback_data: `bid:${alert.playerId}:${alert.name}:${alert.bidAmount}:${alert.type}` },
          { text: '❌ IGNORAR', callback_data: `ignore:${alert.playerId}:${alert.name}` }
        ]]
      };
      await sendTelegramMessage(msg, markup);
    }

    // Notificar jugadores desaparecidos del mercado
    if (result.soldPlayers.length > 0) {
      const names = result.soldPlayers.map(p => escapeHtml(p.name)).join(', ');
      await sendTelegramMessage(`💼 📤 <b>[Monitor Mercado]</b> Jugadores comprados/retirados: <b>${names}</b>`);
    }

  } catch (e) {
    console.error('[DAEMON-MARKET] Error en el monitor de mercado:', e.message);
  } finally {
    await client.close();
    marketMonitorRunning = false;
  }
}

function startMarketMonitor() {
  console.log('[DAEMON] Iniciando monitor de mercado (cada 15 minutos)...');
  // Primera ejecución a los 3 min para inicializar last_market.json sin lanzar alertas falsas
  setTimeout(() => {
    runMarketCheck();
    setInterval(runMarketCheck, 15 * 60 * 1000);
  }, 3 * 60 * 1000);
}

// ── CRON DIARIO (02:50 · 09:00 · 15:00) ──────────────────────────────────────

function startCronScheduler() {
  console.log('[DAEMON] Iniciando planificador de horas fijas (02:50, 09:00, 15:00)...');
  
  setInterval(() => {
    const now = new Date();
    const madridTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
    const hours = madridTime.getHours();
    const minutes = madridTime.getMinutes();

    const shouldRun = 
      (hours === 9 && minutes === 0) || 
      (hours === 15 && minutes === 0) || 
      (hours === 2 && minutes === 50);

    if (shouldRun) {
      const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      console.log(`[DAEMON-CRON] Hora programada detectada (${timeStr}). Ejecutando optimización autónoma...`);

      if (botPaused) {
        console.log('[DAEMON-CRON] Bot pausado, omitiendo ejecución automática.');
        return;
      }

      exec('node src/app.js', { env: { ...process.env, COMUNIO_MODE: 'autonomo' } }, (err) => {
        if (err) {
          sendTelegramMessage(`💼 🚨 <b>[Mateo Oslomany]:</b> Error en ejecución automática: <code>${err.message}</code>`);
          return;
        }
        if (hours === 9) {
          console.log('[DAEMON-CRON] Sincronizando datos con la web...');
          const syncCmd = 'node src/syncWeb.mjs && git add web/src/data/*.json && git commit -m "chore: Sincronizacion automatica web" && git push origin main';
          exec(syncCmd, (syncErr) => {
             if (syncErr) console.error('[DAEMON-CRON] Error sincronizando web:', syncErr);
          });
        }
      });
    }
  }, 60000);
}

// ── MATCHDAY MONITOR ────────────────────────────────────────────────────────
let lastLineupMatchdayId = null;

function startMatchdayMonitor() {
  console.log('[DAEMON] Iniciando monitor de jornadas (Auto-Alineación <3h)...');
  
  setInterval(async () => {
    if (botPaused) return;
    try {
      const client = new ComunioClient();
      await client.login();
      const matchdays = await client.getMatchdays();
      const nextMatchday = matchdays.find(md => !md.finished && !md.started) || matchdays.find(md => !md.finished);
      
      if (nextMatchday) {
        const mdId = nextMatchday._links?.self?.href?.split('/').pop() || nextMatchday.id;
        const detail = await client.getMatchdayDetail(mdId);
        
        if (detail && detail.eventInfo && detail.eventInfo.kickoff) {
          const kickoffTime = new Date(detail.eventInfo.kickoff).getTime();
          const now = Date.now();
          const hoursUntilKickoff = (kickoffTime - now) / (1000 * 60 * 60);
          
          if (hoursUntilKickoff > 0 && hoursUntilKickoff <= 3 && lastLineupMatchdayId !== mdId) {
            console.log(`[DAEMON] Jornada inminente (${hoursUntilKickoff.toFixed(1)}h). Auto-alineando...`);
            await sendTelegramMessage('💼 🚨 <i>[Mateo Oslomany]: La jornada arranca en menos de 3h. Cerrando alineación óptima y ventas de emergencia...</i>');
            
            exec('node src/app.js', { env: { ...process.env, COMUNIO_MODE: 'autonomo' } }, (err) => {
              if (err) sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> Error al aplicar cambios: <code>${err.message}</code>`);
            });
            
            lastLineupMatchdayId = mdId;
          }
        }
      }
      await client.close();
    } catch (e) {
      console.error('[DAEMON] Error en monitor de jornadas:', e.message);
    }
  }, 30 * 60 * 1000); // 30 mins
}


// ── ARRANQUE ──────────────────────────────────────────────────────────────────

startPolling();
startCronScheduler();
startMarketMonitor();
startMatchdayMonitor();
