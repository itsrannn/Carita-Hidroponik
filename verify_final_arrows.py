import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Navigate to the product detail page
        await page.goto("http://localhost:8000/product%20detail.html?id=1")

        # Wait for the related products slider to be visible to ensure the page has loaded
        slider_selector = ".related-product-slider"
        await page.wait_for_selector(slider_selector)

        # Locate the slider element
        slider_element = page.locator(slider_selector)

        # Take a screenshot of the slider area
        screenshot_path = "/home/jules/verification/final_modern_carousel_arrows.png"
        await slider_element.screenshot(path=screenshot_path)

        print(f"Screenshot saved to {screenshot_path}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
