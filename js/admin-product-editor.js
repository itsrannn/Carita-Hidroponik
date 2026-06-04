// js/admin-product-editor.js
document.addEventListener('alpine:init', () => {
    Alpine.data('editorPage', () => ({
        id: null,
        type: 'product',
        action: 'add',
        item: {
            name_en: '', name_id: '', category: '', price: null, stock: 0, image_url: '', description_en: '', description_id: '', char_en: '', char_id: '',
            title_en: '', title_id: '', excerpt_en: '', excerpt_id: '', body_en: '', body_id: ''
        },
        allNews: [], allProducts: [], relatedNewsIds: [], relatedProductIds: [],
        discount_type: 'percent', discount_value: null,
        title: 'Loading...', submitButtonText: 'Save', isLoading: true, isError: false, imagePreviewUrl: null,

        async init() {
            const params = new URLSearchParams(window.location.search);
            this.id = params.get('id');
            this.type = params.get('type') === 'news' ? 'news' : 'product';
            this.action = params.get('action') || (this.id ? 'edit' : 'add');
            this.title = this.type === 'news'
                ? (this.id ? 'Edit News' : 'Tambah News')
                : (this.id ? 'Edit Produk' : 'Tambah Produk');
            try {
                if (this.type === 'product') await this.fetchAllNews();
                if (this.type === 'news') await this.fetchAllProducts();
                if (this.id) await (this.type === 'news' ? this.fetchNewsData() : this.fetchProductData());
                this.isLoading = false;
            } catch (error) {
                console.error('[ADMIN EDITOR LOAD ERROR]', error);
                this.isError = true; this.isLoading = false;
            }
        },

        async fetchAllNews() {
            const { data, error } = await window.supabase.from('news').select('id, title, created_at').order('created_at', { ascending: false });
            if (error) throw error;
            this.allNews = data || [];
        },
        async fetchAllProducts() {
            const { data, error } = await window.supabase.from('products').select('id, name, created_at').order('created_at', { ascending: false });
            if (error) throw error;
            this.allProducts = data || [];
        },
        getLocalized(value, key) {
            if (value && typeof value === 'object') return value[key] || '';
            return key === 'en' ? (value || '') : '';
        },
        async fetchProductData() {
            const { data, error } = await window.supabase.from('products').select('*').eq('id', this.id).single();
            if (error || !data) throw error || new Error('Produk tidak ditemukan.');
            this.item.name_en = this.getLocalized(data.name, 'en'); this.item.name_id = this.getLocalized(data.name, 'id');
            this.item.description_en = this.getLocalized(data.description, 'en'); this.item.description_id = this.getLocalized(data.description, 'id');
            this.item.char_en = this.getLocalized(data.characteristics, 'en'); this.item.char_id = this.getLocalized(data.characteristics, 'id');
            this.item.category = data.category || ''; this.item.price = data.price ?? null; this.item.stock = data.stock ?? data.quantity ?? 0; this.item.image_url = data.image_url || ''; this.imagePreviewUrl = window.fixImagePath(data.image_url);
            this.discount_value = data.discount_percent || (data.discount || 0);
            if (data.discount_price) { this.discount_type = 'price'; this.discount_value = data.discount_price; }
            const links = await window.supabase.from('news_related_products').select('news_id').eq('product_id', this.id);
            this.relatedNewsIds = links.error ? [] : (links.data || []).map((link) => link.news_id);
        },
        async fetchNewsData() {
            const { data, error } = await window.supabase.from('news').select('*, news_related_products(product_id)').eq('id', this.id).single();
            if (error || !data) throw error || new Error('News tidak ditemukan.');
            this.item.title_en = this.getLocalized(data.title, 'en'); this.item.title_id = this.getLocalized(data.title, 'id');
            this.item.excerpt_en = this.getLocalized(data.excerpt, 'en'); this.item.excerpt_id = this.getLocalized(data.excerpt, 'id');
            this.item.body_en = this.getLocalized(data.body || data.content, 'en'); this.item.body_id = this.getLocalized(data.body || data.content, 'id');
            this.item.image_url = data.image_url || ''; this.imagePreviewUrl = window.fixImagePath(data.image_url);
            this.relatedProductIds = (data.news_related_products || []).map((link) => link.product_id);
        },
        validateProduct() {
            if (!this.item.name_en.trim() && !this.item.name_id.trim()) return 'Nama produk wajib diisi.';
            if (!Number.isFinite(Number(this.item.price)) || Number(this.item.price) <= 0) return 'Harga produk wajib lebih dari 0.';
            if (!Number.isFinite(Number(this.item.stock)) || Number(this.item.stock) < 0) return 'Stok produk wajib diisi dan tidak boleh negatif.';
            return '';
        },
        validateNews() {
            if (!this.item.title_en.trim() && !this.item.title_id.trim()) return 'Judul news wajib diisi.';
            if (!this.item.body_en.trim() && !this.item.body_id.trim()) return 'Konten news wajib diisi.';
            return '';
        },
        async submitForm() {
            const validationError = this.type === 'news' ? this.validateNews() : this.validateProduct();
            if (validationError) { (window.showNotification || window.showSiteNotification || alert)(validationError, true); return; }
            this.isLoading = true; this.submitButtonText = 'Saving...';
            try {
                if (this.type === 'news') await this.saveNews(); else await this.saveProduct();
                (window.showNotification || window.showSiteNotification || alert)(this.type === 'news' ? 'News berhasil disimpan.' : 'Produk berhasil disimpan.');
                window.location.href = 'admin-products.html';
            } catch (error) {
                console.error('[ADMIN EDITOR SAVE ERROR]', error);
                (window.showNotification || window.showSiteNotification || alert)(`Gagal menyimpan data: ${error.message}`, true);
            } finally {
                this.isLoading = false; this.submitButtonText = 'Save';
            }
        },
        productPayload() {
            const payload = {
                name: { en: this.item.name_en.trim() || this.item.name_id.trim(), id: this.item.name_id.trim() || this.item.name_en.trim() },
                description: { en: this.item.description_en, id: this.item.description_id },
                characteristics: { en: this.item.char_en, id: this.item.char_id },
                category: this.item.category,
                price: Number(this.item.price),
                stock: Number(this.item.stock),
                image_url: this.item.image_url || null
            };
            if (this.discount_type === 'price') payload.discount_price = Number(this.discount_value || 0);
            else payload.discount_percent = Number(this.discount_value || 0);
            return payload;
        },
        newsPayload() {
            const title = { en: this.item.title_en.trim() || this.item.title_id.trim(), id: this.item.title_id.trim() || this.item.title_en.trim() };
            const body = { en: this.item.body_en.trim() || this.item.body_id.trim(), id: this.item.body_id.trim() || this.item.body_en.trim() };
            const excerpt = { en: this.item.excerpt_en || body.en.slice(0, 160), id: this.item.excerpt_id || body.id.slice(0, 160) };
            return { title, body, content: body, excerpt, image_url: this.item.image_url || null };
        },
        async saveProduct() {
            const payload = this.productPayload();
            const query = this.id
                ? window.supabase.from('products').update(payload).eq('id', this.id).select('id').single()
                : window.supabase.from('products').insert(payload).select('id').single();
            const { data, error } = await query;
            if (error) throw error;
            const productId = this.id || data.id;
            await window.supabase.from('news_related_products').delete().eq('product_id', productId);
            if (this.relatedNewsIds.length) {
                const { error: relError } = await window.supabase.from('news_related_products').insert(this.relatedNewsIds.map((newsId) => ({ news_id: newsId, product_id: productId })));
                if (relError) throw relError;
            }
        },
        async saveNews() {
            const payload = this.newsPayload();
            const query = this.id
                ? window.supabase.from('news').update(payload).eq('id', this.id).select('id').single()
                : window.supabase.from('news').insert(payload).select('id').single();
            const { data, error } = await query;
            if (error) throw error;
            const newsId = this.id || data.id;
            await window.supabase.from('news_related_products').delete().eq('news_id', newsId);
            if (this.relatedProductIds.length) {
                const { error: relError } = await window.supabase.from('news_related_products').insert(this.relatedProductIds.map((productId) => ({ news_id: newsId, product_id: productId })));
                if (relError) throw relError;
            }
        }
    }));
});
