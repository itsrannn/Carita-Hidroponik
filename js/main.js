// --- Mock News Data ---
// In a real application, this would likely be fetched from a CMS or database.
window.mockNewsData = [
  {
    id: 1,
    title: "5 Tips Jitu Memulai Hidroponik di Rumah",
    summary: "Hidroponik tidak sesulit yang dibayangkan. Dengan panduan ini, Anda bisa memulai kebun hidroponik mini di balkon atau halaman rumah Anda.",
    imageUrl: "img/News 1.jpg",
    link: "news detail.html?id=1",
    date: "2024-07-28",
  },
  {
    id: 2,
    title: "Mengenal Nutrisi A-B Mix: Kunci Sukses Tanaman Hidroponik",
    summary: "Apa itu nutrisi A-B Mix dan mengapa sangat penting? Pelajari cara meracik dan menggunakannya untuk hasil panen yang maksimal.",
    imageUrl: "img/News 2.jpg",
    link: "news detail.html?id=2",
    date: "2024-07-25",
  },
  {
    id: 3,
    title: "Perbandingan Media Tanam: Rockwool, Cocopeat, atau Hidroton?",
    summary: "Setiap media tanam memiliki kelebihan dan kekurangan. Kami bantu Anda memilih yang terbaik sesuai dengan jenis tanaman dan sistem Anda.",
    imageUrl: "img/News 3.jpg",
    link: "news detail.html?id=3",
    date: "2024-07-22",
  },
];


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

  // --- No products component here ---
  // Products component sudah didefinisikan inline di index.html
});
