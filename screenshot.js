
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8000');
  await page.waitForSelector('.topbar-inner');
  const topbar = await page.locator('.topbar-inner');
  await topbar.screenshot({ path: 'after_screenshot.png' });
  await browser.close();
})();
