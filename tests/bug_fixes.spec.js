const { test, expect } = require('@playwright/test');

test.describe('Verification of Bug Fixes and Translations', () => {

  test.beforeEach(async ({ page }) => {
    // Handle any dialogs that might appear (e.g., when adding items to the cart)
    page.on('dialog', dialog => dialog.accept());
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


  test('Login page is translated', async ({ page }) => {
      await page.goto('http://localhost:8000/login-page.html');
      const loginButton = page.locator('#login-form .btn');
      await expect(loginButton).toHaveText('Login');
      const registerLink = page.locator('#login-form .register-link a');
      await expect(registerLink).toHaveText('Register');
  });

  test('My Account page redirects to login page', async ({ page }) => {
      await page.goto('http://localhost:8000/my-account.html');
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
      await expect(descriptionTitle).toHaveText('Specifications');
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
