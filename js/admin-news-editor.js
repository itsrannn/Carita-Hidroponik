// js/admin-news-editor.js
document.addEventListener('alpine:init', () => {
    Alpine.data('newsEditorPage', () => ({
        id: null,
        item: {
            title_en: '',
            title_id: '',
            body_en: '',
            body_id: '',
        },
        allProducts: [],
        relatedProductIds: [],
        title: 'Loading...',
        submitButtonText: 'Save Changes',
        isLoading: true,
        isError: false,

        async init() {
            const params = new URLSearchParams(window.location.search);
            this.id = params.get('id');

            await this.fetchAllProducts();

            if (this.id) {
                this.title = 'Edit News';
                await this.fetchNewsData();
            } else {
                this.title = 'Error';
                this.isError = true;
                this.isLoading = false;
            }
        },

        async fetchAllProducts() {
            const { data, error } = await supabase.from('products').select('id, name');
            if (!error) {
                this.allProducts = data;
            }
        },

        async fetchNewsData() {
            this.isLoading = true;
            const { data, error } = await supabase
                .from('news')
                .select(`*, news_related_products(product_id)`)
                .eq('id', this.id)
                .single();

            if (error || !data) {
                this.isError = true;
                this.isLoading = false;
                return;
            }

            this.item.title_en = data.title.en;
            this.item.title_id = data.title.id;
            this.item.body_en = data.body.en;
            this.item.body_id = data.body.id;

            this.relatedProductIds = data.news_related_products.map(p => p.product_id);
            this.isLoading = false;
        },

        async submitForm() {
            this.isLoading = true;
            this.submitButtonText = 'Saving...';

            const dataToSubmit = {
                title: { en: this.item.title_en, id: this.item.title_id },
                body: { en: this.item.body_en, id: this.item.body_id },
            };

            const { error: newsError } = await supabase
                .from('news')
                .update(dataToSubmit)
                .eq('id', this.id);

            if (newsError) {
                window.showNotification('Failed to save news data.', true);
                this.isLoading = false;
                this.submitButtonText = 'Save Changes';
                return;
            }

            // "Replace-all" for related products
            await supabase.from('news_related_products').delete().eq('news_id', this.id);

            if (this.relatedProductIds.length > 0) {
                const relationsToInsert = this.relatedProductIds.map(productId => ({
                    news_id: this.id,
                    product_id: productId,
                }));
                await supabase.from('news_related_products').insert(relationsToInsert);
            }

            window.showNotification('News saved successfully!', false);
            setTimeout(() => {
                window.location.href = 'admin-products.html'; // Redirect to the list page
            }, 1500);

            this.isLoading = false;
            this.submitButtonText = 'Save Changes';
        }
    }));
});
