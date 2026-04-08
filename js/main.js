const API_BASE_URL = 'https://backend-carita-hidroponik.vercel.app';
const SNAP_TOKEN_ENDPOINT = `${API_BASE_URL}/api/payment/create-snap-token`;

const APP_BASE_PATH = (() => {
    const { hostname, pathname } = window.location;
    if (!hostname.endsWith('github.io')) return '';
    const [repoSegment] = pathname.split('/').filter(Boolean);
    return repoSegment ? `/${repoSegment}` : '';
})();

window.APP_BASE_PATH = APP_BASE_PATH;
window.toAppPath = (relativePath = '') => {
    const normalized = String(relativePath).replace(/^\/+/, '');
    return `${APP_BASE_PATH}/${normalized}`.replace(/\/{2,}/g, '/');
};
window.toAppUrl = (relativePath = '') => new URL(window.toAppPath(relativePath), window.location.origin).href;

// --- GLOBAL ERROR HANDLING ---
window.onerror = (message, source, lineno, colno, error) => {
    console.error('[GlobalError]', { message, source, line: lineno, column: colno, stack: error?.stack });
};

window.addEventListener('unhandledrejection', (event) => {
    console.error('[GlobalError] Unhandled promise rejection:', event.reason);
});

// --- FETCH ENGINE (FIXED FOR CORS) ---
window.fetchWithDebug = async (input, init = {}) => {
    const {
        timeoutMs = 15000,
        retries = 1,
        retryDelayMs = 1000,
        ...requestInit
    } = init || {};

    const attemptFetch = async (attempt = 0) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        // Pastikan Headers Terstandarisasi
        const headers = new Headers(requestInit.headers || {});
        if (!headers.has('Content-Type') && !(requestInit.body instanceof FormData)) {
            headers.set('Content-Type', 'application/json');
        }

        const mergedInit = {
            ...requestInit,
            headers,
            mode: 'cors', // Paksa mode CORS
            credentials: 'omit', // Paling aman untuk lintas domain GitHub -> Vercel
            signal: controller.signal
        };

        try {
            console.info(`[Fetch] START: ${requestInit.method || 'GET'} ${input}`);
            const response = await fetch(input, mergedInit);
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.clone().text();
                console.warn(`[Fetch] Error ${response.status}:`, errorText);
            }

            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (attempt < retries) {
                console.warn(`[Fetch] Retry attempt ${attempt + 1}...`);
                await new Promise(r => setTimeout(r, retryDelayMs));
                return attemptFetch(attempt + 1);
            }
            throw error;
        }
    };

    return attemptFetch(0);
};

// --- DOM READY ---
document.addEventListener("DOMContentLoaded", function () {
    const loadComponent = async (id, path) => {
        const mountNode = document.getElementById(id);
        if (!mountNode) return;

        try {
            const response = await window.fetchWithDebug(window.toAppUrl(path), { cache: 'no-store' });
            if (!response.ok) throw new Error('Failed to load component');
            const html = await response.text();
            mountNode.innerHTML = html;

            // Execute scripts in components
            mountNode.querySelectorAll("script").forEach(script => {
                const newScript = document.createElement("script");
                newScript.textContent = script.textContent;
                document.body.appendChild(newScript).remove();
            });

            if (window.feather) feather.replace();
        } catch (error) {
            console.error(`[Loader] Failed: ${path}`, error);
            mountNode.innerHTML = '<div style="text-align:center; padding:1rem;">Failed to load section.</div>';
        }
    };

    loadComponent("header-include", "/components/header.html");
    loadComponent("footer-include", "/components/footer.html");
});

// --- UTILITIES ---
window.formatRupiah = (num) => isNaN(num) ? "Rp 0" : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num);

window.fixImagePath = (path) => path ? String(path).replace(/ /g, '-') : 'img/coming-soon.jpg';

