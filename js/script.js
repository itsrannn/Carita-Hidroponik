document.addEventListener("DOMContentLoaded", () => {
  feather.replace();

  // --- Hero Slider Logic ---
  const slider = document.getElementById("hero-slider");
  if (slider) {
    const slides = slider.querySelectorAll(".slide-item");
    const dotsContainer = slider.querySelector(".slider-dots");
    const prevButton = slider.querySelector(".slider-arrow.prev");
    const nextButton = slider.querySelector(".slider-arrow.next");
    let currentIndex = 0;
    let slideInterval;

    function createDots() {
      slides.forEach((_, index) => {
        const dot = document.createElement("button");
        dot.classList.add("slider-dot");
        if (index === 0) dot.classList.add("active");
        dot.setAttribute("aria-label", `Go to slide ${index + 1}`);
        dot.addEventListener("click", () => {
          goToSlide(index);
          resetInterval();
        });
        dotsContainer.appendChild(dot);
      });
    }

    function updateDots() {
      const dots = dotsContainer.querySelectorAll(".slider-dot");
      dots.forEach((dot, index) => {
        dot.classList.toggle("active", index === currentIndex);
      });
    }

    function goToSlide(index) {
      slides[currentIndex].classList.remove("active");
      currentIndex = (index + slides.length) % slides.length;
      slides[currentIndex].classList.add("active");
      updateDots();
    }

    function nextSlide() {
      goToSlide(currentIndex + 1);
    }

    function prevSlide() {
      goToSlide(currentIndex - 1);
    }

    function startInterval() {
      slideInterval = setInterval(nextSlide, 5000); // Ganti slide setiap 5 detik
    }

    function resetInterval() {
      clearInterval(slideInterval);
      startInterval();
    }

    // Event Listeners
    nextButton.addEventListener("click", () => {
      nextSlide();
      resetInterval();
    });

    prevButton.addEventListener("click", () => {
      prevSlide();
      resetInterval();
    });

    // Initialize
    createDots();
    startInterval();
  }

  // --- News Rendering Logic ---
  async function fetchAndDisplayNews() {
    const newsContainer = document.getElementById("index-news-container");
    if (!newsContainer) return;

    try {
      // Show loading indicator
      newsContainer.innerHTML = '<p class="loading-text" style="text-align: center; padding: 2rem;">Memuat berita...</p>';

      if (!window.supabase) {
        newsContainer.innerHTML = '<p style="text-align: center; color: red;">Gagal memuat Supabase client.</p>';
        return;
      }

      const { data, error } = await window.supabase
        .from('news')
        .select('id, created_at, title, excerpt, image_url')
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;

      if (data && data.length > 0) {
        newsContainer.innerHTML = ''; // Clear loading indicator
        data.forEach(newsItem => {
          const newsCard = `
            <a href="news detail.html?id=${newsItem.id}" class="news-card-link">
              <article class="news-card">
                <div class="news-card-image-wrapper">
                  <img src="${newsItem.image_url || 'img/coming soon.jpg'}" alt="${newsItem.title}" />
                </div>
                <div class="news-card-content">
                  <p class="news-card-meta">${new Date(newsItem.created_at).toLocaleDateString("id-ID", {
                    year: "numeric", month: "long", day: "numeric",
                  })}</p>
                  <h3>${newsItem.title}</h3>
                  <p class="news-card-excerpt">${newsItem.excerpt}</p>
                </div>
              </article>
            </a>
          `;
          newsContainer.innerHTML += newsCard;
        });
      } else {
        newsContainer.innerHTML = '<p style="text-align: center;">Belum ada berita yang diterbitkan.</p>';
      }
    } catch (error) {
      newsContainer.innerHTML = '<p style="text-align: center; color: red;">Gagal memuat berita.</p>';
    }
  }

  fetchAndDisplayNews();

  // Mobile menu toggle logic might be added here later if needed
});
