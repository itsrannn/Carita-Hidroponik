// ==================== Data Produk Global ====================
// **PERUBAHAN:** Data produk dipindah ke sini (menjadi global)
// agar bisa dibaca oleh script di 'product detail.html'
const allProducts = [
  {
    id: 1,
    name: "Benih Cabai Carolina",
    category: "benih",
    price: 12000,
    img: "img/general/Cabai Carolina.png",
    char: "Benih Unggul <br> - Tingkat Pedas: Sangat Tinggi <br> - Perawatan: Sedang <br> - Masa Panen: 90 hari",
    desc: "Benih Cabai Carolina Reaper, dikenal sebagai salah satu cabai terpedas di dunia. Cocok untuk Anda yang menyukai tantangan rasa pedas ekstrem. Perlu perawatan ekstra untuk hasil optimal.",
  },
  {
    id: 2,
    name: "Benih Cabai Fatalii",
    category: "benih",
    price: 12000,
    img: "img/general/Cabai Fatalii.png",
    char: "Rasa Manis <br> - Mudah Tumbuh <br> - Ideal untuk Pot <br> - Panen Cepat",
    desc: "Benih Tomat Cherry (Solanum lycopersicum var. cerasiforme) menghasilkan buah tomat kecil yang manis dan segar. Sangat mudah ditanam, baik di lahan maupun di dalam pot, dan cepat berbuah.",
  },
  {
    id: 3,
    name: "Benih Cabai Ghost Pepper",
    category: "benih",
    price: 15000,
    img: "img/general/Cabai Ghost Pepper.png",
    char: "Daun Renyah <br> - Cepat Tumbuh <br> - Tahan Suhu Sejuk <br> - Populer untuk Salad",
    desc: "Benih Selada (Lactuca sativa) jenis Lollo Rossa. Memiliki daun keriting berwarna hijau dengan semburat merah yang cantik. Teksturnya renyah dan rasanya segar, sempurna untuk salad.",
  },
  {
    id: 4,
    name: "Benih Cabai Habanero.png",
    category: "benih",
    price: 10000,
    img: "img/general/Cabai Habanero.png",
    char: "Kaya Nutrisi <br> - Tahan Hama <br> - Suhu Sejuk <br> - Ukuran Kepala Sedang",
    desc: "Benih Brokoli varietas Green Magic. Menghasilkan kepala bunga yang padat dan berwarna hijau gelap. Dikenal kaya akan vitamin dan mineral, serta memiliki ketahanan yang baik terhadap hama.",
  },
  {
    id: 5,
    name: "Benih Cabai Jalapeno",
    category: "benih",
    price: 20000,
    img: "img/general/Cabai Jalapeno.png",
    char: "Kompos Murni <br> - Menyuburkan Tanah <br> - Ramah Lingkungan <br> - 5kg",
    desc: "Pupuk organik murni dari kompos berkualitas tinggi. Membantu memperbaiki struktur tanah, meningkatkan ketersediaan unsur hara, dan ramah lingkungan. Cocok untuk semua jenis tanaman.",
  },
  {
    id: 6,
    name: "Benih Cabai Naga Viper",
    category: "benih",
    price: 28000,
    img: "img/general/Cabai Naga Viper.png",
    char: "Kompos Murni <br> - Menyuburkan Tanah <br> - Ramah Lingkungan <br> - 5kg",
    desc: "Pupuk organik murni dari kompos berkualitas tinggi. Membantu memperbaiki struktur tanah, meningkatkan ketersediaan unsur hara, dan ramah lingkungan. Cocok untuk semua jenis tanaman.",
  },
  {
    id: 7,
    name: "Benih Cabai Orange Drop",
    category: "benih",
    price: 17000,
    img: "img/general/Cabai Orange Drop.png",
    char: "Kompos Murni <br> - Menyuburkan Tanah <br> - Ramah Lingkungan <br> - 5kg",
    desc: "Pupuk organik murni dari kompos berkualitas tinggi. Membantu memperbaiki struktur tanah, meningkatkan ketersediaan unsur hara, dan ramah lingkungan. Cocok untuk semua jenis tanaman.",
  },
  {
    id: 8,
    name: "Benih Cabai Scotch Bonnet",
    category: "benih",
    price: 25000,
    img: "img/general/Cabai Scotch Bonnet.png",
    char: "Kompos Murni <br> - Menyuburkan Tanah <br> - Ramah Lingkungan <br> - 5kg",
    desc: "Pupuk organik murni dari kompos berkualitas tinggi. Membantu memperbaiki struktur tanah, meningkatkan ketersediaan unsur hara, dan ramah lingkungan. Cocok untuk semua jenis tanaman.",
  },
  {
    id: 9,
    name: "Benih Cabai Thai Chili",
    category: "benih",
    price: 15000,
    img: "img/general/Cabai Thai Chili.png",
    char: "Kompos Murni <br> - Menyuburkan Tanah <br> - Ramah Lingkungan <br> - 5kg",
    desc: "Pupuk organik murni dari kompos berkualitas tinggi. Membantu memperbaiki struktur tanah, meningkatkan ketersediaan unsur hara, dan ramah lingkungan. Cocok untuk semua jenis tanaman.",
  },
  {
    id: 15,
    name: "Pupuk ZA",
    category: "nutrisi",
    price: 30000,
    img: "img/general/Pupuk X.png",
    char: "Sumber Nitrogen <br> - Non-Organik <br> - Merangsang Daun <br> - 1kg",
    desc: "Pupuk ZA (Zwavelzure Ammoniak) adalah pupuk kimia yang kaya akan Nitrogen dan Sulfur. Sangat baik untuk merangsang pertumbuhan daun tanaman pada fase vegetatif.",
  },
  {
    id: 21,
    name: "Sekam Bakar",
    category: "media",
    price: 7000,
    img: "img/general/Sekam Bakar.png",
    char: "Media Tanam <br> - Porositas Tinggi <br> - Steril <br> - 1 karung",
    desc: "Sekam bakar adalah media tanam yang populer karena porositasnya yang tinggi, membuatnya tidak mudah padat dan baik untuk aerasi akar. Sudah disterilkan melalui proses pembakaran.",
  },
  {
    id: 22,
    name: "Spons Hidroponik",
    category: "media",
    price: 3000,
    img: "img/general/Spons Hidroponik.png",
    char: "Media Semai <br> - Hidroponik <br> - Menyerap Air <br> - 1 Papan",
    desc: "Spons khusus untuk media semai hidroponik. Mampu menahan air dengan baik namun tetap memberikan ruang bagi akar untuk bernapas. Ideal untuk memulai semaian.",
  },
  {
    id: 31,
    name: "Gunting Tanaman",
    category: "peralatan",
    price: 38000,
    img: "img/general/Gunting Tanaman.png",
    char: "Stainless Steel <br> - Tajam & Presisi <br> - Ergonomis <br> - Anti Karat",
    desc: "Gunting pangkas (pruning shears) berkualitas tinggi. Terbuat dari stainless steel yang tajam dan tahan karat. Didesain ergonomis agar nyaman digunakan untuk memotong dahan.",
  },
  {
    id: 41,
    name: "Set Komplit Berkebun",
    category: "promo",
    price: 75000,
    img: "img/general/Set Komplit.png",
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
    itemsPerPage: 10,
    selectedCategory: "all",
    sortOption: "default",
    items: allProducts,

    // --- TAMBAHAN: Fungsi init untuk me-reset halaman saat filter berubah ---
    init() {
      const updateAndRefreshIcons = () => {
        this.currentPage = 1;
        this.$nextTick(() => feather.replace());
      };

      this.$watch("selectedCategory", updateAndRefreshIcons);
      this.$watch("searchTerm", updateAndRefreshIcons);
      this.$watch("sortOption", updateAndRefreshIcons);
    },
    // --- AKHIR TAMBAHAN ---

    formatRupiah(value) {
      if (!value) return "Rp 0";
      return "Rp " + value.toLocaleString("id-ID");
    },

    // REFACTOR: Menggabungkan logika filter dan sort ke dalam satu computed property
    // untuk kejelasan dan memastikan urutan operasi yang benar.
    processedItems() {
      // Selalu mulai dengan salinan lengkap dari semua item produk
      let processed = [...this.items];

      // 1. Filter berdasarkan kategori yang dipilih
      if (this.selectedCategory !== "all") {
        processed = processed.filter(
          (item) => item.category === this.selectedCategory
        );
      }

      // 2. Filter berdasarkan kata kunci pencarian
      if (this.searchTerm.trim() !== "") {
        processed = processed.filter((item) =>
          item.name.toLowerCase().includes(this.searchTerm.toLowerCase())
        );
      }

      // 3. Lakukan pengurutan (sorting) berdasarkan opsi yang dipilih
      // Operasi pengurutan dilakukan setelah pemfilteran agar lebih efisien
      if (this.sortOption === "price-asc") {
        processed.sort((a, b) => a.price - b.price);
      } else if (this.sortOption === "price-desc") {
        processed.sort((a, b) => b.price - a.price);
      }

      // Kembalikan item yang sudah diproses (difilter dan diurutkan)
      // Logika paginasi akan diterapkan pada hasil dari fungsi ini
      return processed;
    },

    paginatedItems() {
      const start = (this.currentPage - 1) * this.itemsPerPage;
      const end = start + this.itemsPerPage;
      // Langsung slice dari data yang sudah diproses (filter + sort)
      return this.processedItems().slice(start, end);
    },

    totalPages() {
      // Kalkulasi total halaman berdasarkan data yang sudah diproses
      return Math.ceil(this.processedItems.length / this.itemsPerPage);
    },

    goToPage(page) {
      if (page >= 1 && page <= this.totalPages()) {
        this.currentPage = page;
        window.scrollTo({ top: 0, behavior: "smooth" });
        this.$nextTick(() => feather.replace());
      }
    },
  };
};

// ==================== Alpine Store: Cart ====================
document.addEventListener("alpine:init", () => {
  Alpine.store("cart", {
    items: [],
    total: 0,
    quantity: 0,

    init() {
      // Load from localStorage and then calculate totals
      this.items = JSON.parse(localStorage.getItem('cartItems')) || [];
      this.updateTotalsAndSave();
    },

    add(newItem) {
      const existing = this.items.find((item) => item.id === newItem.id);

      if (existing) {
        existing.quantity++;
      } else {
        // Add new item with quantity 1
        this.items.push({ ...newItem, quantity: 1 });
      }
      this.updateTotalsAndSave();
    },

    remove(id, force = false) {
      const item = this.items.find((i) => i.id === id);
      if (!item) return;

      // If force is true (from trash button) or quantity is 1, remove the item
      if (force || item.quantity === 1) {
        this.items = this.items.filter((i) => i.id !== id);
      } else {
        // Otherwise, just decrement the quantity
        item.quantity--;
      }
      this.updateTotalsAndSave();
    },

    updateTotalsAndSave() {
      // Calculate total quantity and price
      this.quantity = this.items.reduce((sum, i) => sum + i.quantity, 0);
      this.total = this.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);

      // Save to localStorage
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
