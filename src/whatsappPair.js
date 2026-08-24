import { getWhatsAppClient, sendWhatsAppMessage, listWhatsAppGroups } from './whatsappClient.js';
import { getNextMatchdayInfo } from './comunioNewsConsumer.js';
import { ComunioClient } from './comunioClient.js';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('⚽ INICIANDO CONEXIÓN DE WHATSAPP PARA COMUNIO BOT ⚽');
  console.log('Generando sesión de WhatsApp Web local...');

  const client = getWhatsAppClient();

  client.on('ready', async () => {
    console.log('\n======================================================');
    console.log('✅ ¡WHATSAPP VINCULADO CON ÉXITO!');
    console.log('======================================================\n');

    console.log('🔍 Buscando grupos de WhatsApp disponibles en tu cuenta...\n');
    try {
      const groups = await listWhatsAppGroups();
      console.log(`📋 Grupos Encontrados (${groups.length}):`);
      groups.forEach((g, idx) => {
        console.log(`  [${idx + 1}] "${g.name}" -> ID: ${g.id} (${g.participants} miembros)`);
      });
      console.log('\n💡 Para enviar a un grupo más adelante, solo copiaremos su ID en config.json.');
    } catch (e) {
      console.warn('No se pudieron listar los grupos:', e.message);
    }

    // Comprobar si hay número configurado en config.json o como argumento
    let targetChat = process.argv[2];
    try {
      if (!targetChat && fs.existsSync('config.json')) {
        const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
        targetChat = config.whatsapp?.personalChat || config.whatsapp?.groupChat;
      }
    } catch (e) {}

    if (targetChat) {
      console.log(`\n📤 Enviando mensaje de prueba a ${targetChat}...`);
      
      // Obtener info oficial de la próxima jornada de Comunio
      let matchdayNotice = '';
      try {
        const comunio = new ComunioClient();
        await comunio.login();
        const mInfo = await getNextMatchdayInfo(comunio);
        await comunio.close();

        matchdayNotice = `*🚨 AVISO OFICIAL COMUNIO · JORNADA EXTRA 🚨*\n\n` +
          `📅 *Inicio de Jornada:* ${mInfo.kickoffFormatted || 'Martes 25 de agosto a las 21:00h'}\n` +
          `🏟️ *Partidos:* Valencia vs Betis, Real Madrid vs Real Sociedad, Celta vs Osasuna, Barcelona vs Athletic\n\n` +
          `⚠️ *REGLA DE ORO:* Recordad que debéis tener *SALDO POSITIVO (>= 0 €)* y el *11 confirmado* antes de las 21:00h para no sufrir penalización.\n\n` +
          `_Enviado automáticamente desde Racing de Oslo Manager v1.2.0_`;
      } catch (err) {
        matchdayNotice = `*⚽ Test de Conexión de WhatsApp · Racing de Oslo Manager*\n\nConexión establecida con éxito. Los avisos de jornada y fichajes llegarán por este canal.`;
      }

      // Enviar con imagen oficial si existe
      const sampleImg = path.resolve('web/public/media/poster_j1.jpg');
      const imgToSend = fs.existsSync(sampleImg) ? sampleImg : null;

      await sendWhatsAppMessage(targetChat, matchdayNotice, imgToSend);
      console.log('✅ Mensaje de prueba enviado satisfactoriamente.');
    } else {
      console.log('\nℹ️ Para enviar un mensaje de prueba a tu número personal, ejecuta:');
      console.log('   node src/whatsappPair.js 346XXXXXXXX');
      console.log('   (Sustituyendo 346XXXXXXXX por tu número con prefijo 34)');
    }
  });

  await client.initialize();
}

main().catch(err => {
  console.error('[WHATSAPP FATAL]', err.message);
});
