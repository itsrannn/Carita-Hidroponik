document.addEventListener("DOMContentLoaded", async () => {
  // ========== LOAD HEADER ==========
  const headerContainer = document.getElementById("header-include");
  if (headerContainer) {
    try {
      const response = await fetch("components/header.html");
      headerContainer.innerHTML = await response.text();
      Alpine.initTree(headerContainer);

      // Cek apakah ini halaman index.html, jika iya, tambahkan tombol hamburger
      if (window.location.pathname.endsWith("index.html") || window.location.pathname === "/") {
        const topActions = headerContainer.querySelector(".top-actions");
        if (topActions) {
          const hamburgerBtn = document.createElement("button");
          hamburgerBtn.id = "menu-toggle";
          hamburgerBtn.className = "icon-btn";
          hamburgerBtn.setAttribute("aria-label", "Buka Menu");
          hamburgerBtn.innerHTML = '<i data-feather="menu"></i>';

          // --- LOGIKA BUKA/TUTUP SIDEBAR MOBILE ---
          hamburgerBtn.addEventListener("click", () => {
            const sidebar = document.getElementById("categorySidebar");
            if (sidebar) {
              sidebar.classList.toggle("mobile-active");
              document.body.classList.toggle("sidebar-open");
            }
          });

          topActions.appendChild(hamburgerBtn);
        }
      }

      // Jalankan feather icons di dalam header
      if (typeof feather !== "undefined") feather.replace();

      // --- LOGIKA DROPDOWN PROFIL ---
      // Ditempatkan di sini untuk memastikan elemen ada setelah fetch
      const dropdownToggle = document.getElementById("user-dropdown-toggle");
      const dropdownContent = document.getElementById("user-dropdown-content");

      if (dropdownToggle && dropdownContent) {
        dropdownToggle.addEventListener("click", (event) => {
          event.stopPropagation();
          dropdownContent.classList.toggle("active");
        });

        // Menutup dropdown jika klik di luar
        document.addEventListener("click", (event) => {
          if (!dropdownContent.contains(event.target) && !dropdownToggle.contains(event.target)) {
            dropdownContent.classList.remove("active");
          }
        });
      }

    } catch (err) {
      // Gagal memuat header, biarkan kosong
    }
  }

  // ========== LOAD FOOTER ==========
  const footerContainer = document.getElementById("footer-include");
  if (footerContainer) {
    try {
      const response = await fetch("components/footer.html");
      footerContainer.innerHTML = await response.text();

      // Jalankan feather icons di footer juga
      if (typeof feather !== "undefined") feather.replace();
    } catch (err) {
      // Gagal memuat footer, biarkan kosong
    }
  }
});
