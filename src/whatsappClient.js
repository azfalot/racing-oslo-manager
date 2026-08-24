import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import path from 'path';

let clientInstance = null;
let isReady = false;

/**
 * Inicializa el cliente de WhatsApp con persistencia de sesión local
 */
export function getWhatsAppClient() {
  if (clientInstance) return clientInstance;

  clientInstance = new Client({
    authStrategy: new LocalAuth({
      dataPath: './.wwebjs_auth'
    }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    }
  });

  clientInstance.on('qr', (qr) => {
    console.log('\n======================================================');
    console.log('📱 ESCANEA ESTE CÓDIGO QR CON TU WHATSAPP (Dispositivos vinculados):');
    console.log('======================================================\n');
    qrcode.generate(qr, { small: true });
    console.log('\n💡 Abre WhatsApp en tu móvil > Ajustes / Menú > Dispositivos vinculados > Vincular un dispositivo\n');
  });

  clientInstance.on('authenticated', () => {
    console.log('[WHATSAPP] ✅ Sesión autenticada correctamente.');
  });

  clientInstance.on('auth_failure', (msg) => {
    console.error('[WHATSAPP] ❌ Fallo en la autenticación:', msg);
  });

  clientInstance.on('ready', () => {
    isReady = true;
    console.log('[WHATSAPP] 🚀 ¡Cliente de WhatsApp LISTO y conectado!');
  });

  clientInstance.on('disconnected', (reason) => {
    isReady = false;
    console.warn('[WHATSAPP] ⚠️ Cliente desconectado:', reason);
  });

  return clientInstance;
}

/**
 * Envía un mensaje de texto o una imagen a un chat/número o grupo de WhatsApp
 * @param {string} target - Número con prefijo país (ej: '34600112233') o ID de grupo ('1203630...@g.us')
 * @param {string} text - Texto del mensaje (admite negritas con *texto*)
 * @param {string|null} imagePath - Ruta local a la imagen para adjuntar (opcional)
 */
export async function sendWhatsAppMessage(target, text, imagePath = null) {
  const client = getWhatsAppClient();
  if (!isReady) {
    console.log('[WHATSAPP] Esperando a que el cliente esté listo...');
    await client.initialize();
    await new Promise((resolve) => {
      if (isReady) return resolve();
      client.once('ready', resolve);
    });
  }

  // Normalizar target ID
  let chatId = target.trim();
  if (!chatId.includes('@')) {
    // Es un número telefónico (ej: 34600112233)
    chatId = chatId.replace(/[^0-9]/g, '') + '@c.us';
  }

  try {
    if (imagePath && fs.existsSync(imagePath)) {
      const media = MessageMedia.fromFilePath(imagePath);
      await client.sendMessage(chatId, media, { caption: text });
      console.log(`[WHATSAPP] ✅ Imagen con mensaje enviada a ${chatId}`);
    } else {
      await client.sendMessage(chatId, text);
      console.log(`[WHATSAPP] ✅ Mensaje de texto enviado a ${chatId}`);
    }
    return true;
  } catch (err) {
    console.error(`[WHATSAPP ERROR] No se pudo enviar mensaje a ${chatId}:`, err.message);
    return false;
  }
}

/**
 * Obtiene la lista de grupos en los que estás para facilitar encontrar el ID del grupo de Comunio
 */
export async function listWhatsAppGroups() {
  const client = getWhatsAppClient();
  if (!isReady) {
    await client.initialize();
    await new Promise((resolve) => {
      if (isReady) return resolve();
      client.once('ready', resolve);
    });
  }

  const chats = await client.getChats();
  const groups = chats.filter(c => c.isGroup);
  return groups.map(g => ({
    id: g.id._serialized,
    name: g.name,
    participants: g.participants?.length || 0
  }));
}
