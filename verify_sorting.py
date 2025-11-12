
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('http://localhost:8000')

    # Sort by price ascending
    page.select_option('select#sortSelect', 'price-asc')
    page.wait_for_timeout(1000)  # Tunggu render
    page.screenshot(path='sort_price_asc.png')

    # Sort by price descending
    page.select_option('select#sortSelect', 'price-desc')
    page.wait_for_timeout(1000)  # Tunggu render
    page.screenshot(path='sort_price_desc.png')

    browser.close()
