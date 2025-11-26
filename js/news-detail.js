document.addEventListener('DOMContentLoaded', async () => {
    // Ensure Feather icons are replaced
    feather.replace();

    const newsTitleEl = document.getElementById('news-title');
    const newsDateEl = document.getElementById('news-date');
    const newsHeroEl = document.getElementById('news-hero-content');
    const newsBodyEl = document.getElementById('news-body');

    // Function to display error messages
    const showError = (message) => {
        if (newsTitleEl) newsTitleEl.textContent = 'Kesalahan';
        if (newsBodyEl) newsBodyEl.innerHTML = `<p style="color: red;">${message}</p>`;
        if (newsHeroEl) newsHeroEl.style.display = 'none'; // Hide hero on error
    };

    // 1. Get news ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const newsId = urlParams.get('id');

    if (!newsId) {
        showError('ID berita tidak ditemukan di URL. Pastikan URL Anda benar, contoh: news%20detail.html?id=1');
        return;
    }

    // 2. Fetch data from Supabase
    if (!window.supabase) {
        showError('Klien Supabase tidak dapat diakses. Pastikan supabase-client.js dimuat dengan benar.');
        return;
    }

    try {
        const { data, error } = await window.supabase
            .from('news')
            .select('*')
            .eq('id', newsId)
            .single(); // Use .single() to get a single object, not an array

        if (error) throw error;

        if (data) {
            // 3. Populate the page with the fetched data
            document.title = `${data.title} | Carita Hidroponik`; // Update page title
            newsTitleEl.textContent = data.title;
            newsDateEl.textContent = new Date(data.created_at).toLocaleDateString("id-ID", {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            // Populate hero image
            newsHeroEl.innerHTML = `<img src="${data.image_url || 'img/coming soon.jpg'}" alt="${data.title}" />`;

            // Populate article content (it's safe because it comes from a trusted source via Quill)
            newsBodyEl.innerHTML = data.content;

        } else {
            showError(`Berita dengan ID "${newsId}" tidak ditemukan.`);
        }

    } catch (error) {
        console.error('Error fetching news detail:', error);
        showError('Gagal memuat detail berita. Silakan coba lagi nanti.');
    }
});
