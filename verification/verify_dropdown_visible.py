from playwright.sync_api import sync_playwright, expect
import sys

def verify_dropdown(page, screenshot_path):
    """
    Navigates to the index page, clicks the language dropdown,
    and takes a screenshot.
    """
    page.goto("http://localhost:8000/index.html")

    # Click the language switcher button to open the dropdown
    lang_switcher_button = page.locator("#language-switcher button")
    lang_switcher_button.click()

    # The dropdown content itself
    dropdown_content = page.locator("#language-switcher-options")

    # Use a web-first assertion to wait for the dropdown to be visible
    expect(dropdown_content).to_be_visible()

    # Take a screenshot
    page.screenshot(path=screenshot_path)
    print(f"Screenshot saved to {screenshot_path}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python verify_dropdown_visible.py <screenshot_path>")
        sys.exit(1)

    screenshot_path = sys.argv[1]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_dropdown(page, screenshot_path)
        finally:
            browser.close()
