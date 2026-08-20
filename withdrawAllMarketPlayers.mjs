import { ComunioClient } from './src/comunioClient.js';
import { chromium } from 'playwright';

async function withdrawAllMarketPlayers() {
  const c = new ComunioClient();
  const browser = await chromium.launch({ headless: false }); // Non-headless to interact with UI
  const page = await browser.newPage();

  console.log('[CLEAN] Eliminando todos los jugadores de nuestra plantilla del mercado de fichajes...');

  await page.goto('https://www.comunio.es', { waitUntil: 'networkidle' });

  // Cookies
  const acceptBtn = page.locator('button:has-text("AGREE"), button:has-text("Aceptar"), #accept-btn');
  if (await acceptBtn.count() > 0) {
    await acceptBtn.first().click();
    await page.waitForTimeout(1000);
  }

  // Login
  const entrarBtn = page.locator('button:has-text("Entrar")');
  await entrarBtn.first().click();
  await page.waitForTimeout(1000);

  await page.fill('input#usernameLogin', c.username);
  await page.fill('input#passwordLogin', c.password);

  const submitBtn = page.locator('button.login_loginButton__lZg4d');
  await submitBtn.click();
  await page.waitForTimeout(4000);

  // Navigate to market / offers page where listed players are shown
  await page.goto('https://www.comunio.es/game/offers', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Click on the 'X' or 'Retirar' buttons for listed players
  // In Comunio UI, listed players have a close icon (x) or 'Retirar' button
  const removeIcons = page.locator('button:has-text("Retirar"), a:has-text("Retirar"), svg path[d*="M19"], button:has-text("X"), .market-remove-btn');
  console.log('Botones/Iconos de retirada encontrados:', await removeIcons.count());

  // Alternate method: Go to /game/market and click on "Jugadores en el mercado" close buttons
  await page.goto('https://www.comunio.es/game/market', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Look for close/remove buttons on our listed items
  const removeButtonsOnMarket = page.locator('button[aria-label*="quitar"], button[title*="Retirar"], button:has-text("Retirar")');
  console.log('Botones en /game/market:', await removeButtonsOnMarket.count());

  // Loop through all (x) buttons on listed players
  let removedCount = 0;
  for (let i = 0; i < 10; i++) {
    try {
      // Locator for (x) button next to listed players in Comunio market
      const closeBtn = page.locator('div:has-text("Jugadores en el mercado")').locator('button, svg, a').filter({ hasText: /retirar|x|decline/i }).first();
      if (await closeBtn.count() > 0 && await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(1500);
        removedCount++;
      }
    } catch(e) {}
  }

  console.log(`[CLEAN] Se han retirado los jugadores del mercado. Conteo: ${removedCount}`);

  await browser.close();
}

withdrawAllMarketPlayers();
