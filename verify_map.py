
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    # Navigasi ke my-account.html. Ini akan dialihkan ke login, yang tidak masalah.
    # Saya hanya ingin memeriksa apakah elemen peta ada di DOM.
    page.goto('http://localhost:8000/my%20account.html')

    # Tunggu peta dimuat
    page.wait_for_selector('#map .leaflet-container')

    # Ambil tangkapan layar
    page.screenshot(path='my_account_map.png')

    browser.close()
