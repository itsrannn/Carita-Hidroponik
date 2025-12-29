// Global currency formatter
window.formatRupiah = (number) => {
  if (isNaN(number)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(number);
};

window.handleSearch = (searchTerm) => {
  if (searchTerm.trim() !== '') {
    window.location.href = `index.html?s=${encodeURIComponent(searchTerm.trim())}`;
  }
};

/**
 * Calculates the final price and discount percentage for a product.
 * @param {object} product - The product object.
 * @returns {{finalPrice: number, percentOff: number, originalPrice: number}}
 */
window.calculateDiscount = (product) => {
  const originalPrice = product.price;
  let finalPrice = originalPrice;
  let percentOff = 0;

  const hasFixedDiscount = product.discount_price && product.discount_price > 0;
  const hasPercentDiscount = product.discount_percent && product.discount_percent > 0;

  if (hasFixedDiscount) {
    finalPrice = product.discount_price;
    percentOff = Math.floor(((originalPrice - finalPrice) / originalPrice) * 100);
  } else if (hasPercentDiscount) {
    percentOff = product.discount_percent;
    finalPrice = originalPrice - (originalPrice * percentOff / 100);
  }

  // Clamp price to 0 if discount is too high
  finalPrice = Math.max(0, finalPrice);

  return { finalPrice, percentOff, originalPrice };
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
  Alpine.store("i18n", {
    lang: localStorage.getItem("language") || "id",
    messages: {},
    init() {
      this.load(this.lang);
    },
    async load(lang) {
      if (!['en', 'id'].includes(lang)) {
        lang = 'id';
      }
      try {
        const response = await fetch(`locales/${lang}.json`);
        if (!response.ok) {
          throw new Error('Translation file not found.');
        }
        this.messages = await response.json();
        this.lang = lang;
        document.documentElement.lang = lang;
        localStorage.setItem("language", lang);
      } catch (error) {
        console.error('Failed to load translations:', error);
        // Fallback to an empty object, t() will return keys
        this.messages = {};
      } finally {
        document.documentElement.setAttribute('data-i18n-loaded', 'true');
      }
    },
    t(key) {
      const translation = key.split('.').reduce((o, i) => (o ? o[i] : undefined), this.messages);
      if (translation === undefined) {
        console.warn(`Translation not found for key: ${key}`);
        return key;
      }
      return translation;
    }
  });

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
        this.all = data || [];
      } catch (err) {
        console.error("Failed to fetch products:", err);
        this.all = []; // Ensure data is empty on error
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
      window.showNotification('cart.item_added');
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

          const { finalPrice, percentOff } = window.calculateDiscount(product);

          return {
            ...product,
            quantity: item.quantity,
            img: product.image_url,
            price: product.price,
            finalPrice: finalPrice,
            percentOff: percentOff,
            subtotal: finalPrice * item.quantity,
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
      return this.$store.products.all.filter(p => p.discount_price || p.discount_percent > 0).slice(0, 4);
    },

    renderProductCard(item) {
      const { finalPrice, percentOff, originalPrice } = window.calculateDiscount(item);
      const isPromo = percentOff > 0;

      const ribbonHtml = isPromo ? `
        <div class="discount-ribbon"><span>${percentOff}% OFF</span></div>
      ` : '';

      const priceHtml = isPromo ? `
        <div class="price-container">
          <div class="price-original">${window.formatRupiah(originalPrice)}</div>
          <div class="price-discounted">${window.formatRupiah(finalPrice)}</div>
        </div>
      ` : `<div class="price">${window.formatRupiah(originalPrice)}</div>`;

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

    processedItems() {
      let items = this.$store.products.all;

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
      const urlParams = new URLSearchParams(window.location.search);
      this.searchTerm = urlParams.get('s') || '';

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
window.showNotification = (messageKey, isError = false) => {
  const message = Alpine.store('i18n').t(messageKey);
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
