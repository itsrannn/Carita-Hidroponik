/**
 * Initializes the Google Translate widget and sets up the language switcher buttons.
 * This function is the single entry point for all language-related functionality.
 * It's called by the Google Translate script once it's loaded.
 */
function googleTranslateElementInit() {
  new google.translate.TranslateElement(
    {
      pageLanguage: "id",
      includedLanguages: "en,id",
      layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
      autoDisplay: false,
    },
    "google_translate_element"
  );

  // Attach event listeners to all language switcher buttons on the page.
  // This ensures that any button, whether in the header or elsewhere, is functional.
  document.querySelectorAll(".lang-btn").forEach(button => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const lang = button.dataset.lang;
      if (lang) {
        changeLanguage(lang);
      }
    });
  });

  // Immediately synchronize the visual state of the buttons to reflect the current
  // language from the cookie. This removes the previous unreliable timeout.
  syncLanguageButtons();
}

/**
 * Changes the language by setting the 'googtrans' cookie and reloading the page.
 * This is a more reliable method than programmatically interacting with the widget.
 * @param {string} lang The target language code ('en' or 'id').
 */
function changeLanguage(lang) {
  // The cookie's value is the path of the source and target languages.
  // Example: /id/en for Indonesian to English.
  // We set the domain to the current hostname to ensure it's applied correctly,
  // especially when running on localhost.
  const currentDomain = window.location.hostname;
  document.cookie = `googtrans=/id/${lang}; path=/; domain=.${currentDomain}`;

  // A secondary cookie might be needed for root domains without subdomains (like localhost)
  document.cookie = `googtrans=/id/${lang}; path=/;`;

  // Reload the page for the change to take effect.
  window.location.reload();
}


/**
 * Reads the Google Translate cookie ('googtrans') and updates the active class
 * on the custom language switcher buttons to reflect the current language.
 */
function syncLanguageButtons() {
  const cookie = getCookie("googtrans");
  // Cookie value is '/sourceLang/targetLang', e.g., '/id/en'
  // Default to 'id' if the cookie is not set or has an unexpected value.
  const currentLang = (cookie && cookie.endsWith("/en")) ? "en" : "id";

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    if (btn.dataset.lang === currentLang) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

/**
 * Helper function to get a cookie by its name.
 * @param {string} name The name of the cookie.
 * @returns {string|null} The value of the cookie or null if not found.
 */
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return null;
}
