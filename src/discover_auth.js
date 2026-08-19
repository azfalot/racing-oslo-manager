import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const username = process.env.COMUNIO_USERNAME;
const password = process.env.COMUNIO_PASSWORD;

if (!username || !password || username === 'tu_usuario' || password === 'tu_contraseña') {
  console.error('\n[ERROR] Por favor, configura tus credenciales reales de Comunio en el archivo .env primero.');
  console.error('Edita el archivo .env e introduce tu usuario y contraseña.\n');
  process.exit(1);
}

async function main() {
  console.log('Iniciando navegador para descubrir endpoints autenticados...');
  const browser = await chromium.launch({ headless: true }); // Headless para que se ejecute en segundo plano
  const context = await browser.newContext();
  const page = await context.newPage();

  const endpoints = {};

  // Escuchar respuestas de red
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('api.comunio.es') || url.includes('comunio.es/api')) {
      const request = response.request();
      const method = request.method();
      const status = response.status();

      if (method === 'OPTIONS') return;

      const parsedUrl = new URL(url);
      const pathname = parsedUrl.pathname;
      const key = `${method} ${pathname}`;

      const headers = request.headers();
      const authHeader = headers['authorization'] || headers['Authorization'];

      let body = null;
      try {
        if (status >= 200 && status < 300) {
          body = await response.json();
        }
      } catch (e) {
        // No es JSON o ya se cerró
      }

      endpoints[key] = {
        url,
        method,
        status,
        hasAuthHeader: !!authHeader,
        authSample: authHeader ? authHeader.substring(0, 15) + '...' : null,
        responseSample: body ? JSON.stringify(body).substring(0, 200) + '...' : null,
        fullResponseBody: body
      };

      console.log(`[CAPTURED] ${method} ${pathname} (${status})`);
      
      // Guardar endpoints descubiertos
      fs.writeFileSync('api_discovered_endpoints.json', JSON.stringify(endpoints, null, 2), 'utf-8');
    }
  });

  try {
    console.log('Navegando a la página de inicio...');
    await page.goto('https://www.comunio.es', { waitUntil: 'networkidle' });

    // Aceptar cookies si aparece el banner
    const acceptBtn = page.locator('button:has-text("AGREE"), button:has-text("Aceptar"), #accept-btn');
    if (await acceptBtn.count() > 0) {
      console.log('Aceptando cookies...');
      await acceptBtn.first().click();
      await page.waitForTimeout(1000);
    }

    // Hacer clic en "Entrar" para abrir el login
    console.log('Abriendo formulario de login...');
    const entrarBtn = page.locator('button:has-text("Entrar")');
    await entrarBtn.first().click();
    await page.waitForTimeout(1000);

    // Rellenar credenciales
    console.log(`Introduciendo usuario: ${username}...`);
    await page.fill('input#usernameLogin', username);
    await page.fill('input#passwordLogin', password);

    // Hacer clic en enviar
    console.log('Enviando formulario...');
    const submitBtn = page.locator('button.login_loginButton__lZg4d');
    await submitBtn.click();

    // Esperar a que cargue la página tras el login
    console.log('Esperando redirección al panel de control (dashboard)...');
    await page.waitForTimeout(5000);

    const currentUrl = page.url();
    console.log(`URL actual: ${currentUrl}`);

    if (currentUrl.includes('login') || currentUrl === 'https://www.comunio.es/') {
      // Intentar ver si hay mensaje de error
      const errorMsg = await page.locator('.login_error__').innerText().catch(() => null);
      throw new Error(`Login fallido. Verifica tu usuario y contraseña. ${errorMsg ? 'Mensaje: ' + errorMsg : ''}`);
    }

    console.log('¡Login exitoso! Navegando por las secciones del juego para capturar la API...');

    // Navegar por la sección de alineación (Squad/Lineup)
    console.log('Navegando a Alineación...');
    const alineacionLink = page.locator('a:has-text("Alineación"), a[href*="lineup"]');
    if (await alineacionLink.count() > 0) {
      await alineacionLink.first().click();
      await page.waitForTimeout(4000);
    } else {
      console.log('No se encontró el enlace de Alineación por texto. Intentando navegación directa...');
      await page.goto('https://www.comunio.es/game/lineup', { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(4000);
    }

    // Navegar por la sección de Mercado (Market/Transfers)
    console.log('Navegando a Mercado...');
    const mercadoLink = page.locator('a:has-text("Mercado"), a[href*="transfer"]');
    if (await mercadoLink.count() > 0) {
      await mercadoLink.first().click();
      await page.waitForTimeout(4000);
    } else {
      console.log('No se encontró el enlace de Mercado por texto. Intentando navegación directa...');
      await page.goto('https://www.comunio.es/game/transfer', { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(4000);
    }

    // Navegar a Clasificación (Standings)
    console.log('Navegando a Clasificación...');
    const clasifLink = page.locator('a:has-text("Clasificación"), a[href*="standings"]');
    if (await clasifLink.count() > 0) {
      await clasifLink.first().click();
      await page.waitForTimeout(4000);
    } else {
      await page.goto('https://www.comunio.es/game/standings', { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(4000);
    }

    console.log('\n=================================================================');
    console.log('¡Descubrimiento completado con éxito!');
    console.log('Los endpoints descubiertos se han guardado en: api_discovered_endpoints.json');
    console.log('=================================================================\n');

  } catch (err) {
    console.error('\n[ERROR] Ocurrió un fallo durante el descubrimiento:', err.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
