document.addEventListener('DOMContentLoaded', async () => {
    feather.replace();

    const newsTitleEl = document.getElementById('news-title');
    const newsDateEl = document.getElementById('news-date');
    const newsHeroEl = document.getElementById('news-hero-content');
    const newsBodyEl = document.getElementById('news-body');

    const showError = (message) => {
        if (newsTitleEl) newsTitleEl.textContent = 'Error';
        if (newsBodyEl) newsBodyEl.innerHTML = `<p style="color: red;">${message}</p>`;
        if (newsHeroEl) newsHeroEl.style.display = 'none';
    };

    const urlParams = new URLSearchParams(window.location.search);
    const newsId = urlParams.get('id');

    if (!newsId) {
        showError('News ID not found in URL. Please ensure your URL is correct, e.g., news%20detail.html?id=1');
        return;
    }

    if (!window.supabase) {
        showError('Supabase client is not accessible. Make sure supabase-client.js is loaded correctly.');
        return;
    }

    try {
        const { data, error } = await window.supabase
            .from('news')
            .select('*')
            .eq('id', newsId)
            .single();

        if (error) throw error;

        if (data) {
            document.title = `${data.title} | Carita Hidroponik`;
            newsTitleEl.textContent = data.title;
            newsDateEl.textContent = new Date(data.created_at).toLocaleDateString("en-US", {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            newsHeroEl.innerHTML = `<img src="${data.image_url || 'img/coming soon.jpg'}" alt="${data.title}" />`;

            newsBodyEl.innerHTML = data.content;

        } else {
            showError(`News with ID "${newsId}" not found.`);
        }

    } catch (error) {
        showError('Failed to load news detail. Please try again later.');
    }
});
