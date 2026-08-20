const fs = require('fs');
let c = fs.readFileSync('src/app.js', 'utf8');
c = c.replace("const FormData = require('form-data');", "import FormData from 'form-data';\nimport { generateSigningPhoto } from './imageGen.js';");

// Use generateSigningPhoto
const injectGenerate = `
                // GENERATE TELEGRAM PHOTO
                try {
                  const photoPath = await generateSigningPhoto(p.name, p.price, p.playerId);
                  if (photoPath) {
                    await sendTelegramPhoto(photoPath, \`🔥 <b>¡Fichaje Confirmado!</b>\\n\\nBienvenido <b>\${escapeHtml(p.name)}</b> al Racing de Oslo.\\nCoste de la operación: \${p.price.toLocaleString()} €\`);
                  }
                } catch(e) {
                  console.error('[PHOTO] Error:', e.message);
                }
`;

c = c.replace("news.unshift(newArticle);", "news.unshift(newArticle);\n" + injectGenerate);

fs.writeFileSync('src/app.js', c);
