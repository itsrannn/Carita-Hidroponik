
from playwright.sync_api import sync_playwright
import re

def verify_dashboard_layout():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Blokir skrip otentikasi untuk mencegah pengalihan
        page.route(re.compile(r"js/admin-auth\.js"), lambda route: route.abort())

        # Buka halaman admin-dashboard
        page.goto('http://localhost:8000/admin-dashboard.html')

        # Tunggu hingga chart selesai dirender
        page.wait_for_selector('#salesTrendChart')
        page.wait_for_selector('#productSalesChart')

        # Ambil screenshot dengan diagram batang (default)
        page.screenshot(path='verification/dashboard_bar_chart_final.png')

        # Ganti ke diagram lingkaran
        page.select_option('#product-chart-type', 'pie')

        # Tunggu sebentar untuk memastikan transisi selesai
        page.wait_for_timeout(500)

        # Ambil screenshot dengan diagram lingkaran
        page.screenshot(path='verification/dashboard_pie_chart_final.png')

        browser.close()

if __name__ == "__main__":
    verify_dashboard_layout()
