// ================== SIDEBAR TOGGLE (MOBILE) ==================
function setupSidebarToggle() {
  const mobileMenuSidebar = document.getElementById("categorySidebar");
  const menuToggle = document.getElementById("menu-toggle");

  if (menuToggle && mobileMenuSidebar) {
    menuToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      mobileMenuSidebar.classList.toggle("mobile-active");
      document.body.classList.toggle("sidebar-open");
    });

    document.addEventListener("click", (e) => {
      if (
        mobileMenuSidebar.classList.contains("mobile-active") &&
        !mobileMenuSidebar.contains(e.target) &&
        !menuToggle.contains(e.target)
      ) {
        mobileMenuSidebar.classList.remove("mobile-active");
        document.body.classList.remove("sidebar-open");
      }
    });
  }
}

// Gunakan MutationObserver untuk mendeteksi kapan header dimuat
const headerContainer = document.getElementById("header-include");
if (headerContainer) {
  const observer = new MutationObserver((mutationsList, observer) => {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList') {
        const menuToggle = document.getElementById("menu-toggle");
        if (menuToggle) {
          setupSidebarToggle();
          observer.disconnect(); // Hentikan observasi setelah tombol ditemukan
          break;
        }
      }
    }
  });

  observer.observe(headerContainer, { childList: true, subtree: true });
}

// ================== COLLAPSE SIDEBAR (DESKTOP MODE) ==================
const collapseBtn = document.getElementById("sidebar-collapse");
const categoryList = document.getElementById("categoryList");

if (collapseBtn && categoryList) {
  collapseBtn.addEventListener("click", () => {
    categoryList.classList.toggle("hidden");
    collapseBtn.textContent = categoryList.classList.contains("hidden")
      ? "+"
      : "−";
  });
}

// ================== CATEGORY FILTER ==================
document.querySelectorAll(".category-list a").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();

    document
      .querySelectorAll(".category-list a")
      .forEach((l) => l.classList.remove("active"));
    e.target.classList.add("active");

    const cat = e.target.dataset.cat;
    const element = document.querySelector("[x-data^='products']");
    const alpineComponent = element ? Alpine.$data(element) : null;

    if (alpineComponent) {
      alpineComponent.selectedCategory = cat;
    }
  });
});

// ================== SORTING ==================
const sortSelect = document.getElementById("sortSelect");

if (sortSelect) {
  sortSelect.addEventListener("change", (e) => {
    const element = document.querySelector("[x-data^='products']");
    const alpineComponent = element ? Alpine.$data(element) : null;

    if (alpineComponent) {
      alpineComponent.sortOption = e.target.value;
    }
  });
}

// ================== FEATHER ICONS REFRESH & ALPINE START ==================
document.addEventListener("DOMContentLoaded", () => {
  if (typeof feather !== "undefined") feather.replace();

  // Start Alpine now that all components and stores are registered
  if (window.Alpine) {
    window.Alpine.start();
  }
});

// ================== CART BADGE REFRESH ON BFCACHE ==================
window.addEventListener('pageshow', (event) => {
  // Check if the page was loaded from the back-forward cache
  if (event.persisted) {
    // If so, re-initialize the cart from localStorage to ensure the badge is up-to-date
    // This requires Alpine.js and the cart store to be available
    if (window.Alpine && Alpine.store('cart')) {
      Alpine.store('cart').init();
    }
  }
});

// ==================== Alpine Store: Products Component ====================
document.addEventListener("alpine:init", () => {
  Alpine.store("productsComponent", {
    searchTerm: "",
    selectedCategory: "all",
    sortOption: "default",
    currentPage: 1,
    itemsPerPage: 6,
  });
});

// ==================== Alpine Store: Pagination ====================
document.addEventListener("DOMContentLoaded", () => {
  const paginationLinks = document.querySelectorAll(".pagination a");

  paginationLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      // biar tetap jalanin fungsi aslinya kalau ada
      setTimeout(() => {
        window.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      }, 100); // jeda sedikit agar perubahan halaman keburu render
    });
  });
});
