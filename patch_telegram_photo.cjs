const fs = require('fs');

let c = fs.readFileSync('src/app.js', 'utf8');

if (!c.includes('sendTelegramPhoto')) {
  const injectPhotoFunc = `
const FormData = require('form-data');
async function sendTelegramPhoto(photoPath, caption) {
  if (!telegramToken || !telegramChatId) return;
  try {
    const url = \`https://api.telegram.org/bot\${telegramToken}/sendPhoto\`;
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
`;
  
  c = c.replace("async function sendTelegramMessage(text) {", injectPhotoFunc + "\nasync function sendTelegramMessage(text) {");
  fs.writeFileSync('src/app.js', c);
}
