document.addEventListener('alpine:init', () => {
    Alpine.data('productAdmin', () => ({
        isModalOpen: false,
        modalMode: 'add', // 'add' or 'edit'
        currentProductId: null,
        currentProductImageUrl: null,
        products: [],

        openAddModal() {
            this.modalMode = 'add';
            this.currentProductId = null;
            this.currentProductImageUrl = null;
            document.getElementById('add-product-form').reset();
            const imageInput = document.getElementById('product-image');
            imageInput.required = true;
            this.isModalOpen = true;
        },

        openEditModal(product) {
            this.modalMode = 'edit';
            this.currentProductId = product.id;
            this.currentProductImageUrl = product.image_url;

            // Populate form
            document.getElementById('product-name').value = product.name;
            document.getElementById('product-category').value = product.category;
            document.getElementById('product-price').value = product.price;
            document.getElementById('product-char').value = product.char || '';
            document.getElementById('product-description').value = product.description;

            // Image is not required for editing
            const imageInput = document.getElementById('product-image');
            imageInput.required = false;

            this.isModalOpen = true;
        },

        closeModal() {
            this.isModalOpen = false;
        }
    }));
});


document.addEventListener('DOMContentLoaded', () => {
    const addProductForm = document.getElementById('add-product-form');
    const productListBody = document.getElementById('product-list-body');
    const loadingMessage = document.getElementById('loading-message');
    const messageContainer = document.getElementById('admin-message-container');

    let allProducts = []; // Cache for product data

    function displayMessage(message, isSuccess) {
        messageContainer.textContent = message;
        messageContainer.className = isSuccess ? 'message-container success' : 'message-container error';
        messageContainer.style.display = 'block';
        setTimeout(() => messageContainer.style.display = 'none', 5000);
    }

    function formatRupiah(value) {
        return "Rp " + (Number(value) || 0).toLocaleString("id-ID");
    }

    function renderProducts(products) {
        productListBody.innerHTML = '';
        if (products.length === 0) {
            productListBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Belum ada produk.</td></tr>';
            return;
        }

        products.forEach(product => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td data-label="Gambar"><img src="${product.image_url}" alt="${product.name}" class="product-image"></td>
                <td data-label="Produk" class="product-name">${product.name}</td>
                <td data-label="Kategori">${product.category}</td>
                <td data-label="Harga">${formatRupiah(product.price)}</td>
                <td data-label="Aksi">
                    <div class="action-buttons">
                        <button class="btn-edit" data-product-id="${product.id}">Edit</button>
                        <button class="btn-delete" data-product-id="${product.id}" data-image-path="${product.image_url}">Hapus</button>
                    </div>
                </td>
            `;
            productListBody.appendChild(row);
        });
    }

    async function fetchProducts() {
        loadingMessage.style.display = 'block';
        const { data, error } = await window.supabase.from('products').select('*').order('created_at', { ascending: false });

        loadingMessage.style.display = 'none';
        if (error) {
            console.error('Error fetching products:', error);
            displayMessage('Gagal memuat produk.', false);
            return;
        }
        allProducts = data; // Cache the data
        renderProducts(allProducts);
    }

    addProductForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const alpineComponent = document.body.__x;
        const currentMode = alpineComponent.$data.modalMode;

        if (currentMode === 'add') {
            await addNewProduct();
        } else {
            await updateProduct();
        }
    });

    async function addNewProduct() {
        const name = document.getElementById('product-name').value;
        const category = document.getElementById('product-category').value;
        const price = document.getElementById('product-price').value;
        const imageFile = document.getElementById('product-image').files[0];
        const char = document.getElementById('product-char').value;
        const description = document.getElementById('product-description').value;

        if (!imageFile) {
            displayMessage('Gambar produk wajib diisi.', false);
            return;
        }

        const filePath = `product-images/${Date.now()}_${imageFile.name}`;
        const { error: uploadError } = await window.supabase.storage.from('product-images').upload(filePath, imageFile);
        if (uploadError) {
            displayMessage('Gagal mengunggah gambar.', false); return;
        }

        const { data: { publicUrl } } = window.supabase.storage.from('product-images').getPublicUrl(filePath);

        const { error: insertError } = await window.supabase.from('products').insert({ name, category, price, char, description, image_url: publicUrl });
        if (insertError) {
            displayMessage('Gagal menambahkan produk.', false);
            await window.supabase.storage.from('product-images').remove([filePath]);
            return;
        }

        displayMessage('Produk berhasil ditambahkan!', true);
        document.body.__x.$data.isModalOpen = false;
        await fetchProducts();
    }

    async function updateProduct() {
        const alpineComponent = document.body.__x;
        const productId = alpineComponent.$data.currentProductId;
        const currentImageUrl = alpineComponent.$data.currentProductImageUrl;

        const name = document.getElementById('product-name').value;
        const category = document.getElementById('product-category').value;
        const price = document.getElementById('product-price').value;
        const imageFile = document.getElementById('product-image').files[0];
        const char = document.getElementById('product-char').value;
        const description = document.getElementById('product-description').value;

        let newImageUrl = currentImageUrl;
        let newFilePath = null;

        if (imageFile) {
            newFilePath = `product-images/${Date.now()}_${imageFile.name}`;
            const { error: uploadError } = await window.supabase.storage.from('product-images').upload(newFilePath, imageFile);
            if (uploadError) {
                displayMessage('Gagal mengunggah gambar baru.', false); return;
            }
            const { data: { publicUrl } } = window.supabase.storage.from('product-images').getPublicUrl(newFilePath);
            newImageUrl = publicUrl;
        }

        const { error: updateError } = await window.supabase.from('products').update({ name, category, price, char, description, image_url: newImageUrl }).eq('id', productId);
        if (updateError) {
            displayMessage('Gagal memperbarui produk.', false);
            if (newFilePath) await window.supabase.storage.from('product-images').remove([newFilePath]);
            return;
        }

        if (imageFile && currentImageUrl) {
            const oldFilePath = currentImageUrl.substring(currentImageUrl.indexOf('product-images/'));
            await window.supabase.storage.from('product-images').remove([oldFilePath]);
        }

        displayMessage('Produk berhasil diperbarui!', true);
        document.body.__x.$data.isModalOpen = false;
        await fetchProducts();
    }


    productListBody.addEventListener('click', async (e) => {
        const alpineComponent = document.body.__x;

        if (e.target.classList.contains('btn-edit')) {
            const productId = e.target.dataset.productId;
            const product = allProducts.find(p => p.id == productId);
            if (product) {
                 alpineComponent.$data.openEditModal(product);
            }
        }

        if (e.target.classList.contains('btn-delete')) {
            const productId = e.target.dataset.productId;
            const imageUrl = e.target.dataset.imagePath;
            if (!confirm('Apakah Anda yakin ingin menghapus produk ini?')) return;

            const { error: deleteDbError } = await window.supabase.from('products').delete().match({ id: productId });
            if (deleteDbError) {
                displayMessage('Gagal menghapus data produk.', false); return;
            }

            const filePath = imageUrl.substring(imageUrl.indexOf('product-images/'));
            const { error: deleteStorageError } = await window.supabase.storage.from('product-images').remove([filePath]);
            if (deleteStorageError) {
                displayMessage('Produk dihapus, tetapi gambar gagal dihapus.', false);
            } else {
                displayMessage('Produk berhasil dihapus!', true);
            }
            await fetchProducts();
        }
    });

    // Initial fetch
    fetchProducts();
});
