
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        # Desktop screenshot
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.set_viewport_size({"width": 1280, "height": 800})
        await page.goto("http://localhost:8000/news-detail.html?id=1")
        await page.wait_for_timeout(5000)
        await page.screenshot(path="desktop_news_detail.png")

        # Mobile screenshot
        await page.set_viewport_size({"width": 375, "height": 667})
        await page.reload()
        await page.wait_for_timeout(5000)
        await page.screenshot(path="mobile_news_detail.png")

        await browser.close()

asyncio.run(main())
