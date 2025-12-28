// Global currency formatter
window.formatRupiah = (number) => {
  if (isNaN(number)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(number);
};

// Global status translator
window.translateStatus = (status) => {
  const statusMap = {
    'Menunggu Konfirmasi': 'Awaiting Confirmation',
    'Diproses': 'Preparing for Shipment',
    'Dalam Pengiriman': 'On Its Way',
    'Selesai': 'Completed',
    'Ditolak': 'Rejected',
  };
  return statusMap[status] || status;
};

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
        // Failed to load products, let the array be empty
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

  // --- Page Components ---
  Alpine.data('products', () => ({
    searchTerm: '',
    selectedCategory: 'all',
    sortOption: 'default',
    currentPage: 1,
    itemsPerPage: 12,

    promoItems() {
      return Alpine.store('products').all.filter(p => p.discount_price || p.discount_percent > 0).slice(0, 4);
    },

    renderProductCard(item) {
      const isPromo = (item.discount_price && item.discount_price > 0) || (item.discount_percent && item.discount_percent > 0);
      let discountedPrice = 0;
      let percent = 0;

      if (isPromo) {
        // A fixed-price discount exists
        if (item.discount_price && item.discount_price > 0) {
          discountedPrice = item.discount_price;
          // Calculate the percentage discount and round down
          percent = Math.floor(((item.price - item.discount_price) / item.price) * 100);
        } else { // A percentage-based discount exists
          discountedPrice = item.price - (item.price * item.discount_percent / 100);
          percent = item.discount_percent;
        }
      }

      const ribbonHtml = isPromo && percent > 0 ? `
        <div class="discount-ribbon"><span>${percent}% OFF</span></div>
      ` : '';

      const priceHtml = isPromo && discountedPrice > 0 ? `
        <div class="price-container">
          <div class="price-original">${window.formatRupiah(item.price)}</div>
          <div class="price-discounted">${window.formatRupiah(discountedPrice)}</div>
        </div>
      ` : `<div class="price">${window.formatRupiah(item.price)}</div>`;

      return `
        <a href="product detail.html?id=${item.id}" class="product-link">
          <article class="product-card">
            ${ribbonHtml}
            <figure class="product-media">
              <img src="${item.image_url ? item.image_url : 'img/coming soon.jpg'}" alt="${item.name}" />
            </figure>
            <div class="product-body">
              <h3 class="product-title">${item.name}</h3>
              <div class="product-meta">
                ${priceHtml}
                <button class="btn-sm add-cart" @click.prevent.stop="$store.cart.add(${item.id})">
                  <i data-feather="shopping-bag"></i> Add
                </button>
              </div>
            </div>
          </article>
        </a>
      `;
    },

    showOnlyPromos() {
      this.selectedCategory = 'promo';
      const productSection = document.getElementById('Product');
      if (productSection) {
        window.scrollTo({
          top: productSection.offsetTop,
          behavior: 'smooth'
        });
      }
    },

    processedItems() {
      let items = Alpine.store('products').all;

      if (this.searchTerm.trim()) {
        const query = this.searchTerm.toLowerCase();
        items = items.filter(item =>
          item.name.toLowerCase().includes(query) ||
          (item.description && item.description.toLowerCase().includes(query))
        );
      }

      if (this.selectedCategory === 'promo') {
        items = items.filter(item => item.discount_price || (item.discount_percent && item.discount_percent > 0));
      } else if (this.selectedCategory !== 'all') {
        items = items.filter(item => item.category === this.selectedCategory);
      }

      const sortedItems = [...items];
      switch (this.sortOption) {
        case 'price-asc':
          sortedItems.sort((a, b) => a.price - b.price);
          break;
        case 'price-desc':
          sortedItems.sort((a, b) => b.price - a.price);
          break;
      }
      return sortedItems;
    },

    paginatedItems() {
      const start = (this.currentPage - 1) * this.itemsPerPage;
      const end = start + this.itemsPerPage;
      return this.processedItems().slice(start, end);
    },

    totalPages() {
      return Math.ceil(this.processedItems().length / this.itemsPerPage);
    },

    goToPage(page) {
      if (page < 1 || page > this.totalPages()) return;
      this.currentPage = page;

      const productSection = document.getElementById('Product');
      if (productSection) {
        window.scrollTo({ top: productSection.offsetTop, behavior: 'smooth' });
      }

      this.$nextTick(() => feather.replace());
    },

    init() {
      const refreshOnFilterChange = () => {
        this.currentPage = 1;
        this.$nextTick(() => feather.replace());
      };
      this.$watch('searchTerm', refreshOnFilterChange);
      this.$watch('selectedCategory', refreshOnFilterChange);
      this.$watch('sortOption', refreshOnFilterChange);

      this.$watch('$store.products.isLoading', (loading) => {
        if (!loading) {
          this.$nextTick(() => feather.replace());
        }
      });
    }
  }));

  Alpine.data('contentManager', () => ({
    activeTab: 'products',
    products: [],
    news: [],
    isLoading: { products: true, news: true },
    searchQuery: { products: '', news: '' },
    bulkDiscountPercent: null,

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
        window.showNotification('Failed to load products.', true);
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
        window.showNotification('Failed to load news.', true);
      } finally {
        this.isLoading.news = false;
      }
    },

    async deleteItem(id, imageUrl) {
      if (!confirm('Are you sure you want to delete this item?')) return;

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
        window.showNotification('Item successfully deleted.');
      } catch (error) {
        window.showNotification('Failed to delete item.', true);
      }
    },

    async applyBulkDiscount() {
      if (!this.bulkDiscountPercent || this.bulkDiscountPercent < 1 || this.bulkDiscountPercent > 90) {
        window.showNotification('Please enter a valid discount percentage (1-90).', true);
        return;
      }

      if (!confirm(`Are you sure you want to apply a ${this.bulkDiscountPercent}% discount to all eligible products? This action cannot be undone.`)) {
        return;
      }

      try {
        const { error } = await supabase
          .from('products')
          .update({
            discount_percent: this.bulkDiscountPercent,
            discount_price: null
          })
          .is('discount_price', null);

        if (error) throw error;

        window.showNotification('Bulk discount applied successfully!');
        this.bulkDiscountPercent = null;
        this.fetchProducts(); // Refresh the product list
      } catch (error) {
        window.showNotification('Failed to apply bulk discount.', true);
      }
    }
  }));

});

// Global notification
window.showNotification = (message, isError = false) => {
  const notificationElement = document.getElementById('notification');
  if (!notificationElement) {
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
