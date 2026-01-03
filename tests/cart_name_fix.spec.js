const { test, expect } = require('@playwright/test');

const MOCK_PRODUCTS = [
  {
    "id": 1,
    "created_at": "2024-01-01T00:00:00.000Z",
    "name": { "en": "Green Spinach", "id": "Bayam Hijau" },
    "description": { "en": "Fresh green spinach.", "id": "Bayam hijau segar." },
    "price": 15000,
    "category": "seeds",
    "stock": 100,
    "image_url": "img/product-1.jpg",
    "char": { "en": "Details about spinach.", "id": "Detail tentang bayam." },
    "discount_percent": 0,
    "discount_price": null
  },
  {
    "id": 2,
    "created_at": "2024-01-01T00:00:00.000Z",
    "name": null, // Malformed name
    "description": { "en": "A product with a null name.", "id": "Produk dengan nama null." },
    "price": 20000,
    "category": "nutrition",
    "stock": 50,
    "image_url": "img/product-2.jpg",
    "char": { "en": "Details.", "id": "Detail." },
    "discount_percent": 0,
    "discount_price": null
  },
  {
    "id": 3,
    "created_at": "2024-01-01T00:00:00.000Z",
    // Missing name property
    "description": { "en": "A product with a missing name.", "id": "Produk tanpa nama." },
    "price": 25000,
    "category": "equipment",
    "stock": 20,
    "image_url": "img/product-3.jpg",
    "char": { "en": "Details.", "id": "Detail." },
    "discount_percent": 10,
    "discount_price": null
  }
];

const MOCK_CART = [
  { "id": 1, "quantity": 2 },
  { "id": 2, "quantity": 1 },
  { "id": 3, "quantity": 3 }
];

test.describe('Cart Page Name Display', () => {
  test('should display correct names and fallbacks for products in the cart', async ({ page }) => {
    // 1. Mock the API call to fetch products before navigation
    await page.route('**/rest/v1/products**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PRODUCTS),
      });
    });

    // 2. Navigate to the base URL first to establish an origin for localStorage
    await page.goto('http://localhost:8000/');

    // 3. Set up the initial cart state in localStorage
    await page.evaluate(cart => {
      localStorage.setItem('cart', JSON.stringify(cart));
    }, MOCK_CART);

    // 4. Navigate to the cart page and wait for the product fetch to complete
    await Promise.all([
        page.waitForResponse('**/rest/v1/products**'),
        page.goto('http://localhost:8000/my%20cart.html')
    ]);

    // 5. Wait for the cart items to be rendered and visible
    await expect(page.locator('.cart-item')).toHaveCount(3);

    // 6. Assertions
    const cartItems = page.locator('.cart-item');

    // Check item 1 (Valid Name)
    const item1 = cartItems.nth(0);
    await expect(item1.locator('.item-name')).toHaveText('Green Spinach');
    await expect(item1.locator('.quantity-value')).toHaveText('2');

    // Check item 2 (Null Name)
    const item2 = cartItems.nth(1);
    await expect(item2.locator('.item-name')).toHaveText('Unnamed Product');
    await expect(item2.locator('.quantity-value')).toHaveText('1');

    // Check item 3 (Missing Name Property)
    const item3 = cartItems.nth(2);
    await expect(item3.locator('.item-name')).toHaveText('Unnamed Product');
    await expect(item3.locator('.quantity-value')).toHaveText('3');
  });
});
