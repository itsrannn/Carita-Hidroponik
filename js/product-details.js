Alpine.data('productDetail', () => ({
  // Data
  product: null,
  productName: '',
  productDescription: '',
  productCharacteristicsList: '',
  priceInfo: {},
  mainImage: '',
  quantity: 1,
  relatedProducts: [],
  relatedLoading: true,
  ready: false,
  showAddedToCartPopup: false,
  // Mock Data for UI development
  mockColors: [
    { name: 'Red', value: '#E53935', image: 'img/products/cabai-merah-keriting.jpg' },
    { name: 'Green', value: '#43A047', image: 'img/products/caisim.jpg' },
    { name: 'Blue', value: '#1E88E5', image: 'img/products/selada-hidroponik.jpg' }
  ],
  selectedColor: 'Red',
  mockImages: [
    'img/products/cabai-merah-keriting.jpg',
    'img/products/caisim.jpg',
    'img/products/selada-hidroponik.jpg',
    'img/products/kangkung-hidroponik.jpg',
  ],

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
    this.productName = (this.product.name && this.product.name[lang]) || (this.product.name && this.product.name.id) || 'No name';
    this.productDescription = (this.product.description && this.product.description[lang]) || (this.product.description && this.product.description.id) || '';

    // Process characteristics: split by newline and wrap in <li>
    const characteristics = (this.product.characteristics && this.product.characteristics[lang]) || (this.product.characteristics && this.product.characteristics.id) || '';
    this.productCharacteristicsList = characteristics
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => `<li>✔ ${line.trim()}</li>`)
      .join('');

    this.priceInfo = this.calculateDiscount(this.product);
    this.mainImage = this.product.image_url || 'img/coming-soon.jpg';
    // Sync mock images with product image
    this.mockImages.unshift(this.mainImage);
    this.mockImages = [...new Set(this.mockImages)]; // Remove duplicates
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
    this.selectedColor = color.name;
    this.mainImage = color.image; // Change main image based on color
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
      this.$store.cart.add(this.product.id, 1); // Always add 1 item
      this.showAddedToCartPopup = true;
    }
  },

  buyNow() {
    if (this.product) {
      this.$store.cart.add(this.product.id, this.quantity);
      window.location.href = 'my cart.html';
    }
  },

  // Utility Methods (assuming they might not be globally available on this page)
  formatRupiah(number) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(number);
  },

  calculateDiscount(product) {
    const originalPrice = product.price || 0;
    let finalPrice = originalPrice;
    let percentOff = 0;

    if (product.discount_type === 'percent' && product.discount_value > 0) {
      percentOff = product.discount_value;
      finalPrice = originalPrice - (originalPrice * percentOff / 100);
    } else if (product.discount_type === 'fixed' && product.discount_value > 0) {
      finalPrice = product.discount_value;
      percentOff = Math.round(((originalPrice - finalPrice) / originalPrice) * 100);
    }

    return { originalPrice, finalPrice, percentOff };
  }
}));
