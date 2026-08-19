import axios from 'axios';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { ComunioClient } from './comunioClient.js';
import { ComunioEngine } from './engine.js';
import { analyzeRivals } from './rivals.js';
import fs from 'fs';

dotenv.config();

const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;

if (!telegramToken || !telegramChatId) {
  console.error('[DAEMON] Error: TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no están configurados en el .env');
  process.exit(1);
}

let lastUpdateId = 0;

async function sendTelegramMessage(text) {
  try {
    const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
    
    // Si el mensaje es más corto de 4000 caracteres, enviarlo en un solo bloque
    if (text.length <= 4000) {
      await axios.post(url, {
        chat_id: telegramChatId,
        text: text,
        parse_mode: 'HTML'
      });
      return;
    }

    // Dividir en trozos de máx 4000 caracteres respetando los saltos de línea
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

    // Enviar cada trozo de manera secuencial
    for (const chunk of chunks) {
      await axios.post(url, {
        chat_id: telegramChatId,
        text: chunk,
        parse_mode: 'HTML'
      });
      await new Promise(r => setTimeout(r, 500)); // Evitar rate-limits de Telegram
    }
  } catch (err) {
    const detail = err.response ? JSON.stringify(err.response.data) : err.message;
    console.error('[DAEMON-TG] Error al enviar mensaje:', detail);
  }
}

