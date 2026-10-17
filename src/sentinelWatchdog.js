import { ComunioClient } from './comunioClient.js';
import { ComunioEngine } from './engine.js';
import { autoListSpeculationPlayers, executeSpeculationOfferAcceptances } from './dailySpeculator.js';
import axios from 'axios';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;

export async function sendSentinelTelegramMessage(htmlContent, replyMarkup = null) {
  if (!telegramToken || !telegramChatId) {
    console.warn('[SENTINEL] Telegram credentials not found in env.');
    return false;
  }
  try {
    const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
    const payload = {
      chat_id: telegramChatId,
      text: htmlContent,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };
    if (replyMarkup) payload.reply_markup = replyMarkup;
    const res = await axios.post(url, payload, { timeout: 10000 });
    return res.data?.ok === true;
  } catch (err) {
    console.error('[SENTINEL-TELEGRAM ERROR]', err.message);
    return false;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Genera un informe diario completo con diagnóstico financiero, solvencia, estado del XI y propuestas de mejora
 */
export async function generateDailyImprovementReport(client) {
  const shouldClose = !client;
  const c = client || new ComunioClient();
  const engine = new ComunioEngine();

  try {
    await c.login();

    const db = await c.getDashboardData();
    const squad = await c.getSquad();
    const lineup = await c.getCurrentLineup();
    const market = await c.getMarket();
    const userMarketListings = await c.getUserMarketListings();

    const balance = db?.money || 0;
    const teamValue = db?.teamValue || 0;
    const totalWealth = balance + teamValue;

    // 1. Detección de próxima jornada y tiempo restante
    let nextMatchday = null;
    let kickoffDate = null;
    let hoursUntilKickoff = null;
    try {
      const matchdayRes = await axios.get('https://api.comunio.es/matchdays/current', { headers: c.getHeaders() });
      nextMatchday = matchdayRes.data?.id;
      const kickoffStr = matchdayRes.data?.eventInfo?.kickoff;
      if (kickoffStr) {
        kickoffDate = new Date(kickoffStr);
        hoursUntilKickoff = Math.round((kickoffDate.getTime() - Date.now()) / (1000 * 60 * 60));
      }
    } catch (e) {
      console.warn('[SENTINEL] Error consultando matchdays:', e.message);
    }

    // 2. Estado de Solvencia
    const isSolvent = balance >= 0;
    let solvencyIcon = isSolvent ? '🟢' : '🔴';
    let solvencyTitle = isSolvent ? 'SOLVENTE (APTO PARA PUNTUAR)' : 'DÉFICIT CRÍTICO (RIESGO 0 PUNTOS)';
    
    // Titulares y banquillo
    const starterIds = new Set((lineup?.players || []).map(p => p.playerId || p.id));
    const benchPlayers = (squad?.players || []).filter(p => !starterIds.has(p.playerId || p.id));

    // 3. Verificación del Once Titular y Salud
    const injuredStarters = (lineup?.players || []).filter(p => p.status === 'INJURED' || p.status === 'SUSPENDED');
    const healthyStartersCount = (lineup?.players || []).filter(p => p.status !== 'INJURED' && p.status !== 'SUSPENDED').length;

    // 4. Construcción del Informe
    let report = `🛡️ <b>[CENTINELA RACING DE OSLO] · INFORME DIARIO &amp; MEJORAS</b>\n`;
    report += `📅 <i>${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' })}</i>\n\n`;

    report += `💰 <b>1. ESTADO FINANCIERO Y SOLVENCIA:</b>\n`;
    report += ` • <b>Saldo Líquido:</b> <b>${balance.toLocaleString('es-ES')} €</b>\n`;
    report += ` • <b>Valor Plantilla:</b> ${teamValue.toLocaleString('es-ES')} €\n`;
    report += ` • <b>Patrimonio Total:</b> ${totalWealth.toLocaleString('es-ES')} €\n`;
    report += ` • <b>Estado Jornada:</b> ${solvencyIcon} <b>${solvencyTitle}</b>\n`;

    if (!isSolvent) {
      report += `\n🚨 <b>¡ALERTA DEUDORA URGENTE!</b>\n`;
      report += ` ⚠️ El equipo está en negativo por <b>${Math.abs(balance).toLocaleString('es-ES')} €</b>.\n`;
      if (hoursUntilKickoff !== null) {
        if (hoursUntilKickoff > 0) {
          report += ` ⏳ Quedan aproximadamente <b>${hoursUntilKickoff} horas</b> para el inicio de la jornada.\n`;
        } else {
          report += ` ℹ️ La jornada del fin de semana está en juego. Saneando con máxima urgencia para la próxima fecha.\n`;
        }
      }
      report += ` 📋 <b>Plan de Saneamiento en Curso:</b>\n`;
      if (userMarketListings.length > 0) {
        userMarketListings.forEach(l => {
          report += `   • 🏷️ <b>${escapeHtml(l.name)}</b> en venta por <b>${(l.price || 0).toLocaleString('es-ES')} €</b>\n`;
        });
        const totalProjected = userMarketListings.reduce((sum, l) => sum + (l.price || 0), 0);
        const netAfterSales = balance + totalProjected;
        report += `   💵 Ingreso estimado con ofertas de Computer: <b>+${totalProjected.toLocaleString('es-ES')} €</b>\n`;
        report += `   📊 Saldo proyectado tras ventas: <b>${netAfterSales >= 0 ? '+' : ''}${netAfterSales.toLocaleString('es-ES')} €</b> (${netAfterSales >= 0 ? '🟢 SANEADO' : '🔴 SIGUE NEGATIVO'})\n`;
      } else {
        report += `   ⚠️ <i>¡No hay jugadores de banquillo listados en el mercado! Poniendo en venta de inmediato...</i>\n`;
      }
    } else {
      report += ` • <b>Margen de Seguridad:</b> Superávit de <b>+${balance.toLocaleString('es-ES')} €</b>. Sin riesgo de sanción.\n`;
    }

    report += `\n⚽ <b>2. ESTADO DEL ONCE TITULAR (3-5-2):</b>\n`;
    report += ` • Titulares Activos: <b>${healthyStartersCount}/11</b> disponibles\n`;
    if (injuredStarters.length > 0) {
      report += ` • ⚠️ <b>Bajas Médicas Detectadas en el XI:</b>\n`;
      injuredStarters.forEach(p => {
        const posText = p.type || p.position || 'campo';
        report += `   - 🚑 <b>${escapeHtml(p.name)}</b> (${posText}) · <i>${escapeHtml(p.statusInfo || 'Baja / Lesión')}</i>\n`;
      });
    } else {
      report += ` • ✅ Todos los titulares en óptimas condiciones físicas.\n`;
    }

    // 5. Propuestas de Mejora Cuantitativas del Mercado
    report += `\n💡 <b>3. PROPUESTAS DE MEJORA Y OPORTUNIDADES DEL DÍA:</b>\n`;

    const marketPlayers = market?.players || [];
    // Filtrar gangas y titulares de Primera
    const potentialUpgrades = marketPlayers.filter(p => {
      const isComputer = !p.owner || p.owner.name === 'Computer' || p.owner.id === 1;
      const isAffordable = p.price <= (balance > 0 ? balance : 2500000);
      return isComputer && isAffordable && p.points > 15;
    }).sort((a, b) => (b.points / Math.max(b.price, 1)) - (a.points / Math.max(a.price, 1)));

    if (potentialUpgrades.length > 0) {
      report += ` 🎯 <b>Oportunidades de Alto Rendimiento (Calidad/Precio):</b>\n`;
      potentialUpgrades.slice(0, 3).forEach((p, idx) => {
        report += `   ${idx + 1}. <b>${escapeHtml(p.name)}</b> (${p.clubName || 'LaLiga'}, ${p.type}) — <b>${p.price.toLocaleString('es-ES')} €</b>\n`;
        report += `      📊 Puntos: <b>${p.points} pts</b> | Eficiencia: ${( (p.points / (p.price / 1000000)) ).toFixed(1)} pts/M€\n`;
      });
    } else {
      report += ` • No hay oportunidades destacadas a coste asequible en la tanda actual de Computer.\n`;
    }

    // Sugerencia de rotación para lesionados
    if (injuredStarters.length > 0 && potentialUpgrades.length > 0) {
      const firstTarget = potentialUpgrades[0];
      report += ` 🔄 <b>Recomendación Táctica:</b> Fichar a <b>${escapeHtml(firstTarget.name)}</b> para cubrir la baja de <b>${escapeHtml(injuredStarters[0].name)}</b>.\n`;
    }

    report += `\n🤖 <i>Sistema Centinela activo · Monitoreo continuo 24/7 de solvencia y ofertas.</i>`;

    return {
      success: true,
      reportHtml: report,
      isSolvent,
      balance,
      userMarketListings
    };
  } catch (err) {
    console.error('[SENTINEL] Error generando informe diario:', err.message);
    return { success: false, error: err.message };
  } finally {
    if (shouldClose) await c.close();
  }
}

/**
 * Watchdog de solvencia: Si hay deuda y faltan menos de 48h, asegura que los suplentes
 * estén listados en mercado, acepta ofertas pendientes y envía alerta inmediata.
 */
export async function checkSolvencyAndAutoAlert() {
  const client = new ComunioClient();
  try {
    await client.login();
    const db = await client.getDashboardData();
    const squad = await client.getSquad();
    const lineup = await client.getCurrentLineup();
    const balance = db?.money || 0;

    const starterIds = new Set((lineup?.players || []).map(p => p.playerId || p.id));

    // Si hay deuda pendiente:
    if (balance < 0) {
      console.log(`[SENTINEL-WATCHDOG] ⚠️ Saldo negativo detectado: ${balance.toLocaleString('es-ES')} €. Verificando mercado y ofertas...`);

      // 1. Asegurar que los suplentes estén en el mercado
      await autoListSpeculationPlayers(client, squad, {
        currentBalance: balance,
        forceSanear: true,
        protectedPlayerIds: Array.from(starterIds)
      });

      // 2. Verificar y aceptar cualquier oferta de venta entrante para los suplentes
      const offersUrl = `https://api.comunio.es/communities/${client.communityId}/users/${client.userId}/offers?current`;
      const offersRes = await axios.get(offersUrl, { headers: client.getHeaders() });
      const saleOffers = (offersRes.data?.items || []).filter(item => item.type === 'SALE' && item.state === 'PENDING');

      if (saleOffers.length > 0) {
        console.log(`[SENTINEL-WATCHDOG] Ofertas detectadas para sanear (${saleOffers.length}). Ejecutando ventas...`);
        const result = await executeSpeculationOfferAcceptances(client, saleOffers, {
          currentBalance: balance,
          forceSanear: true,
          protectedPlayerIds: Array.from(starterIds),
          squad
        });

        for (const trade of result.acceptedTrades) {
          const alertMsg = `🚨 🩹 <b>[Centinela · Saneamiento Automático de Emergencia]</b>\n\n` +
            `👤 Se ha aceptado la venta de <b>${escapeHtml(trade.name)}</b> por <b>${trade.sellPrice.toLocaleString('es-ES')} €</b>.\n` +
            `💵 Objetivo: Eliminar saldo negativo para asegurar puntos en la jornada.\n` +
            `📊 Saldo anterior: ${balance.toLocaleString('es-ES')} € ➔ Proyectado: ${(balance + trade.sellPrice).toLocaleString('es-ES')} €.`;
          await sendSentinelTelegramMessage(alertMsg);
        }
      }
    }
  } catch (err) {
    console.error('[SENTINEL-WATCHDOG ERROR]', err.message);
  } finally {
    await client.close();
  }
}

// Ejecución directa por CLI si se llama explícitamente
if (process.argv[1]?.endsWith('sentinelWatchdog.js')) {
  (async () => {
    console.log('[SENTINEL] Ejecutando análisis directo...');
    const result = await generateDailyImprovementReport();
    if (result.success) {
      console.log('\n=== INFORME GENERADO CON ÉXITO ===\n');
      console.log(result.reportHtml.replace(/<[^>]*>/g, ''));
      if (process.argv.includes('--send')) {
        await sendSentinelTelegramMessage(result.reportHtml);
        console.log('\n[SENTINEL] Enviado por Telegram.');
      }
    } else {
      console.error('[SENTINEL] Fallo:', result.error);
    }
  })();
}
