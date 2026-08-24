import path from 'path';
import puppeteer from 'puppeteer';
import { generateTemplateGraphic, publishClubNews } from './imageGen.js';
import { ComunioClient } from './comunioClient.js';

/**
 * Publica una noticia directamente en el tablón oficial de la comunidad en Comunio
 */
export async function publishPostToComunio(title, body, options = {}) {
  const client = options.client || new ComunioClient();
  let mustClose = false;
  if (!client.isLoggedIn) {
    await client.login();
    mustClose = true;
  }

  console.log(`[COMUNIO-POSTER] 📢 Publicando post en el tablón oficial de Comunio: "${title}"...`);

  let posted = false;

  try {
    const browser = await puppeteer.launch({ 
      headless: true,
      executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    console.log('[COMUNIO-POSTER] 1. Accediendo a Comunio...');
    await page.goto('https://www.comunio.es/', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));

    // 1. Aceptar cookies si aparecen
    await page.evaluate(() => {
      const agreeBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.trim().toUpperCase() === 'ACEPTO');
      if (agreeBtn) agreeBtn.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    // 2. Clic en Entrar
    await page.evaluate(() => {
      const entrarBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.trim().toLowerCase() === 'entrar');
      if (entrarBtn) entrarBtn.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    // 3. Rellenar credenciales
    await page.type('input[placeholder="Nombre de usuario"]', client.username, { delay: 25 });
    await page.type('input[placeholder="Contraseña"]', client.password, { delay: 25 });
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const modalBtn = btns.reverse().find(b => b.innerText && b.innerText.trim().toLowerCase() === 'entrar' && !b.disabled);
      if (modalBtn) modalBtn.click();
    });
    await new Promise(r => setTimeout(r, 5000));

    // 4. Ir a Noticias
    await page.goto('https://www.comunio.es/game/news', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2500));

    // 5. Clic físico con ratón sobre Crear Post
    const boundingBox = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const target = all.find(e => e.innerText && e.innerText.trim() === 'Crear post');
      if (target) {
        const rect = (target.closest('div') || target).getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }
      return null;
    });

    if (boundingBox) {
      await page.mouse.click(boundingBox.x + boundingBox.width / 2, boundingBox.y + boundingBox.height / 2);
      await new Promise(r => setTimeout(r, 2000));

      // 6. Escribir Título y Cuerpo
      const titleInput = await page.$('input[placeholder*="Título"], input[placeholder*="Titulo"]');
      if (titleInput) {
        await titleInput.click();
        await page.keyboard.type(title.slice(0, 250), { delay: 15 });
      }

      const editor = await page.$('div[contenteditable="true"], textarea[placeholder*="mensaje"]');
      if (editor) {
        await editor.click();
        await page.keyboard.type(body, { delay: 10 });
      }

      await new Promise(r => setTimeout(r, 1500));

      // 7. Clic en Crear publicación
      const submitResult = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const submitBtn = btns.find(b => b.innerText && b.innerText.trim().toLowerCase() === 'crear publicación');
        if (submitBtn && !submitBtn.disabled) {
          submitBtn.click();
          return true;
        }
        return false;
      });

      if (submitResult) {
        console.log('[COMUNIO-POSTER] 🚀 ¡Post oficial publicado en Comunio con éxito!');
        posted = true;
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    await browser.close();
  } catch (err) {
    console.error('[COMUNIO-POSTER ERROR] Error al publicar en Comunio:', err.message);
  }

  if (mustClose) await client.close();
  return posted;
}

/**
 * PUNTO 1: Publica la promoción oficial del Portal Web del Racing de Oslo
 */
export async function postPortalLaunchAnnouncement() {
  const title = '🏛️ COMUNICADO: El Racing de Oslo estrena su Sede Digital';
  const body = 
    'La Junta Directiva del Racing de Oslo hace público el lanzamiento oficial de su portal digital para toda la comunidad de la Segunda Regional Cántabra.\n\n' +
    '📊 CONTENIDO EN ABIERTO:\n' +
    ' • Seguimiento en tiempo real de la plantilla y cotizaciones.\n' +
    ' • Crónicas oficiales, actas de partidos y auditoría de puntos.\n' +
    ' • Gráfica histórica de valor de mercado de todos los clubes de la liga.\n\n' +
    '🌐 Acceso al Portal: https://racing-oslo-manager.pages.dev\n\n' +
    '¡Bienvenidos al Oslo Arena!';

  // 1. Generar tarjeta gráfica institucional
  await generateTemplateGraphic('club', 'SEDE DIGITAL OFICIAL', 'Portal Web Oficial y Sala de Prensa');
  
  // 2. Publicar en nuestra propia web
  await publishClubNews(title, 'Lanzamiento del portal web institucional del club.', body, 'Institucional', 'club');

  // 3. Publicar en el tablón de Comunio
  return publishPostToComunio(title, body);
}

/**
 * PUNTO 2: Publica un Comunicado Oficial tras un Fichaje Bomba / Galáctico
 */
export async function postStarSigningAnnouncement(playerName, priceFormatted, playerId = null, position = 'centrocampista') {
  const title = `⭐ OFICIAL: ${playerName} nuevo jugador del Racing de Oslo`;
  const body = 
    `El Racing de Oslo y la Secretaría Técnica encabezada por Mateo Oslomany han cerrado un acuerdo para la incorporación definitiva de ${playerName}.\n\n` +
    `💼 DETALLES DE LA OPERACIÓN:\n` +
    ` • Futbolista: ${playerName} (${position})\n` +
    ` • Inversión: ${priceFormatted}\n\n` +
    `El jugador se incorporará de inmediato a la disciplina del equipo en el Oslo Arena para preparar la próxima jornada.\n\n` +
    `📰 Ficha completa y perfil técnico en: https://racing-oslo-manager.pages.dev`;

  // 1. Generar tarjeta gráfica de fichaje oficial
  await generateTemplateGraphic('signing', playerName, priceFormatted, playerId);

  // 2. Publicar en nuestra web
  await publishClubNews(title, `Acuerdo oficial para el traspaso de ${playerName}.`, body, 'Fichajes', 'signing');

  // 3. Publicar en el tablón de Comunio
  return publishPostToComunio(title, body);
}
