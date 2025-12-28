document.addEventListener('alpine:init', () => {
  Alpine.data('productSearch', () => ({
    searchTerm: '',
    filteredProducts: [],
    isLoading: true,
    currentPage: 1,
    itemsPerPage: 12,

    init() {
      const urlParams = new URLSearchParams(window.location.search);
      this.searchTerm = urlParams.get('s') || '';

      this.$watch('$store.products.all', () => {
        this.filterProducts();
      });

      if (this.$store.products.all.length > 0) {
        this.filterProducts();
      }
    },

    filterProducts() {
      this.isLoading = true;
      if (this.searchTerm) {
        this.filteredProducts = this.$store.products.all.filter(product =>
          product.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
          (product.description && product.description.toLowerCase().includes(this.searchTerm.toLowerCase()))
        );
      } else {
        this.filteredProducts = [...this.$store.products.all];
      }
      this.currentPage = 1;
      this.isLoading = false;
    },

    paginatedItems() {
      const start = (this.currentPage - 1) * this.itemsPerPage;
      const end = start + this.itemsPerPage;
      return this.filteredProducts.slice(start, end);
    },

    totalPages() {
      return Math.ceil(this.filteredProducts.length / this.itemsPerPage);
    },

    goToPage(page) {
      if (page >= 1 && page <= this.totalPages()) {
        this.currentPage = page;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
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
    }
  }));
});
