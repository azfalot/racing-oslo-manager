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

function getAuditHistoryText() {
  try {
    if (fs.existsSync('audit_log.json')) {
      const log = JSON.parse(fs.readFileSync('audit_log.json', 'utf-8'));
      if (log.length === 0) return ' - Ninguno.\n';
      return log.slice(-5).reverse().map(entry => {
        return `   [${entry.timestamp}] ${entry.action}: ${escapeHtml(entry.player)} (${entry.amount}) ➔ <b>${escapeHtml(entry.status)}</b>`;
      }).join('\n') + '\n';
    }
  } catch (e) {}
  return ' - Ninguno.\n';
}

async function runBot() {
  console.log('=================================================================');
  console.log(`INICIANDO COMUNIO BOT - MODO: ${mode.toUpperCase()}`);
  console.log('=================================================================\n');

  // 1. Leer noticias públicas del blog de Comunio
  console.log('[INFO] Leyendo noticias y análisis del día de Comunio...');
  const news = await fetchLatestNews(6);
  let newsText = `📰 <b>Últimos análisis del Comunio Magazine:</b>\n`;
  if (news && news.length > 0) {
    news.forEach((article, idx) => {
      console.log(`  [Noticia ${idx + 1}] ${article.title}`);
      newsText += ` - <a href="${escapeHtml(article.url)}">${escapeHtml(article.title)}</a>\n`;
    });
  } else {
    newsText += ` - No se pudieron cargar las noticias de pretemporada hoy.\n`;
  }
  console.log('');

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
    console.log(`[INFO] Ofertas activas encontradas: ${pendingBids.length}`);

    // Obtener datos del Dashboard (incluyendo saldo económico)
    console.log('[INFO] Cargando panel principal de economía...');
    const dashboardData = await client.getDashboardData();
    
    // Configurar saldo leyendo de la API de Comunio
    let balance = 20000000; // Por defecto de seguridad
    if (dashboardData && dashboardData.money !== undefined) {
      balance = dashboardData.money;
    } else {
      console.log('[WARN] No se pudo leer el saldo exacto desde la API, utilizando saldo de seguridad en 20M.');
    }
    
    console.log(`[INFO] Saldo actual: ${balance.toLocaleString()} €\n`);

    // Obtener plantilla actual
    console.log('[INFO] Cargando plantilla del equipo...');
    const squad = await client.getSquad();

    if (!squad || !squad.players) {
      console.warn('[WARN] No se pudo cargar la plantilla mediante la API. Usando plantilla vacía o simulada.');
    }

    // Obtener alineación actual
    console.log('[INFO] Cargando alineación actual...');
    const currentLineup = await client.getCurrentLineup();

    // Obtener mercado
    console.log('[INFO] Cargando mercado de fichajes...');
    const market = await client.getMarket();
    const marketPlayers = market?.players || [];
    console.log(`[INFO] Jugadores en el mercado: ${marketPlayers.length}\n`);

    // 2. Ejecutar análisis del motor de decisiones
    console.log('[PROCESANDO] Ejecutando lógica de optimización...');
    
    // Optimizar alineación
    const lineupResult = engine.optimizeLineup(squad || { players: [] });
    
    // Gestionar economía
    const economyResult = engine.manageEconomy(squad || { players: [] }, balance);
    
    // Analizar mercado para compras
    const marketResult = engine.analyzeMarket(marketPlayers, squad, balance);

    // Aplicar margen de puja configurable a las recomendaciones de compra
    if (marketResult.recommendations) {
      marketResult.recommendations = marketResult.recommendations.map(rec => {
        const withMargin = Math.ceil(rec.price * (1 + bidMargin / 100));
        return {
          ...rec,
          bidAmount: withMargin
        };
      });
    }

    // Analizar rivales de la comunidad
    console.log('[INFO] Analizando los equipos rivales de la liga...');
    const rivals = await analyzeRivals(client);

    // Obtener sugerencias de liquidez (ventas opcionales de suplentes/lesionados de la plantilla)
    const starting11Ids = lineupResult.starting11 ? lineupResult.starting11.map(p => p.playerId) : [];
    const liquiditySuggestions = engine.getLiquiditySuggestions(squad, starting11Ids);

    // Enriquecer recomendaciones con Transfermarkt
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

    // 3. Aplicar cambios en Modo Autónomo ANTES de redactar el reporte
    if (mode === 'autonomo') {
      console.log('[AUTÓNOMO] Aplicando cambios en tu cuenta de Comunio...');
      
      // Guardar la alineación óptima
      if (lineupResult.starting11 && lineupResult.starting11.length > 0) {
        try {
          const startingIds = lineupResult.starting11.map(p => p.playerId);
          console.log('[AUTÓNOMO] Guardando alineación ideal...');
          const success = await client.setLineup(startingIds, lineupResult.formation);
          logAction("Alineación Guardada", lineupResult.formation, null, success ? "Éxito" : "Fallo");
        } catch (e) {
          console.error('[AUTÓNOMO] Error guardando alineación:', e.message);
          logAction("Alineación Guardada", lineupResult.formation, null, "Fallo (Error)");
        }
      }

      // Si está en deuda y hay sugerencias de venta, ponerlos en venta
      if (economyResult.inDebt && economyResult.suggestedSales.length > 0) {
        for (const s of economyResult.suggestedSales) {
          try {
            console.log(`[AUTÓNOMO] Poniendo en venta por deuda a ${s.name} por ${s.price}...`);
            const success = await client.sellPlayer(s.playerId, s.name, s.price);
            logAction("Puesto en Venta (Deuda)", s.name, s.price, success ? "Éxito" : "Fallo");
          } catch (e) {
            console.error(`[AUTÓNOMO] Error vendiendo a ${s.name}:`, e.message);
            logAction("Puesto en Venta (Deuda)", s.name, s.price, "Fallo (Error)");
          }
        }
      }

      // Poner en venta también las sugerencias de liquidez opcionales automáticamente
      if (liquiditySuggestions && liquiditySuggestions.length > 0) {
        for (const s of liquiditySuggestions) {
          try {
            console.log(`[AUTÓNOMO] Poniendo en venta para liquidez a ${s.name} por ${s.price}...`);
            const success = await client.sellPlayer(s.playerId, s.name, s.price);
            logAction("Puesto en Venta (Liquidez)", s.name, s.price, success ? "Éxito" : "Fallo");
          } catch (e) {
            console.error(`[AUTÓNOMO] Error vendiendo sugerencia de liquidez ${s.name}:`, e.message);
            logAction("Puesto en Venta (Liquidez)", s.name, s.price, "Fallo (Error)");
          }
        }
      }

      // Comprar fichajes recomendados (pujas al mínimo absoluto + margen configurable)
      if (marketResult.recommendations && marketResult.recommendations.length > 0) {
        for (const rec of marketResult.recommendations.slice(0, 2)) {
          // Comprobar si ya existe una puja activa por este jugador
          const existingBid = pendingBids.find(b => b.playerId === rec.playerId);
          if (existingBid) {
            console.log(`[AUTÓNOMO] Ya existe una oferta activa por ${rec.name} por ${existingBid.price.toLocaleString()} € (Oferta calculada: ${rec.bidAmount.toLocaleString()} €). Omitiendo duplicado.`);
            continue;
          }

          // Pujar solo si la mejora es significativa
          if (rec.upgradePoints > 15 && balance >= rec.bidAmount) {
            try {
              console.log(`[AUTÓNOMO] Pujando automáticamente por ${rec.name} con oferta de ${rec.bidAmount.toLocaleString()} € (Margen: ${bidMargin}%)...`);
              const success = await client.placeBid(rec.playerId, rec.name, rec.bidAmount);
              logAction("Puja Enviada", rec.name, rec.bidAmount, success ? "Éxito" : "Fallo");
            } catch (e) {
              console.error(`[AUTÓNOMO] Error al pujar por ${rec.name}:`, e.message);
              logAction("Puja Enviada", rec.name, rec.bidAmount, "Fallo (Error)");
            }
          }
        }
      }
    }

    // 4. Confeccionar el reporte final en HTML
    let report = `💼 <b>INFORME DE DIRECCIÓN DEPORTIVA</b>\n<i>Remite: Mateo Oslomany (Director Deportivo, Racing de Oslo)</i>\n\n`;
    report += `💰 <b>Estado Financiero:</b>\n`;
    report += ` - Saldo: ${balance.toLocaleString()} €\n`;
    report += ` - Estado: ${economyResult.inDebt ? '⚠️ EN DEUDA' : '✅ Saneado'}\n`;
    report += ` - Margen de puja activo: <b>${bidMargin}%</b>\n\n`;

    if (economyResult.inDebt) {
      report += `🚨 <b>Ventas Urgentes Sugeridas (Para salir de la deuda):</b>\n`;
      economyResult.suggestedSales.forEach(s => {
        report += ` - <b>${escapeHtml(s.name)}</b> (${escapeHtml(s.type)}) - Valor: ${s.price.toLocaleString()} €\n   <i>Motivo:</i> ${escapeHtml(s.reason)}\n`;
      });
      report += `\n`;
    }

    report += `⚽ <b>Alineación Actual en Comunio (Formación: ${currentLineup ? currentLineup.tactic : 'Desconocida'}):</b>\n`;
    if (currentLineup && currentLineup.players && currentLineup.players.length > 0) {
      currentLineup.players.forEach(p => {
        report += `   • [${p.type.substring(0,2).toUpperCase()}] <b>${escapeHtml(p.name)}</b> (${p.price.toLocaleString()} €)\n`;
      });
    } else {
      report += `   - No se pudo leer la alineación actual.\n`;
    }
    report += `\n`;

    report += `⚽ <b>Optimización de Alineación Recomendada (Formación: ${lineupResult.formation || 'Sin asignar'}):</b>\n`;
    if (lineupResult.starting11) {
      report += ` <b>Titulares:</b> \n`;
      lineupResult.starting11.forEach(p => {
        report += `   • [${p.type.substring(0,2).toUpperCase()}] <b>${escapeHtml(p.name)}</b> (Ptos esperados: ${p.expectedPoints.toFixed(0)}) ${p.available ? '✅' : '❌ Lesionado/Sancionado'}\n`;
      });
      report += ` <b>Reservas:</b> \n`;
      lineupResult.bench.slice(0, 4).forEach(p => {
        report += `   • [${p.type.substring(0,2).toUpperCase()}] <b>${escapeHtml(p.name)}</b>\n`;
      });
    } else {
      report += ` - No se pudo generar la alineación ideal.\n`;
    }
    report += `\n`;

    report += `🛒 <b>Recomendaciones de Compra en el Mercado (Análisis Transfermarkt):</b>\n`;
    if (recommendationsWithTM.length > 0) {
      recommendationsWithTM.forEach(rec => {
        const tmSuffix = rec.tmUrl ? ` <a href="${escapeHtml(rec.tmUrl)}">[Valor TM: ${escapeHtml(rec.tmValue)}]</a>` : ` (Valor TM: ${escapeHtml(rec.tmValue)})`;
        report += ` - <b>${escapeHtml(rec.name)}</b> (${escapeHtml(rec.type)}) - Precio Comunio: ${rec.price.toLocaleString()} €${tmSuffix}\n`;
        report += `   <i>Oferta Sugerida:</i> <b>${rec.bidAmount.toLocaleString()} €</b> ( Upgrade: +${rec.upgradePoints.toFixed(0)} ptos )\n`;
        report += `   <i>Análisis:</i> ${escapeHtml(rec.reason)}\n`;
      });
    } else {
      report += ` - No hay compras recomendadas que mejoren tu equipo actual dentro de tu presupuesto.\n`;
    }
    report += `\n`;

    report += `💡 <b>Sugerencias de Venta Opcionales (Para ganar liquidez):</b>\n`;
    if (liquiditySuggestions.length > 0) {
      liquiditySuggestions.forEach(s => {
        report += ` - <b>${escapeHtml(s.name)}</b> - Valor: ${s.price.toLocaleString()} €\n   <i>Análisis:</i> ${escapeHtml(s.reason)}\n`;
      });
    } else {
      report += ` - No tienes jugadores suplentes de alto valor o lesionados de larga duración que convenga vender.\n`;
    }
    report += `\n`;

    report += `👥 <b>Análisis de Rivales en tu Liga (Ordenados por Valor de Plantilla):</b>\n`;
    if (rivals && rivals.length > 0) {
      rivals.forEach(r => {
        const prefix = r.isMe ? '👑 <b>[TÚ]</b>' : '👤';
        report += ` - ${prefix} <b>${escapeHtml(r.teamName)}</b> (${escapeHtml(r.ownerName)})\n`;
        report += `   Plantilla: ${r.playerCount} jugadores - Valor total: ${r.squadValue.toLocaleString()} €\n`;
        report += `   Estrellas principales: ${r.stars.map(s => `${escapeHtml(s.name)} (${s.price.toLocaleString()} €)`).join(', ')}\n`;
      });
    } else {
      report += ` - No se pudo realizar el análisis de los rivales.\n`;
    }
    report += `\n`;

    report += `📋 <b>Apartado de Cambios Recientes (Historial de Auditoría):</b>\n`;
    report += getAuditHistoryText();
    report += `\n`;

    report += `Atentamente,\n<b>Mateo Oslomany</b>\n<i>Director Deportivo, Racing de Oslo</i>\n\n`;

    report += newsText;

    console.log('-----------------------------------------------------------------');
    console.log(report.replace(/<[^>]*>/g, ''));
    console.log('-----------------------------------------------------------------');

    // Enviar reporte diario a Telegram
    await sendTelegramMessage(report);

    // 5. Comparar plantilla actual con last_squad.json para detectar fichajes/ventas consolidados
    try {
      const currentPlayers = squad?.players || [];
      if (fs.existsSync('last_squad.json')) {
        const lastSquadData = JSON.parse(fs.readFileSync('last_squad.json', 'utf-8'));
        const lastPlayers = lastSquadData.players || [];
        
        const currentIds = currentPlayers.map(p => p.playerId);
        const lastIds = lastPlayers.map(p => p.playerId);

        // Altas (Fichajes)
        const newSignings = currentPlayers.filter(p => !lastIds.includes(p.playerId));
        // Bajas (Ventas)
        const completedSales = lastPlayers.filter(p => !currentIds.includes(p.playerId));

        if (newSignings.length > 0 || completedSales.length > 0) {
          let changeReport = `💼 <b>[Mateo Oslomany]:</b> ¡Noticias de última hora sobre nuestra plantilla!\n\n`;
          
          if (newSignings.length > 0) {
            changeReport += `✅ <b>Nuevas Incorporaciones (Fichajes):</b>\n`;
            newSignings.forEach(p => {
              changeReport += ` • <b>${escapeHtml(p.name)}</b> (Puntos est.: ${p.average?.points || 0}) - Valor: ${p.price.toLocaleString()} €\n`;
            });
            changeReport += `\n`;
          }

          if (completedSales.length > 0) {
            changeReport += `❌ <b>Salidas del Club (Ventas):</b>\n`;
            completedSales.forEach(p => {
              changeReport += ` • <b>${escapeHtml(p.name)}</b> - Liberado por: ${p.price.toLocaleString()} €\n`;
            });
            changeReport += `\n`;
          }

          changeReport += `<i>¡Seguimos puliendo la plantilla ideal!</i>`;
          await sendTelegramMessage(changeReport);
        }
      }
      // Guardar plantilla actual como referencia para la siguiente ejecución
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
