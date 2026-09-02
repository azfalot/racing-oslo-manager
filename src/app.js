import dotenv from 'dotenv';
import { fetchLatestNews } from './news.js';
import { ComunioClient } from './comunioClient.js';
import { ComunioEngine } from './engine.js';
import { getTransfermarktData } from './transfermarkt.js';
import { analyzeRivals } from './rivals.js';
import axios from 'axios';
import fs from 'fs';

dotenv.config();

const mode = process.env.COMUNIO_MODE || 'asistente';
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;

function escapeHtml(text) {
  if (!text) return '';
  return text.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}


import path from 'path';
import FormData from 'form-data';
import { generateSigningPhoto, publishSigningNews, publishSaleNews } from './imageGen.js';
async function sendTelegramPhoto(photoPath, caption) {
  if (!telegramToken || !telegramChatId) return;
  try {
    const url = `https://api.telegram.org/bot${telegramToken}/sendPhoto`;
    const formData = new FormData();
    formData.append('chat_id', telegramChatId);
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');
    formData.append('photo', fs.createReadStream(photoPath));

    await axios.post(url, formData, {
      headers: formData.getHeaders()
    });
  } catch (err) {
    console.error('[TELEGRAM] Error al enviar foto:', err.message);
  }
}

async function sendTelegramMessage(text) {
  if (!telegramToken || !telegramChatId) return;
  try {
    const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
    
    if (text.length <= 4000) {
      await axios.post(url, {
        chat_id: telegramChatId,
        text: text,
        parse_mode: 'HTML'
      });
      return;
    }

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
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk);
    }

    for (const chunk of chunks) {
      await axios.post(url, {
        chat_id: telegramChatId,
        text: chunk,
        parse_mode: 'HTML'
      });
      await new Promise(r => setTimeout(r, 500));
    }
  } catch (err) {
    const detail = err.response ? JSON.stringify(err.response.data) : err.message;
    console.error('[TELEGRAM] Error al enviar mensaje:', detail);
  }
}

function logAction(action, player, amount, status) {
  let log = [];
  try {
    if (fs.existsSync('audit_log.json')) {
      log = JSON.parse(fs.readFileSync('audit_log.json', 'utf-8'));
    }
  } catch (e) {}

  log.push({
    timestamp: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
    action,
    player,
    amount: amount ? `${amount.toLocaleString()} €` : '-',
    status
  });

  if (log.length > 50) log = log.slice(-50);

  fs.writeFileSync('audit_log.json', JSON.stringify(log, null, 2));
}

