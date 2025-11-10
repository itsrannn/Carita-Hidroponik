// ==================== Data Produk Global ====================
// **PERUBAHAN:** Data produk dipindah ke sini (menjadi global)
// agar bisa dibaca oleh script di 'product detail.html'
const allProducts = [
  {
    id: 1,
    name: "Benih Cabai Carolina",
    category: "benih",
    price: 12000,
    img: "img/general/Kucing Anggora.jpg",
    char: "Benih Unggul <br> - Tingkat Pedas: Sangat Tinggi <br> - Perawatan: Sedang <br> - Masa Panen: 90 hari",
    desc: "Benih Cabai Carolina Reaper, dikenal sebagai salah satu cabai terpedas di dunia. Cocok untuk Anda yang menyukai tantangan rasa pedas ekstrem. Perlu perawatan ekstra untuk hasil optimal.",
  },
  {
    id: 2,
    name: "Benih Tomat Cherry",
    category: "benih",
    price: 12000,
    img: "img/general/Munchkin.jpg",
    char: "Rasa Manis <br> - Mudah Tumbuh <br> - Ideal untuk Pot <br> - Panen Cepat",
    desc: "Benih Tomat Cherry (Solanum lycopersicum var. cerasiforme) menghasilkan buah tomat kecil yang manis dan segar. Sangat mudah ditanam, baik di lahan maupun di dalam pot, dan cepat berbuah.",
  },
  {
    id: 3,
    name: "Benih Selada",
    category: "benih",
    price: 15000,
    img: "img/general/Kucing Hutan (1).jpg",
    char: "Daun Renyah <br> - Cepat Tumbuh <br> - Tahan Suhu Sejuk <br> - Populer untuk Salad",
    desc: "Benih Selada (Lactuca sativa) jenis Lollo Rossa. Memiliki daun keriting berwarna hijau dengan semburat merah yang cantik. Teksturnya renyah dan rasanya segar, sempurna untuk salad.",
  },
  {
    id: 4,
    name: "Benih Brokoli",
    category: "benih",
    price: 10000,
    img: "img/general/Kucing Hutan.jpg",
    char: "Kaya Nutrisi <br> - Tahan Hama <br> - Suhu Sejuk <br> - Ukuran Kepala Sedang",
    desc: "Benih Brokoli varietas Green Magic. Menghasilkan kepala bunga yang padat dan berwarna hijau gelap. Dikenal kaya akan vitamin dan mineral, serta memiliki ketahanan yang baik terhadap hama.",
  },
  {
    id: 5,
    name: "Pupuk Organik",
    category: "nutrisi",
    price: 25000,
    img: "img/general/Anggora.jpg",
    char: "Kompos Murni <br> - Menyuburkan Tanah <br> - Ramah Lingkungan <br> - 5kg",
    desc: "Pupuk organik murni dari kompos berkualitas tinggi. Membantu memperbaiki struktur tanah, meningkatkan ketersediaan unsur hara, dan ramah lingkungan. Cocok untuk semua jenis tanaman.",
  },
  {
    id: 6,
    name: "Pupuk ZA",
    category: "nutrisi",
    price: 30000,
    img: "img/general/Kucing Besar.jpg",
    char: "Sumber Nitrogen <br> - Non-Organik <br> - Merangsang Daun <br> - 1kg",
    desc: "Pupuk ZA (Zwavelzure Ammoniak) adalah pupuk kimia yang kaya akan Nitrogen dan Sulfur. Sangat baik untuk merangsang pertumbuhan daun tanaman pada fase vegetatif.",
  },
  {
    id: 7,
    name: "Sekam Bakar",
    category: "media",
    price: 7000,
    img: "img/general/Kucing Hutan.jpg",
    char: "Media Tanam <br> - Porositas Tinggi <br> - Steril <br> - 1 karung",
    desc: "Sekam bakar adalah media tanam yang populer karena porositasnya yang tinggi, membuatnya tidak mudah padat dan baik untuk aerasi akar. Sudah disterilkan melalui proses pembakaran.",
  },
  {
    id: 8,
    name: "Spons Hidroponik",
    category: "media",
    price: 3000,
    img: "img/general/Anggora.jpg",
    char: "Media Semai <br> - Hidroponik <br> - Menyerap Air <br> - 1 Papan",
    desc: "Spons khusus untuk media semai hidroponik. Mampu menahan air dengan baik namun tetap memberikan ruang bagi akar untuk bernapas. Ideal untuk memulai semaian.",
  },
  {
    id: 9,
    name: "Gunting Tanaman",
    category: "peralatan",
    price: 75000,
    img: "img/general/Kucing Besar.jpg",
    char: "Stainless Steel <br> - Tajam & Presisi <br> - Ergonomis <br> - Anti Karat",
    desc: "Gunting pangkas (pruning shears) berkualitas tinggi. Terbuat dari stainless steel yang tajam dan tahan karat. Didesain ergonomis agar nyaman digunakan untuk memotong dahan.",
  },
];

