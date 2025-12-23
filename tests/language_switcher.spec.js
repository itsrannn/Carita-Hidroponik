const { test, expect } = require('@playwright/test');

test.describe('Language Switcher Functionality', () => {
  const BASE_URL = 'http://localhost:8000';

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/index.html`);
    // Wait for the header to be dynamically loaded and the buttons to be ready
    await page.waitForSelector('.lang-switcher-desktop .lang-btn');
  });

  test('should switch language to English and back to Indonesian', async ({ page }) => {
    // Define locators for easier access
    const heroTitle = page.locator('.hero-title').first();
    const enButton = page.locator('.lang-switcher-desktop .lang-btn[data-lang="en"]');
    const idButton = page.locator('.lang-switcher-desktop .lang-btn[data-lang="id"]');

    // --- Step 1: Verify initial state is Indonesian ---
    await expect(heroTitle).toContainText('DISKON 30% UNTUK SEMUA BENIH!');
    // Allow a moment for the sync function to run and set the initial active button
    await expect(idButton).toHaveClass(/active/, { timeout: 5000 });
    await expect(enButton).not.toHaveClass(/active/);

    // --- Step 2: Switch to English ---
    await enButton.click();

    // The translation is asynchronous. We wait for the original text to disappear.
    await expect(heroTitle).not.toContainText('DISKON 30% UNTUK SEMUA BENIH!', { timeout: 10000 });

    // Now, we check for the English text. Translations can be slightly different, so we use a regex.
    // Updated to match the actual translation from Google.
    await expect(heroTitle).toContainText(/30% OFF ON ALL SEEDS!/i);

    // Verify the 'EN' button is now active and 'ID' is not.
    await expect(enButton).toHaveClass(/active/);
    await expect(idButton).not.toHaveClass(/active/);

    // --- Step 3: Switch back to Indonesian ---
    await idButton.click();

    // Wait for the English text to disappear.
    await expect(heroTitle).not.toContainText(/30% DISCOUNT FOR ALL SEEDS!/i, { timeout: 10000 });

    // Verify the text has returned to the original Indonesian.
    await expect(heroTitle).toContainText('DISKON 30% UNTUK SEMUA BENIH!');

    // Verify the 'ID' button is active again and 'EN' is not.
    await expect(idButton).toHaveClass(/active/);
    await expect(enButton).not.toHaveClass(/active/);
  });
});
