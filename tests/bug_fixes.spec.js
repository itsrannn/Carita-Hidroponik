const { test, expect } = require('@playwright/test');

test.describe('Verification of Bug Fixes and Translations', () => {

  test.beforeEach(async ({ page }) => {
    // Handle any dialogs that might appear (e.g., when adding items to the cart)
    page.on('dialog', dialog => dialog.accept());
  });

  test('Admin dropdown can now be opened', async ({ page }) => {
    await page.goto('http://localhost:8000/admin.html');
    await page.waitForSelector('html[data-alpine-ready="true"]');

    // Switch to English first
    await page.locator('.lang-dropdown .icon-btn').click();
      await page.waitForTimeout(100); // Give dropdown time to open
    const englishButton = page.locator('.lang-dropdown .dropdown-content a[href="#"]').filter({ hasText: 'English' }).first();
    await englishButton.click();
    await page.waitForSelector('html[data-i18n-loaded="true"]');

    // Click the user dropdown button
    const userDropdownButton = page.locator('header .user-dropdown button');
    await userDropdownButton.click();

    // Verify that the dropdown content is now visible and translated
    const dropdownContent = page.locator('#user-dropdown-content');
    await expect(dropdownContent).toBeVisible();
    await expect(dropdownContent).toContainText('My Profile');

    // Click outside the dropdown to close it
    await page.locator('body').click({ position: { x: 10, y: 10 } });
    await expect(dropdownContent).not.toBeVisible();
  });

  test('Cart badge updates correctly after back navigation', async ({ page }) => {
    // Go to the main page
    await page.goto('http://localhost:8000/index.html');

    // Add the first item to the cart
    await page.locator('.product-card .add-cart').first().click();

    // Verify the cart badge shows '1'
    const cartBadge = page.locator('#cart-count');
    await expect(cartBadge).toHaveText('1');

    // Navigate to another page
    await page.goto('http://localhost:8000/contact.html');
    await expect(page).toHaveTitle(/Contact Us/); // Check for translated title

    // Navigate back to the main page using the browser's back button
    await page.goBack();

    // Verify the cart badge STILL shows '1' thanks to the bfcache fix
    await expect(cartBadge).toHaveText('1');
  });

  test('Home page main content is translated', async ({ page }) => {
      await page.goto('http://localhost:8000/index.html');
      await page.waitForSelector('html[data-alpine-ready="true"]');

      // Click the language dropdown and select English
      await page.locator('.lang-dropdown .icon-btn').click();
      await page.waitForTimeout(100); // Give dropdown time to open
      const englishButton = page.locator('.lang-dropdown .dropdown-content a[href="#"]').filter({ hasText: 'English' }).first();
      await englishButton.click();
      await page.waitForSelector('html[data-i18n-loaded="true"]');

      const mainHeading = page.locator('#Product h1');
      await expect(mainHeading).toHaveText('Featured Products');
      const categoryTitle = page.locator('#categorySidebar h4');
      // Corrected the expected text to match the translation file
      await expect(categoryTitle).toHaveText('Categories');
  });

  test('Login page is translated', async ({ page }) => {
      await page.goto('http://localhost:8000/login%20page.html');
      const loginButton = page.locator('#login-form .btn');
      await expect(loginButton).toHaveText('Login');
      const registerLink = page.locator('#login-form .register-link a');
      await expect(registerLink).toHaveText('Register');
  });

  test('My Account page redirects to login (as expected)', async ({ page }) => {
      await page.goto('http://localhost:8000/my%20account.html');
      // The page should redirect to the login page if not authenticated
      await expect(page).toHaveTitle(/Login Page/);
  });

  test('Cart page is translated', async ({ page }) => {
      await page.goto('http://localhost:8000/my%20cart.html');
      const pageTitle = page.locator('.cart-section .section-title');
      await expect(pageTitle).toHaveText('Shopping Cart');
      const emptyCartMessage = page.locator('.cart-empty-message');
      await expect(emptyCartMessage).toHaveText('Your shopping cart is empty.');
  });

  test('Product detail page is translated', async ({ page }) => {
      // Mock the API call to ensure the product data is available for the test
      await page.route('**/rest/v1/products**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 1, name: { id: 'Produk Uji', en: 'Test Product' }, category: 'seeds', price: 10000, characteristics: 'Test char', description: 'Test desc', image_url: '' }
          ]),
        });
      });
      await page.goto('http://localhost:8000/product%20detail.html?id=1');
      await page.waitForSelector('html[data-alpine-ready="true"]');

      // Wait for the component to signal it's ready
      await page.waitForSelector('.product-detail-container[data-ready="true"]');

      const addToCartButton = page.locator('.add-cart');
      await expect(addToCartButton).toBeVisible();
      await expect(addToCartButton).toContainText('Add to Cart');
      const descriptionTitle = page.locator('.product-detail-description h2');
      await expect(descriptionTitle).toHaveText('Product Description');
  });

  test('News detail page is translated', async ({ page }) => {
      // Mock the API call to ensure news data is available
      await page.route('**/rest/v1/news**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            { id: 1, title: 'Test News', created_at: new Date().toISOString(), content: 'Test content', image_url: '' }
          ),
        });
      });
      await page.goto('http://localhost:8000/news%20detail.html?id=1');
      const shareTitle = page.locator('.share-buttons h4');
      await expect(shareTitle).toHaveText('Share This Article:');
  });
});
