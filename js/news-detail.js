document.addEventListener('alpine:init', () => {
    Alpine.data('newsDetail', () => ({
        newsItem: null,
        relatedProducts: [],
        latestNews: [],
        isLoading: true,
        notFound: false,
        newsId: null,

        init() {
            const urlParams = new URLSearchParams(window.location.search);
            this.newsId = urlParams.get('id');

            if (!this.newsId) {
                console.error('News ID is missing.');
                this.isLoading = false;
                this.notFound = true;
                return;
            }

            // Use Alpine.effect to react to language changes from the i18n store
            Alpine.effect(() => {
                const lang = this.$store.i18n.lang; // Dependency
                // This will re-run whenever the language changes.
                if (this.newsItem) {
                    this.updateDocumentTitle();
                }
            });

            this.fetchNewsData();
            this.fetchLatestNews();
        },

        async fetchNewsData() {
            this.isLoading = true;
            this.notFound = false;
            try {
                const { data, error } = await window.supabase
                    .from('news')
                    .select(`
                        *,
                        news_related_products(
                          product_id,
                          products(*)
                        )
                    `)
                    .eq('id', this.newsId)
                    .single();

                if (error) {
                    // Log the error but don't re-throw, as a 406 PostgREST error
                    // can mean "not found", which we handle by checking `data`.
                    console.error('Error fetching news:', error);
                }

                if (!data) {
                    this.notFound = true;
                    return;
                }

                this.newsItem = data;

                // Transform the related products data into a pure products array
                if (data.news_related_products && Array.isArray(data.news_related_products)) {
                    const relatedProducts = data.news_related_products.map(r => r.products).filter(p => p); // filter out nulls
                    this.$store.news.relatedProducts = relatedProducts; // Use the store as per instructions
                } else {
                    this.$store.news.relatedProducts = [];
                }

                this.updateDocumentTitle();

            } catch (error) {
                console.error('An unexpected error occurred:', error);
                this.notFound = true;
            } finally {
                this.isLoading = false;
            }
        },

        async fetchLatestNews() {
            try {
                const { data, error } = await window.supabase
                    .from('news')
                    .select('id, title, created_at')
                    .neq('id', this.newsId) // Exclude the current article
                    .order('created_at', { ascending: false })
                    .limit(5);
                if (error) throw error;
                this.latestNews = data;
            } catch (error) {
                console.error("Failed to load latest news:", error);
            }
        },

        updateDocumentTitle() {
            document.title = `${this.newsTitle} | Carita Hidroponik`;
        },

        get newsTitle() {
            if (this.isLoading) return this.$store.i18n.t('news.loading');
            if (this.notFound) return this.$store.i18n.t('news.notFound');
            if (!this.newsItem) return '';
            const lang = this.$store.i18n.lang;
            return this.newsItem.title[lang] || this.newsItem.title.id;
        },

        get newsContent() {
            if (this.isLoading) return `<p>${this.$store.i18n.t('news.loading')}</p>`;
            if (this.notFound) return `<p>${this.$store.i18n.t('news.notFound')}</p>`;
            if (!this.newsItem) return '';
            const lang = this.$store.i18n.lang;
            return this.newsItem.content[lang] || this.newsItem.content.id;
        },

        get formattedDate() {
            if (!this.newsItem) return '';
            const lang = this.$store.i18n.lang;
            return new Date(this.newsItem.created_at).toLocaleDateString(lang, {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
    }));
});
