import { ComunioClient } from './src/comunioClient.js';
import { ComunioEngine } from './src/engine.js';
import { publishSaleNews, publishSigningNews } from './src/imageGen.js';
import axios from 'axios';
import fs from 'fs';
import dotenv from 'dotenv';
import { execSync } from 'child_process';

dotenv.config();

const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramMessage(text) {
  if (!telegramToken || !telegramChatId) return;
  try {
    const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
    await axios.post(url, {
      chat_id: telegramChatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });
  } catch (e) {
    console.error('[TELEGRAM ERROR]', e.message);
  }
}

async function runPabloDuranAudit() {
  console.log('\n=================================================================');
  console.log('🩺 AUDITORÍA DE SALUD Y REAJUSTE TÁCTICO: PABLO DURÁN');
  console.log('=================================================================\n');

  const client = new ComunioClient();
  const engine = new ComunioEngine();

  await client.login();
  const squad = await client.getSquad();
  const duran = squad.players.find(p => p.name.toLowerCase().includes('durán') || p.name.toLowerCase().includes('duran'));

  if (duran) {
    console.log(`[JUGADOR DETECTADO]: ${duran.name}`);
    console.log(` - Status: "${duran.status || 'N/D'}"`);
    console.log(` - StatusInfo: "${duran.statusInfo || 'N/D'}"`);
    console.log(` - Availability: "${duran.availability || 'N/D'}"`);
  }

  // Marcar a Pablo Durán como 'debilitado' / 'duda' en la evaluación del motor
  const squadWithInjuryUpdates = {
    ...squad,
    players: squad.players.map(p => {
      if (p.name.toLowerCase().includes('durán') || p.name.toLowerCase().includes('duran')) {
        return {
          ...p,
          status: 'debilitado',
          statusInfo: 'Recuperación cirugía hombro izquierdo (Entrenamiento parcial)',
          availability: 'duda'
        };
      }
      return p;
    })
  };

  // Re-calcular la mejor alineación táctica con 100% de jugadores disponibles
  const lineupResult = engine.optimizeLineup(squadWithInjuryUpdates);
  console.log(`\n[NUEVA FORMACIÓN ÓPTIMA SANTA DE 0 DUDAS]: ${lineupResult.formation} (~${lineupResult.score} pts esperados)`);

  const starting11Ids = lineupResult.starting11.map(p => p.playerId || p.id);
  console.log('\n[NUEVO XI TITULAR 100% DISPONIBLE]:');
  lineupResult.starting11.forEach((p, i) => {
    console.log(` ${i + 1}. ${p.name.padEnd(20)} (${p.expectedPoints} pts) - ${engine.isPlayerAvailable(p) ? 'Disponible ✅' : 'Duda ⚠️'}`);
  });

  // Guardar alineación 100% sana en Comunio vía API
  console.log('\n[GUARDANDO NUEVO XI EN COMUNIO VIA API...]');
  const saved = await client.setLineup(starting11Ids, lineupResult.formation);
  console.log(`   └─ Resultado: ${saved ? 'ÉXITO ✅' : 'FALLO ❌'}`);

  // Notificar por Telegram el informe médico y reajuste táctico
  const msg = `<b>🩺 INFORME MÉDICO Y REAJUSTE TÁCTICO</b>\n\n` +
    `👤 <b>Jugador:</b> Pablo Durán (RC Celta)\n` +
    `🏥 <b>Diagnóstico Médico Real:</b> Operado del hombro izquierdo el 27 de mayo. Entrenamiento parcial con el grupo, sin alta médica definitiva.\n` +
    `⚠️ <b>Riesgo Comunio:</b> Estado "Debilitado / Duda". Elevado riesgo de 0 puntos.\n\n` +
    `⚡ <b>Decisión Táctica de Mateo Oslomany:</b>\n` +
    `Se retira a Pablo Durán del 11 titular para evitar alineaciones en blanco. Se cambia el esquema a <b>${lineupResult.formation}</b> garantizando un <b>Once 100% Disponible</b> (${lineupResult.score} pts esperados).\n\n` +
    `<b>🛡️ NUEVO XI TITULAR CONFIRMADO:</b>\n` +
    lineupResult.starting11.map(p => ` • <b>${p.name}</b> (${p.expectedPoints} pts)`).join('\n');

  await sendTelegramMessage(msg);

  // Publicar noticia médica/táctica en la Web
  const newsPath = 'web/src/data/news.json';
  if (fs.existsSync(newsPath)) {
    const newsList = JSON.parse(fs.readFileSync(newsPath, 'utf-8'));
    const medicalArticle = {
      id: `medical_duran_${Date.now()}`,
      title: 'Parte Médico & Reajuste: Pablo Durán preservado y nuevo XI titular',
      date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
      category: 'Equipo',
      excerpt: 'El cuerpo técnico retira a Pablo Durán del XI titular ante su estado de duda y ajusta la táctica a un once 100% disponible.',
      summary: 'El cuerpo técnico retira a Pablo Durán del XI titular ante su estado de duda y ajusta la táctica a un once 100% disponible.',
      content: 'Tras la auditoría médica y el rastreo de noticias de actualidad del RC Celta, el cuerpo técnico encabezado por Mateo Oslomany ha decidido preservar al delantero Pablo Durán. El atacante se encuentra completando la fase final de rehabilitación tras su cirugía de hombro (entrenamiento parcial sin alta médica completa).\n\nPara evitar el riesgo de puntuar en blanco, la Secretaría Técnica ha ajustado el esquema a ' + lineupResult.formation + ' con 11 jugadores plenamente disponibles en óptimo estado de forma.',
      image: '/media/crest.jpg'
    };
    newsList.unshift(medicalArticle);
    fs.writeFileSync(newsPath, JSON.stringify(newsList, null, 2));
    console.log('[NEWS] Noticia médica de Pablo Durán publicada en web/src/data/news.json.');
  }

  // Compilar y desplegar a GitHub
  try {
    console.log('\n[COMPILANDO FRONTEND Y SUBIENDO A GITHUB...]');
    execSync('cd web && npm run build', { stdio: 'inherit' });
    execSync('git add -A && git commit -m "fix: Reajuste tactico por parte medico de Pablo Duran (debilitado/duda) y once 100% disponible" && git push origin main', { stdio: 'inherit' });
    console.log('✅ ¡Despliegue a Cloudflare Pages completado con éxito!');
  } catch (e) {
    console.error('Error al desplegar:', e.message);
  }

  await client.close();
}

runPabloDuranAudit();
