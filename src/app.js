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


import FormData from 'form-data';
import { generateSigningPhoto } from './imageGen.js';
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

  // Cargar margen de puja desde config.json
  let bidMargin = 0;
  try {
    if (fs.existsSync('config.json')) {
      const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
      bidMargin = typeof config.bidMargin === 'number' ? config.bidMargin : 0;
    }
  } catch (e) {
    console.warn('[INFO] No se pudo cargar config.json, usando margen del 0% por defecto.');
  }
  console.log(`[INFO] Margen de puja activo: ${bidMargin}%`);

  try {
    await client.login();
    
    // Obtener ofertas de compra pendientes activas en los servidores
    console.log('[INFO] Cargando ofertas de compra pendientes...');
    const pendingBids = await client.getPendingBids();

    // Aceptar ofertas rentables pendientes
    console.log('[INFO] Revisando y aceptando ofertas de venta...');
    await client.acceptBestOffers();
  
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

    // Aplicar margen de puja a las recomendaciones
    if (marketResult.recommendations) {
      marketResult.recommendations = marketResult.recommendations.map(rec => {
        const withMargin = Math.ceil(rec.price * (1 + bidMargin / 100));
        return { ...rec, bidAmount: withMargin };
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

    // ── MODO AUTÓNOMO: Aplicar cambios ──────────────────────────────────────
    if (mode === 'autonomo') {
      console.log('[AUTÓNOMO] Aplicando cambios en tu cuenta de Comunio...');
      
      // Guardar la alineación óptima
      if (lineupResult.starting11 && lineupResult.starting11.length > 0) {
        try {
          const startingIds = lineupResult.starting11.map(p => p.playerId);
          console.log('[AUTÓNOMO] Guardando alineación ideal...');
          const success = await client.setLineup(startingIds, lineupResult.formation);
          logAction('Alineación Guardada', lineupResult.formation, null, success ? 'Éxito' : 'Fallo');
        } catch (e) {
          console.error('[AUTÓNOMO] Error guardando alineación:', e.message);
          logAction('Alineación Guardada', lineupResult.formation, null, 'Fallo (Error)');
        }
      }

      // Vender por deuda
      if (economyResult.inDebt && economyResult.suggestedSales.length > 0) {
        for (const s of economyResult.suggestedSales) {
          try {
            console.log(`[AUTÓNOMO] Poniendo en venta por deuda a ${s.name} por ${s.price}...`);
            const success = await client.sellPlayer(s.playerId, s.name, s.price);
            logAction('Puesto en Venta (Deuda)', s.name, s.price, success ? 'Éxito' : 'Fallo');
          } catch (e) {
            console.error(`[AUTÓNOMO] Error vendiendo a ${s.name}:`, e.message);
            logAction('Puesto en Venta (Deuda)', s.name, s.price, 'Fallo (Error)');
          }
        }
      }

      // Vender suplentes/lesionados para liquidez
      if (liquiditySuggestions && liquiditySuggestions.length > 0) {
        for (const s of liquiditySuggestions) {
          try {
            console.log(`[AUTÓNOMO] Poniendo en venta para liquidez a ${s.name} por ${s.price}...`);
            const success = await client.sellPlayer(s.playerId, s.name, s.price);
            logAction('Puesto en Venta (Liquidez)', s.name, s.price, success ? 'Éxito' : 'Fallo');
          } catch (e) {
            console.error(`[AUTÓNOMO] Error vendiendo sugerencia de liquidez ${s.name}:`, e.message);
            logAction('Puesto en Venta (Liquidez)', s.name, s.price, 'Fallo (Error)');
          }
        }
      }

      // Pujar por recomendaciones del mercado
      if (marketResult.recommendations && marketResult.recommendations.length > 0) {
        for (const rec of marketResult.recommendations.slice(0, 2)) {
          const existingBid = pendingBids.find(b => b.playerId === rec.playerId);
          if (existingBid) {
            console.log(`[AUTÓNOMO] Ya existe oferta activa por ${rec.name}. Omitiendo duplicado.`);
            continue;
          }
          if (rec.upgradePoints > 15 && balance >= rec.bidAmount) {
            try {
              console.log(`[AUTÓNOMO] Pujando por ${rec.name}: ${rec.bidAmount.toLocaleString()} € (Margen: ${bidMargin}%)...`);
              const success = await client.placeBid(rec.playerId, rec.name, rec.bidAmount);
              logAction('Puja Enviada', rec.name, rec.bidAmount, success ? 'Éxito' : 'Fallo');
            } catch (e) {
              console.error(`[AUTÓNOMO] Error al pujar por ${rec.name}:`, e.message);
              logAction('Puja Enviada', rec.name, rec.bidAmount, 'Fallo (Error)');
            }
          }
        }
      }
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
    if (economyResult.inDebt) alertLines.push(`🚨 Deuda: ${Math.abs(balance).toLocaleString()} € → <code>/sugerencias</code>`);
    if (injuredStarters.length > 0) alertLines.push(`🤕 Lesionados titulares: ${injuredStarters.map(p => escapeHtml(p.name)).join(', ')}`);
    if (pendingBids.length > 0) alertLines.push(`⏳ ${pendingBids.length} puja(s) activa(s) → <code>/mis_pujas</code>`);

    // Línea de mercado
    const marketOpsCount = recommendationsWithTM.length;
    const marketLine = marketOpsCount > 0
      ? `${marketOpsCount} oportunidad(es) → <code>/mercado</code>`
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
    if (teamValue > 0) report += `📊 <b>Valor de plantilla:</b> ${teamValue.toLocaleString()} € | Margen puja: <b>${bidMargin}%</b>\n`;
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
              
              // Generar y enviar cartel en Telegram
              try {
                const photoPath = await generateSigningPhoto(p.name, p.price, p.playerId);
                if (photoPath) {
                  await sendTelegramPhoto(photoPath, `🔥 <b>¡FICHAJE CONFIRMADO!</b>\n\n<b>${escapeHtml(p.name)}</b> llega al Oslo Arena por <b>${p.price.toLocaleString()} €</b>.`);
                }
              } catch (imgErr) {
                console.error(`[TELEGRAM PHOTO] Error generando cartel para ${p.name}:`, imgErr.message);
              }

              // Noticia para la Web
              try {
                if (fs.existsSync('web/src/data/news.json')) {
                  const news = JSON.parse(fs.readFileSync('web/src/data/news.json', 'utf-8'));
                  news.unshift({
                    id: Date.now() + Math.floor(Math.random() * 1000),
                    title: `¡Oficial! ${p.name} ficha por el Racing de Oslo`,
                    date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
                    excerpt: `El club hace oficial la incorporación de ${p.name} tras abonar su traspaso.`,
                    content: `Mateo Oslomany ha cerrado otra operación estelar. ${p.name} se une a las filas del Racing de Oslo por ${p.price.toLocaleString()} €. La dirección deportiva confía en su gran aportación para la temporada.\n\n¡Bienvenido al club!`,
                    image: `/media/signings/${p.playerId}_signing.jpg`
                  });
                  fs.writeFileSync('web/src/data/news.json', JSON.stringify(news, null, 2));
                }
              } catch (newsErr) {
                console.error(`[WEB NEWS] Error al publicar noticia para ${p.name}:`, newsErr.message);
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
