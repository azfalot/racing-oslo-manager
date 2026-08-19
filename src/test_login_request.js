import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('request', request => {
    const url = request.url();
    if (url.includes('comunio')) {
      console.log(`[REQUEST] ${request.method()} ${url}`);
      const postData = request.postData();
      if (postData) {
        console.log(`  -> Payload: ${postData}`);
      }
    }
  });

  page.on('response', response => {
    const url = response.url();
    if (url.includes('comunio')) {
      console.log(`[RESPONSE] ${response.status()} ${url}`);
    }
  });
  
  console.log('Navigating to https://www.comunio.es ...');
  await page.goto('https://www.comunio.es', { waitUntil: 'networkidle' });

  // Handle GDPR banner if present
  try {
    const agreeBtn = page.locator('button:has-text("AGREE"), button:has-text("Aceptar"), #accept-btn');
    if (await agreeBtn.count() > 0) {
      await agreeBtn.first().click();
      await page.waitForTimeout(1000);
    }
  } catch (err) {}

  // Click the "Entrar" button to open the login form
  const entrarBtn = page.locator('button:has-text("Entrar")');
  await entrarBtn.first().click();
  await page.waitForTimeout(1000);

  // Fill in fake credentials
  console.log('Filling in fake credentials...');
  await page.fill('input#usernameLogin', 'fakeuser_antigravity');
  await page.fill('input#passwordLogin', 'fakepassword123');

  // Click the submit "Entrar" button
  console.log('Clicking submit "Entrar" button...');
  // Let's use the button with class login_loginButton__lZg4d
  const submitBtn = page.locator('button.login_loginButton__lZg4d');
  await submitBtn.click();

  // Wait for network response
  await page.waitForTimeout(3000);

  await browser.close();
}

main().catch(console.error);
