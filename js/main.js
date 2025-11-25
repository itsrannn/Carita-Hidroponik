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
    items: [], // e.g., [{ id: 1, quantity: 1 }]
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
      return this.items.map(item => {
        const product = Alpine.store("products").getProductById(item.id);
        return {
          ...product,
          quantity: item.quantity,
          subtotal: (product ? product.price : 0) * item.quantity,
        };
      });
    },
    get total() {
      return this.details.reduce((total, item) => total + item.subtotal, 0);
    },
    get quantity() {
        return this.items.reduce((total, item) => total + item.quantity, 0);
    }
  });

  // --- Reusable Components ---
  Alpine.data("products", () => ({
    searchTerm: "",
    currentPage: 1,
    itemsPerPage: 8,
    selectedCategory: "all",
    sortOption: "default",
    init() {
      this.$watch("currentPage", () => {
        this.$nextTick(() => feather.replace());
      });
    },
    formatRupiah(value) {
      if (!value) return "Rp 0";
      return "Rp " + value.toLocaleString("id-ID");
    },
    get items() {
      return Alpine.store("products").all;
    },
    get isLoading() {
      return Alpine.store("products").isLoading;
    },
    processedItems() {
      let processed = [...this.items];
      if (this.selectedCategory !== "all") {
        processed = processed.filter(
          (item) => item.category === this.selectedCategory
        );
      }
      if (this.searchTerm.trim() !== "") {
        processed = processed.filter((item) =>
          item.name.toLowerCase().includes(this.searchTerm.toLowerCase())
        );
      }
      if (this.sortOption === "price-asc") {
        processed.sort((a, b) => a.price - b.price);
      } else if (this.sortOption === "price-desc") {
        processed.sort((a, b) => b.price - a.price);
      }
      return processed;
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
      if (page >= 1 && page <= this.totalPages()) {
        this.currentPage = page;
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
  }));
});
