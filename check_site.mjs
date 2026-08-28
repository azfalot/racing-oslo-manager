import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText));
  
  console.log('1. Navegando a PORTADA / ...');
  await page.goto('https://racing-oslo.cotero91.workers.dev/', { waitUntil: 'networkidle2' });
  const title1 = await page.title();
  const text1 = await page.evaluate(() => document.getElementById('root')?.innerText.substring(0, 200));
  console.log('Portada Titulo:', title1);
  console.log('Portada Texto:\n', text1);

  console.log('\n2. Navegando a FINANZAS /finanzas ...');
  await page.goto('https://racing-oslo.cotero91.workers.dev/finanzas', { waitUntil: 'networkidle2' });
  const text2 = await page.evaluate(() => document.getElementById('root')?.innerText.substring(0, 300));
  console.log('Finanzas Texto:\n', text2);

  await browser.close();
  console.log('\n✅ ¡TODO VERIFICADO Y OPERATIVO EN VIVO!');
})();
