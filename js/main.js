document.addEventListener("alpine:init", () => {
  // --- Centralized Stores ---
  Alpine.store("products", {
    all: [],
    isLoading: true,
    async init() {
      this.isLoading = true;
      try {
        const { data, error } = await window.supabase
          .from("products")
          .select("*")
          .order("id", { ascending: true });
        if (error) throw error;
        this.all = data;
      } catch (err) {
        console.error("Error fetching products:", err);
      } finally {
        this.isLoading = false;
      }
    },
    getProductById(id) {
      return this.all.find(p => String(p.id) === String(id));
    }
  });

  Alpine.store("cart", {
    items: [],
    init() {
      this.items = JSON.parse(localStorage.getItem("cartItems")) || [];
    },
    add(productId) {
      const existing = this.items.find(item => String(item.id) === String(productId));
      if (existing) {
        existing.quantity++;
      } else {
        this.items.push({ id: productId, quantity: 1 });
      }
      this.save();
    },
    remove(productId, force = false) {
      const itemIndex = this.items.findIndex(item => String(item.id) === String(productId));
      if (itemIndex > -1) {
        if (force || this.items[itemIndex].quantity === 1) {
          this.items.splice(itemIndex, 1);
        } else {
          this.items[itemIndex].quantity--;
        }
      }
      this.save();
    },
    clear() {
      this.items = [];
      this.save();
    },
    save() {
      localStorage.setItem("cartItems", JSON.stringify(this.items));
    },
    get details() {
      return this.items
        .map(item => {
          const product = Alpine.store("products").getProductById(item.id);
          if (!product) {
            return null;
          }
          return {
            ...product,
            quantity: item.quantity,
            img: product.image_url,
            subtotal: product.price * item.quantity,
          };
        })
        .filter(Boolean);
    },
    get total() {
      return this.details.reduce((total, item) => total + item.subtotal, 0);
    },
    get quantity() {
      return this.items.reduce((total, item) => total + item.quantity, 0);
    }
  });

  // --- Page-Specific Components ---
  Alpine.data('adminPage', () => ({
    activeTab: 'products', // 'products' or 'news'
    products: [],
    news: [],
    isLoading: { products: true, news: true },
    isModalOpen: false,
    modalMode: 'add', // 'add' or 'edit'
    currentItem: {},
    searchQuery: { products: '', news: '' },

    get filteredProducts() {
        if (!this.searchQuery.products) return this.products;
        const query = this.searchQuery.products.toLowerCase();
        return this.products.filter(p =>
            p.name.toLowerCase().includes(query) ||
            p.category.toLowerCase().includes(query)
        );
    },

    get filteredNews() {
        if (!this.searchQuery.news) return this.news;
        const query = this.searchQuery.news.toLowerCase();
        return this.news.filter(n =>
            n.title.toLowerCase().includes(query) ||
            n.excerpt.toLowerCase().includes(query)
        );
    },

    async init() {
      this.fetchProducts();
      this.fetchNews();
    },

    async fetchProducts() {
      this.isLoading.products = true;
      try {
        const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        this.products = data;
      } catch (error) {
        console.error('Error fetching products:', error);
        window.showNotification('Gagal memuat produk.', true);
      } finally {
        this.isLoading.products = false;
      }
    },

    async fetchNews() {
      this.isLoading.news = true;
      try {
        const { data, error } = await supabase.from('news').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        this.news = data;
      } catch (error) {
        console.error('Error fetching news:', error);
        window.showNotification('Gagal memuat berita.', true);
      } finally {
        this.isLoading.news = false;
      }
    },

    getModalTitle() {
      const type = this.activeTab === 'products' ? 'Produk' : 'Berita';
      return this.modalMode === 'add' ? `Tambah ${type} Baru` : `Edit ${type}`;
    },

    getSubmitButtonText() {
        return this.modalMode === 'add' ? 'Tambah' : 'Simpan Perubahan';
    },

    openAddModal() {
      this.modalMode = 'add';
      this.currentItem = this.activeTab === 'products' ?
        { name: '', category: 'benih', price: 0, characteristics: '', description: '', image_url: '' } :
        { title: '', excerpt: '', image_url: '' };
      this.isModalOpen = true;
    },

    openEditModal(item) {
      this.modalMode = 'edit';
      this.currentItem = JSON.parse(JSON.stringify(item));
      this.isModalOpen = true;
    },

    closeModal() {
      this.isModalOpen = false;
      this.currentItem = {};
    },

    async submitForm() {
        const tableName = this.activeTab;
        const isAddMode = this.modalMode === 'add';
        let itemData = { ...this.currentItem };

        try {
            // 1. Handle image upload if a new file is selected
            const imageInput = document.getElementById(tableName === 'products' ? 'product-image-input' : 'news-image-input');
            const file = imageInput.files[0];

            if (file) {
                const fileName = `${tableName}/${Date.now()}_${file.name}`;
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('product-images')
                    .upload(fileName, file);

                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
                itemData.image_url = urlData.publicUrl;

                // If editing, delete the old image
                if (!isAddMode && this.currentItem.image_url) {
                    const oldImageName = this.currentItem.image_url.split('/').pop();
                    if(oldImageName) {
                       await supabase.storage.from('product-images').remove([`${tableName}/${oldImageName}`]);
                    }
                }
            }

            // 2. Prepare data for Supabase (remove id for insert)
            let queryData = { ...itemData };
            if (isAddMode) {
                delete queryData.id;
            } else {
                delete queryData.created_at; // Avoid updating this field
            }

            // 3. Upsert data to the table
            let result;
            if (isAddMode) {
                result = await supabase.from(tableName).insert(queryData).select();
            } else {
                result = await supabase.from(tableName).update(queryData).eq('id', itemData.id).select();
            }

            const { data, error } = result;

            if (error) throw error;

            // 4. Update local state
            if (isAddMode) {
                this[tableName].unshift(data[0]);
            } else {
                const index = this[tableName].findIndex(i => i.id === data[0].id);
                if (index > -1) this[tableName][index] = data[0];
            }

            window.showNotification(`${tableName === 'products' ? 'Produk' : 'Berita'} berhasil disimpan!`);
            this.closeModal();
        } catch (error) {
            console.error('Error submitting form:', error);
            window.showNotification('Terjadi kesalahan. Coba lagi.', true);
        }
    },

    async deleteItem(id, imageUrl) {
        if (!confirm('Anda yakin ingin menghapus item ini? Tindakan ini tidak dapat dibatalkan.')) return;

        const tableName = this.activeTab;

        try {
            // 1. Delete from table
            const { error: dbError } = await supabase.from(tableName).delete().eq('id', id);
            if (dbError) throw dbError;

            // 2. Delete image from storage
            if (imageUrl) {
                const imageName = imageUrl.split('/').pop();
                if (imageName) {
                    await supabase.storage.from('product-images').remove([`${tableName}/${imageName}`]);
                }
            }

            // 3. Update local state
            this[tableName] = this[tableName].filter(item => item.id !== id);
            window.showNotification('Item berhasil dihapus.');

        } catch (error) {
            console.error('Error deleting item:', error);
            window.showNotification('Gagal menghapus item.', true);
        }
    },

    formatRupiah(number) {
        if (isNaN(number)) return "Rp 0";
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
    }
  }));
});

window.showNotification = (message, isError = false) => {
  const notificationElement = document.getElementById('notification');
  if (!notificationElement) {
    console.warn('Notification element not found. Please add `<div id="notification"></div>` to your HTML.');
    alert(message);
    return;
  }
  notificationElement.textContent = message;
  notificationElement.style.backgroundColor = isError ? '#ef4444' : 'var(--accent)';
  notificationElement.classList.add('show');
  setTimeout(() => {
    notificationElement.classList.remove('show');
  }, 3000);
};
