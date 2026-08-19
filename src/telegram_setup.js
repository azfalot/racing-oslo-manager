import axios from 'axios';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const token = '8809720385:AAHu0qetFGc9LTCdifj_sKBSgElrEcdd7vY';

async function setupTelegram() {
  console.log('Retrieving updates from Telegram to find your Chat ID...');
  try {
    const url = `https://api.telegram.org/bot${token}/getUpdates`;
    const res = await axios.get(url);
    const updates = res.data.result || [];
    
    if (updates.length === 0) {
      console.log('\n======================================================');
      console.log('⚠️  ¡No se han encontrado mensajes en el bot de Telegram!');
      console.log('Por favor, abre Telegram en tu móvil o PC, busca a @OSLOMANY_BOT');
      console.log('y pulsa en "/start" o envíale cualquier mensaje.');
      console.log('Luego vuelve a ejecutar este setup para capturar tu Chat ID.');
      console.log('======================================================\n');
      return;
    }

    // Buscar el chat ID del último mensaje enviado
    const lastUpdate = updates[updates.length - 1];
    const chatId = lastUpdate.message?.chat?.id;
    const firstName = lastUpdate.message?.chat?.first_name || 'Usuario';

    if (chatId) {
      console.log(`\n¡Éxito! Encontrado Chat ID: ${chatId} (${firstName})`);
      
      // Leer .env existente
      let envContent = fs.readFileSync('.env', 'utf-8');
      
      // Reemplazar TOKEN y CHAT_ID
      envContent = envContent.replace(/TELEGRAM_BOT_TOKEN=.*/, `TELEGRAM_BOT_TOKEN=${token}`);
      envContent = envContent.replace(/TELEGRAM_CHAT_ID=.*/, `TELEGRAM_CHAT_ID=${chatId}`);
      
      fs.writeFileSync('.env', envContent);
      console.log('Archivo .env actualizado con éxito.');

      // Enviar mensaje de prueba al usuario
      console.log('Enviando mensaje de confirmación a Telegram...');
      const sendUrl = `https://api.telegram.org/bot${token}/sendMessage`;
      await axios.post(sendUrl, {
        chat_id: chatId,
        text: `🤖 *¡Comunio Bot Conectado!*\n\nHola ${firstName}, he configurado correctamente tu token y Chat ID. A partir de ahora recibirás aquí los reportes diarios de alineación, economía y pujas del mercado.`,
        parse_mode: 'Markdown'
      });
      console.log('Mensaje de prueba enviado con éxito.');
    }
  } catch (err) {
    console.error('Error configurando Telegram:', err.message);
  }
}

setupTelegram();
