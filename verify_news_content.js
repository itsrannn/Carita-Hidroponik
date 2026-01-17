
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8000/news-detail.html?id=1');
  // Wait for the title element to be rendered, which indicates Alpine.js has processed the data.
  await page.waitForSelector('h1', { timeout: 5000 });
  // Add a small extra delay just in case.
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'news-detail-screenshot.png' });
  await browser.close();
})();
