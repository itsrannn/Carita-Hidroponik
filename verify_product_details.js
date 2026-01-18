
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:8000/product-details.html?id=1', { waitUntil: 'networkidle' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: 'product_details_desktop.png' });

  await browser.close();
})();
