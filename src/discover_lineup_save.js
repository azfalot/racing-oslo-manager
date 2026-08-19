import { chromium } from 'playwright';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const username = process.env.COMUNIO_USERNAME;
const password = process.env.COMUNIO_PASSWORD;

async function main() {
  console.log('=================================================================');
  console.log('Descubridor de Guardar Alineación y Pujas');
  console.log('=================================================================');
  console.log('Iniciando navegador... Por favor, realiza las siguientes acciones:');
  console.log('1. Cambia un jugador de tu alineación por otro en el panel de alineación.');
  console.log('2. Haz clic en "Guardar alineación".');
  console.log('3. Haz una puja ficticia baja en algún jugador en el mercado.');
  console.log('4. Cierra el navegador cuando termines.');
  console.log('=================================================================\n');

  const browser = await chromium.launch({ headless: false }); // Headful para que el usuario interactúe
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('request', async (request) => {
    const url = request.url();
    if (url.includes('api.comunio.es')) {
      const method = request.method();
      if (method === 'POST' || method === 'PUT') {
        console.log(`\n[INTERCEPTED ${method}] ${url}`);
        console.log('Payload:', request.postData());
      }
    }
  });

  try {
    await page.goto('https://www.comunio.es', { waitUntil: 'networkidle' });

    // Cookies
    const acceptBtn = page.locator('button:has-text("AGREE"), button:has-text("Aceptar"), #accept-btn');
    if (await acceptBtn.count() > 0) {
      await acceptBtn.first().click();
    }

    // Login
    const entrarBtn = page.locator('button:has-text("Entrar")');
    await entrarBtn.first().click();

    await page.fill('input#usernameLogin', username);
    await page.fill('input#passwordLogin', password);

    const submitBtn = page.locator('button.login_loginButton__lZg4d');
    await submitBtn.click();

    // Esperar a que el usuario termine y cierre el navegador
    await new Promise((resolve) => {
      page.on('close', resolve);
    });

    console.log('\nNavegador cerrado. Finalizando captura...');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
