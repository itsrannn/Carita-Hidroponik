document.addEventListener("DOMContentLoaded", async () => {
  // ========== LOAD HEADER ==========
  const headerContainer = document.getElementById("header-include");
  if (headerContainer) {
    try {
      const response = await fetch("components/header.html");
      headerContainer.innerHTML = await response.text();

      // Jalankan feather icons di dalam header
      if (typeof feather !== "undefined") feather.replace();

      // Re-inisialisasi AlpineJS untuk mengenali komponen di header
      if (typeof Alpine !== "undefined") Alpine.initTree(headerContainer);

    } catch (err) {
      console.error("Gagal memuat header:", err);
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
      console.error("Gagal memuat footer:", err);
    }
  }
});
