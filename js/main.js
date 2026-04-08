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
    const raw = String(relativePath || '').trim();
    if (!raw) return APP_BASE_PATH || '/';

    if (/^(?:[a-z]+:)?\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) {
        return raw;
    }

    const [pathOnly, hashPart = ''] = raw.split('#');
    const [pathnamePart, queryPart = ''] = pathOnly.split('?');
    const normalizedPath = String(pathnamePart).replace(/^\/+/, '');
    const base = `${APP_BASE_PATH}/${normalizedPath}`.replace(/\/{2,}/g, '/');

    const withQuery = queryPart ? `${base}?${queryPart}` : base;
    return hashPart ? `${withQuery}#${hashPart}` : withQuery;
};

window.toAppUrl = (relativePath = '') => {
    const resolved = window.toAppPath(relativePath);
    if (/^(?:[a-z]+:)?\/\//i.test(resolved) || resolved.startsWith('data:') || resolved.startsWith('blob:')) {
        return resolved;
    }
    return new URL(resolved, window.location.origin).href;
};

// --- GLOBAL ERROR HANDLING ---
window.onerror = (message, source, lineno, colno, error) => {
    console.error('[GlobalError]', {
        message,
        source,
        line: lineno,
        column: colno,
        stack: error?.stack
    });
};

window.addEventListener('unhandledrejection', (event) => {
    console.error('[GlobalError] Unhandled promise rejection:', event.reason);
});

// --- FETCH ENGINE (CORS + DEBUG) ---
window.fetchWithDebug = async (input, init = {}) => {
    const {
        timeoutMs = 15000,
        retries = 1,
        retryDelayMs = 1000,
        skipJsonContentType = false,
        ...requestInit
    } = init || {};

    const targetUrl = typeof input === 'string' ? input : input?.url;

    const attemptFetch = async (attempt = 0) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);

        const headers = new Headers(requestInit.headers || {});
        if (!skipJsonContentType && !headers.has('Content-Type') && !(requestInit.body instanceof FormData)) {
            headers.set('Content-Type', 'application/json');
        }

        const mergedInit = {
            ...requestInit,
            headers,
            mode: requestInit.mode || 'cors',
            credentials: requestInit.credentials || 'omit',
            signal: controller.signal
        };

        try {
            console.info(`[Fetch] START (${attempt + 1}/${retries + 1}): ${mergedInit.method || 'GET'} ${targetUrl || input}`);
            const response = await fetch(input, mergedInit);
            clearTimeout(timeoutId);

            if (!response.ok) {
                const clone = response.clone();
                let errorText = '';
                try {
                    errorText = await clone.text();
                } catch (_e) {
                    errorText = '(failed to read response body)';
                }

                console.warn('[Fetch] Non-OK response:', {
                    url: targetUrl,
                    status: response.status,
                    statusText: response.statusText,
                    body: errorText
                });
            }

            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            const isAbort = error?.name === 'AbortError';
            const maybeCors = /failed to fetch|networkerror|cors/i.test(String(error?.message || ''));

            console.error('[Fetch] Request failed:', {
                url: targetUrl,
                attempt: attempt + 1,
                retries: retries + 1,
                isAbort,
                maybeCors,
                error
            });

            if (attempt < retries) {
                await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
                return attemptFetch(attempt + 1);
            }
            throw error;
        }
    };

    return attemptFetch(0);
};

// --- DOM READY ---
document.addEventListener('DOMContentLoaded', () => {
    const loadComponent = async (id, path) => {
        const mountNode = document.getElementById(id);
        if (!mountNode) return;

        try {
            const response = await window.fetchWithDebug(window.toAppUrl(path), {
                cache: 'no-store',
                skipJsonContentType: true
            });
            if (!response.ok) throw new Error(`Failed to load component: ${path}`);

            const html = await response.text();
            mountNode.innerHTML = html;

            mountNode.querySelectorAll('script').forEach((script) => {
                const newScript = document.createElement('script');
                newScript.textContent = script.textContent;
                document.body.appendChild(newScript).remove();
            });

            if (window.Alpine && typeof window.Alpine.initTree === 'function') {
                window.Alpine.initTree(mountNode);
            }

            if (window.feather) window.feather.replace();
        } catch (error) {
            console.error(`[Loader] Failed: ${path}`, error);
            mountNode.innerHTML = '<div style="text-align:center; padding:1rem;">Failed to load section.</div>';
        }
    };

    loadComponent('header-include', '/components/header.html');
    loadComponent('footer-include', '/components/footer.html');
});

