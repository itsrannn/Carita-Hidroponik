document.addEventListener('alpine:init', () => {
    Alpine.data('newsDetail', () => ({
        isLoading: true,
        notFound: false,
        newsItem: null,
        latestNews: [],
        relatedProducts: [],
        newsId: null,
        latestLimit: 5,

        init() {
            this.$watch('$store.i18n.ready', (isReady) => {
                if (isReady) {
                    this.fetchNewsData();
                }
            });

            if (this.$store.i18n.ready) {
                this.fetchNewsData();
            }

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
                const { data: newsData, error: newsError } = await window.supabase
                    .from('news')
                    .select('*')
                    .eq('id', this.newsId)
                    .single();

                if ((newsError && newsError.code === 'PGRST116') || !newsData) {
                    this.notFound = true;
                    return;
                }
                if (newsError) throw newsError;

                this.newsItem = newsData;

                await Promise.all([
                    this.fetchRelatedProducts(),
                    this.fetchLatestNews()
                ]);
            } catch (error) {
                console.error('An unexpected error occurred during data fetching:', error);
                this.notFound = true;
            } finally {
                this.isLoading = false;
            }
        },

        async fetchRelatedProducts() {
            if (!this.newsId) return;

            let productIds = [];

            // Admin-managed relation (join table): one news can link many products.
            const { data: relatedLinks, error: linksError } = await window.supabase
                .from('news_related_products')
                .select('product_id')
                .eq('news_id', this.newsId);

            if (!linksError && Array.isArray(relatedLinks) && relatedLinks.length > 0) {
                productIds = relatedLinks.map((link) => link.product_id).filter(Boolean);
            }

            // Optional fallback if admin stores relation directly in `news.related_product_ids`.
            if (productIds.length === 0 && Array.isArray(this.newsItem?.related_product_ids)) {
                productIds = this.newsItem.related_product_ids.filter(Boolean);
            }

            if (productIds.length === 0) {
                this.relatedProducts = [];
                return;
            }

            const { data: productsData, error: productsError } = await window.supabase
                .from('products')
                .select('*')
                .in('id', productIds);

            if (productsError || !productsData) {
                console.error('Error fetching related products:', productsError);
                this.relatedProducts = [];
                return;
            }

            const orderedProducts = productIds
                .map((id) => productsData.find((product) => product.id === id))
                .filter(Boolean);

            this.relatedProducts = orderedProducts;
        },

        async fetchLatestNews() {
            try {
                const { data, error } = await window.supabase
                    .from('news')
                    .select('id, title, created_at')
                    .neq('id', this.newsId)
                    .order('created_at', { ascending: false })
                    .limit(this.latestLimit);

                if (error) throw error;
                this.latestNews = Array.isArray(data) ? data : [];
            } catch (error) {
                console.error('Failed to load latest news:', error);
                this.latestNews = [];
            }
        },

        productName(product) {
            if (!product || !product.name) return '';
            const lang = this.$store.i18n.lang;

            if (typeof product.name === 'object') {
                return product.name[lang] || product.name.id || product.name.en || '';
            }

            return product.name;
        },

        newsListTitle(item) {
            if (!item || !item.title) return '';
            const lang = this.$store.i18n.lang;

            if (typeof item.title === 'object') {
                return item.title[lang] || item.title.id || item.title.en || '';
            }

            return item.title;
        },

        get showRelatedProductsWidget() {
            return this.isLoading || this.relatedProducts.length > 0;
        },

        get showLatestNewsWidget() {
            return this.isLoading || this.latestNews.length > 0;
        },

        updateDocumentTitle() {
            if (!this.newsItem) return;
            document.title = `${this.newsTitle} | Carita Hidroponik`;
        },

        get newsTitle() {
            if (!this.newsItem || !this.newsItem.title) return '';

            const lang = this.$store.i18n.lang;
            const title = this.newsItem.title;

            if (typeof title === 'string') return title;
            return (title && title[lang]) || (title && title.id) || (title && title.en) || '';
        },

        get newsContent() {
            if (!this.newsItem) return '';

            const lang = this.$store.i18n.lang;
            const multilingualContent = this.newsItem.content || this.newsItem.body;

            if (!multilingualContent) return '';
            if (typeof multilingualContent === 'string') return multilingualContent;

            return multilingualContent[lang] || multilingualContent.id || multilingualContent.en || '';
        },

        get formattedDate() {
            if (!this.newsItem) return '';
            const lang = this.$store.i18n.lang;
            return new Date(this.newsItem.created_at).toLocaleDateString(lang, {
                year: 'numeric', month: 'long', day: 'numeric'
            });
        },

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
            return 'Rp ' + value.toLocaleString('id-ID');
        }
    }));
});
