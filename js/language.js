/**
 * Initializes the Google Translate widget.
 * This function is called by the Google Translate script once it's loaded.
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

  // A short delay to allow the widget to render and its cookie to be processed.
  setTimeout(syncLanguageButtons, 500);
}

/**
 * Changes the language by manipulating the hidden Google Translate dropdown.
 * This function now polls for the select element to avoid race conditions.
 * @param {string} lang The target language code ('en' or 'id').
 */
function changeLanguage(lang) {
  const maxRetries = 15;
  let retries = 0;

  const intervalId = setInterval(() => {
    const select = document.querySelector(".goog-te-combo");

    if (select) {
      clearInterval(intervalId); // Stop polling
      select.value = lang;
      select.dispatchEvent(new Event("change"));
      // After triggering the change, wait for the cookie to be updated, then sync buttons.
      setTimeout(syncLanguageButtons, 500);
    } else {
      retries++;
      if (retries >= maxRetries) {
        clearInterval(intervalId); // Stop polling
        console.error("ERROR: Could not find the Google Translate select element (.goog-te-combo) after multiple retries. Translation cannot proceed.");
      }
    }
  }, 200);
}


/**
 * Reads the Google Translate cookie ('googtrans') and updates the active class
 * on the custom language switcher buttons to reflect the current language.
 */
function syncLanguageButtons() {
  const cookie = getCookie("googtrans");
  // Cookie value is '/sourceLang/targetLang', e.g., '/id/en'
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
