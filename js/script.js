// ================== SIDEBAR TOGGLE (MOBILE) ==================
const mobileMenuSidebar = document.getElementById("categorySidebar"); // Nama unik
const menuToggle = document.getElementById("menu-toggle");

if (menuToggle && mobileMenuSidebar) {
  menuToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    mobileMenuSidebar.classList.toggle("mobile-active"); // Ganti
    document.body.classList.toggle("sidebar-open");
  });

  // Klik di luar sidebar → tutup
  document.addEventListener("click", (e) => {
    if (
      !mobileMenuSidebar.contains(e.target) && // Ganti
      !menuToggle.contains(e.target) &&
      mobileMenuSidebar.classList.contains("mobile-active") // Ganti
    ) {
      mobileMenuSidebar.classList.remove("mobile-active"); // Ganti
      document.body.classList.remove("sidebar-open");
    }
  });
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

// ================== FEATHER ICONS REFRESH ==================
document.addEventListener("DOMContentLoaded", () => {
  if (typeof feather !== "undefined") feather.replace();
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