// --- UTILITIES ---
window.formatRupiah = (num) => (
    Number.isNaN(Number(num))
        ? 'Rp 0'
        : new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(Number(num))
);

window.fixImagePath = (path) => {
    const fallback = window.toAppPath('img/coming-soon.jpg');
    if (!path) return fallback;

    const trimmed = String(path).trim();
    if (!trimmed) return fallback;

    if (/^(?:[a-z]+:)?\/\//i.test(trimmed) || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
        return trimmed;
    }

    const normalized = trimmed.replace(/\\/g, '/').replace(/ /g, '-').replace(/^\/+/, '');
    return window.toAppPath(normalized);
};

window.calculateDiscount = (product) => {
    const original = Number(product?.price || 0);
    let final = original;
    let percent = 0;

    if (Number(product?.discount_price) > 0) {
        final = Number(product.discount_price);
        percent = original > 0 ? Math.floor(((original - final) / original) * 100) : 0;
    } else if (Number(product?.discount_percent) > 0) {
        percent = Number(product.discount_percent);
        final = original - (original * percent / 100);
    }

    return {
        finalPrice: Math.max(0, final),
        percentOff: Math.max(0, percent),
        originalPrice: original
    };
};

// --- ALPINE STORES ---
document.addEventListener('alpine:init', () => {
    Alpine.store('i18n', {
        lang: 'id',
        ready: false,
        isLoading: false,
        translations: {},
        supportedLangs: {
            id: { name: 'ID', flag: 'id' },
            en: { name: 'EN', flag: 'gb' }
        },

        async init() {
            const saved = localStorage.getItem('language');
            const initialLang = this.supportedLangs[saved] ? saved : 'id';
            this.lang = initialLang;
            await this.load(initialLang);
            this.ready = true;
        },

        async setLang(nextLang) {
            if (!this.supportedLangs[nextLang] || nextLang === this.lang) return;
            this.lang = nextLang;
            localStorage.setItem('language', nextLang);
            await this.load(nextLang);
        },

        async load(lang = this.lang) {
            this.isLoading = true;
            try {
                const localeUrl = window.toAppUrl(`locales/${lang}.json?v=${Date.now()}`);
                const res = await window.fetchWithDebug(localeUrl, {
                    cache: 'no-store',
                    skipJsonContentType: true
                });

                if (!res.ok) throw new Error(`Locale fetch failed (${res.status})`);
                const payload = await res.json();
                this.translations = payload && typeof payload === 'object' ? payload : {};
                this.lang = lang;
                localStorage.setItem('language', lang);
                document.documentElement.lang = lang;
            } catch (error) {
                console.error('[i18n] Language load failed:', error);
                this.translations = {};
            } finally {
                this.isLoading = false;
            }
        },

        t(key) {
            if (!key) return '';
            const value = String(key)
                .split('.')
                .reduce((acc, cur) => (acc && Object.prototype.hasOwnProperty.call(acc, cur) ? acc[cur] : undefined), this.translations);

            return value ?? key;
        }
    });


    Alpine.store('i18n').init().catch((error) => {
        console.error('[i18n] Initial bootstrap failed:', error);
    });

    Alpine.data('products', () => ({
        searchTerm: '',
        selectedCategory: 'all',
        sortOption: 'default',
        currentPage: 1,
        itemsPerPage: 8,

        init() {
            if (!this.$store.products.isLoading && this.$store.products.all.length === 0) {
                this.$store.products.init();
            }

            Alpine.effect(() => {
                this.$store.i18n.lang;
                this.currentPage = 1;
            });
        },

        handleSearch(term = '') {
            this.searchTerm = String(term || '').trim();
            this.currentPage = 1;
        },

        toggleSort() {
            this.sortOption = this.sortOption === 'price-asc'
                ? 'price-desc'
                : 'price-asc';
            this.currentPage = 1;
        },

        processedItems() {
            const list = Array.isArray(this.$store.products.all) ? [...this.$store.products.all] : [];
            const term = this.searchTerm.toLowerCase();
            const lang = this.$store.i18n.lang || 'id';

            const filtered = list.filter((item) => {
                if (!item) return false;

                const matchesCategory = this.selectedCategory === 'all'
                    || String(item.category || '').toLowerCase() === this.selectedCategory;

                if (!matchesCategory) return false;

                if (!term) return true;

                const localizedName = (item.name && (item.name[lang] || item.name.id || item.name.en))
                    || item.product_name
                    || '';

                return String(localizedName).toLowerCase().includes(term);
            });

            if (this.sortOption === 'price-asc' || this.sortOption === 'price-desc') {
                const asc = this.sortOption === 'price-asc';
                filtered.sort((a, b) => {
                    const aPrice = window.calculateDiscount(a).finalPrice;
                    const bPrice = window.calculateDiscount(b).finalPrice;
                    return asc ? aPrice - bPrice : bPrice - aPrice;
                });
            }

            return filtered;
        },

        promoItems() {
            return this.processedItems().filter((item) => Number(item.discount_price || item.discount_percent || 0) > 0);
        },

        totalPages() {
            return Math.max(1, Math.ceil(this.processedItems().length / this.itemsPerPage));
        },

        goToPage(page) {
            const next = Number(page || 1);
            this.currentPage = Math.min(Math.max(1, next), this.totalPages());
        },

        paginatedItems() {
            const start = (this.currentPage - 1) * this.itemsPerPage;
            return this.processedItems().slice(start, start + this.itemsPerPage);
        },

        renderProductCard(item) {
            const { finalPrice, percentOff, originalPrice } = window.calculateDiscount(item);
            const isPromo = percentOff > 0;
            const lang = this.$store.i18n.lang;
            const itemName = (item.name && (item.name[lang] || item.name.id || item.name.en))
                || item.product_name
                || 'Unnamed Product';

            const ribbonHtml = isPromo
                ? `<div class="discount-ribbon"><span>${percentOff}% OFF</span></div>`
                : '';

            const priceHtml = isPromo
                ? `<div class="price-container"><div class="price-original">${window.formatRupiah(originalPrice)}</div><div class="price-discounted">${window.formatRupiah(finalPrice)}</div></div>`
                : `<div class="price">${window.formatRupiah(originalPrice)}</div>`;

            return `
      <a href="${window.toAppPath(`product-details.html?id=${item.id}`)}" class="product-link">
        <article class="product-card">
          ${ribbonHtml}
          <figure class="product-media">
            <img src="${window.fixImagePath(item.image_url || item.img)}" alt="${itemName}" />
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
        }
    }));

    Alpine.store('products', {
        all: [],
        isLoading: true,
        errorMessage: '',

        async init() {
            this.isLoading = true;
            this.errorMessage = '';

            try {
                if (!window.supabase) {
                    throw new Error('Supabase client is not available on window.supabase');
                }

                const { data, error } = await window.supabase
                    .from('products')
                    .select('*')
                    .order('id', { ascending: true });

                if (error) throw error;

                this.all = (data || []).map((item) => {
                    const nameObj = typeof item.name === 'object' && item.name
                        ? item.name
                        : {
                            id: item.name_id || item.product_name || item.name || 'Produk',
                            en: item.name_en || item.product_name || item.name || 'Product'
                        };

                    const fallbackLocalizedName = nameObj.id || nameObj.en || item.product_name || item.name || 'Produk';
                    const imageUrl = window.fixImagePath(item.image_url || item.img || 'img/coming-soon.jpg');

                    return {
                        ...item,
                        name: nameObj,
                        product_name: item.product_name || fallbackLocalizedName,
                        price: Number(item.price || 0),
                        discount_price: Number(item.discount_price || 0),
                        discount_percent: Number(item.discount_percent || 0),
                        image_url: imageUrl,
                        img: imageUrl
                    };
                });
            } catch (error) {
                console.error('[Products] Fetch failed:', error);
                this.all = [];
                this.errorMessage = Alpine.store('i18n')?.t?.('products.fetchError') || 'Products are temporarily unavailable.';
            } finally {
                this.isLoading = false;
            }
        },

        getProductById(id) {
            return this.all.find((p) => String(p.id) === String(id));
        }
    });

    Alpine.store('cart', {
        items: JSON.parse(localStorage.getItem('cart') || '[]'),

        init() {
            this.save();
        },

        add(productId, qty = 1) {
            const existing = this.items.find((i) => String(i.productId) === String(productId));
            if (existing) {
                existing.quantity += qty;
            } else {
                this.items.push({ productId, quantity: qty });
            }
            this.save();
        },

        remove(productId, force = false) {
            const index = this.items.findIndex((i) => String(i.productId) === String(productId));
            if (index > -1) {
                if (force || this.items[index].quantity <= 1) {
                    this.items.splice(index, 1);
                } else {
                    this.items[index].quantity -= 1;
                }
            }
            this.save();
        },

        clear() {
            this.items = [];
            this.save();
        },

        save() {
            localStorage.setItem('cart', JSON.stringify(this.items));
        },

        get quantity() {
            return this.items.reduce((total, item) => total + Number(item.quantity || 0), 0);
        },

        get details() {
            const lang = Alpine.store('i18n')?.lang || 'id';
            return this.items
                .map((item) => {
                    const product = Alpine.store('products').getProductById(item.productId);
                    if (!product) return null;

                    const disc = window.calculateDiscount(product);
                    const localizedName = (product.name && (product.name[lang] || product.name.id || product.name.en))
                        || product.product_name
                        || 'Produk';

                    return {
                        ...product,
                        ...disc,
                        name: localizedName,
                        img: window.fixImagePath(product.image_url || product.img),
                        quantity: item.quantity,
                        subtotal: disc.finalPrice * item.quantity,
                        totalWeight: Number(product.weight || 0) * item.quantity
                    };
                })
                .filter(Boolean);
        },

        get total() {
            return this.details.reduce((sum, item) => sum + item.subtotal, 0);
        },

        get totalWeight() {
            return this.details.reduce((sum, item) => sum + item.totalWeight, 0);
        }
    });
});

// --- CHECKOUT LOGIC ---
function checkoutPage() {
    return {
        isLoginModalOpen: false,
        isSidebarOpen: false,
        isConfirmModalOpen: false,
        isProfileModalOpen: false,

        shipping: {
            courier: 'jne',
            cost: 0,
            service: '',
            destinationCityId: '',
            addressLabel: ''
        },
        regions: { services: [] },
        isCheckoutLoading: false,

        updateShippingCost() {
            if (!this.shipping.service) {
                this.shipping.cost = 0;
                return;
            }

            try {
                const selected = JSON.parse(this.shipping.service);
                this.shipping.cost = Number(selected?.cost?.[0]?.value || 0);
            } catch (_e) {
                this.shipping.cost = 0;
            }
        },

        calculateGrandTotal() {
            return Alpine.store('cart').total + Number(this.shipping.cost || 0);
        },

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
                if (result?.status === 'success') {
                    this.regions.services = Array.isArray(result.data) ? result.data : [];
                } else {
                    this.regions.services = [];
                }
            } catch (error) {
                console.error('[Checkout] Shipping calc failed', error);
                this.regions.services = [];
            } finally {
                this.isCheckoutLoading = false;
            }
        }
    };
}
