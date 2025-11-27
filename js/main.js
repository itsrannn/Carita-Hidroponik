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
    searchQuery: { products: '', news: '' },

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

  Alpine.data('editorPage', () => ({
      type: null,
      action: null,
      id: null,
      item: {},
      title: 'Memuat...',
      submitButtonText: 'Simpan',
      isLoading: true,
      quill: null,

      async init() {
          const params = new URLSearchParams(window.location.search);
          this.type = params.get('type');
          this.action = params.get('action');
          this.id = params.get('id');

          this.setupPage();

          if (this.action === 'edit' && this.id) {
              await this.fetchData();
          } else {
              this.initializeEmptyItem();
              this.isLoading = false;
          }

           if (this.type === 'news') {
              this.$nextTick(() => {
                  this.initializeQuill();
                  if (this.item.content) {
                      this.quill.root.innerHTML = this.item.content;
                  }
              });
          }
      },

      setupPage() {
          if (this.type === 'product') {
              this.title = this.action === 'add' ? 'Tambah Produk Baru' : 'Edit Produk';
          } else if (this.type === 'news') {
              this.title = this.action === 'add' ? 'Tambah Berita Baru' : 'Edit Berita';
          }
          this.submitButtonText = this.action === 'add' ? 'Simpan' : 'Simpan Perubahan';
      },

      initializeEmptyItem() {
          if (this.type === 'product') {
              this.item = { name: '', category: '', price: null, characteristics: '', description: '', image_url: '' };
          } else if (this.type === 'news') {
              this.item = { title: '', excerpt: '', content: '', image_url: '' };
          }
      },

      async fetchData() {
          this.isLoading = true;
          const tableName = this.type === 'product' ? 'products' : 'news';
          const { data, error } = await supabase
              .from(tableName)
              .select('*')
              .eq('id', this.id)
              .single();

          if (error) {
              console.error('Error fetching data:', error);
              showNotification('Gagal memuat data. Silakan coba lagi.', true);
              this.isLoading = false;
              return;
          }

          this.item = data;
          this.isLoading = false;
      },

      initializeQuill() {
          if (document.getElementById('quill-editor') && !this.quill) {
              this.quill = new Quill('#quill-editor', {
                  theme: 'snow',
                  modules: {
                      toolbar: [
                          [{ 'header': [1, 2, 3, false] }],
                          ['bold', 'italic', 'underline'],
                          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                          ['link', 'image'],
                          ['clean']
                      ]
                  }
              });
          }
      },

      async submitForm() {
          this.isLoading = true;

          const imageInput = document.getElementById(this.type === 'product' ? 'image-input' : 'news-image-input');
          const file = imageInput.files[0];
          let imageUrl = this.item.image_url;

          if (file) {
              const filePath = `${this.type}-images/${Date.now()}-${file.name}`;
              const { data: uploadData, error: uploadError } = await supabase.storage
                  .from('product-images')
                  .upload(filePath, file);

              if (uploadError) {
                  console.error('Error uploading image:', uploadError);
                  showNotification('Gagal mengunggah gambar.', true);
                  this.isLoading = false;
                  return;
              }

              const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(uploadData.path);
              imageUrl = urlData.publicUrl;
          }

          let dataToSubmit = { ...this.item, image_url: imageUrl };
          if (this.type === 'news') {
              dataToSubmit.content = this.quill.root.innerHTML;
          }

          if (this.action === 'add') {
              delete dataToSubmit.id;
          }

          const tableName = this.type === 'product' ? 'products' : 'news';
          let response;
          if (this.action === 'add') {
              response = await supabase.from(tableName).insert([dataToSubmit]);
          } else {
              response = await supabase.from(tableName).update(dataToSubmit).eq('id', this.id);
          }

          const { error } = response;

          if (error) {
              console.error('Error saving data:', error);
              showNotification('Gagal menyimpan data. Silakan coba lagi.', true);
              this.isLoading = false;
              return;
          }

          showNotification('Data berhasil disimpan!', false);
          setTimeout(() => {
              window.location.href = 'admin-products.html';
          }, 1500);
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
