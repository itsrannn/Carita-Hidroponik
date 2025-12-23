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
}

function changeLanguage(lang) {
  var select = document.querySelector("#google_translate_element select");
  if (select) {
    select.value = lang;
    select.dispatchEvent(new Event("change"));
  }

  // Update active button state
  document.querySelectorAll(".lang-btn").forEach(function(btn) {
    btn.classList.remove("active");
  });
  var activeButton = document.querySelector(`.lang-btn[data-lang='${lang}']`);
  if (activeButton) {
    activeButton.classList.add("active");
  }
}