async function handleTelegramMessage(message) {
  const text = (message.text || '').trim();
  const chatId = message.chat.id;

  // Solo responder al propietario configurado
  if (chatId.toString() !== telegramChatId.toString()) {
    console.log(`[DAEMON] Mensaje ignorado de chat no autorizado: ${chatId}`);
    return;
  }

  console.log(`[DAEMON] Comando recibido de Telegram: "${text}"`);

  if (text.startsWith('/start') || text.startsWith('/help') || text.toLowerCase() === 'ayuda') {
    const helpText = `💼 <b>[Mateo Oslomany]:</b> ¡Hola! Soy tu Director Deportivo de confianza.\n\n` +
      `Puedes ordenarme tareas usando los siguientes comandos:\n\n` +
      `📊 <b>Comandos de Análisis:</b>\n` +
      ` • <code>/reporte</code> - Te envío el informe de dirección deportiva del día (sólo lectura).\n` +
      ` • <code>/rivales</code> - Analizo el valor y las estrellas de las plantillas enemigas.\n` +
      ` • <code>/sugerencias</code> - Te aconsejo qué descartes vender para hacer caja.\n\n` +
      `⚡ <b>Comandos de Acción:</b>\n` +
      ` • <code>/alinear</code> - Guardo tu alineación óptima y realizo pujas de mercado.\n` +
      ` • <code>/vender &lt;nombre&gt;</code> - Pongo en venta de inmediato a un jugador de tu plantilla.\n` +
      ` • <code>/margen &lt;porcentaje&gt;</code> - Configuro un sobreprecio por encima del mínimo de mercado.\n\n` +
      `🕒 <b>Planificación Activa:</b>\n` +
      ` • Ejecutaré mis análisis y optimizaciones diarias de forma automática en tu PC a las <b>02:50</b>, <b>09:00</b> y <b>15:00</b> (hora Madrid).`;
    await sendTelegramMessage(helpText);
  } 
  
  else if (text.startsWith('/reporte')) {
    await sendTelegramMessage('💼 <i>[Mateo Oslomany]: De acuerdo, ejecutando análisis de tu Comunio (modo lectura)...</i>');
    // Forzar modo asistente
    exec('set COMUNIO_MODE=asistente&& node src/app.js', (err, stdout, stderr) => {
      if (err) {
        sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> Error al generar el informe: <code>${err.message}</code>`);
      }
    });
  } 
  
  else if (text.startsWith('/alinear')) {
    await sendTelegramMessage('💼 ⚡ <i>[Mateo Oslomany]: Entendido, optimizando el 11 titular y lanzando pujas de mercado...</i>');
    // Forzar modo autonomo
    exec('set COMUNIO_MODE=autonomo&& node src/app.js', (err, stdout, stderr) => {
      if (err) {
        sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> Error al aplicar cambios: <code>${err.message}</code>`);
      }
    });
  } 
  
  else if (text.startsWith('/rivales')) {
    await sendTelegramMessage('💼 ⏳ <i>[Mateo Oslomany]: Analizando plantillas de la liga...</i>');
    const client = new ComunioClient();
    try {
      await client.login();
      const rivals = await analyzeRivals(client);
      let rep = `💼 <b>[Mateo Oslomany]:</b> Aquí tienes el análisis de plantillas rivales (ordenadas por valor):\n\n`;
      rivals.forEach(r => {
        const prefix = r.isMe ? '👑 <b>[TÚ]</b>' : '👤';
        rep += ` - ${prefix} <b>${r.teamName}</b> (${r.ownerName})\n`;
        rep += `   Plantilla: ${r.playerCount} jug. - Valor: ${r.squadValue.toLocaleString()} €\n`;
        rep += `   Estrellas: ${r.stars.map(s => `${s.name} (${s.price.toLocaleString()} €)`).join(', ')}\n\n`;
      });
      await sendTelegramMessage(rep);
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> Error analizando rivales: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }
  } 
  
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
      let rep = `💼 <b>[Mateo Oslomany]:</b> Estas son mis sugerencias de venta opcionales para ganar caja:\n\n`;
      if (suggestions.length > 0) {
        suggestions.forEach(s => {
          rep += ` • <b>${s.name}</b> - Valor: ${s.price.toLocaleString()} €\n   <i>Análisis:</i> ${s.reason}\n\n`;
        });
      } else {
        rep += ` - No tienes suplentes caros o lesionados de larga duración que convenga vender. Tu plantilla está bastante ajustada.`;
      }
      await sendTelegramMessage(rep);
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> Error al consultar sugerencias: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }
  } 
  
  else if (text.startsWith('/margen')) {
    const parts = text.split(' ');
    
    // Si no se especifica el margen, se lee el valor actual
    if (parts.length < 2) {
      let currentMargin = 0;
      try {
        if (fs.existsSync('config.json')) {
          const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
          currentMargin = typeof config.bidMargin === 'number' ? config.bidMargin : 0;
        }
      } catch (e) {}
      await sendTelegramMessage(`💼 📊 <b>[Mateo Oslomany]:</b> Actualmente mi margen de puja es de <b>${currentMargin}%</b> por encima del valor mínimo de mercado.`);
      return;
    }

    const marginValue = parseFloat(parts[1]);
    if (isNaN(marginValue) || marginValue < 0 || marginValue > 50) {
      await sendTelegramMessage('💼 ⚠️ <b>[Mateo Oslomany]:</b> Margen incorrecto. Debes introducir un valor numérico entre 0 y 50.\nEjemplo: <code>/margen 1.5</code>');
      return;
    }

    try {
      let config = {};
      if (fs.existsSync('config.json')) {
        config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
      }
      config.bidMargin = marginValue;
      fs.writeFileSync('config.json', JSON.stringify(config, null, 2));

      await sendTelegramMessage(`💼 ✅ <b>[Mateo Oslomany]: ¡Entendido, Jefe!</b> He configurado mi margen de puja en <b>${marginValue}%</b>. A partir de ahora, cuando intente pujar en el mercado por un jugador de la Computadora, ofertaré su precio mínimo incrementado en un <b>${marginValue}%</b> para asegurar su contratación.`);
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> No pude guardar la configuración: <code>${e.message}</code>`);
    }
  }

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
        await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> No he encontrado a ningún jugador llamado "${nameQuery}" en tu plantilla.`);
        return;
      }

      await sendTelegramMessage(`💼 🚀 <i>[Mateo Oslomany]: Poniendo en venta a ${player.name} por su precio mínimo (${player.price.toLocaleString()} €)...</i>`);
      const success = await client.sellPlayer(player.playerId, player.name, player.price);

      if (success) {
        // Registrar en auditoría
        let log = [];
        try {
          if (fs.existsSync('audit_log.json')) {
            log = JSON.parse(fs.readFileSync('audit_log.json', 'utf-8'));
          }
        } catch (e) {}
        log.push({
          timestamp: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
          action: "Puesto en Venta (Telegram)",
          player: player.name,
          amount: `${player.price.toLocaleString()} €`,
          status: "Éxito"
        });
        fs.writeFileSync('audit_log.json', JSON.stringify(log.slice(-50), null, 2));

        await sendTelegramMessage(`💼 ✅ <b>[Mateo Oslomany]: ¡Operación completada!</b> <b>${player.name}</b> ya está puesto en el mercado por <b>${player.price.toLocaleString()} €</b>.`);
      } else {
        await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> La llamada al servidor falló. No pude poner en venta a ${player.name}.`);
      }
    } catch (e) {
      await sendTelegramMessage(`💼 ❌ <b>[Mateo Oslomany]:</b> Error al procesar la venta: <code>${e.message}</code>`);
    } finally {
      await client.close();
    }
  } 
  
  else {
    await sendTelegramMessage('💼 ⚠️ <b>[Mateo Oslomany]:</b> Comando no reconocido. Envía <code>/help</code> para ver los comandos válidos.');
  }
}

async function startPolling() {
  console.log('[DAEMON] Iniciando escucha de comandos de Telegram (Long Polling)...');
  await sendTelegramMessage('💼 🟢 <b>[Mateo Oslomany]:</b> Servicio de dirección deportiva iniciado y en línea. Envía <code>/help</code> para ver mis comandos.');

  while (true) {
    try {
      const url = `https://api.telegram.org/bot${telegramToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`;
      const res = await axios.get(url, { timeout: 35000 });
      const updates = res.data.result || [];
      
      for (const update of updates) {
        lastUpdateId = update.update_id;
        if (update.message && update.message.text) {
          await handleTelegramMessage(update.message);
        }
      }
    } catch (err) {
      console.error('[DAEMON-TG] Error al recibir actualizaciones:', err.message);
      // Esperar 5 segundos antes de reintentar ante fallos de red
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

// Planificador de cron diario simplificado
function startCronScheduler() {
  console.log('[DAEMON] Iniciando planificador de horas fijas (02:50, 09:00, 15:00)...');
  
  setInterval(() => {
    const now = new Date();
    const madridTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
    const hours = madridTime.getHours();
    const minutes = madridTime.getMinutes();

    // Comprobar ejecuciones programadas
    const shouldRun = 
      (hours === 9 && minutes === 0) || 
      (hours === 15 && minutes === 0) || 
      (hours === 2 && minutes === 50); // 02:50 a.m. (10 minutos antes del cierre)

    if (shouldRun) {
      const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      console.log(`[DAEMON-CRON] Hora programada detectada (${timeStr}). Ejecutando optimización autónoma...`);
      sendTelegramMessage(`💼 🕒 <b>[Mateo Oslomany]:</b> Ejecución programada detectada (${timeStr} Madrid). Optimizando cuenta...`);
      
      exec('set COMUNIO_MODE=autonomo&& node src/app.js', (err, stdout, stderr) => {
        if (err) {
          sendTelegramMessage(`💼 🚨 <b>[Mateo Oslomany]:</b> Error en la ejecución automática: <code>${err.message}</code>`);
        }
      });
    }
  }, 60000); // Revisar cada minuto
}

startPolling();
startCronScheduler();
