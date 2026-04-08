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
        lang: localStorage.getItem('language') || 'id',
        ready: false,
        translations: {},
        async init() {
            await this.load();
            this.ready = true;
        },
        async load() {
            try {
                const url = window.toAppUrl(`locales/${this.lang}.json?v=${Date.now()}`);
                const res = await window.fetchWithDebug(url);
                this.translations = await res.json();
                document.documentElement.lang = this.lang;
            } catch (e) { console.error("Lang load failed", e); }
        },
        t(key) {
            return key.split('.').reduce((acc, cur) => acc && acc[cur], this.translations) || key;
        }
    });

    Alpine.store("products", {
        all: [],
        isLoading: true,
        async init() {
            try {
                const { data, error } = await window.supabase.from("products").select("*").order("id", { ascending: true });
                if (error) throw error;
                this.all = data || [];
            } catch (e) { console.error("Fetch products failed", e); }
            finally { this.isLoading = false; }
        },
        getProductById(id) { return this.all.find(p => String(p.id) === String(id)); }
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