window.calculateDiscount = (product) => {
    const original = product.price || 0;
    let final = original;
    let percent = 0;

    if (product.discount_price > 0) {
        final = product.discount_price;
        percent = Math.floor(((original - final) / original) * 100);
    } else if (product.discount_percent > 0) {
        percent = product.discount_percent;
        final = original - (original * percent / 100);
    }
    return { finalPrice: Math.max(0, final), percentOff: percent, originalPrice: original };
};

// --- ALPINE STORES ---
document.addEventListener("alpine:init", () => {
    Alpine.store('i18n', {
        supportedLangs: { id: 'Bahasa Indonesia', en: 'English' },
        lang: 'id',
        ready: false,
        translations: {},
        async init() {
            const savedLang = localStorage.getItem('language') || localStorage.getItem('lang');
            this.lang = this.supportedLangs[savedLang] ? savedLang : 'id';
            await this.load();
            this.ready = true;
        },
        async load() {
            try {
                if (!this.supportedLangs[this.lang]) this.lang = 'id';
                const url = window.toAppUrl(`locales/${this.lang}.json?v=${Date.now()}`);
                const res = await window.fetchWithDebug(url);
                this.translations = await res.json();
                document.documentElement.lang = this.lang;
                localStorage.setItem('language', this.lang);
            } catch (e) { console.error("Lang load failed", e); }
        },
        t(key) {
            if (!key) return '';
            return key.split('.').reduce((acc, cur) => acc && acc[cur], this.translations) || key;
        }
    });

    Alpine.store("products", {
        all: [],
        isLoading: true,
        errorMessage: '',
        async init() {
            try {
                const { data, error } = await window.supabase.from("products").select("*").order("id", { ascending: true });
                if (error) throw error;
                this.all = data || [];
                this.errorMessage = '';
            } catch (e) {
                console.error("Fetch products failed", e);
                this.all = [];
                this.errorMessage = 'Products are temporarily unavailable.';
            }
            finally { this.isLoading = false; }
        },
        getProductById(id) { return this.all.find(p => String(p.id) === String(id)); }
    });

    Alpine.store("account", {
        user: null,
        profile: {},
        orders: [],
        isLoading: false,
        isOrderLoading: false,
        async init() {
            if (!window.supabase) return;
            this.isLoading = true;
            try {
                const { data: { session } } = await window.supabase.auth.getSession();
                this.user = session?.user || null;
                if (!this.user?.id) return;
                await Promise.all([this.fetchProfile(), this.fetchOrders()]);
            } catch (error) {
                console.error('[Account] init failed:', error);
            } finally {
                this.isLoading = false;
            }
        },
        async fetchProfile() {
            if (!this.user?.id) return;
            const { data, error } = await window.supabase
                .from('profiles')
                .select('*')
                .eq('id', this.user.id)
                .maybeSingle();
            if (error) {
                console.error('[Account] profile fetch failed:', error);
                this.profile = {};
                return;
            }
            this.profile = data || {};
        },
        async fetchOrders() {
            if (!this.user?.id) return;
            this.isOrderLoading = true;
            try {
                const { data, error } = await window.supabase
                    .from('orders')
                    .select('*')
                    .eq('user_id', this.user.id)
                    .order('created_at', { ascending: false });
                if (error) throw error;
                this.orders = data || [];
            } catch (error) {
                console.error('[Account] orders fetch failed:', error);
                this.orders = [];
            } finally {
                this.isOrderLoading = false;
            }
        }
    });

    Alpine.store("cart", {
        items: JSON.parse(localStorage.getItem("cart")) || [],
        init() { this.save(); },
        add(productId, qty = 1) {
            const existing = this.items.find(i => String(i.productId) === String(productId));
            if (existing) existing.quantity += qty;
            else this.items.push({ productId, quantity: qty });
            this.save();
        },
        remove(productId, force = false) {
            const idx = this.items.findIndex(i => String(i.productId) === String(productId));
            if (idx > -1) {
                if (force || this.items[idx].quantity <= 1) this.items.splice(idx, 1);
                else this.items[idx].quantity--;
            }
            this.save();
        },
        save() { localStorage.setItem("cart", JSON.stringify(this.items)); },
        get details() {
            return this.items.map(item => {
                const p = Alpine.store("products").getProductById(item.productId);
                if (!p) return null;
                const disc = window.calculateDiscount(p);
                return { ...p, ...disc, quantity: item.quantity, subtotal: disc.finalPrice * item.quantity, totalWeight: (p.weight || 0) * item.quantity };
            }).filter(Boolean);
        },
        get total() { return this.details.reduce((t, i) => t + i.subtotal, 0); },
        get totalWeight() { return this.details.reduce((t, i) => t + i.totalWeight, 0); }
    });

    Alpine.data("products", () => ({
        products: [],
        selectedCategory: 'all',
        searchTerm: '',
        sortOption: 'default',
        currentPage: 1,
        perPage: 8,
        init() {
            this.syncFromStore();
            this.$watch('$store.products.all', () => {
                this.syncFromStore();
                this.currentPage = 1;
            });
            if (!Array.isArray(this.$store.products.all) || this.$store.products.all.length === 0) {
                this.$store.products.init().then(() => this.syncFromStore());
            }
        },
        syncFromStore() {
            this.products = Array.isArray(this.$store.products.all) ? this.$store.products.all : [];
        },
        handleSearch(term) {
            this.searchTerm = String(term || '').trim().toLowerCase();
            this.currentPage = 1;
        },
        toggleSort() {
            if (this.sortOption === 'default') this.sortOption = 'price-asc';
            else if (this.sortOption === 'price-asc') this.sortOption = 'price-desc';
            else this.sortOption = 'default';
            this.currentPage = 1;
        },
        processedItems() {
            let items = Array.isArray(this.products) ? [...this.products] : [];
            if (this.selectedCategory && this.selectedCategory !== 'all') {
                items = items.filter((p) => String(p.category || '').toLowerCase() === this.selectedCategory);
            }
            if (this.searchTerm) {
                items = items.filter((p) => String(p.name || '').toLowerCase().includes(this.searchTerm));
            }
            if (this.sortOption === 'price-asc') items.sort((a, b) => (a.price || 0) - (b.price || 0));
            if (this.sortOption === 'price-desc') items.sort((a, b) => (b.price || 0) - (a.price || 0));
            return items;
        },
        totalPages() {
            const total = Math.ceil(this.processedItems().length / this.perPage);
            return total > 0 ? total : 1;
        },
        paginatedItems() {
            const items = this.processedItems();
            const page = Number.isFinite(this.currentPage) ? this.currentPage : 1;
            const start = (Math.max(1, page) - 1) * this.perPage;
            return items.slice(start, start + this.perPage);
        },
        goToPage(page) {
            const nextPage = Math.min(this.totalPages(), Math.max(1, Number(page) || 1));
            this.currentPage = nextPage;
        },
        promoItems() {
            return (Array.isArray(this.products) ? this.products : []).filter((p) => (p.discount_price || 0) > 0 || (p.discount_percent || 0) > 0);
        },
        renderProductCard(item) {
            if (!item) return '';
            const detailUrl = window.toAppPath(`product-details.html?id=${item.id}`);
            const img = window.fixImagePath(item.image_url);
            const { finalPrice, percentOff, originalPrice } = window.calculateDiscount(item);
            return `
                <article class="product-card">
                    ${percentOff > 0 ? `<span class="badge-discount">-${percentOff}%</span>` : ''}
                    <a href="${detailUrl}">
                        <img src="${img}" alt="${item.name || 'Product'}" loading="lazy">
                        <h3>${item.name || '-'}</h3>
                    </a>
                    <div class="price-wrap">
                        ${percentOff > 0 ? `<span class="price-original">${window.formatRupiah(originalPrice)}</span>` : ''}
                        <strong class="price-final">${window.formatRupiah(finalPrice)}</strong>
                    </div>
                </article>
            `;
        }
    }));

    Alpine.data("accountPage", () => ({
        activeView: 'profile',
        editProfileMode: false,
        editAddressMode: false,
        loading: false,
        user: null,
        profile: {},
        orders: [],
        isOrderLoading: false,
        provinces: [],
        regencies: [],
        districts: [],
        villages: [],
        selectedProvince: '',
        selectedRegency: '',
        selectedDistrict: '',
        selectedVillage: '',
        async init() {
            await this.$store.account.init();
            this.syncAccountState();
            this.$watch('$store.account.profile', () => this.syncAccountState());
            this.$watch('$store.account.orders', () => this.syncAccountState());
            this.$nextTick(() => window.feather?.replace());
        },
        syncAccountState() {
            this.user = this.$store.account.user;
            this.profile = { ...(this.$store.account.profile || {}) };
            this.orders = Array.isArray(this.$store.account.orders) ? this.$store.account.orders : [];
            this.isOrderLoading = !!this.$store.account.isOrderLoading;
        },
        async updateProfile() {
            if (!this.user?.id) return;
            this.loading = true;
            try {
                const payload = {
                    full_name: this.profile.full_name || '',
                    phone_number: this.profile.phone_number || ''
                };
                const { error } = await window.supabase.from('profiles').upsert({ id: this.user.id, ...payload });
                if (error) throw error;
                await this.$store.account.fetchProfile();
                this.editProfileMode = false;
            } catch (error) {
                console.error('[Account] updateProfile failed:', error);
            } finally {
                this.loading = false;
            }
        },
        async updateAddress() {
            if (!this.user?.id) return;
            this.loading = true;
            try {
                const payload = {
                    address: this.profile.address || '',
                    postal_code: this.profile.postal_code || '',
                    province: this.selectedProvince || this.profile.province || '',
                    regency: this.selectedRegency || this.profile.regency || '',
                    district: this.selectedDistrict || this.profile.district || '',
                    village: this.selectedVillage || this.profile.village || '',
                    latitude: this.profile.latitude || null,
                    longitude: this.profile.longitude || null
                };
                const { error } = await window.supabase.from('profiles').upsert({ id: this.user.id, ...payload });
                if (error) throw error;
                await this.$store.account.fetchProfile();
                this.editAddressMode = false;
            } catch (error) {
                console.error('[Account] updateAddress failed:', error);
            } finally {
                this.loading = false;
            }
        },
        fetchRegencies() { this.regencies = []; this.districts = []; this.villages = []; },
        fetchDistricts() { this.districts = []; this.villages = []; },
        fetchVillages() { this.villages = []; },
        updateProfileVillage() {},
        getStatusClass(status = '') { return `status-${String(status).toLowerCase().replace(/\s+/g, '-')}`; },
        translateStatus(status = '') { return status || 'Not Updated'; },
        formatRupiah(value) { return window.formatRupiah(value); },
        async handleLogout() {
            await window.supabase?.auth?.signOut();
            window.location.href = window.toAppPath('login-page.html');
        }
    }));
});

// --- CHECKOUT LOGIC ---
function checkoutPage() {
    return {
        shipping: { courier: 'jne', cost: 0, service: '', destinationCityId: '' },
        regions: { services: [] },
        isCheckoutLoading: false,

        async calculateShipping() {
            if (!this.shipping.destinationCityId || !this.shipping.courier) return;
            
            this.isCheckoutLoading = true;
            try {
                const res = await window.fetchWithDebug(`${API_BASE_URL}/api/shipping/cost`, {
                    method: 'POST',
                    body: JSON.stringify({
                        destination: this.shipping.destinationCityId,
                        weight: Alpine.store('cart').totalWeight,
                        courier: this.shipping.courier
                    })
                });
                const result = await res.json();
                if (result.status === 'success') {
                    this.regions.services = result.data;
                }
            } catch (e) {
                console.error("Shipping calc failed", e);
            } finally {
                this.isCheckoutLoading = false;
            }
        }
    };
}
