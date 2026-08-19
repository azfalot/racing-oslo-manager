import { chromium } from 'playwright';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const username = process.env.COMUNIO_USERNAME;
const password = process.env.COMUNIO_PASSWORD;

if (!username || !password || username === 'tu_usuario' || password === 'tu_contraseña') {
  console.error('\n[ERROR] Por favor, configura tus credenciales de Comunio en el archivo .env primero.');
  process.exit(1);
}

async function main() {
  console.log(`Intentando iniciar sesión con el usuario: ${username}...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  // Capturar respuestas de red interesantes
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('api.comunio.es') && response.status() === 200) {
      console.log(`[API Response] ${response.request().method()} ${url}`);
    }
  });

  try {
    await page.goto('https://www.comunio.es', { waitUntil: 'networkidle' });

    // Cookies
    const acceptBtn = page.locator('button:has-text("AGREE"), button:has-text("Aceptar"), #accept-btn');
    if (await acceptBtn.count() > 0) {
      console.log('Aceptando cookies...');
      await acceptBtn.first().click();
      await page.waitForTimeout(1000);
    }

    // Login modal
    console.log('Haciendo clic en Entrar...');
    const entrarBtn = page.locator('button:has-text("Entrar")');
    await entrarBtn.first().click();
    await page.waitForTimeout(1000);

    // Credenciales
    await page.fill('input#usernameLogin', username);
    await page.fill('input#passwordLogin', password);
    
    console.log('Enviando formulario...');
    const submitBtn = page.locator('button.login_loginButton__lZg4d');
    await submitBtn.click();

    // Esperar a la redirección
    console.log('Esperando carga del panel de juego...');
    await page.waitForTimeout(6000);

    const currentUrl = page.url();
    console.log(`URL actual después del login: ${currentUrl}`);

    if (currentUrl.includes('login') || currentUrl === 'https://www.comunio.es/') {
      console.log('El login parece haber fallado.');
      // Capturar pantalla para depuración
      await page.screenshot({ path: 'login_error.png' });
      console.log('Se ha guardado una captura de pantalla del error en login_error.png');
      throw new Error('No se pudo iniciar sesión. Verifica tus credenciales.');
    }

    console.log('¡Inicio de sesión exitoso!');

    // Extraer localStorage y cookies
    const localStorageData = await page.evaluate(() => {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        data[key] = localStorage.getItem(key);
      }
      return data;
    });

    const cookies = await context.cookies();

    const sessionInfo = {
      url: currentUrl,
      cookies,
      localStorage: localStorageData
    };

    fs.writeFileSync('src/session_info.json', JSON.stringify(sessionInfo, null, 2), 'utf-8');
    console.log('Información de sesión guardada en src/session_info.json');

  } catch (err) {
    console.error('Error durante el login:', err.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