// ==================== Data Berita Global ====================
const allNews = [
  {
    id: 1,
    title: "5 Langkah Mudah Menanam Selada Hidroponik untuk Pemula",
    summary:
      "Pelajari panduan lengkap menanam selada air dengan sistem hidroponik di rumah. Cocok untuk pemula!",
    category: "Tutorial",
    date: "10 Nov 2025",
    image: "img/coming soon.jpg",
  },
  {
    id: 2,
    title: "Nutrisi AB Mix: Rahasia Pertumbuhan Cepat Tanaman Hidroponik",
    summary:
      "Kenali kandungan dan cara menggunakan nutrisi AB Mix agar tanaman hidroponik tumbuh optimal!",
    category: "Berita",
    date: "9 Nov 2025",
    image: "img/coming soon.jpg",
  },
];

// ==================== NEWS RENDER FIX ====================
function renderNewsCards(newsData) {
  const container = document.getElementById("index-news-container");
  if (!container) return; // kalau belum ada di halaman, skip

  container.innerHTML = ""; // bersihkan kontainer dulu

  newsData.forEach((news) => {
    const card = document.createElement("a");
    card.href = `news detail.html?id=${news.id}`;
    card.classList.add("news-card");
    card.innerHTML = `
      <img src="${news.image}" alt="${news.title}" />
      <div class="news-card-content">
        <div class="news-card-category">${news.category}</div>
        <h3 class="news-card-title">${news.title}</h3>
        <p class="news-card-summary">${news.summary}</p>
        <div class="news-card-date">${news.date}</div>
      </div>
    `;
    container.appendChild(card);
  });
}

// Jalankan otomatis setelah DOM siap
document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("index-news-container");
  if (container) {
    renderNewsCards(allNews);
  }

  // feather icon
  if (typeof feather !== "undefined") feather.replace();
});

