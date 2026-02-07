Alpine.data('productDetail', () => ({
  // Data
  product: null,
  productName: '',
  productDescription: '',
  productCharacteristicsList: '',
  priceInfo: {},
  mainImage: '',
  productImages: [],
  quantity: 1,
  relatedProducts: [],
  relatedLoading: true,
  ready: false,
  colorOptions: [],
  selectedColor: '',

  // Methods
  init() {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    Alpine.effect(() => {
        const isLoading = this.$store.products.isLoading;
        if (!isLoading) {
            this.product = this.$store.products.getProductById(productId);
            if (this.product) {
                this.setupProductData();
                this.fetchRelatedProducts();
            }
            this.$nextTick(() => this.initSliders());
        }
    });
  },

  setupProductData() {
    const lang = this.$store.i18n.lang;
    this.productName = this.getLocalizedValue(this.product.name, lang, 'Produk tanpa nama');
    this.productDescription = this.getLocalizedValue(this.product.description, lang, '');

    // Process characteristics: split by newline and wrap in <li>
    const characteristics = this.getLocalizedValue(this.product.characteristics, lang, '');
    this.productCharacteristicsList = characteristics
      .replace(/<br\s*\/?>/gi, '\n')
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => `<li>✔ ${line.replace(/^-+/, '').trim()}</li>`)
      .join('');

    this.priceInfo = this.calculateDiscount(this.product);
    this.productImages = this.getProductImages(this.product);
    this.mainImage = this.productImages[0] || 'img/coming soon.jpg';
    this.colorOptions = this.getColorOptions(this.product);
    this.selectedColor = this.colorOptions[0]?.name || '';
    this.ready = true;
  },

  async fetchRelatedProducts() {
    this.relatedLoading = true;
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .neq('id', this.product.id) // Exclude the current product
      .limit(5);

    if (error) {
      console.error('Error fetching related products:', error);
      this.relatedProducts = [];
    } else {
      this.relatedProducts = data;
    }
    this.relatedLoading = false;
  },

  initSliders() {
    // Ensure Swiper instances are destroyed before re-initializing
    if (this.thumbnailSwiper) this.thumbnailSwiper.destroy();
    if (this.relatedSwiper) this.relatedSwiper.destroy();

    if (this.productImages.length > 1) {
      this.thumbnailSwiper = new Swiper('.product-thumbnail-slider', {
        spaceBetween: 10,
        slidesPerView: 4,
        freeMode: true,
        watchSlidesProgress: true,
        navigation: {
          nextEl: '.swiper-button-next',
          prevEl: '.swiper-button-prev',
        },
      });
    }

    this.relatedSwiper = new Swiper('.related-product-slider', {
      loop: true,
      slidesPerView: 2,
      spaceBetween: 15,
      pagination: {
        el: '.swiper-pagination',
        clickable: true,
      },
      navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
      },
      breakpoints: {
        640: { slidesPerView: 3, spaceBetween: 20 },
        768: { slidesPerView: 4, spaceBetween: 25 },
        1024: { slidesPerView: 5, spaceBetween: 30 },
      },
    });
  },

  // UI Interaction Methods
  selectColor(color) {
    if (!color) return;
    this.selectedColor = color.name;
    if (color.image) {
      this.mainImage = color.image;
    }
  },

  selectThumbnail(image) {
    this.mainImage = image;
  },

  increaseQuantity() {
    this.quantity++;
  },

  decreaseQuantity() {
    if (this.quantity > 1) {
      this.quantity--;
    }
  },

  addToCart() {
    if (this.product) {
      this.$store.cart.add(this.product.id, this.quantity);
      // Optional: Show a confirmation toast/message
    }
  },

  // Utility Methods (assuming they might not be globally available on this page)
  formatRupiah(number) {
    if (window.formatRupiah) {
      return window.formatRupiah(number);
    }
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(number);
  },

  calculateDiscount(product) {
    if (window.calculateDiscount) {
      return window.calculateDiscount(product);
    }
    const originalPrice = product.price || 0;
    return { originalPrice, finalPrice: originalPrice, percentOff: 0 };
  },

  getLocalizedValue(field, lang, fallback = '') {
    if (!field) return fallback;
    if (typeof field === 'string') return field;
    return field[lang] || field.id || fallback;
  },

  getProductImages(product) {
    const images = [];
    if (product.image_url) {
      images.push(product.image_url);
    }
    if (Array.isArray(product.images)) {
      images.push(...product.images.filter(Boolean));
    }
    if (typeof product.gallery === 'string') {
      images.push(
        ...product.gallery
          .split(',')
          .map(item => item.trim())
          .filter(Boolean)
      );
    }
    return [...new Set(images)];
  },

  getColorOptions(product) {
    if (Array.isArray(product.colors)) {
      return product.colors.filter(option => option && option.name);
    }
    if (Array.isArray(product.variants)) {
      return product.variants
        .filter(variant => variant && variant.name)
        .map(variant => ({
          name: variant.name,
          value: variant.color || variant.value,
          image: variant.image
        }));
    }
    return [];
  }
}));
