document.addEventListener('alpine:init', () => {
  Alpine.data('productDetail', () => ({
    product: null,
    mainImage: '',
    quantity: 1,
    relatedProducts: [],
    relatedLoading: false,
    ready: false,
    activeTab: 'details',

    // For future expansion
    mockImages: [],
    mockColors: [],
    selectedColor: '',

    async init() {
      const urlParams = new URLSearchParams(window.location.search);
      const productId = urlParams.get('id');

      if (!productId) {
        this.ready = true;
        return;
      }

      try {
        const { data, error } = await window.supabase
          .from('products')
          .select('*')
          .eq('id', productId)
          .single();

        if (error) throw error;
        this.product = data;
        this.setupProductData();
        await this.fetchRelatedProducts();
      } catch (err) {
        console.error('Error fetching product:', err);
      } finally {
        this.ready = true;
        this.$nextTick(() => {
          this.initSliders();
        });
      }
    },

    setupProductData() {
      if (this.product) {
        this.mainImage = this.product.image_url || 'img/coming soon.jpg';
        this.mockImages = [this.mainImage];
      }
    },

    async fetchRelatedProducts() {
      if (!this.product) return;
      this.relatedLoading = true;
      try {
        // First try to find products in the same category
        let { data, error } = await window.supabase
          .from('products')
          .select('*')
          .eq('category', this.product.category)
          .neq('id', this.product.id)
          .limit(4);

        if (error) throw error;

        // Fallback: If no products in same category, fetch any other products
        if (!data || data.length === 0) {
            const { data: fallbackData, error: fallbackError } = await window.supabase
                .from('products')
                .select('*')
                .neq('id', this.product.id)
                .limit(4);

            if (fallbackError) throw fallbackError;
            data = fallbackData;
        }

        this.relatedProducts = data;
      } catch (err) {
        console.error('Error fetching related products:', err);
      } finally {
        this.relatedLoading = false;
        this.$nextTick(() => {
          this.initSliders();
        });
      }
    },

    initSliders() {
      // Related products slider
      new Swiper('.related-product-slider', {
        slidesPerView: 1,
        spaceBetween: 10,
        navigation: {
          nextEl: '.swiper-button-next',
          prevEl: '.swiper-button-prev',
        },
        pagination: {
          el: '.swiper-pagination',
          clickable: true,
        },
        breakpoints: {
          640: { slidesPerView: 2, spaceBetween: 20 },
          1024: { slidesPerView: 4, spaceBetween: 30 },
        }
      });

      // Thumbnail slider
      if (this.mockImages.length > 1) {
          new Swiper('.product-thumbnail-slider', {
              slidesPerView: 4,
              spaceBetween: 10,
              navigation: {
                  nextEl: '.swiper-button-next',
                  prevEl: '.swiper-button-prev',
              }
          });
      }

      if (window.feather) {
        window.feather.replace();
      }
    },

    selectThumbnail(image) {
      this.mainImage = image;
    },

    selectColor(color) {
        this.selectedColor = color.name;
        this.mainImage = color.image;
    },

    increaseQuantity() {
      this.quantity++;
    },

    decreaseQuantity() {
      if (this.quantity > 1) this.quantity--;
    },

    addToCart() {
      if (this.product) {
        this.$store.cart.add(this.product.id, this.quantity);
        // Notification is now handled globally in cart.add
      }
    },

    setTab(tab) {
      this.activeTab = tab;
    },

    get productName() {
      if (!this.product) return '';
      const lang = this.$store.i18n.lang;

      // Handle both JSON and string
      if (typeof this.product.name === 'object' && this.product.name !== null) {
          return this.product.name[lang] || this.product.name.id || '';
      }
      return this.product.name || '';
    },

    get productDescription() {
      if (!this.product) return '';
      const lang = this.$store.i18n.lang;

      // Handle both JSON and string
      if (typeof this.product.description === 'object' && this.product.description !== null) {
          return this.product.description[lang] || this.product.description.id || '';
      }
      return this.product.description || '';
    },

    get productCharacteristicsList() {
      if (!this.product || !this.product.characteristics) return '';
      const lang = this.$store.i18n.lang;

      let characteristics = '';
      // Handle both JSON and string
      if (typeof this.product.characteristics === 'object' && this.product.characteristics !== null) {
          characteristics = this.product.characteristics[lang] || this.product.characteristics.id || '';
      } else {
          characteristics = this.product.characteristics || '';
      }

      if (!characteristics) return '';

      return characteristics.split('\n').map(line => {
        return `<li>✔ ${line.trim()}</li>`;
      }).join('');
    },

    get priceInfo() {
      if (!this.product) return { originalPrice: 0, finalPrice: 0, percentOff: 0 };
      // Use global discount calculator
      return window.calculateDiscount(this.product);
    },

    formatRupiah(number) {
        return window.formatRupiah(number);
    },

    calculateDiscount(item) {
      // Use global discount calculator
      return window.calculateDiscount(item);
    }
  }));
});
