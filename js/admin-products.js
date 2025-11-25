document.addEventListener('alpine:init', () => {
    Alpine.data('productAdmin', () => ({
        // STATE
        isModalOpen: false,
        modalMode: 'add', // 'add' or 'edit'
        currentProductId: null,
        currentProductImageUrl: null,
        allProductsCache: [],
        isLoading: true,

        // INIT
        init() {
            this.fetchProducts();
        },

        // MODAL METHODS
        openAddModal() {
            this.modalMode = 'add';
            this.currentProductId = null;
            this.currentProductImageUrl = null;
            this.$nextTick(() => {
                document.getElementById('add-product-form').reset();
                document.getElementById('product-image').required = true;
            });
            this.isModalOpen = true;
        },

        openEditModal(product) {
            this.modalMode = 'edit';
            this.currentProductId = product.id;
            this.currentProductImageUrl = product.image_url;

            this.$nextTick(() => {
                document.getElementById('product-name').value = product.name;
                document.getElementById('product-category').value = product.category;
                document.getElementById('product-price').value = product.price;
                document.getElementById('product-char').value = product.char || '';
                document.getElementById('product-description').value = product.description;
                document.getElementById('product-image').required = false;
            });

            this.isModalOpen = true;
        },

        closeModal() {
            this.isModalOpen = false;
        },

        // DATA METHODS
        async fetchProducts() {
            this.isLoading = true;
            const { data, error } = await window.supabase.from('products').select('*').order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching products:', error);
                this.displayMessage('Gagal memuat produk.', false);
            } else {
                this.allProductsCache = data;
            }
            this.isLoading = false;
        },

        // FORM SUBMISSION
        async submitForm() {
            if (this.modalMode === 'add') {
                await this.addNewProduct();
            } else {
                await this.updateProduct();
            }
        },

        async addNewProduct() {
            const imageFile = document.getElementById('product-image').files[0];
            if (!imageFile) {
                this.displayMessage('Gambar produk wajib diisi.', false);
                return;
            }

            const filePath = `product-images/${Date.now()}_${imageFile.name}`;
            const { error: uploadError } = await window.supabase.storage.from('product-images').upload(filePath, imageFile);
            if (uploadError) {
                this.displayMessage('Gagal mengunggah gambar.', false); return;
            }

            const { data: { publicUrl } } = window.supabase.storage.from('product-images').getPublicUrl(filePath);

            const { error: insertError } = await window.supabase.from('products').insert({
                name: document.getElementById('product-name').value,
                category: document.getElementById('product-category').value,
                price: document.getElementById('product-price').value,
                char: document.getElementById('product-char').value,
                description: document.getElementById('product-description').value,
                image_url: publicUrl
            });

            if (insertError) {
                this.displayMessage('Gagal menambahkan produk.', false);
                await window.supabase.storage.from('product-images').remove([filePath]);
                return;
            }

            this.displayMessage('Produk berhasil ditambahkan!', true);
            this.closeModal();
            await this.fetchProducts();
        },

        async updateProduct() {
            const imageFile = document.getElementById('product-image').files[0];
            let newImageUrl = this.currentProductImageUrl;
            let newFilePath = null;

            if (imageFile) {
                newFilePath = `product-images/${Date.now()}_${imageFile.name}`;
                const { error: uploadError } = await window.supabase.storage.from('product-images').upload(newFilePath, imageFile);
                if (uploadError) {
                    this.displayMessage('Gagal mengunggah gambar baru.', false); return;
                }
                const { data: { publicUrl } } = window.supabase.storage.from('product-images').getPublicUrl(newFilePath);
                newImageUrl = publicUrl;
            }

            const { error: updateError } = await window.supabase.from('products').update({
                name: document.getElementById('product-name').value,
                category: document.getElementById('product-category').value,
                price: document.getElementById('product-price').value,
                char: document.getElementById('product-char').value,
                description: document.getElementById('product-description').value,
                image_url: newImageUrl
            }).eq('id', this.currentProductId);

            if (updateError) {
                this.displayMessage('Gagal memperbarui produk.', false);
                if (newFilePath) await window.supabase.storage.from('product-images').remove([newFilePath]);
                return;
            }

            if (imageFile && this.currentProductImageUrl) {
                const oldFilePath = this.currentProductImageUrl.substring(this.currentProductImageUrl.indexOf('product-images/'));
                await window.supabase.storage.from('product-images').remove([oldFilePath]);
            }

            this.displayMessage('Produk berhasil diperbarui!', true);
            this.closeModal();
            await this.fetchProducts();
        },

        async deleteProduct(productId, imageUrl) {
            if (!confirm('Apakah Anda yakin ingin menghapus produk ini?')) return;

            const { error: deleteDbError } = await window.supabase.from('products').delete().match({ id: productId });
            if (deleteDbError) {
                this.displayMessage('Gagal menghapus data produk.', false); return;
            }

            const filePath = imageUrl.substring(imageUrl.indexOf('product-images/'));
            await window.supabase.storage.from('product-images').remove([filePath]);

            this.displayMessage('Produk berhasil dihapus!', true);
            await this.fetchProducts();
        },

        // UTILITY METHODS
        displayMessage(message, isSuccess) {
            const messageContainer = document.getElementById('admin-message-container');
            messageContainer.textContent = message;
            messageContainer.className = isSuccess ? 'message-container success' : 'message-container error';
            messageContainer.style.display = 'block';
            setTimeout(() => messageContainer.style.display = 'none', 5000);
        },

        formatRupiah(value) {
            return "Rp " + (Number(value) || 0).toLocaleString("id-ID");
        }
    }));

});
