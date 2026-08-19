import { chromium } from 'playwright';
import fs from 'fs';

async function launch() {
  console.log('================================================================');
  console.log('INICIANDO BRAVE INTERCEPTOR');
  console.log('================================================================');
  
  // Buscar ruta por defecto de Brave en Windows
  const bravePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
  
  console.log(`Buscando Brave en: ${bravePath}`);
  
  try {
    const browser = await chromium.launch({
      executablePath: bravePath,
      headless: false,
      args: [
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });

    const context = await browser.newContext();
    const page = await context.newPage();
    
    const captured = [];

    // Interceptar peticiones salientes
    page.on('request', request => {
      const url = request.url();
      if (url.includes('api.comunio.es')) {
        captured.push({
          url,
          method: request.method(),
          headers: request.headers(),
          postData: request.postData()
        });
        fs.writeFileSync('captured_sale_requests.json', JSON.stringify(captured, null, 2));
      }
    });

    console.log('\n🟢 Brave abierto. Sigue estos pasos:');
    console.log('1. Inicia sesión en Comunio.es.');
    console.log('2. Ve a la pestaña "Mercado" y luego a la sección "Ventas".');
    console.log('3. Pon en venta a cualquier jugador (puedes retirarlo después).');
    console.log('4. Cierra la ventana del navegador Brave.');
    console.log('================================================================\n');

    await page.goto('https://www.comunio.es');

    // Esperar hasta que se cierre el navegador
    await new Promise(resolve => browser.on('disconnected', resolve));
    console.log('❌ Navegador cerrado. Tráfico guardado en: captured_sale_requests.json');
  } catch (err) {
    console.error('Error al lanzar Brave:', err.message);
    console.log('Asegúrate de tener Brave instalado en la ruta por defecto o edita el script con tu ruta.');
  }
}

launch();
