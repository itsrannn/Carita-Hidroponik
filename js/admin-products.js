document.addEventListener('DOMContentLoaded', () => {
    const addProductForm = document.getElementById('add-product-form');
    const productListGrid = document.getElementById('product-list-grid');
    const loadingMessage = document.getElementById('loading-message');
    const messageContainer = document.getElementById('admin-message-container');

    // Fungsi untuk menampilkan pesan (sukses atau error)
    function displayMessage(message, isSuccess) {
        messageContainer.textContent = message;
        messageContainer.className = isSuccess ? 'message-container success' : 'message-container error';
        messageContainer.style.display = 'block';
        setTimeout(() => {
            messageContainer.style.display = 'none';
        }, 5000);
    }

    // Format Rupiah
    function formatRupiah(value) {
        if (!value) return "Rp 0";
        return "Rp " + Number(value).toLocaleString("id-ID");
    }

    // Fungsi untuk mengambil dan menampilkan produk
    async function fetchProducts() {
        loadingMessage.style.display = 'block';
        productListGrid.innerHTML = '';

        const { data, error } = await window.supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        loadingMessage.style.display = 'none';

        if (error) {
            console.error('Error fetching products:', error);
            displayMessage('Gagal memuat produk.', false);
            return;
        }

        if (data.length === 0) {
            productListGrid.innerHTML = '<p>Belum ada produk yang ditambahkan.</p>';
            return;
        }

        data.forEach(product => {
            const card = document.createElement('div');
            card.classList.add('product-card');
            card.innerHTML = `
                <img src="${product.image_url}" alt="${product.name}">
                <div class="product-card-content">
                    <h3>${product.name}</h3>
                    <p>${formatRupiah(product.price)}</p>
                    <div class="product-card-actions">
                        <button class="btn-delete" data-product-id="${product.id}" data-image-path="${product.image_url}">Hapus</button>
                    </div>
                </div>
            `;
            productListGrid.appendChild(card);
        });
    }

    // Event listener untuk form penambahan produk
    addProductForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('product-name').value;
        const category = document.getElementById('product-category').value;
        const price = document.getElementById('product-price').value;
        const imageFile = document.getElementById('product-image').files[0];
        const char = document.getElementById('product-char').value;
        const description = document.getElementById('product-description').value;

        if (!imageFile) {
            displayMessage('Silakan pilih gambar produk.', false);
            return;
        }

        // 1. Upload gambar ke Supabase Storage
        const filePath = `product-images/${Date.now()}_${imageFile.name}`;
        const { error: uploadError } = await window.supabase.storage
            .from('product-images')
            .upload(filePath, imageFile);

        if (uploadError) {
            console.error('Error uploading image:', uploadError);
            displayMessage('Gagal mengunggah gambar.', false);
            return;
        }

        // 2. Dapatkan URL publik dari gambar yang diunggah
        const { data: publicUrlData } = window.supabase.storage
            .from('product-images')
            .getPublicUrl(filePath);

        const imageUrl = publicUrlData.publicUrl;

        // 3. Simpan data produk ke tabel 'products'
        const { error: insertError } = await window.supabase
            .from('products')
            .insert({
                name,
                category,
                price,
                char,
                description,
                image_url: imageUrl,
            });

        if (insertError) {
            console.error('Error inserting product:', insertError);
            displayMessage('Gagal menambahkan produk.', false);
            // Coba hapus gambar yang sudah terunggah jika insert gagal
            await window.supabase.storage.from('product-images').remove([filePath]);
            return;
        }

        displayMessage('Produk berhasil ditambahkan!', true);
        addProductForm.reset();
        await fetchProducts(); // Muat ulang daftar produk
    });

    // Event listener untuk tombol hapus (menggunakan event delegation)
    productListGrid.addEventListener('click', async (e) => {
        if (e.target.classList.contains('btn-delete')) {
            const productId = e.target.dataset.productId;
            const imageUrl = e.target.dataset.imagePath;

            if (!confirm('Apakah Anda yakin ingin menghapus produk ini?')) {
                return;
            }

            // 1. Hapus data produk dari tabel
            const { error: deleteDbError } = await window.supabase
                .from('products')
                .delete()
                .match({ id: productId });

            if (deleteDbError) {
                console.error('Error deleting product from database:', deleteDbError);
                displayMessage('Gagal menghapus data produk.', false);
                return;
            }

            // 2. Hapus gambar dari storage
            // Ekstrak path file dari URL lengkap
            const filePath = imageUrl.substring(imageUrl.indexOf('product-images/'));
            const { error: deleteStorageError } = await window.supabase.storage
                .from('product-images')
                .remove([filePath]);

            if (deleteStorageError) {
                console.error('Error deleting product image from storage:', deleteStorageError);
                // Tampilkan pesan, tapi data DB sudah terhapus jadi tetap lanjutkan refresh
                displayMessage('Produk dihapus, tetapi gambar gagal dihapus dari storage.', false);
            } else {
                displayMessage('Produk berhasil dihapus!', true);
            }

            await fetchProducts(); // Muat ulang daftar produk
        }
    });

    // Inisialisasi: Panggil fetchProducts saat halaman dimuat
    fetchProducts();
});
