document.addEventListener('alpine:init', () => {
    Alpine.data('newsDetail', () => ({
        newsItem: null,
        relatedProducts: [],
        latestNews: [],
        isLoading: true,
        newsId: null,

        init() {
            const urlParams = new URLSearchParams(window.location.search);
            this.newsId = urlParams.get('id');

            if (!this.newsId) {
                console.error('News ID is missing.');
                this.isLoading = false;
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
            try {
                const { data, error } = await window.supabase
                    .from('news')
                    .select('*')
                    .eq('id', this.newsId)
                    .single();

                if (error) throw error;

                this.newsItem = data;
                this.updateDocumentTitle();
                this.fetchRelatedProducts(); // Fetch related products after getting the category
            } catch (error) {
                console.error('Error fetching news:', error);
            } finally {
                this.isLoading = false;
            }
        },

        async fetchLatestNews() {
            try {
                const { data, error } = await supabase
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

        fetchRelatedProducts() {
            // This now relies on the global product store
            if (!this.$store.products.all.length) {
                // Wait for products to be loaded if they aren't already
                this.$watch('$store.products.isLoading', (loading) => {
                    if (!loading) {
                        this.filterRelatedProducts();
                    }
                });
            } else {
                this.filterRelatedProducts();
            }
        },

        filterRelatedProducts() {
            if (!this.newsItem || !this.newsItem.category) {
                this.relatedProducts = [];
                return;
            }
            this.relatedProducts = this.$store.products.all
                .filter(p => p.category === this.newsItem.category)
                .slice(0, 4); // Limit to 4 related products
        },

        updateDocumentTitle() {
            document.title = `${this.newsTitle} | Carita Hidroponik`;
        },

        get newsTitle() {
            if (!this.newsItem) return this.$store.i18n.t('news.loading');
            const lang = this.$store.i18n.lang;
            return this.newsItem.title[lang] || this.newsItem.title.id;
        },

        get newsContent() {
            if (!this.newsItem) return `<p>${this.$store.i18n.t('news.loading')}</p>`;
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
