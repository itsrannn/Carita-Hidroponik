const { test, expect } = require('@playwright/test');

test.describe('Verifikasi Perbaikan Bug', () => {

  test.beforeEach(async ({ page }) => {
    // Menangani dialog yang mungkin muncul (misalnya, saat item ditambahkan ke keranjang)
    page.on('dialog', dialog => dialog.accept());
  });

  test('Dropdown admin sekarang dapat dibuka', async ({ page }) => {
    await page.goto('http://localhost:8000/admin.html');

    // Klik tombol dropdown pengguna
    const userDropdownButton = page.locator('header .user-dropdown button');
    await userDropdownButton.click();

    // Verifikasi bahwa konten dropdown sekarang terlihat
    const dropdownContent = page.locator('header .dropdown-content');
    await expect(dropdownContent).toBeVisible();

    // Ambil tangkapan layar untuk verifikasi visual
    await page.screenshot({ path: '/home/jules/verification/admin_dropdown_fix_verified.png' });

    // Klik di luar dropdown untuk menutupnya
    await page.locator('body').click({ position: { x: 10, y: 10 } });
    await expect(dropdownContent).not.toBeVisible();
  });

  test('Lencana keranjang diperbarui setelah navigasi kembali', async ({ page }) => {
    // Buka halaman utama
    await page.goto('http://localhost:8000/index.html');

    // Tambahkan item pertama ke keranjang
    await page.locator('.product-card .add-cart').first().click();

    // Verifikasi bahwa lencana keranjang menunjukkan '1'
    const cartBadge = page.locator('#cart-count');
    await expect(cartBadge).toHaveText('1');

    // Navigasi ke halaman lain
    await page.goto('http://localhost:8000/contact.html');
    await expect(page).toHaveTitle(/Kontak/); // Pastikan halaman baru dimuat

    // Navigasi kembali ke halaman utama menggunakan tombol kembali browser
    await page.goBack();

    // Verifikasi bahwa lencana keranjang MASIH menunjukkan '1' berkat perbaikan bfcache
    await expect(cartBadge).toHaveText('1');

    // Ambil tangkapan layar
    await page.screenshot({ path: '/home/jules/verification/cart_badge_fix_verified.png' });
  });

});
