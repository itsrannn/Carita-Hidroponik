// js/admin-product-editor.js
document.addEventListener('alpine:init', () => {
    Alpine.data('editorPage', () => ({
        id: null,
        item: {
            name_en: '',
            name_id: '',
            category: '',
            price: null,
            image_url: '',
            description_en: '',
            description_id: '',
            char_en: '',
            char_id: '',
        },
        discount_type: 'percent', // 'percent' or 'price'
        discount_value: null,
        title: 'admin.productEditor.loading',
        submitButtonText: 'admin.productEditor.submit',
        isLoading: true,
        isError: false,
        imagePreviewUrl: null,

        async init() {
            const params = new URLSearchParams(window.location.search);
            this.id = params.get('id');

            if (this.id) {
                this.title = 'admin.productEditor.editTitle';
                await this.fetchData();
            } else {
                // This page is only for editing, so show an error if no ID is provided.
                this.title = 'admin.productEditor.notFound';
                this.isError = true;
                this.isLoading = false;
            }
        },

        async fetchData() {
            this.isLoading = true;
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('id', this.id)
                .single();

            if (error || !data) {
                this.isError = true;
                this.isLoading = false;
                this.title = 'admin.productEditor.notFound';
                return;
            }

            // Handle name (string or JSON)
            if (typeof data.name === 'object' && data.name) {
                this.item.name_en = data.name.en || '';
                this.item.name_id = data.name.id || '';
            } else {
                this.item.name_en = data.name || '';
            }

            // Handle description (string or JSON)
            if (typeof data.description === 'object' && data.description) {
                this.item.description_en = data.description.en || '';
                this.item.description_id = data.description.id || '';
            } else {
                this.item.description_en = data.description || '';
            }

            // Handle characteristics (string or JSON)
            if (typeof data.characteristics === 'object' && data.characteristics) {
                this.item.char_en = data.characteristics.en || '';
                this.item.char_id = data.characteristics.id || '';
            } else {
                this.item.char_en = data.characteristics || '';
            }

            this.item.category = data.category;
            this.item.price = data.price;
            this.item.image_url = data.image_url;
            this.imagePreviewUrl = data.image_url;

            // Handle discount logic
            if (data.discount < 0) {
                this.discount_type = 'price';
                this.discount_value = -data.discount;
            } else {
                this.discount_type = 'percent';
                this.discount_value = data.discount;
            }

            this.isLoading = false;
        },

        async submitForm() {
            this.isLoading = true;
            this.submitButtonText = 'admin.productEditor.submitting';

            let discountForDb = 0;
            if (this.discount_value !== null && this.discount_value > 0) {
                discountForDb = this.discount_type === 'price'
                    ? -Math.abs(this.discount_value)
                    : Math.abs(this.discount_value);
            }

            // Consolidate bilingual fields into JSON objects
            const dataToSubmit = {
                name: { en: this.item.name_en, id: this.item.name_id },
                description: { en: this.item.description_en, id: this.item.description_id },
                category: this.item.category,
                price: this.item.price,
                image_url: this.item.image_url,
            };

            const { error } = await supabase
                .from('products')
                .update(dataToSubmit)
                .eq('id', this.id);

            if (error) {
                window.showNotification(`Failed to save data: ${error.message}`, true);
            } else {
                window.showNotification('Data saved successfully!', false);
                // As per requirement, stay on the page.
                // Optionally, refetch data to confirm it's updated.
                // await this.fetchData();
            }

            this.isLoading = false;
            this.submitButtonText = 'admin.productEditor.submit';
        }
    }));
});
