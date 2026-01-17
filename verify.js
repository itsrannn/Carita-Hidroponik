
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Test Case: News Detail Page (ID: 1)
  await page.goto('http://localhost:8000/news-detail.html?id=1', { waitUntil: 'networkidle' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: 'desktop_news_detail_fixed.png' });

  await page.setViewportSize({ width: 375, height: 667 });
  await page.screenshot({ path: 'mobile_news_detail_fixed.png' });

  await browser.close();
})();
