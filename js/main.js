
document.addEventListener("DOMContentLoaded", function () {
  const loadComponent = (id, url) => {
    fetch(url)
      .then((response) => response.text())
      .then((html) => {
        document.getElementById(id).innerHTML = html;
        // Re-evaluate scripts in the loaded component
        const scripts = document
          .getElementById(id)
          .querySelectorAll("script");
        scripts.forEach((script) => {
          const newScript = document.createElement("script");
          newScript.textContent = script.textContent;
          document.body.appendChild(newScript).remove();
        });
         // After all components are loaded and scripts are evaluated
        feather.replace();
      })
      .catch((error) =>
        console.error(`Failed to load component ${url}:`, error)
      );
  };

  loadComponent("header-include", "components/header.html");
  loadComponent("footer-include", "components/footer.html");

  // Force re-initialization of the cart from localStorage when a page is shown from bfcache
  window.addEventListener('pageshow', (event) => {
    if (event.persisted && window.Alpine && Alpine.store('cart')) {
      Alpine.store('cart').init();
    }
  });
});


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
  Alpine.store('i18n', {
    lang: localStorage.getItem('language') || 'id',
    ready: false,
    supportedLangs: {
        'en': 'English',
        'id': 'Bahasa Indonesia'
    },
    translations: {},

    async init() {
        // This function is now idempotent
        if (this.ready) return;

        await this.load();
        document.documentElement.lang = this.lang;

        // This is the gate. Only set to true after everything is loaded.
        this.ready = true;
    },

    async load() {
        try {
            const response = await fetch(`locales/${this.lang}.json?v=${new Date().getTime()}`);
            if (!response.ok) throw new Error('Translations file not found');
            this.translations = await response.json();
        } catch (error) {
            console.error(`Failed to load translations for ${this.lang}:`, error);
            this.translations = {};
        }
    },

    setLang(newLang) {
        if (!this.supportedLangs.hasOwnProperty(newLang)) {
            console.warn(`Unsupported language: ${newLang}`);
            return;
        }
        this.lang = newLang;
        localStorage.setItem('language', newLang);
        document.documentElement.lang = this.lang;
        this.load(); // Reload translations for the new language
    },

    t(key, fallback = null) {
        // Traverses nested object keys, e.g., 'header.title'
        const value = key.split('.').reduce((acc, cur) => acc && acc[cur], this.translations);
        // Return the found value, a fallback, or the key itself for debugging
        return value !== undefined && value !== null ? value : (fallback !== null ? fallback : key);
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

  Alpine.store('news', {
    relatedProducts: [],
    // Future properties for news can be added here
  });

  Alpine.store("cart", {
    items: [],
    init() {
      this.items = JSON.parse(localStorage.getItem("cart")) || [];
    },
    add(productId) {
      const existing = this.items.find(item => String(item.id) === String(productId));
      if (existing) {
        existing.quantity++;
      } else {
        this.items.push({ id: productId, quantity: 1 });
      }
      this.save();
      window.showNotification('Item added to cart');
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
      localStorage.setItem("cart", JSON.stringify(this.items));
    },
    get details() {
      return this.items
        .map(item => {
          const product = Alpine.store("products").getProductById(item.id);
          if (!product) return null;

          const { finalPrice, percentOff } = window.calculateDiscount(product);
          const lang = Alpine.store('i18n').lang;
          const safeName = (product.name && product.name[lang]) ? product.name[lang] : ((product.name && product.name['id']) ? product.name['id'] : "Unnamed Product");

          return {
            ...product,
            name: safeName,
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
    sortOption: 'price-asc',
    currentPage: 1,
    itemsPerPage: 12,

    toggleSort() {
      this.sortOption = this.sortOption === 'price-asc' ? 'price-desc' : 'price-asc';
    },

    promoItems() {
      return this.$store.products.all.filter(p => p.discount_price || p.discount_percent > 0).slice(0, 4);
    },

    renderProductCard(item) {
      const { finalPrice, percentOff, originalPrice } = window.calculateDiscount(item);
      const isPromo = percentOff > 0;
      const lang = this.$store.i18n.lang;
      const itemName = (item.name && item.name[lang]) ? item.name[lang] : ((item.name && item.name['id']) ? item.name['id'] : 'Unnamed Product');


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
        <a href="product-details.html?id=${item.id}" class="product-link">
          <article class="product-card">
            ${ribbonHtml}
            <figure class="product-media">
              <img src="${item.image_url ? item.image_url : 'img/coming soon.jpg'}" alt="${itemName}" />
            </figure>
            <div class="product-body">
              <h3 class="product-title">${itemName}</h3>
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
      const lang = this.$store.i18n.lang;

      if (this.searchTerm.trim()) {
        const query = this.searchTerm.toLowerCase();
        items = items.filter(item => {
            const name = (item.name && item.name[lang]) ? item.name[lang] : ((item.name && item.name['id']) ? item.name['id'] : '');
            const description = (item.description && item.description[lang]) ? item.description[lang] : ((item.description && item.description['id']) ? item.description['id'] : '');
            const nameMatch = name.toLowerCase().includes(query);
            const descriptionMatch = description.toLowerCase().includes(query);
            return nameMatch || descriptionMatch;
        });
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
        const lang = this.$store.i18n.lang;

        return this.products.filter(p => {
            const productName = (p.name && p.name[lang]) ? p.name[lang].toLowerCase() : ((p.name && p.name['id']) ? p.name['id'].toLowerCase() : '');
            return productName.includes(q) || p.category.toLowerCase().includes(q);
        });
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

  Alpine.data('productDetail', () => ({
        product: null,
        relatedProducts: [],
        relatedLoading: true,
        priceInfo: { percentOff: 0, originalPrice: 0, discountedPrice: 0 },
        ready: false, // Add a ready flag
        init() {
            const urlParams = new URLSearchParams(window.location.search);
            const productId = urlParams.get('id');

            Alpine.effect(() => {
                const isLoading = this.$store.products.isLoading;
                const lang = this.$store.i18n.lang; // React to language changes

                if (!isLoading) {
                    this.product = this.$store.products.getProductById(productId);
                    if (this.product) {
                        this.priceInfo = calculateDiscount(this.product);
                        const productName = (this.product.name && this.product.name[lang]) ? this.product.name[lang] : ((this.product.name && this.product.name['id']) ? this.product.name['id'] : '');
                        document.title = "Carita Hidroponik | " + productName;
                        this.fetchRelatedProducts();
                    }
                    this.ready = true;
                }
            });
        },
        fetchRelatedProducts() {
            if (!this.product) return;
            this.relatedLoading = true;
            this.relatedProducts = this.$store.products.all.filter(p =>
                p.category === this.product.category && String(p.id) !== String(this.product.id)
            );
            this.relatedLoading = false;
            this.$nextTick(() => this.initSwiper());
        },
        initSwiper() {
            if (this.relatedProducts.length === 0) return;
            new Swiper(".related-product-slider", {
                loop: this.relatedProducts.length > 4, // Loop only if there are enough items
                spaceBetween: 15,
                navigation: {
                    nextEl: ".swiper-button-next",
                    prevEl: ".swiper-button-prev",
                },
                pagination: {
                    el: ".swiper-pagination",
                    clickable: true,
                },
                breakpoints: {
                    320: { slidesPerView: 2, spaceBetween: 10 },
                    768: { slidesPerView: 5, spaceBetween: 20 },
                },
            });
            this.$nextTick(() => feather.replace());
        },
        // Getter to safely access translated name
        get productName() {
            if (!this.product) return '';
            const lang = this.$store.i18n.lang;
            return (this.product.name && this.product.name[lang]) ? this.product.name[lang] : ((this.product.name && this.product.name['id']) ? this.product.name['id'] : '');
        },
        // Getter to safely access translated description
        get productDescription() {
            if (!this.product) return '';
            const lang = this.$store.i18n.lang;
            return (this.product.description && this.product.description[lang]) ? this.product.description[lang] : ((this.product.description && this.product.description['id']) ? this.product.description['id'] : '');
        },
        // Getter for characteristics with the same pattern
        get productCharacteristics() {
            if (!this.product) return '';
            const lang = this.$store.i18n.lang;
            return (this.product.char && this.product.char[lang]) ? this.product.char[lang] : ((this.product.char && this.product.char['id']) ? this.product.char['id'] : '');
        }
    }));

    // --- Global Initialization ---
    // Initialize stores on startup. Components will react to their state changes.
    Alpine.store('i18n').init();
    Alpine.store('products').init();
    Alpine.store('cart').init();

    // Signal that Alpine is ready
    document.documentElement.setAttribute('data-alpine-ready', 'true');

  function checkoutPage() {
      return {
        isProfileModalOpen: false,
        isLoginModalOpen: false,
        isConfirmModalOpen: false,
        userProfile: null,

        async handleCheckout() {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            this.isLoginModalOpen = true;
            return;
          }

          const { complete, profile } = await this.isProfileComplete();
          if (!complete) {
            this.isProfileModalOpen = true;
            return;
          }
          this.userProfile = profile;
          this.isConfirmModalOpen = true;
        },

        async confirmAndProcessCheckout() {
          if (this.userProfile) {
            await this.processCheckout(this.userProfile);
          } else {
            // Re-validate just in case
            const { complete, profile } = await this.isProfileComplete();
            if (complete) {
              await this.processCheckout(profile);
            } else {
              this.isConfirmModalOpen = false;
              this.isProfileModalOpen = true;
            }
          }
        },

        async isProfileComplete() {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return { complete: false, profile: null };

          const { data, error } = await supabase
            .from('profiles')
            .select('full_name, phone_number, address, postal_code, province, regency, district, village, latitude, longitude')
            .eq('id', session.user.id)
            .single();

          if (error) return { complete: false, profile: null };

          const requiredFields = ['full_name', 'phone_number', 'address', 'postal_code', 'province', 'regency', 'district', 'village'];
          for (const f of requiredFields) {
            if (!data[f] || String(data[f]).trim() === '') return { complete: false, profile: data };
          }
          if (data.latitude == null || data.longitude == null || (data.latitude === 0 && data.longitude === 0)) {
            return { complete: false, profile: data };
          }
          return { complete: true, profile: data };
        },

        async processCheckout(profile) {
          if (this.$store.cart.items.length === 0) {
            window.showNotification('Your shopping cart is empty.', true);
            return;
          }

          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            window.showNotification('Session not found. Please log in again.', true);
            return;
          }

          const orderCode = this.generateOrderCode();
          const orderDetails = this.$store.cart.details.map(item => ({
            product_id: item.id, name: item.name, quantity: item.quantity, price: item.price, subtotal: item.subtotal
          }));

          const { error } = await supabase.from('orders').insert({
            user_id: user.id,
            order_code: orderCode,
            order_details: orderDetails,
            shipping_address: { ...profile },
            total_amount: this.$store.cart.total,
            status: 'Menunggu Konfirmasi'
          });

          if (error) {
            window.showNotification(`An error occurred: ${error.message}`, true);
            return;
          }

          this.$store.cart.clear(); // Use the store's method
          window.showNotification(`Your order with code ${orderCode} has been placed successfully!`);

          setTimeout(() => {
            if (typeof showOrderHistorySection === 'function') {
              showOrderHistorySection();
            }
          }, 1500);
        },

        generateOrderCode() {
          const date = new Date();
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, '0');
          const d = String(date.getDate()).padStart(2, '0');
          const random = Math.random().toString(36).substring(2, 6).toUpperCase();
          return `CH-${y}${m}${d}-${random}`;
        }
      }
    }

    Alpine.data('checkoutPage', checkoutPage);

    const initialProfileState = {
        full_name: '',
        phone_number: '',
        address: '',
        postal_code: '',
        province: '',
        regency: '',
        district: '',
        village: '',
        latitude: null,
        longitude: null,
    };

    Alpine.data('accountPage', () => ({
        // --- Core View State ---
        activeView: 'profile', // 'profile' or 'orderHistory'

        // --- User and Profile Data ---
        user: null,
        profile: { ...initialProfileState },
        loading: false,

        // --- Order History Data ---
        orders: [],
        isOrderLoading: true,
        orderSubscription: null,

        // --- UI State ---
        editProfileMode: false,
        editAddressMode: false,

        // --- Map State ---
        map: null,
        marker: null,

        // --- Regional Data ---
        provinces: [],
        regencies: [],
        districts: [],
        villages: [],
        selectedProvince: '',
        selectedRegency: '',
        selectedDistrict: '',
        selectedVillage: '',

        resetState() {
            this.user = null;
            this.profile = { ...initialProfileState };
            this.orders = [];
            this.activeView = 'profile';
            this.editProfileMode = false;
            this.editAddressMode = false;
            if (this.orderSubscription) {
                supabase.removeChannel(this.orderSubscription);
                this.orderSubscription = null;
            }
        },

        // --- Initialization ---
        async init() {
            const { data: { session } } = await window.supabase.auth.getSession();
            if (!session) {
                window.location.replace("login-page.html");
                return;
            }
            this.user = session.user;

            // Setup real-time auth listener
            supabase.auth.onAuthStateChange((event, session) => {
                if (event === 'SIGNED_OUT') {
                    this.resetState();
                    window.location.replace('login-page.html');
                } else if (event === 'SIGNED_IN') {
                    // Potentially handle user change if needed in the future
                    this.user = session.user;
                }
            });

            // Fetch all necessary data
            await this.fetchProvinces();
            await this.getProfile();
            await this.fetchOrders();

            this.$watch('editAddressMode', (value) => {
                if (value) {
                    this.$nextTick(() => {
                        this.initMap();
                    });
                }
            });
        },

        // --- View and URL Management ---

        // --- Map Functionality ---
        initMap() {
            const defaultLat = -2.5489;
            const defaultLng = 118.0149;

            const lat = this.profile.latitude || defaultLat;
            const lng = this.profile.longitude || defaultLng;

            if (this.map) {
                this.map.remove();
            }

            this.map = L.map('map').setView([lat, lng], 13);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(this.map);

            this.marker = L.marker([lat, lng], {
                draggable: true
            }).addTo(this.map);

            this.marker.on('dragend', (event) => {
                const position = this.marker.getLatLng();
                this.profile.latitude = position.lat;
                this.profile.longitude = position.lng;
            });

            this.map.on('click', (event) => {
                const position = event.latlng;
                this.marker.setLatLng(position);
                this.profile.latitude = position.lat;
                this.profile.longitude = position.lng;
            });
        },

        // --- Regional Data Fetching ---
        async fetchProvinces() {
            try {
                const response = await fetch('https://www.emsifa.com/api-wilayah-indonesia/api/provinces.json');
                this.provinces = await response.json();
            } catch (error) {
                console.error("Failed to load provinces:", error);
            }
        },

        async fetchRegencies() {
            if (!this.selectedProvince) {
                this.regencies = [];
                this.districts = [];
                this.villages = [];
                return;
            }
            try {
                const response = await fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/regencies/${this.selectedProvince}.json`);
                this.regencies = await response.json();
                this.districts = [];
                this.villages = [];
            } catch (error) {
                console.error("Failed to load regencies:", error);
            }
        },

        async fetchDistricts() {
            if (!this.selectedRegency) {
                this.districts = [];
                this.villages = [];
                return;
            }
            try {
                const response = await fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/districts/${this.selectedRegency}.json`);
                this.districts = await response.json();
                this.villages = [];
            } catch (error) {
                console.error("Failed to load districts:", error);
            }
        },

        async fetchVillages() {
            if (!this.selectedDistrict) {
                this.villages = [];
                return;
            }
            try {
                const response = await fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/villages/${this.selectedDistrict}.json`);
                this.villages = await response.json();
            } catch (error) {
                console.error("Failed to load villages:", error);
            }
        },

        updateProfileVillage() {
            // Placeholder for future logic
        },

        // --- Order History Functionality ---
        async fetchOrders() {
            this.isOrderLoading = true;
            try {
                const { data, error } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('user_id', this.user.id)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                this.orders = data;
                this.subscribeToOrderChanges();
            } catch (error) {
                window.showNotification('Failed to load order history.', true);
            } finally {
                this.isOrderLoading = false;
            }
        },

        subscribeToOrderChanges() {
            // Unsubscribe from any existing channel to prevent duplicates
            if (this.orderSubscription) {
                supabase.removeChannel(this.orderSubscription);
            }

            this.orderSubscription = supabase
                .channel(`public:orders:user_id=eq.${this.user.id}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'orders',
                    filter: `user_id=eq.${this.user.id}`
                },
                (payload) => {
                    // Refetch all orders to ensure data consistency
                    this.fetchOrders();
                }
            ).subscribe();
        },

        getStatusClass(status) {
            if (!status) return 'status-default';
            return `status-${status.toLowerCase().replace(/\s+/g, '-')}`;
        },

        // --- Profile and Address Management ---
        async getProfile() {
            this.loading = true;
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select(`full_name, phone_number, address, postal_code, province, regency, district, village, latitude, longitude`)
                    .eq('id', this.user.id)
                    .single();

                if (error && error.code !== 'PGRST116') {
                    // PGRST116 means no rows found, which is a valid case for a new user.
                    // We only throw if it's a different, unexpected error.
                    throw error;
                }

                if (data) {
                    this.profile = { ...this.profile, ...data };

                    // --- Start of Sequential Address Hydration ---
                    if (this.profile.province && this.provinces.length > 0) {
                        const province = this.provinces.find(p => p.name === this.profile.province);
                        if (!province) return;

                        this.selectedProvince = province.id;
                        await this.fetchRegencies();
                        await this.$nextTick(); // Wait for DOM update

                        if (this.profile.regency && this.regencies.length > 0) {
                            const regency = this.regencies.find(r => r.name === this.profile.regency);
                            if (!regency) return;

                            this.selectedRegency = regency.id;
                            await this.fetchDistricts();
                            await this.$nextTick(); // Wait for DOM update

                            if (this.profile.district && this.districts.length > 0) {
                                const district = this.districts.find(d => d.name === this.profile.district);
                                if (!district) return;

                                this.selectedDistrict = district.id;
                                await this.fetchVillages();
                                await this.$nextTick(); // Wait for DOM update

                                if (this.profile.village && this.villages.length > 0) {
                                    const village = this.villages.find(v => v.name === this.profile.village);
                                    if (village) {
                                        this.selectedVillage = village.id;
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                window.showNotification('Failed to load profile: ' + error.message, true);
            } finally {
                this.loading = false;
            }
        },

        async updateProfile() {
            this.loading = true;
            try {
                const { data, error } = await supabase.from('profiles').update({
                    full_name: this.profile.full_name,
                    phone_number: this.profile.phone_number,
                    updated_at: new Date()
                }).eq('id', this.user.id).select().single();

                if (error) throw error;

                if (data) {
                    this.profile = { ...this.profile, ...data };
                    window.showNotification('Profile updated successfully!');
                    this.editProfileMode = false;
                }
            } catch (error) {
                window.showNotification('Error updating profile: ' + error.message, true);
            } finally {
                this.loading = false;
            }
        },

        async updateAddress() {
            this.loading = true;

            const provinceName = this.provinces.find(p => p.id === this.selectedProvince)?.name || '';
            const regencyName = this.regencies.find(r => r.id === this.selectedRegency)?.name || '';
            const districtName = this.districts.find(d => d.id === this.selectedDistrict)?.name || '';
            const villageName = this.villages.find(v => v.id === this.selectedVillage)?.name || '';

            try {
                const { data, error } = await supabase.from('profiles').update({
                    address: this.profile.address,
                    postal_code: this.profile.postal_code,
                    province: provinceName,
                    regency: regencyName,
                    district: districtName,
                    village: villageName,
                    latitude: this.profile.latitude,
                    longitude: this.profile.longitude,
                    updated_at: new Date()
                }).eq('id', this.user.id).select().single();

                if (error) throw error;

                if (data) {
                    this.profile = { ...this.profile, ...data };
                    window.showNotification('Address updated successfully!');
                    this.editAddressMode = false;
                }
            } catch (error) {
                window.showNotification('Error updating address: ' + error.message, true);
            } finally {
                this.loading = false;
            }
        },

        async handleLogout() {
            this.loading = true;
            await window.supabase.auth.signOut();
            this.resetState();
            window.location.replace('login-page.html');
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
