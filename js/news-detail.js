document.addEventListener('alpine:init', () => {
    Alpine.data('newsDetail', () => ({
        isLoading: true,
        notFound: false,
        newsItem: null,
        latestNews: [],
        relatedProducts: [],
        newsId: null,

        init() {
            // This watcher is the gate. It ensures fetchNewsData only runs when i18n is ready.
            this.$watch('$store.i18n.ready', (isReady) => {
                if (isReady) {
                    this.fetchNewsData();
                }
            });

            // If i18n is already ready when the component initializes, fire immediately.
            if (this.$store.i18n.ready) {
                this.fetchNewsData();
            }

            // Effect to update title reactively when newsItem or language changes.
            Alpine.effect(() => {
                if (this.newsItem) {
                    this.updateDocumentTitle();
                }
            });
        },

        async fetchNewsData() {
            this.isLoading = true;
            const urlParams = new URLSearchParams(window.location.search);
            this.newsId = urlParams.get('id');

            if (!this.newsId) {
                console.error('News ID is missing from URL.');
                this.isLoading = false;
                this.notFound = true;
                return;
            }

            try {
                // Step 1: Fetch the main news article.
                const { data: newsData, error: newsError } = await window.supabase
                    .from('news')
                    .select('*')
                    .eq('id', this.newsId)
                    .single();

                if ((newsError && newsError.code === 'PGRST116') || !newsData) {
                    // PGRST116 means no rows found, a valid "not found" case.
                    this.notFound = true;
                    return;
                }
                if (newsError) throw newsError; // Throw other errors

                this.newsItem = newsData;

                // Step 2 & 3: Fetch related products.
                await this.fetchRelatedProducts();
                await this.fetchLatestNews();

            } catch (error) {
                console.error('An unexpected error occurred during data fetching:', error);
                this.notFound = true;
            } finally {
                this.isLoading = false;
            }
        },

        async fetchRelatedProducts() {
            if (!this.newsId) return;
            // Fetch related product IDs
            const { data: relatedLinks, error: linksError } = await window.supabase
                .from('news_related_products')
                .select('product_id')
                .eq('news_id', this.newsId);

            if (linksError) {
                console.error('Error fetching related product links:', linksError);
                this.relatedProducts = [];
                return;
            }

            const productIds = relatedLinks.map(link => link.product_id);
            if (productIds.length > 0) {
                // Fetch the actual products
                const { data: productsData, error: productsError } = await window.supabase
                    .from('products')
                    .select('*')
                    .in('id', productIds);

                if (productsError) {
                    console.error('Error fetching related products:', productsError);
                    this.relatedProducts = [];
                } else {
                    this.relatedProducts = productsData;
                }
            } else {
                this.relatedProducts = [];
            }
        },

        async fetchLatestNews() {
            try {
                const { data, error } = await window.supabase
                    .from('news')
                    .select('id, title, created_at')
                    .neq('id', this.newsId)
                    .order('created_at', { ascending: false })
                    .limit(5);
                if (error) throw error;
                this.latestNews = data;
            } catch (error) {
                console.error("Failed to load latest news:", error);
            }
        },

        updateDocumentTitle() {
            if (!this.newsItem) return;
            document.title = `${this.newsTitle} | Carita Hidroponik`;
        },

        get newsTitle() {
            if (!this.newsItem) return '';
            const lang = this.$store.i18n.lang;
            return this.newsItem.title[lang] || this.newsItem.title.id;
        },

        get newsContent() {
            // More robust handling to prevent "undefined"
            if (!this.newsItem || !this.newsItem.description) {
                return ''; // Return empty string if no item or no description
            }

            const lang = this.$store.i18n.lang;
            const desc = this.newsItem.description;

            // Check if description is a valid object for multi-language
            if (typeof desc === 'object' && desc !== null) {
                // Return the description in the current language, fallback to 'id', then to an empty string
                return desc[lang] || desc.id || '';
            }

            // Fallback for any other unexpected type (e.g. string, number)
            return '';
        },

        get formattedDate() {
            if (!this.newsItem) return '';
            const lang = this.$store.i18n.lang;
            return new Date(this.newsItem.created_at).toLocaleDateString(lang, {
                year: 'numeric', month: 'long', day: 'numeric'
            });
        },

        // --- Share URLs ---
        get currentUrl() {
            return window.location.href;
        },

        get twitterShareUrl() {
            const text = encodeURIComponent(this.newsTitle);
            return `https://twitter.com/intent/tweet?url=${this.currentUrl}&text=${text}`;
        },

        get facebookShareUrl() {
            return `https://www.facebook.com/sharer/sharer.php?u=${this.currentUrl}`;
        },

        get emailShareUrl() {
            const subject = encodeURIComponent(this.newsTitle);
            const body = encodeURIComponent(this.currentUrl);
            return `mailto:?subject=${subject}&body=${body}`;
        },

        formatRupiah(value) {
            if (typeof value !== 'number') {
                return 'Rp 0';
            }
            return "Rp " + value.toLocaleString("id-ID");
        }
    }));
});