// ==================== Alpine.js Product Data ====================
window.products = function () {
  return {
    searchTerm: "",
    currentPage: 1,
    itemsPerPage: 8,
    selectedCategory: "all",
    sortOption: "default",
    items: allProducts,

    // --- TAMBAHAN: Fungsi init untuk me-reset halaman saat filter berubah ---
    init() {
      // Awasi perubahan pada 'selectedCategory'
      this.$watch("selectedCategory", () => {
        this.currentPage = 1;
      });

      // Awasi perubahan pada 'searchTerm'
      this.$watch("searchTerm", () => {
        this.currentPage = 1;
      });

      // Awasi perubahan pada 'sortOption'
      this.$watch("sortOption", () => {
        this.currentPage = 1;
      });

      // Awasi perubahan pada 'currentPage' untuk me-render ulang ikon
      this.$watch('currentPage', () => {
        // Tunggu hingga DOM diperbarui oleh Alpine, baru ganti ikon
        this.$nextTick(() => {
          feather.replace();
        });
      });
    },
    // --- AKHIR TAMBAHAN ---

    formatRupiah(value) {
      if (!value) return "Rp 0";
      return "Rp " + value.toLocaleString("id-ID");
    },

    filteredItems() {
      let filtered = this.items;

      if (this.selectedCategory !== "all") {
        filtered = filtered.filter(
          (item) => item.category === this.selectedCategory
        );
      }

      if (this.searchTerm.trim() !== "") {
        filtered = filtered.filter((item) =>
          item.name.toLowerCase().includes(this.searchTerm.toLowerCase())
        );
      }

      return filtered;
    },

    sortedItems() {
      let items = [...this.filteredItems()];

      if (this.sortOption === "price-asc") {
        items.sort((a, b) => a.price - b.price);
      } else if (this.sortOption === "price-desc") {
        items.sort((a, b) => b.price - b.price);
      }

      return items;
    },

    paginatedItems() {
      const start = (this.currentPage - 1) * this.itemsPerPage;
      const end = start + this.itemsPerPage;
      return this.sortedItems().slice(start, end);
    },

    totalPages() {
      return Math.ceil(this.sortedItems().length / this.itemsPerPage);
    },

    goToPage(page) {
      if (page >= 1 && page <= this.totalPages()) {
        this.currentPage = page;
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
  };
};

// ==================== Alpine Store: Cart ====================
document.addEventListener("alpine:init", () => {
  Alpine.store("cart", {
    items: JSON.parse(localStorage.getItem('cartItems')) || [],
    total: 0,
    quantity: 0,

    init() {
      this.updateTotals();
      // Watch for changes and save to localStorage
      this.$watch('items', () => {
        localStorage.setItem('cartItems', JSON.stringify(this.items));
        this.updateTotals();
      });
    },

    add(newItem) {
      const existing = this.items.find((item) => item.id === newItem.id);

      if (existing) {
        existing.quantity++;
      } else {
        this.items.push({
          ...newItem,
          quantity: 1,
        });
      }
      this.updateAndSave();
    },

    remove(id) {
      const item = this.items.find((i) => i.id === id);
      if (!item) return;

      if (item.quantity > 1) {
        item.quantity--;
      } else {
        this.items = this.items.filter((i) => i.id !== id);
      }
      this.updateAndSave();
    },

    updateAndSave() {
      this.quantity = this.items.reduce((sum, i) => sum + i.quantity, 0);
      this.total = this.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
      localStorage.setItem('cartItems', JSON.stringify(this.items));
    },
  });

  // ==================== Search Box ====================
  // (Kode ini dibiarkan apa adanya, meski watcher di init() juga menangani search)
  document.addEventListener("DOMContentLoaded", () => {
    const searchBox = document.querySelector("#search-box-home");
    if (searchBox) {
      searchBox.addEventListener("input", (e) => {
        const productsComponent = Alpine.store("productsComponent");
        if (productsComponent) {
          productsComponent.searchTerm = e.target.value;
          productsComponent.currentPage = 1;
        }
      });
    }
  });

  // ==================== Hero Slider Logic ====================
  initHeroSlider();
});

function initHeroSlider() {
  const slider = document.getElementById("hero-slider");
  if (!slider) return;

  const slides = Array.from(slider.querySelectorAll(".slide-item"));
  const dotsContainer = slider.querySelector(".slider-dots");
  const prevButton = slider.querySelector(".slider-arrow.prev");
  const nextButton = slider.querySelector(".slider-arrow.next");

  if (slides.length <= 1) {
    if (slides.length === 1) slides[0].classList.add("active");
    if (prevButton) prevButton.style.display = "none";
    if (nextButton) nextButton.style.display = "none";
    return;
  }

  let currentIndex = 0;
  let intervalId;

  slides.forEach((_, index) => {
    const dot = document.createElement("button");
    dot.setAttribute("aria-label", `Go to slide ${index + 1}`);
    dot.addEventListener("click", () => moveToSlide(index));
    dotsContainer.appendChild(dot);
  });
  const dots = Array.from(dotsContainer.querySelectorAll("button"));

  function updateSlider() {
    slides.forEach((slide, index) =>
      slide.classList.toggle("active", index === currentIndex)
    );
    dots.forEach((dot, index) =>
      dot.classList.toggle("active", index === currentIndex)
    );
  }

  function moveToSlide(index) {
    if (index >= slides.length) currentIndex = 0;
    else if (index < 0) currentIndex = slides.length - 1;
    else currentIndex = index;

    updateSlider();
    resetAutoPlay();
  }

  if (prevButton)
    prevButton.addEventListener("click", () => moveToSlide(currentIndex - 1));
  if (nextButton)
    nextButton.addEventListener("click", () => moveToSlide(currentIndex + 1));

  function startAutoPlay() {
    intervalId = setInterval(() => moveToSlide(currentIndex + 1), 5000);
  }

  function resetAutoPlay() {
    clearInterval(intervalId);
    startAutoPlay();
  }

  updateSlider();
  startAutoPlay();
}
// ==================== Fungsi untuk Memuat Detail Berita ====================
function loadNewsById(id) {
  const news = allNews.find((n) => n.id == id); // Gunakan '==' untuk perbandingan longgar

  if (!news) {
    document.getElementById("news-title").innerText = "Berita Tidak Ditemukan";
    document.getElementById("news-body").innerHTML =
      "<p>Maaf, berita yang Anda cari tidak dapat ditemukan. Silakan kembali ke halaman utama.</p>";
    return;
  }

  // Isi konten ke dalam elemen HTML
  document.getElementById("news-title").innerText = news.title;
  document.getElementById("news-date").innerText = news.date;

  // Placeholder untuk penulis jika tidak ada di data
  document.getElementById("news-author").innerText = news.author || "Tim Redaksi";

  // Konten Hero (Gambar)
  const heroContainer = document.getElementById("news-hero-content");
  heroContainer.innerHTML = `<img src="${news.image}" alt="${news.title}" />`;

  // Isi body berita (jika ada, jika tidak, tampilkan summary)
  const bodyContent =
    news.fullContent || `<p>${news.summary}</p><p><i>(Konten lengkap belum tersedia.)</i></p>`;
  document.getElementById("news-body").innerHTML = bodyContent;
}

// Ekspor fungsi agar bisa diakses dari file lain (misalnya, dari <script> di HTML)
window.loadNewsById = loadNewsById;
