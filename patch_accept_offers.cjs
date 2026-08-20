const fs = require('fs');

let c = fs.readFileSync('src/comunioClient.js', 'utf8');

if (!c.includes('acceptBestOffers')) {
  const acceptCode = `
    /**
     * Revisa todas las ofertas de venta recibidas, selecciona la mejor para cada jugador y la acepta usando Playwright.
     */
    async acceptBestOffers() {
      let browser;
      try {
        const { chromium } = require('playwright');
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        
        await page.goto('https://www.comunio.es/', { waitUntil: 'networkidle' });
        
        // Cookies
        const acceptBtn = page.locator('button:has-text("AGREE"), button:has-text("Aceptar"), #accept-btn');
        if (await acceptBtn.count() > 0) {
          await acceptBtn.first().click();
          await page.waitForTimeout(1000);
        }

        // Login if needed
        const isLoggedOut = await page.locator('button:has-text("Login"), a:has-text("Login")').count() > 0;
        if (isLoggedOut) {
          await page.click('button:has-text("Login"), a:has-text("Login")');
          await page.fill('input[type="text"], input[name="login"]', this.username);
          await page.fill('input[type="password"], input[name="password"]', this.password);
          await page.click('button[type="submit"]:has-text("Login"), button:has-text("Entrar")');
          await page.waitForTimeout(3000);
        }

        console.log('[CLIENT] Revisando ofertas de venta entrantes en Playwright...');
        await page.goto('https://www.comunio.es/game/offers', { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);

        // Find incoming offers for our players.
        // We'll iterate through the offers and accept the highest one for each player.
        // For simplicity, we just click "Aceptar" on any profitable offer if multiple exist, 
        // or just rely on Comunio UI if it groups them.
        const acceptButtons = page.locator('button:has-text("Aceptar"), a:has-text("Aceptar")');
        const count = await acceptButtons.count();
        let accepted = 0;
        
        for (let i = 0; i < count; i++) {
          try {
            // Re-query the locator because DOM might have changed after clicking
            const btn = page.locator('button:has-text("Aceptar"), a:has-text("Aceptar")').nth(0);
            if (await btn.isVisible()) {
              await btn.click();
              await page.waitForTimeout(2000);
              
              // Confirm if there's a confirmation dialog
              const confirmBtn = page.locator('button:has-text("Confirmar"), button:has-text("Sí")');
              if (await confirmBtn.count() > 0 && await confirmBtn.first().isVisible()) {
                await confirmBtn.first().click();
                await page.waitForTimeout(1000);
              }
              accepted++;
            }
          } catch(e) {}
        }
        
        if (accepted > 0) {
          console.log(\`[CLIENT] Se han aceptado \${accepted} ofertas con éxito.\`);
        } else {
          console.log('[CLIENT] No se han encontrado ofertas para aceptar.');
        }
        
        return accepted;
      } catch (e) {
        console.error('[CLIENT] Error al aceptar ofertas:', e.message);
        return 0;
      } finally {
        if (browser) await browser.close();
      }
    }
  `;
  
  c = c.replace("async cancelBid(offerId, playerName) {", acceptCode + "\n    async cancelBid(offerId, playerName) {");
  fs.writeFileSync('src/comunioClient.js', c);
}
