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
  // The products component is now defined inline in index.html
  // to prevent race condition errors.
});
