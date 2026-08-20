import puppeteer from 'puppeteer';
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  await page.goto(`https://racing-oslo.cotero91.workers.dev/?v=${Date.now()}`, { waitUntil: 'networkidle2' });
  const rootHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML.substring(0, 300));
  console.log('ROOT HTML:', rootHtml);
  await browser.close();
})();
