import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Navigating to https://www.comunio.es ...');
  await page.goto('https://www.comunio.es', { waitUntil: 'networkidle' });

  // Let's dump all inputs and buttons on the page
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

  console.log('\n--- Inputs Found ---');
  console.log(inputs);

  console.log('\n--- Buttons Found ---');
  console.log(buttons);

  await browser.close();
}

main().catch(console.error);
