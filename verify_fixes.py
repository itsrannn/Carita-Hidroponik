import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        await page.goto("http://localhost:8000/index.html")

        # Tunggu hingga produk selesai dimuat
        await page.wait_for_selector(".products-grid .product-card")

        # Tunggu hingga berita selesai dimuat
        await page.wait_for_selector(".news-grid .news-card-link")

        # Beri waktu sedikit agar semua gambar dan ikon selesai dirender
        await page.wait_for_timeout(2000)

        await page.screenshot(path="verification.png", full_page=True)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
