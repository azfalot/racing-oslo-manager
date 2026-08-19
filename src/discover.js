import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('=================================================================');
  console.log('Comunio API Discovery Tool');
  console.log('=================================================================');
  console.log('Este script iniciará un navegador visible.');
  console.log('Por favor, inicia sesión en Comunio y navega por las pestañas:');
  console.log('1. Inicio (Tablón de noticias)');
  console.log('2. Alineación');
  console.log('3. Mercado de fichajes');
  console.log('4. Clasificación / Tu perfil');
  console.log('=================================================================');
  console.log('El script registrará todas las llamadas a api.comunio.es...');
  console.log('Presiona Ctrl+C en la consola para detener el script cuando termines.');
  console.log('-----------------------------------------------------------------\n');

  const logFile = path.resolve('api_discovery_log.json');
  const capturedRequests = [];

  // Launch headful browser so the user can interact
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Monitor network responses
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('api.comunio.es') || url.includes('comunio.es/api')) {
      const request = response.request();
      const method = request.method();
      const status = response.status();

      // Skip OPTIONS requests
      if (method === 'OPTIONS') return;

      console.log(`[API CALL] ${method} ${url} -> Status: ${status}`);

      let responseBody = null;
      try {
        if (status >= 200 && status < 300) {
          responseBody = await response.json();
        }
      } catch (err) {
        // Response might not be JSON or already read
      }

      const headers = request.headers();
      const authHeader = headers['authorization'] || headers['Authorization'];
      if (authHeader) {
        console.log(`  -> Authorization Header detected: ${authHeader.substring(0, 20)}...`);
      }

      const record = {
        timestamp: new Date().toISOString(),
        method,
        url,
        requestHeaders: headers,
        postData: request.postData(),
        status,
        responseBody
      };

      capturedRequests.push(record);
      fs.writeFileSync(logFile, JSON.stringify(capturedRequests, null, 2), 'utf-8');
    }
  });

  await page.goto('https://www.comunio.es');

  // Keep running until closed manually
  page.on('close', () => {
    console.log('\nNavegador cerrado por el usuario. Guardando logs y saliendo...');
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Error en el script de descubrimiento:', err);
});
