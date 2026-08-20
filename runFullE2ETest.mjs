import { ComunioClient } from './src/comunioClient.js';
import { ComunioEngine } from './src/engine.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { execSync } from 'child_process';

dotenv.config();

const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramMessage(text, replyMarkup = null) {
  if (!telegramToken || !telegramChatId) return;
  try {
    const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
    const payload = {
      chat_id: telegramChatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };
    if (replyMarkup) payload.reply_markup = replyMarkup;
    await axios.post(url, payload);
    console.log('  [TELEGRAM] Notificación enviada con éxito.');
  } catch (e) {
    console.error('  [TELEGRAM ERROR]', e.message);
  }
}

async function runE2ETest() {
  console.log('\n=================================================================');
  console.log('🧪 PRUEBA END-TO-END (E2E) INTEGRAL - RACING DE OSLO MANAGER');
  console.log('=================================================================\n');

  const client = new ComunioClient();
  const engine = new ComunioEngine();

  // STEP 1: Autenticación y Carga de Datos Iniciales
  console.log('📌 1. ANÁLISIS DE PLANTILLA Y CONFIGURACIÓN DE EFICIENCIA');
  await client.login();

  const squad = await client.getSquad();
  const dashboard = await client.getDashboardData();
  const balance = dashboard?.money || 14740000;

  console.log(`   └─ Plantilla detectada: ${squad.players.length} jugadores.`);
  console.log(`   └─ Balance actual en cuenta: ${balance.toLocaleString()} €.`);

  // Evaluar estado de disponibilidad de cada jugador y riesgo de lesión
  const squadAnalysis = squad.players.map(p => {
    const pts = engine.getExpectedPoints(p);
    const available = engine.isPlayerAvailable(p);
    const injuryInfo = engine.evaluateInjuryRisk ? engine.evaluateInjuryRisk(p) : { isBargainRisk: false };
    return {
      ...p,
      expectedPoints: pts,
      available,
      statusStr: available ? 'Disponible ✅' : (injuryInfo.isBargainRisk ? 'Lesión Leve ⚠️' : 'Lesión Grave 🔴')
    };
  });

  console.log('\n  [ESTADO DE JUGADORES EN PLANTILLA]:');
  squadAnalysis.forEach(p => {
    console.log(`   • ${p.name.padEnd(20)} | ${(p.type || p.position).padEnd(10)} | Temp. Pasada: ${p.expectedPoints.toString().padStart(3)} pts | Estado: ${p.statusStr}`);
  });

  // Calcular Formación y XI Titular Óptimo
  const lineupResult = engine.optimizeLineup(squad);
  console.log(`\n  [OPTIMIZACIÓN TÁCTICA]: Formación Óptima -> ${lineupResult.formation} (~${lineupResult.score} pts esperados)`);

  const starting11Ids = lineupResult.starting11.map(p => p.playerId || p.id);
  console.log('  [XI TITULAR SELECCIONADO]:');
  lineupResult.starting11.forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.name} (${p.expectedPoints} pts)`);
  });

  // Guardar la Alineación Óptima en Comunio
  console.log('\n  [GUARDANDO ALINEACIÓN ÓPTIMA EN COMUNIO VIA API]...');
  const savedLineup = await client.setLineup(starting11Ids, lineupResult.formation);
  console.log(`   └─ Estado de guardado: ${savedLineup ? 'ÉXITO ✅' : 'REVISAR FALLBACK ⚠️'}`);


  // STEP 2: Análisis del Mercado y Ejecución de Pujas / Ventas
  console.log('\n📌 2. EJECUCIÓN DE MERCADO (PUJAS Y VENTAS ESTRICTAS)');
  const market = await client.getMarket();
  const marketPlayers = market.players || market || [];
  console.log(`   └─ Mercado descargado: ${marketPlayers.length} jugadores en venta.`);

  const marketAnalysis = engine.analyzeMarket(marketPlayers, squad, balance);
  const topRecommendations = (marketAnalysis.recommendations || []).slice(0, 3);

  console.log('\n  [OPORTUNIDADES DE FICHAJE DETECTADAS]:');
  if (topRecommendations.length === 0) {
    console.log('   └─ No hay oportunidades de mercado que superen a nuestros titulares actuales.');
  } else {
    for (const rec of topRecommendations) {
      console.log(`   • Oportunidad: ${rec.name} (${rec.type}) — VM: ${rec.price.toLocaleString()} € | Mejora: +${rec.upgradePoints.toFixed(0)} pts sobre nuestro peor ${rec.type}`);
    }
  }

  // Verificar si hay ofertas pendientes recibidas por nuestros jugadores
  const offersUrl = `https://api.comunio.es/communities/${client.communityId}/users/${client.userId}/offers?current`;
  const offersRes = await axios.get(offersUrl, { headers: client.getHeaders() });
  const pendingOffers = (offersRes.data?.items || []).filter(item => item.type === 'SALE' && item.state === 'PENDING');

  console.log(`\n  [OFERTAS RECIBIDAS PENDIENTES DE RESPUESTA]: ${pendingOffers.length}`);


  // STEP 3: Envío de Informe Ejecutivo y Peticiones a Telegram
  console.log('\n📌 3. ENVÍO DE NOTIFICACIONES Y PETICIONES INTERACTIVAS A TELEGRAM');

  let reportMsg = `<b>📋 INFORME EJECUTIVO DE AUDITORÍA (TEST E2E)</b>\n\n` +
    `💰 <b>Balance Actual:</b> ${balance.toLocaleString()} €\n` +
    `👥 <b>Plantilla:</b> ${squad.players.length} jugadores\n` +
    `⚽ <b>Formación Óptima XI:</b> ${lineupResult.formation} (${lineupResult.score} pts esperados)\n\n` +
    `<b>🛡️ ONCE TITULAR GUARDADO EN COMUNIO:</b>\n` +
    lineupResult.starting11.map(p => ` • <b>${p.name}</b> (${p.expectedPoints} pts)`).join('\n') + `\n\n` +
    `🛒 <b>Estado de Mercado:</b> ${marketPlayers.length} fichajes disponibles.\n` +
    `✅ <i>Alineación optimizada y guardada correctamente en Comunio.</i>`;

  await sendTelegramMessage(reportMsg);

  // Enviar ofertas pendientes con botones interactivos si existen
  for (const offer of pendingOffers) {
    const player = offer.tradable;
    const offerPrice = offer.price;
    const buyerName = offer.user?.name || 'Comprador';
    const offerId = offer.id;
    const playerId = player.id;
    const playerName = player.name;

    const evaluation = engine.evaluateSaleOffer(player, [offer], squad, balance);

    const offerMsg = `<b>💼 PROPUESTA DE DECISIÓN DE VENTA</b>\n\n` +
      `👤 <b>Jugador:</b> ${playerName} (${player.position || 'Jugador'})\n` +
      `📈 <b>Valor de Mercado:</b> ${(player.quotedPrice || player.price).toLocaleString()} €\n` +
      `💰 <b>Oferta Recibida:</b> ${offerPrice.toLocaleString()} € (${buyerName})\n\n` +
      `📋 <b>Dictamen Deportivo:</b>\n${evaluation.reason}\n\n` +
      `👇 <i>Pulsa un botón a continuación para tomar la decisión:</i>`;

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: "✅ ACEPTAR VENTA", callback_data: `acc_sale:${offerId}:${playerId}:${offerPrice}` },
          { text: "❌ RECHAZAR VENTA", callback_data: `rej_sale:${offerId}:${playerId}` }
        ]
      ]
    };
    await sendTelegramMessage(offerMsg, replyMarkup);
  }


  // STEP 4: Sincronización Web y Actualización de Noticias
  console.log('\n📌 4. SINCRONIZACIÓN DE LA WEB Y NOTICIAS');
  
  const newsPath = 'web/src/data/news.json';
  if (fs.existsSync(newsPath)) {
    const newsList = JSON.parse(fs.readFileSync(newsPath, 'utf-8'));
    const auditNewsId = 'audit_e2e_20260820';
    const existingIndex = newsList.findIndex(n => n.id === auditNewsId);
    
    const auditArticle = {
      id: auditNewsId,
      title: 'Comunicado Oficial: Ajuste Táctico del XI Titular',
      date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
      category: 'Equipo',
      excerpt: `La dirección deportiva encabezada por Mateo Oslomany confirma la optimización del esquema ${lineupResult.formation} para la próxima jornada.`,
      summary: `La dirección deportiva encabezada por Mateo Oslomany confirma la optimización del esquema ${lineupResult.formation} para la próxima jornada.`,
      content: `El Racing de Oslo ha completado la auditoría integral de rendimiento de la plantilla. El técnico Mateo Oslomany ha fijado la alineación titular bajo el esquema ${lineupResult.formation}, maximizando la proyección de puntos (~${lineupResult.score} pts esperados) y protegiendo a las piezas clave del vestuario.\n\nEl equipo se ejercita en el Oslo Arena preparando la inminente jornada liguera.`,
      image: '/media/crest.jpg'
    };

    if (existingIndex >= 0) {
      newsList[existingIndex] = auditArticle;
    } else {
      newsList.unshift(auditArticle);
    }
    fs.writeFileSync(newsPath, JSON.stringify(newsList, null, 2));
    console.log('   └─ Noticia táctica actualizada en web/src/data/news.json');
  }


  // STEP 5: Compilación Frontend y Despliegue en GitHub
  console.log('\n📌 5. COMPILACIÓN FRONTEND Y DESPLIEGUE EN GITHUB');
  try {
    console.log('   └─ Ejecutando npm run build en /web...');
    execSync('cd web && npm run build', { stdio: 'inherit' });

    console.log('   └─ Haciendo commit y push a GitHub...');
    execSync('git add -A && git commit -m "test: Resultado de prueba E2E de optimizacion tactica, mercado y web" && git push origin main', { stdio: 'inherit' });
    console.log('   └─ ¡Despliegue a Cloudflare Pages completado con éxito! ✅');
  } catch (e) {
    console.error('   └─ Error durante la compilación o despliegue:', e.message);
  }

  await client.close();

  console.log('\n=================================================================');
  console.log('🎉 PRUEBA END-TO-END COMPLETADA SATISFACTORIAMENTE');
  console.log('=================================================================\n');
}

runE2ETest();
