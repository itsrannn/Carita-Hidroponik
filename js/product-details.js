document.addEventListener('alpine:init', () => {
  Alpine.data('productDetail', () => ({
    // Data
    product: null,
    productName: '',
    productDescription: '',
    productSpecsList: '',
    priceInfo: {},
    mainImage: '',
    productImages: [],
    quantity: 1,
    relatedProducts: [],
    relatedLoading: true,
    crossSellProducts: [],
    crossSellLoading: true,
    ready: false,
    variantOptions: [],
    selectedVariant: null,
    activeTab: 'detail',

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
                this.refreshProductSuggestions();
            }
            this.$nextTick(() => this.initSliders());
        }
    });
  },

  setupProductData() {
    const lang = this.$store.i18n.lang;
    this.productName = this.getLocalizedValue(this.product.name, lang, 'Produk tanpa nama');
    this.productDescription = this.getLocalizedValue(this.product.description, lang, '');

    // Process specifications: split by newline and wrap in <li>
    const specs = this.getLocalizedValue(this.product.char, lang, '');
    this.productSpecsList = specs
      .replace(/<br\s*\/?>/gi, '\n')
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => `<li>✔ ${line.replace(/^-+/, '').trim()}</li>`)
      .join('');

    this.priceInfo = this.calculateDiscount(this.product);
    this.productImages = this.getProductImages(this.product);
    this.mainImage = this.productImages[0] || 'img/coming soon.jpg';
    this.variantOptions = this.getVariantOptions(this.product);
    this.selectedVariant = null;
    this.ready = true;
  },

  refreshProductSuggestions() {
    const allProducts = this.$store.products.all || [];
    const category = this.product ? this.product.category : null;
    const excludeId = this.product ? this.product.id : null;

    this.relatedLoading = true;
    this.crossSellLoading = true;

    this.relatedProducts = this.filterByCategory(allProducts, category, excludeId, 'include');
    this.crossSellProducts = this.filterByCategory(allProducts, category, excludeId, 'exclude');

    this.relatedLoading = false;
    this.crossSellLoading = false;
    this.$nextTick(() => {
      if (window.feather) {
        feather.replace();
      }
    });
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

    if (document.querySelector('.related-product-slider')) {
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
    }
  },

  // UI Interaction Methods
  selectVariant(variant) {
    if (!variant) return;
    this.selectedVariant = variant;
    if (variant.image) {
      this.mainImage = variant.image;
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

  ensureVariantSelected() {
    if (this.variantOptions.length > 0 && !this.selectedVariant) {
      return false;
    }
    return true;
  },

  addToCart() {
    if (this.product && this.ensureVariantSelected()) {
      this.$store.cart.add(this.product.id, this.quantity, this.selectedVariant);
      // Optional: Show a confirmation toast/message
    }
  },

  buyNow() {
    if (this.product && this.ensureVariantSelected()) {
      this.$store.cart.add(this.product.id, this.quantity, this.selectedVariant);
      window.location.href = 'my-cart.html';
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

  filterByCategory(products, category, excludeId, mode = 'include') {
    if (!Array.isArray(products)) return [];
    return products.filter(product => {
      if (!product) return false;
      if (excludeId && product.id === excludeId) return false;
      if (!category) {
        return mode === 'exclude';
      }
      const isMatch = product.category === category;
      return mode === 'include' ? isMatch : !isMatch;
    });
  },

  renderProductCard(item) {
    const { finalPrice, percentOff, originalPrice } = this.calculateDiscount(item);
    const isPromo = percentOff > 0;
    const lang = this.$store.i18n.lang;
    const itemName = this.getLocalizedValue(item.name, lang, 'Unnamed Product');

    const ribbonHtml = isPromo ? `
      <div class="discount-ribbon"><span>${percentOff}% OFF</span></div>
    ` : '';

    const priceHtml = isPromo ? `
      <div class="price-container">
        <div class="price-original">${this.formatRupiah(originalPrice)}</div>
        <div class="price-discounted">${this.formatRupiah(finalPrice)}</div>
      </div>
    ` : `<div class="price">${this.formatRupiah(originalPrice)}</div>`;

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

    getVariantOptions(product) {
      if (!product) return [];
      if (Array.isArray(product.variants)) {
        return product.variants
          .map(variant => {
            const label = variant.label || variant.name || variant.value;
            const id = variant.id || (label ? String(label).toLowerCase().replace(/\s+/g, '-') : '');
            return {
              id,
              label,
              image: variant.image || null
            };
          })
          .filter(variant => variant.id && variant.label);
      }
      if (Array.isArray(product.colors)) {
        return product.colors
          .map(color => {
            const label = color.name || color.label;
            const id = color.id || (label ? String(label).toLowerCase().replace(/\s+/g, '-') : '');
            return {
              id,
              label,
              image: color.image || null
            };
          })
          .filter(variant => variant.id && variant.label);
      }
      return [];
    }
  }));
});
