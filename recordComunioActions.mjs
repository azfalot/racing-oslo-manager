import { chromium } from 'playwright';
import fs from 'fs';

async function recordUserActions() {
  console.log('🚀 Iniciando ventana interactiva de Comunio con grabador de red...');
  console.log('================================================================');
  console.log('Instrucciones para el usuario:');
  console.log('  1. Inicia sesión en la ventana de Comunio.');
  console.log('  2. Quita un jugador de la venta (icono de X o Retirar).');
  console.log('  3. Acepta una oferta de venta (Aceptar oferta).');
  console.log('================================================================\n');

  const browser = await chromium.launch({ 
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  const networkLogs = [];

  page.on('request', request => {
    if (request.url().includes('comunio.es')) {
      const logItem = {
        timestamp: new Date().toISOString(),
        method: request.method(),
        url: request.url(),
        postData: request.postData()
      };
      networkLogs.push(logItem);

      if (['POST', 'PUT', 'DELETE'].includes(request.method())) {
        console.log(`📡 [PETICIÓN WEB] ${request.method()} ${request.url()}`);
        if (request.postData()) {
          console.log(`   └─ DATOS ENVIADOS:`, request.postData());
        }
      }
    }
  });

  page.on('response', async response => {
    const reqMethod = response.request().method();
    if (response.url().includes('comunio.es') && ['POST', 'PUT', 'DELETE'].includes(reqMethod)) {
      let bodyText = '';
      try {
        bodyText = await response.text();
      } catch(e) {}
      console.log(`📥 [RESPUESTA ${response.status()}] ${reqMethod} ${response.url()}`);
      if (bodyText) {
        console.log(`   └─ RESPUESTA SERVIDOR:`, bodyText.substring(0, 300));
      }
    }
  });

  // Navigate to main Comunio page
  await page.goto('https://www.comunio.es');

  // Mantener la ventana abierta durante 3 minutos
  console.log('\n⏳ Esperando a que el usuario complete las dos acciones en la pantalla...');
  await new Promise(resolve => setTimeout(resolve, 180000));

  fs.writeFileSync('comunio_actions_log.json', JSON.stringify(networkLogs, null, 2));
  console.log('\n💾 Grabación finalizada. Datos guardados en comunio_actions_log.json');
  await browser.close();
}

recordUserActions();