async function runBot() {
  console.log('=================================================================');
  console.log(`INICIANDO COMUNIO BOT - MODO: ${mode.toUpperCase()}`);
  console.log('=================================================================\n');

  const client = new ComunioClient();
  const engine = new ComunioEngine();

  try {
    await client.login();
    
    // Obtener ofertas de compra pendientes activas en los servidores
    console.log('[INFO] Cargando ofertas de compra pendientes...');
    const pendingBids = await client.getPendingBids();
    console.log(`[INFO] Ofertas activas encontradas: ${pendingBids.length}`);

    // Obtener datos del Dashboard (incluyendo saldo económico)
    console.log('[INFO] Cargando panel principal de economía...');
    const dashboardData = await client.getDashboardData();
    
    let balance = 0;
    let teamValue = 0;
    if (dashboardData) {
      balance = dashboardData.money || 0;
      teamValue = dashboardData.teamValue || 0;
    }
    if (balance === 0) {
      console.log('[WARN] No se pudo leer el saldo exacto desde la API.');
    }
    console.log(`[INFO] Saldo actual: ${balance.toLocaleString()} €\n`);

    // Obtener plantilla actual
    console.log('[INFO] Cargando plantilla del equipo...');
    const squad = await client.getSquad();

    // Obtener alineación actual
    console.log('[INFO] Cargando alineación actual...');
    const currentLineup = await client.getCurrentLineup();

    // Obtener mercado
    console.log('[INFO] Cargando mercado de fichajes...');
    const market = await client.getMarket();
    const marketPlayers = market?.players || [];
    console.log(`[INFO] Jugadores en el mercado: ${marketPlayers.length}\n`);

    // Obtener jornadas
    console.log('[INFO] Cargando calendario de jornadas...');
    const matchdays = await client.getMatchdays();
    const nextMatchday = matchdays.find(md => !md.finished && !md.started) || matchdays.find(md => !md.finished);

    // Ejecutar análisis del motor de decisiones
    console.log('[PROCESANDO] Ejecutando lógica de optimización...');
    const lineupResult = engine.optimizeLineup(squad || { players: [] });
    const economyResult = engine.manageEconomy(squad || { players: [] }, balance);
    const marketResult = engine.analyzeMarket(marketPlayers, squad, balance);

    // Fijar recomendaciones estrictamente al 100.0% del Valor de Mercado (Regla 3)
    if (marketResult.recommendations) {
      marketResult.recommendations = marketResult.recommendations.map(rec => {
        return { ...rec, bidAmount: rec.price, marginPct: 0 };
      });
    }

    // Analizar rivales
    console.log('[INFO] Analizando los equipos rivales de la liga...');
    const rivals = await analyzeRivals(client);

    // Sugerencias de liquidez
    const starting11Ids = lineupResult.starting11 ? lineupResult.starting11.map(p => p.playerId) : [];
    const liquiditySuggestions = engine.getLiquiditySuggestions(squad, starting11Ids);

    // Enriquecer recomendaciones con Transfermarkt (top 5)
    console.log('[INFO] Consultando valores de mercado reales en Transfermarkt...');
    const recommendationsWithTM = await Promise.all(
      (marketResult.recommendations || []).slice(0, 5).map(async (rec) => {
        const tmData = await getTransfermarktData(rec.name);
        return {
          ...rec,
          tmValue: tmData ? tmData.value : 'Desconocido',
          tmUrl: tmData ? tmData.url : null
        };
      })
    );

    // ── MODO AUTÓNOMO: Cálculo y visualización del 11 titular (Guardado reservado a ventana pre-partido) ──────
    if (mode === 'autonomo') {
      console.log(`[AUTÓNOMO] XI Ideal calculado (${lineupResult.formation} ~${Math.round(lineupResult.score || 0)} pts). Guardado programado para ventana pre-partido.`);
    }

    // ── RESUMEN EJECUTIVO COMPACTO ───────────────────────────────────────────
    const myRank = rivals.findIndex(r => r.isMe) + 1;
    const myRankStr = myRank > 0 ? `#${myRank} de ${rivals.length}` : '—';

    // La API devuelve todas las jornadas sin started/finished diferenciado en pretemporada.
    // La jornada más próxima es simplemente la de menor matchdayKey.
    let matchdayLine = '—';
    if (matchdays && matchdays.length > 0) {
      const next = matchdays[0]; // Ya vienen ordenadas por matchdayKey asc desde getMatchdays()
      // Intentar extraer fecha del eventInfo (formato "Aufstellung X. Spieltag" sin fecha, o string con fecha)
      const dateMatch = (next.eventInfo || '').match(/(\d{2}\/\d{2}\/\d{4})/);
      if (dateMatch) {
        const d = new Date(dateMatch[1]);
        matchdayLine = `J${next.matchdayKey} · ${d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', timeZone: 'Europe/Madrid' })}`;
      } else {
        matchdayLine = `Jornada ${next.matchdayKey}`;
      }
    }

    // Alertas
    const injuredStarters = (lineupResult.starting11 || []).filter(p => !p.available);
    const alertLines = [];
    if (economyResult.inDebt) alertLines.push(`🚨 Deuda: ${Math.abs(balance).toLocaleString()} € → /sugerencias`);
    if (injuredStarters.length > 0) alertLines.push(`🤕 Lesionados titulares: ${injuredStarters.map(p => escapeHtml(p.name)).join(', ')}`);
    if (pendingBids.length > 0) alertLines.push(`⏳ ${pendingBids.length} puja(s) activa(s) → /mis_pujas`);

    // Línea de mercado
    const marketOpsCount = recommendationsWithTM.length;
    const marketLine = marketOpsCount > 0
      ? `${marketOpsCount} oportunidad(es) → /mercado`
      : 'Sin compras rentables ahora mismo';

    // Última acción auditada
    let lastActionLine = '—';
    try {
      if (fs.existsSync('audit_log.json')) {
        const log = JSON.parse(fs.readFileSync('audit_log.json', 'utf-8'));
        if (log.length > 0) {
          const last = log[log.length - 1];
          lastActionLine = `${last.action}: ${escapeHtml(last.player)} (${last.amount}) ➔ ${escapeHtml(last.status)}`;
        }
      }
    } catch (e) {}

    const predictedPoints = engine.getMatchdayPrediction(lineupResult.starting11);

    let report = `💼 <b>Mateo Oslomany · Resumen Ejecutivo</b>\n`;
    report += `<i>${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</i>\n\n`;
    report += `💰 <b>Presupuesto disponible:</b> ${balance.toLocaleString()} € ${economyResult.inDebt ? '⚠️ EN DEUDA' : '✅'}\n`;
    if (teamValue > 0) report += `📊 <b>Valor de plantilla:</b> ${teamValue.toLocaleString()} € | Pujas automáticas: <b>100% VM</b>\n`;
    report += `⚽ <b>Alineación:</b> ${lineupResult.formation || '—'} ${mode === 'autonomo' ? '(guardada ✅)' : '(modo asistente)'}\n`;
    report += `📈 <b>Predicción Jornada:</b> ~${predictedPoints} pts esperados 🎯\n`;
    report += `🛒 <b>Mercado:</b> ${marketLine}\n`;
    report += `👥 <b>Liga:</b> ${myRankStr} equipos\n`;
    report += `📅 <b>Próx. jornada:</b> ${matchdayLine}\n`;

    if (alertLines.length > 0) {
      report += `\n⚠️ <b>Alertas:</b>\n`;
      alertLines.forEach(a => { report += ` • ${a}\n`; });
    }

    report += `\n🎯 <b>Última acción:</b> <i>${lastActionLine}</i>\n`;
    report += `\n🌐 <b>Web Oficial:</b> <a href="https://racing-oslo.cotero91.workers.dev/">Visitar la Web Oficial</a>\n`;
    report += `\n<i>Usa /help para ver todos los comandos disponibles.</i>`;

    console.log('-----------------------------------------------------------------');
    console.log(report.replace(/<[^>]*>/g, ''));
    console.log('-----------------------------------------------------------------');

    await sendTelegramMessage(report);

    // ── DETECTAR CAMBIOS EN PLANTILLA ────────────────────────────────────────
    try {
      const currentPlayers = squad?.players || [];
      if (fs.existsSync('last_squad.json')) {
        const lastSquadData = JSON.parse(fs.readFileSync('last_squad.json', 'utf-8'));
        const lastPlayers = lastSquadData.players || [];
        
        const currentIds = currentPlayers.map(p => p.playerId);
        const lastIds = lastPlayers.map(p => p.playerId);

        const newSignings = currentPlayers.filter(p => !lastIds.includes(p.playerId));
        const completedSales = lastPlayers.filter(p => !currentIds.includes(p.playerId));

        if (newSignings.length > 0 || completedSales.length > 0) {
          let changeReport = `💼 <b>[Mateo Oslomany]:</b> ¡Noticias de última hora sobre nuestra plantilla!\n\n`;
          
          if (newSignings.length > 0) {
            changeReport += `✅ <b>Nuevas Incorporaciones:</b>\n`;
            for (const p of newSignings) {
              changeReport += ` • <b>${escapeHtml(p.name)}</b> - Valor: ${p.price.toLocaleString()} €\n`;
              
              // Generar tarjeta gráfica oficial, publicar noticia en la web y enviar cartel por Telegram
              try {
                const article = await publishSigningNews(p.name, p.price, p.playerId, p.type || 'Jugador');
                if (article && article.image) {
                  const localImagePath = path.resolve('web/public', article.image.replace(/^\//, ''));
                  if (fs.existsSync(localImagePath)) {
                    await sendTelegramPhoto(localImagePath, `🔥 <b>¡FICHAJE CONFIRMADO!</b>\n\n<b>${escapeHtml(p.name)}</b> llega al Oslo Arena por <b>${p.price.toLocaleString()} €</b>.`);
                  }
                }
              } catch (imgErr) {
                console.error(`[NEWS ERROR] Error publicando noticia de fichaje para ${p.name}:`, imgErr.message);
              }
            }
            changeReport += `\n`;
          }

          if (completedSales.length > 0) {
            changeReport += `❌ <b>Salidas del Club:</b>\n`;
            for (const p of completedSales) {
              changeReport += ` • <b>${escapeHtml(p.name)}</b> - ${p.price.toLocaleString()} €\n`;

              // Generar cartel de venta, foto de API y Noticia Web idéntica a las compras
              try {
                await publishSaleNews(p.name, p.price, p.playerId);
              } catch (imgErr) {
                console.error(`[NEWS ERROR] Error al publicar noticia de venta para ${p.name}:`, imgErr.message);
              }
            }
            changeReport += `\n`;
          }

          changeReport += `<i>¡Seguimos puliendo la plantilla ideal!</i>`;
          await sendTelegramMessage(changeReport);
        }
      }
      fs.writeFileSync('last_squad.json', JSON.stringify({ players: currentPlayers }, null, 2));
    } catch (e) {
      console.error('[INFO] Error al procesar diferencias de plantilla:', e.message);
    }

  } catch (err) {
    console.error('[ERROR CRÍTICO] El bot falló durante la ejecución:', err.message);
    await sendTelegramMessage(`🚨 <b>Error en tu Comunio Bot:</b> \n<code>${escapeHtml(err.message)}</code>`);
  } finally {
    await client.close();
    console.log('\n[FIN] Ejecución finalizada correctamente.');
    console.log('=================================================================');
  }
}

runBot();
