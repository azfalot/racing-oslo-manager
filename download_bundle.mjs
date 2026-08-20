import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // capture the JS file
  let jsContent = '';
  page.on('response', async (response) => {
    if (response.url().endsWith('.js')) {
      jsContent = await response.text();
      fs.writeFileSync('remote_bundle.js', jsContent);
    }
  });

  await page.goto(`https://racing-oslo.cotero91.workers.dev/?v=${Date.now()}`, { waitUntil: 'networkidle2' });
  await browser.close();
  console.log('Bundle downloaded');
})();
