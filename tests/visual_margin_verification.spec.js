const { test } = require('@playwright/test');

test.describe('Verifikasi Margin Visual', () => {
  const pagesToTest = [
    'index.html',
    'contact.html',
    'admin.html',
    'my-account.html', // Corrected filename
    'order-history.html'
  ];

  for (const pageUrl of pagesToTest) {
    test(`Ambil tangkapan layar dari ${pageUrl}`, async ({ page }) => {
      await page.goto(`http://localhost:8000/${pageUrl}`);
      // Tunggu hingga jaringan idle untuk memastikan semua konten dimuat
      await page.waitForLoadState('networkidle');
      const screenshotPath = `test-results/margin-check-${pageUrl.replace('.html', '').replace(' ', '-')}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
    });
  }
});
