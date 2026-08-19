import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Navigating to https://www.comunio.es ...');
  await page.goto('https://www.comunio.es', { waitUntil: 'networkidle' });

  // Handle GDPR banner if present
  try {
    const agreeBtn = page.locator('button:has-text("AGREE"), button:has-text("Aceptar"), #accept-btn');
    if (await agreeBtn.count() > 0) {
      console.log('GDPR banner detected. Clicking AGREE...');
      await agreeBtn.first().click();
      await page.waitForTimeout(1000);
    }
  } catch (err) {
    console.log('No GDPR banner or error clicking it:', err.message);
  }

  // Click the "Entrar" button
  console.log('Clicking "Entrar" button...');
  const entrarBtn = page.locator('button:has-text("Entrar")');
  await entrarBtn.first().click();
  await page.waitForTimeout(2000);

  // Dump the input fields and buttons now
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map(input => ({
      type: input.type,
      name: input.name,
      id: input.id,
      placeholder: input.placeholder,
      className: input.className
    }));
  });

  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(button => ({
      text: button.innerText,
      id: button.id,
      className: button.className,
      type: button.type
    }));
  });

  console.log('\n--- Inputs Found After Clicking "Entrar" ---');
  console.log(inputs);

  console.log('\n--- Buttons Found After Clicking "Entrar" ---');
  console.log(buttons);

  await browser.close();
}

main().catch(console.error);
