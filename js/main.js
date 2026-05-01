const API_BASE_URL = 'https://carita-hidroponik-backend.vercel.app';
const SNAP_TOKEN_ENDPOINT = '/api/payment/create-snap-token';
window.API_BASE_URL = API_BASE_URL;

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

window.toApiPath = (relativePath = '') => {
    const normalized = String(relativePath || '').trim();
    if (!normalized) return API_BASE_URL;
    if (/^(?:[a-z]+:)?\/\//i.test(normalized)) return normalized;
    const path = normalized.startsWith('/') ? normalized : `/${normalized}`;
    return `${API_BASE_URL}${path}`;
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
window.safeFeatherReplace = () => {
    if (!(window.feather && typeof window.feather.replace === 'function')) return;

    requestAnimationFrame(() => {
        try {
            window.feather.replace();
        } catch (error) {
            console.warn('[Feather] replace skipped:', error);
        }
    });
};

document.addEventListener('DOMContentLoaded', async () => {
    const loadComponent = async (selector, path) => {
        const mountNode = document.querySelector(selector);
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
        } catch (error) {
            console.error(`[Loader] Failed: ${path}`, error);
            mountNode.innerHTML = '<div style="text-align:center; padding:1rem;">Failed to load section.</div>';
        }
    };

    const initLayout = async () => {
        console.log('Header:', document.querySelector('#header'));
        console.log('Footer:', document.querySelector('#footer'));

        await loadComponent('#header, #header-include', './components/header.html');
        await loadComponent('#footer, #footer-include', './components/footer.html');

        setTimeout(() => {
            window.safeFeatherReplace();
        }, 50);
    };

    await initLayout();
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

window.resolveImagePath = (path) => {
    const fallback = window.toAppPath('img/coming-soon.jpg');
    if (!path) return fallback;

    const trimmed = String(path).trim();
    if (!trimmed) return fallback;

    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
        return trimmed;
    }

    if (/^https?:\/\//i.test(trimmed)) {
        try {
            const url = new URL(trimmed);
            if (url.origin === window.location.origin) {
                const normalizedOriginPath = url.pathname.replace(/^\/+/, '');
                if (APP_BASE_PATH) {
                    const repoPrefix = APP_BASE_PATH.replace(/^\/+/, '');
                    if (normalizedOriginPath.startsWith(`${repoPrefix}/`)) {
                        return window.toAppPath(normalizedOriginPath.slice(repoPrefix.length + 1));
                    }
                }
            }
            return trimmed;
        } catch (_e) {
            return trimmed;
        }
    }

    let normalized = trimmed.replace(/\\/g, '/').replace(/ /g, '-').replace(/^\/+/, '');
    if (APP_BASE_PATH) {
        const repoPrefix = APP_BASE_PATH.replace(/^\/+/, '');
        if (normalized.startsWith(`${repoPrefix}/`)) {
            normalized = normalized.slice(repoPrefix.length + 1);
        }
    }

    return normalized ? window.toAppPath(normalized) : fallback;
};

window.fixImagePath = window.resolveImagePath;

window.applyImageFallback = (imgElement) => {
    if (!imgElement || imgElement.tagName !== 'IMG') return;
    const fallback = window.toAppPath('img/coming-soon.jpg');
    if (imgElement.dataset.fallbackApplied === '1') return;

    imgElement.onerror = () => {
        if (imgElement.dataset.fallbackApplied === '1') return;
        imgElement.dataset.fallbackApplied = '1';
        imgElement.src = fallback;
    };
};

document.addEventListener('error', (event) => {
    const target = event.target;
    if (target && target.tagName === 'IMG') {
        window.applyImageFallback(target);
        target.onerror?.();
    }
}, true);

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
        isSnapPopupActive: false,
        checkoutState: {
            isLoggedIn: false,
            isProfileComplete: false,
            isAddressComplete: false,
            profileLoaded: false
        },
        profileSnapshot: null,
        profileDebug: {
            normalizedProfile: null,
            missingFields: []
        },

        shipping: {
            selectedMethod: 'rekomendasi-kami',
            selectedCourier: 'recommendation',
            dropdownOpen: false,
            cost: 0,
            addressLabel: '',
            estimateLabel: '',
            zoneLabel: '',
            error: '',
            couriers: [
                { id: 'recommendation', name: 'Rekomendasi Kami', available: true, recommended: true, etd: '1-2 hari' },
                { id: 'tiki', name: 'TIKI', available: false },
                { id: 'pos', name: 'POS Indonesia', available: false },
                { id: 'jne', name: 'JNE', available: false }
            ]
        },
        isCalculatingShipping: false,
        shippingLoaded: false,
        lastShippingRequestKey: null,
        shippingDebounceTimer: null,
        lastShippingDebounceToken: null,
        shippingRequestController: null,
        isCheckoutLoading: false,
        ppnRate: 0.11,

        async init() {
            if (this.shippingLoaded) {
                console.info('[Checkout] init skipped: shipping already loaded.');
                return;
            }
            await this.loadCheckoutState();
        },

        get subtotal() {
            return Number(Alpine.store('cart')?.total || 0);
        },

        get ppnAmount() {
            return this.subtotal * this.ppnRate;
        },

        get ongkir() {
            return Number(this.shipping.cost || 0);
        },

        checkoutButtonText() {
            if (this.isCheckoutLoading) return 'Memproses...';
            if (this.isSnapPopupActive) return 'Checkout Sedang Berjalan...';
            return 'Checkout Sekarang';
        },

        async getLoggedInUser() {
            if (!window.supabase?.auth?.getSession) return null;

            try {
                const { data, error } = await window.supabase.auth.getSession();
                if (error) {
                    console.error('[Checkout] Failed to load auth session:', error);
                    return null;
                }

                return data?.session?.user || null;
            } catch (error) {
                console.error('[Checkout] Error while checking auth session:', error);
                return null;
            }
        },

        async hydrateShippingAddress() {
            this.shipping.addressLabel = '';

            const user = await this.getLoggedInUser();
            if (!user?.id || !window.supabase?.from) return;

            try {
                const { data, error } = await window.supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .maybeSingle();

                if (error) {
                    console.error('[Checkout] Failed to fetch profile for address:', error);
                    return;
                }

                if (!data) {
                    this.profileSnapshot = null;
                    return;
                }

                this.profileSnapshot = data;
                console.info('[Checkout] Loaded user profile for shipping:', data);

                const addressParts = [
                    data.address,
                    data.district,
                    data.regency || data.city,
                    data.province,
                    data.postal_code
                ].filter(Boolean);

                this.shipping.addressLabel = addressParts.join(', ');
            } catch (error) {
                console.error('[Checkout] Failed to hydrate shipping address:', error);
            } finally {
                this.checkoutState.profileLoaded = true;
            }
        },

        getFirstFilledValue(...values) {
            for (const value of values) {
                if (typeof value === 'string') {
                    if (value.trim().length > 0) return value.trim();
                    continue;
                }

                if (value !== null && value !== undefined && value !== '') return value;
            }
            return null;
        },

        isNonEmptyValue(value) {
            return this.getFirstFilledValue(value) !== null;
        },

        isCoordinateValid(value) {
            const numeric = Number(value);
            return Number.isFinite(numeric);
        },

        normalizeProfileData(profile) {
            const safeProfile = profile || {};

            const normalizedProfile = {
                full_name: this.getFirstFilledValue(safeProfile.full_name, safeProfile.nama_penerima, safeProfile.receiver_name),
                phone_number: this.getFirstFilledValue(safeProfile.phone_number, safeProfile.phone, safeProfile.no_hp),
                address: this.getFirstFilledValue(safeProfile.address, safeProfile.alamat, safeProfile.full_address),
                province: this.getFirstFilledValue(safeProfile.province, safeProfile.provinsi),
                city_or_regency: this.getFirstFilledValue(
                    safeProfile.regency,
                    safeProfile.city,
                    safeProfile.kota,
                    safeProfile.kabupaten,
                    safeProfile.city_id,
                    safeProfile.regency_id
                ),
                district: this.getFirstFilledValue(safeProfile.district, safeProfile.kecamatan),
                village: this.getFirstFilledValue(safeProfile.village, safeProfile.kelurahan),
                postal_code: this.getFirstFilledValue(safeProfile.postal_code, safeProfile.kode_pos),
                latitude: this.getFirstFilledValue(safeProfile.latitude, safeProfile.lat),
                longitude: this.getFirstFilledValue(safeProfile.longitude, safeProfile.lng, safeProfile.lon)
            };

            return normalizedProfile;
        },

        evaluateProfileState(profile) {
            const normalizedProfile = this.normalizeProfileData(profile);
            const missingFields = [];

            const requiredFields = [
                { key: 'full_name', label: 'full_name' },
                { key: 'phone_number', label: 'phone_number' },
                { key: 'address', label: 'address' },
                { key: 'province', label: 'province' },
                { key: 'city_or_regency', label: 'city/regency' },
                { key: 'district', label: 'district' },
                { key: 'village', label: 'village' },
                { key: 'postal_code', label: 'postal_code' }
            ];

            requiredFields.forEach((field) => {
                if (!this.isNonEmptyValue(normalizedProfile[field.key])) {
                    missingFields.push(field.label);
                }
            });

            if (!this.isCoordinateValid(normalizedProfile.latitude)) {
                missingFields.push('latitude');
            }

            if (!this.isCoordinateValid(normalizedProfile.longitude)) {
                missingFields.push('longitude');
            }

            const isProfileComplete = this.isNonEmptyValue(normalizedProfile.full_name)
                && this.isNonEmptyValue(normalizedProfile.phone_number);

            const isAddressComplete = missingFields.length === 0;

            this.checkoutState.isProfileComplete = isProfileComplete;
            this.checkoutState.isAddressComplete = isAddressComplete;
            this.profileDebug.normalizedProfile = normalizedProfile;
            this.profileDebug.missingFields = missingFields;

            console.log('Checkout profile data:', normalizedProfile);
            console.log('Missing fields:', missingFields);
        },

        async loadCheckoutState() {
            const user = await this.getLoggedInUser();
            this.checkoutState.isLoggedIn = Boolean(user);
            this.checkoutState.profileLoaded = false;
            this.profileSnapshot = null;

            if (!this.checkoutState.isLoggedIn) {
                this.checkoutState.profileLoaded = true;
                this.checkoutState.isProfileComplete = false;
                this.checkoutState.isAddressComplete = false;
                this.shippingLoaded = false;
                this.lastShippingRequestKey = null;
                return;
            }

            await this.hydrateShippingAddress();
            this.evaluateProfileState(this.profileSnapshot);

            if (this.checkoutState.profileLoaded && !this.shippingLoaded) {
                await this.calculateShipping('loadCheckoutState:init');
            }
        },

        updateShippingCost(cost = 0) {
            this.shipping.cost = Number(cost || 0);
            if (this.shipping.cost > 0) this.clearNotification();
        },

        getSelectedCourier() {
            return this.shipping.couriers.find((courier) => courier.id === this.shipping.selectedCourier)
                || this.shipping.couriers[0];
        },

        selectCourier(courier) {
            if (!courier?.available) return;

            this.shipping.selectedCourier = courier.id;
            this.shipping.dropdownOpen = false;

            const methodCode = courier.id === 'recommendation' ? 'rekomendasi-kami' : courier.id;
            this.onShippingMethodChange(methodCode);
        },

        onShippingMethodChange(methodCode) {
            if (methodCode !== 'rekomendasi-kami') {
                this.showNotification('Saat ini hanya metode Rekomendasi Kami yang tersedia.', true);
                this.shipping.selectedMethod = 'rekomendasi-kami';
                this.shipping.selectedCourier = 'recommendation';
                return;
            }

            this.shipping.selectedMethod = 'rekomendasi-kami';
            this.shipping.selectedCourier = 'recommendation';
            this.calculateShipping('shipping-method-change', { force: true });
        },

        calculateGrandTotal() {
            return this.subtotal + this.ppnAmount + this.ongkir;
        },

        async validateCheckout() {
            console.info('[Checkout] validateCheckout start:', {
                isLoggedIn: this.checkoutState.isLoggedIn,
                profileLoaded: this.checkoutState.profileLoaded,
                isProfileComplete: this.checkoutState.isProfileComplete,
                isAddressComplete: this.checkoutState.isAddressComplete,
                shippingLoaded: this.shippingLoaded,
                shippingCost: this.ongkir
            });

            if (!this.checkoutState.isLoggedIn) {
                this.isLoginModalOpen = true;
                return { valid: false, reason: 'LOGIN_REQUIRED' };
            }

            if (Alpine.store('cart').items.length === 0) {
                this.showNotification('Keranjang belanja kosong. Tambahkan produk terlebih dahulu.', true);
                return { valid: false, reason: 'EMPTY_CART' };
            }

            if (!this.checkoutState.profileLoaded) {
                this.showNotification('Data profil masih dimuat. Coba lagi dalam beberapa detik.', true);
                return { valid: false, reason: 'PROFILE_LOADING' };
            }

            if (!this.checkoutState.isProfileComplete || !this.checkoutState.isAddressComplete) {
                this.isProfileModalOpen = true;
                return { valid: false, reason: 'PROFILE_OR_ADDRESS_INCOMPLETE' };
            }

            if (this.shipping.selectedMethod !== 'rekomendasi-kami' || this.ongkir <= 0) {
                console.warn('[Checkout] Checkout validation failed for shipping state:', {
                    selectedMethod: this.shipping.selectedMethod,
                    shippingCost: this.ongkir
                });
                this.showNotification('Metode pengiriman rekomendasi belum siap. Silakan cek alamat Anda.', true);
                return { valid: false, reason: 'SHIPPING_NOT_SELECTED' };
            }

            return { valid: true };
        },

        async handleCheckout() {
            if (this.isCheckoutLoading || this.isSnapPopupActive) return;

            if (this.shouldRefreshShipping()) {
                await this.calculateShipping('handleCheckout:state-changed', { force: true });
            } else {
                console.info('[Checkout] handleCheckout skip shipping recalculation: request key unchanged.');
            }

            const validation = await this.validateCheckout();
            if (!validation.valid) return;

            this.isConfirmModalOpen = true;
        },

        async confirmAndProcessCheckout() {
            const validation = await this.validateCheckout();
            if (!validation.valid) return;

            this.isCheckoutLoading = true;
            this.isSnapPopupActive = true;

            try {
                const checkoutPayload = this.buildCheckoutPayload();
                const snapSession = await this.createSnapSession(checkoutPayload);
                await this.openMidtransSnap(snapSession, checkoutPayload);
            } catch (error) {
                console.error('[Checkout] Checkout flow failed:', error);
                this.showNotification(error?.message || 'Checkout gagal diproses. Silakan coba lagi.', true);
            } finally {
                this.isCheckoutLoading = false;
                this.isSnapPopupActive = false;
                this.isConfirmModalOpen = false;
            }
        },

        buildCheckoutPayload() {
            const cartDetails = Alpine.store('cart').details || [];
            const cart = cartDetails.map((item) => ({
                id: String(item.id),
                name: item.name,
                quantity: Number(item.quantity),
                price: Number(item.finalPrice || item.price || 0)
            }));

            const roundedTax = Math.round(this.ppnAmount);
            const roundedShipping = Math.round(this.ongkir);

            if (roundedTax > 0) {
                cart.push({
                    id: 'ppn-tax',
                    name: 'PPN 11%',
                    quantity: 1,
                    price: roundedTax
                });
            }

            if (roundedShipping > 0) {
                cart.push({
                    id: 'shipping-fee',
                    name: 'Ongkir Rekomendasi Kami',
                    quantity: 1,
                    price: roundedShipping
                });
            }

            const totalPrice = cart.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
            const normalizedProfile = this.profileDebug.normalizedProfile || this.normalizeProfileData(this.profileSnapshot);

            return {
                cart,
                totalPrice,
                customer: {
                    firstName: normalizedProfile.full_name || 'Pelanggan',
                    name: normalizedProfile.full_name || 'Pelanggan',
                    phone: normalizedProfile.phone_number || '',
                    email: this.getFirstFilledValue(this.profileSnapshot?.email, this.profileSnapshot?.user_email) || 'customer@example.com'
                }
            };
        },

        async createSnapSession(payload) {
            const response = await window.fetchWithDebug(window.toApiPath(SNAP_TOKEN_ENDPOINT), {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            const result = await response.json().catch(() => ({}));
            const snapToken =
                result?.token ||
                result?.snapToken ||
                result?.snap_token;

            if (!response.ok) {
                console.error('[Checkout] Failed to create snap session:', result);
                throw new Error(result?.message || 'Gagal membuat token pembayaran Midtrans.');
            }

            if (!snapToken) {
                console.error('[Checkout] Token not found:', result);
                throw new Error('Gagal membuat token pembayaran Midtrans.');
            }

            this.latestSnapSession = result;
            console.log('[MIDTRANS TOKEN RECEIVED]', snapToken);

            return snapToken;
        },

        loadMidtransSnapScript(clientKey) {
            if (window.snap?.pay) return Promise.resolve(window.snap);

            return new Promise((resolve, reject) => {
                const existingScript = document.getElementById('midtrans-snap-script');
                if (existingScript) {
                    existingScript.addEventListener('load', () => resolve(window.snap));
                    existingScript.addEventListener('error', () => reject(new Error('Gagal memuat script Midtrans Snap.')));
                    return;
                }

                const script = document.createElement('script');
                script.id = 'midtrans-snap-script';
                script.src = 'https://app.sandbox.midtrans.com/snap/snap.js';
                script.setAttribute('data-client-key', clientKey || '');
                script.onload = () => resolve(window.snap);
                script.onerror = () => reject(new Error('Gagal memuat script Midtrans Snap.'));
                document.body.appendChild(script);
            });
        },

        async openMidtransSnap(snapSession, checkoutPayload) {
            const snapMetadata = this.latestSnapSession || {};
            const snap = await this.loadMidtransSnapScript(snapMetadata.clientKey);
            if (!snap?.pay) throw new Error('Midtrans Snap tidak tersedia.');
            const token = typeof snapSession === 'string'
                ? snapSession
                : (snapSession?.token || snapSession?.snapToken || snapSession?.snap_token);
            if (!token) throw new Error('Token Midtrans tidak ditemukan');
            console.log('[SNAP PAY START]');

            await new Promise((resolve, reject) => {
                window.snap.pay(token, {
                    onSuccess: async (result) => {
                        await this.confirmPaymentStatus(snapMetadata.orderId, 'success', result?.transaction_id);
                        this.showNotification('Pembayaran berhasil. Pesanan Anda diproses.');
                        resolve();
                    },
                    onPending: async (result) => {
                        await this.confirmPaymentStatus(snapMetadata.orderId, 'pending', result?.transaction_id);
                        this.showNotification('Pembayaran pending. Silakan selesaikan pembayaran Anda.');
                        resolve();
                    },
                    onError: async (_result) => {
                        await this.confirmPaymentStatus(snapMetadata.orderId, 'failed');
                        reject(new Error('Pembayaran gagal diproses oleh Midtrans.'));
                    },
                    onClose: () => {
                        this.showNotification('Popup pembayaran ditutup sebelum selesai.', true);
                        resolve();
                    }
                });
            });

            console.info('[Checkout] Midtrans payload sent:', checkoutPayload);
        },

        async confirmPaymentStatus(orderCode, paymentStatus, transactionId = null) {
            try {
                await window.fetchWithDebug(window.toApiPath('/api/payment/confirm'), {
                    method: 'POST',
                    body: JSON.stringify({
                        order_code: orderCode,
                        payment_status: paymentStatus,
                        transaction_id: transactionId
                    })
                });
            } catch (error) {
                console.error('[Checkout] Failed to confirm payment status:', error);
            }
        },

        goToLoginPage() {
            this.isLoginModalOpen = false;
            window.location.href = window.toAppPath('login-page.html?redirect=my-cart.html');
        },

        goToAccountPage() {
            this.isProfileModalOpen = false;
            window.location.href = window.toAppPath('my-account.html');
        },

        showNotification(message, isError = false) {
            const notification = document.getElementById('notification');
            if (!notification) {
                console[isError ? 'error' : 'info']('[Checkout] Notification:', message);
                return;
            }

            notification.textContent = message;
            notification.style.backgroundColor = isError ? '#c62828' : 'var(--accent)';
            notification.classList.add('show');
            setTimeout(() => notification.classList.remove('show'), 2500);
        },

        clearNotification() {
            const notification = document.getElementById('notification');
            if (!notification) return;
            notification.classList.remove('show');
            notification.textContent = '';
        },

        buildShippingRequestKey() {
            const weight = Number(Alpine.store('cart')?.totalWeight || 0);
            const profile = this.profileDebug.normalizedProfile || this.normalizeProfileData(this.profileSnapshot);

            return JSON.stringify({
                method: this.shipping.selectedMethod,
                weight,
                province: profile?.province || '',
                cityOrRegency: profile?.city_or_regency || '',
                district: profile?.district || '',
                postalCode: profile?.postal_code || '',
                address: profile?.address || ''
            });
        },

        shouldRefreshShipping() {
            if (!this.shippingLoaded) return true;
            return this.buildShippingRequestKey() !== this.lastShippingRequestKey;
        },

        async calculateShipping(triggerSource = 'unknown', options = {}) {
            const { force = false, debounceMs = 400, fallbackCost = 25000, timeoutMs = 8000 } = options || {};

            if (!this.checkoutState.profileLoaded) return fallbackCost;
            if (this.shipping.selectedMethod !== 'rekomendasi-kami') this.shipping.selectedMethod = 'rekomendasi-kami';
            if (this.isCalculatingShipping) return this.shipping.cost || fallbackCost;

            const requestKey = this.buildShippingRequestKey();
            if (!force && this.shippingLoaded && requestKey === this.lastShippingRequestKey) {
                return this.shipping.cost || fallbackCost;
            }

            if (!force) {
                clearTimeout(this.shippingDebounceTimer);
                const token = Symbol('shipping-debounce');
                this.lastShippingDebounceToken = token;
                await new Promise((resolve) => {
                    this.shippingDebounceTimer = setTimeout(resolve, debounceMs);
                });
                if (this.lastShippingDebounceToken !== token || this.isCalculatingShipping) {
                    return this.shipping.cost || fallbackCost;
                }
            }

            this.isCalculatingShipping = true;
            this.isCheckoutLoading = true;
            this.shippingRequestController = new AbortController();
            const timeoutId = setTimeout(() => this.shippingRequestController?.abort(), timeoutMs);

            try {
                this.shipping.error = '';
                const cartStore = Alpine.store('cart');
                const totalWeight = Number(cartStore?.totalWeight || 0);
                const quantity = Number(cartStore?.quantity || 0);
                const courier = this.shipping.selectedMethod === 'rekomendasi-kami'
                    ? 'jne'
                    : this.shipping.selectedMethod;

                const res = await window.fetchWithDebug(window.toApiPath('/api/shipping/cost'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        courier,
                        weight: totalWeight,
                        quantity,
                        totalWeight
                    }),
                    signal: this.shippingRequestController.signal
                });

                const result = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(result?.message || 'Gagal mengambil estimasi pengiriman.');

                const rawCost =
                    result?.recommendation?.cost ??
                    result?.cost ??
                    result?.shippingCost ??
                    result?.data?.cost;
                const nextCost = Number(rawCost);
                if (!Number.isFinite(nextCost) || nextCost <= 0) throw new Error('Invalid shipping cost response');

                const recommendation = result?.recommendation || {
                    cost: nextCost,
                    etd: result?.etd || result?.data?.etd,
                    zone_name: result?.zone_name || result?.data?.zone_name || ''
                };

                this.shipping.zoneLabel = recommendation.zone_name || '';
                this.shipping.estimateLabel = `${recommendation.etd || '1-4 hari kerja'} • Zona ${this.shipping.zoneLabel || '-'}`;
                this.updateShippingCost(nextCost);
                this.shippingLoaded = true;
                this.lastShippingRequestKey = requestKey;
                this.clearNotification();
                return nextCost;
            } catch (error) {
                this.updateShippingCost(0);
                this.shipping.error = 'Gagal mengambil ongkir';
                this.shipping.zoneLabel = '';
                this.shipping.estimateLabel = '';
                if (error?.name !== 'AbortError') {
                    console.error('[Checkout] Shipping calculation failed:', error?.message || error);
                }
                return 0;
            } finally {
                clearTimeout(timeoutId);
                this.shippingRequestController = null;
                this.isCheckoutLoading = false;
                this.isCalculatingShipping = false;
            }
        }
    };
}
