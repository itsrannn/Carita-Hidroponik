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
          if (!product) return null;
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

  // --- Page Component (FINAL FIXED VERSION) ---
  Alpine.data('contentManager', () => ({
    activeTab: 'products',
    products: [],
    news: [],
    isLoading: { products: true, news: true },
    isModalOpen: false,
    modalMode: 'add',
    currentItem: {},
    searchQuery: { products: '', news: '' },
    quill: null,

    initQuill() {
        this.$nextTick(() => {
            if (document.getElementById('quill-editor')) {
                this.quill = new Quill('#quill-editor', {
                    theme: 'snow',
                    modules: {
                        toolbar: [
                            [{ 'header': [1, 2, false] }],
                            ['bold', 'italic', 'underline'],
                            ['link'],
                            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                            ['clean']
                        ]
                    }
                });

                // Set content if in edit mode
                if (this.modalMode === 'edit' && this.currentItem.content) {
                    this.quill.root.innerHTML = this.currentItem.content;
                } else {
                    this.quill.root.innerHTML = '';
                }
            }
        });
    },

    get filteredProducts() {
      if (!this.searchQuery.products) return this.products;
      const q = this.searchQuery.products.toLowerCase();
      return this.products.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    },

    get filteredNews() {
      if (!this.searchQuery.news) return this.news;
      const q = this.searchQuery.news.toLowerCase();
      return this.news.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.excerpt.toLowerCase().includes(q)
      );
    },

    async init() {
      this.fetchProducts();
      this.fetchNews();
    },

    async fetchProducts() {
      this.isLoading.products = true;
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('created_at', { ascending: false });
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
        const { data, error } = await supabase
          .from('news')
          .select('*')
          .order('created_at', { ascending: false });
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
      return this.modalMode === 'add'
        ? `Tambah ${type} Baru`
        : `Edit ${type}`;
    },

    getSubmitButtonText() {
      return this.modalMode === 'add' ? 'Tambah' : 'Simpan Perubahan';
    },

    openAddModal() {
      this.modalMode = 'add';
      this.currentItem =
        this.activeTab === 'products'
          ? { name: '', category: 'benih', price: 0, characteristics: '', description: '', image_url: '' }
          : { title: '', excerpt: '', content: '', image_url: '' };
      this.isModalOpen = true;
      if (this.activeTab === 'news') {
        this.initQuill();
      }
    },

    openEditModal(item) {
      this.modalMode = 'edit';
      this.currentItem = JSON.parse(JSON.stringify(item));
      this.isModalOpen = true;
      if (this.activeTab === 'news') {
        this.initQuill();
      }
    },

    closeModal() {
      this.isModalOpen = false;
      this.currentItem = {};
      this.quill = null;
    },

    async submitForm() {
      const tableName = this.activeTab;
      const isAdd = this.modalMode === 'add';
      let itemData = { ...this.currentItem };

      if (tableName === 'news' && this.quill) {
        itemData.content = this.quill.root.innerHTML;
      }

      try {
        // --- Handle image upload ---
        const inputId = tableName === 'products' ? 'product-image-input' : 'news-image-input';
        const imageInput = document.getElementById(inputId);
        const file = imageInput.files[0];

        if (file) {
          const uploadedName = `${tableName}/${Date.now()}_${file.name}`;

          const { error: uploadErr } = await supabase.storage
            .from('product-images')
            .upload(uploadedName, file);
          if (uploadErr) throw uploadErr;

          const { data: urlData } =
            supabase.storage.from('product-images').getPublicUrl(uploadedName);

          itemData.image_url = urlData.publicUrl;

          // Delete old image when editing
          if (!isAdd && this.currentItem.image_url) {
            const oldName = this.currentItem.image_url.split('/').pop();
            if (oldName) {
              await supabase.storage.from('product-images').remove([`${tableName}/${oldName}`]);
            }
          }
        }

        // --- Prepare query ---
        let finalData = { ...itemData };
        if (isAdd) delete finalData.id;
        else delete finalData.created_at;

        let result = isAdd
          ? await supabase.from(tableName).insert(finalData).select()
          : await supabase.from(tableName).update(finalData).eq('id', itemData.id).select();

        const { data, error } = result;
        if (error) throw error;

        // Update UI
        if (isAdd) {
          this[tableName].unshift(data[0]);
        } else {
          const idx = this[tableName].findIndex(i => i.id === data[0].id);
          if (idx > -1) this[tableName][idx] = data[0];
        }

        window.showNotification(`${tableName === 'products' ? 'Produk' : 'Berita'} berhasil disimpan!`);
        this.closeModal();
      } catch (error) {
        console.error('Error submitting form:', error);
        window.showNotification('Terjadi kesalahan. Coba lagi.', true);
      }
    },

    async deleteItem(id, imageUrl) {
      if (!confirm('Anda yakin ingin menghapus item ini?')) return;

      const tableName = this.activeTab;
      try {
        const { error: dbErr } = await supabase.from(tableName).delete().eq('id', id);
        if (dbErr) throw dbErr;

        if (imageUrl) {
          const fileName = imageUrl.split('/').pop();
          if (fileName) {
            await supabase.storage.from('product-images').remove([`${tableName}/${fileName}`]);
          }
        }

        this[tableName] = this[tableName].filter(item => item.id !== id);
        window.showNotification('Item berhasil dihapus.');
      } catch (error) {
        console.error('Error deleting item:', error);
        window.showNotification('Gagal menghapus item.', true);
      }
    },

    formatRupiah(number) {
      if (isNaN(number)) return "Rp 0";
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0
      }).format(number);
    }
  }));
});

// Global notification
window.showNotification = (message, isError = false) => {
  const notificationElement = document.getElementById('notification');
  if (!notificationElement) {
    console.warn('Notification element not found.');
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
