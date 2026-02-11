
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://localhost:8000")

    # Wait for products to load
    page.wait_for_selector(".product-card", timeout=10000)

    print("--- PRODUCTS ---")
    products = page.locator(".product-card").all()
    for i, product in enumerate(products):
        img = product.locator("img")
        src = img.get_attribute("src")
        print(f"Product {i}: src='{src}'")

    print("\n--- NEWS ---")
    news_items = page.locator(".news-card").all()
    for i, news in enumerate(news_items):
        img = news.locator("img")
        src = img.get_attribute("src")
        print(f"News {i}: src='{src}'")

    browser.close()

if __name__ == "__main__":
    with sync_playwright() as playwright:
        run(playwright)
