// js/admin.js

const AdminShared = (() => {
    const rawT = (key) => {
        const store = window.Alpine?.store?.('i18n');
        return store?.t ? store.t(key) : key;
    };

    function t(key, fallback = '') {
        const value = rawT(key);
        return value && value !== key ? value : (fallback || key);
    }

    async function waitForI18n() {
        const store = window.Alpine?.store?.('i18n');
        if (!store) return;
        if (!store.ready && typeof store.init === 'function') {
            await store.init().catch(() => undefined);
        }
    }

    function escapeHtml(value = '') {
        return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[char]));
    }

    function getLocalized(value, fallback = '-') {
        const lang = window.Alpine?.store?.('i18n')?.lang || 'id';
        if (value && typeof value === 'object') return value[lang] || value.id || value.en || fallback;
        return value || fallback;
    }

    function notify(message, isError = false) {
        const fn = window.showNotification || window.showSiteNotification;
        if (typeof fn === 'function') fn(message, isError);
        else window.alert(message);
    }

    return { t, waitForI18n, escapeHtml, getLocalized, notify };
})();

window.AdminOrdersPage = (() => {
    let allOrders = [];
    let activeOrderId = null;

    const STATUS_OPTIONS = [
        { value: 'Pending', label: 'Pending', aliases: ['Pending', 'pending', 'Menunggu Konfirmasi'] },
        { value: 'Diproses', label: 'Diproses', aliases: ['Diproses', 'processing'] },
        { value: 'Dikirim', label: 'Dikirim', aliases: ['Dikirim', 'Dalam Pengiriman', 'shipped'] },
        { value: 'Selesai', label: 'Selesai', aliases: ['Selesai', 'completed'] },
        { value: 'Dibatalkan', label: 'Dibatalkan', aliases: ['Dibatalkan', 'Ditolak', 'rejected', 'cancelled', 'canceled'] }
    ];

    function normalizeStatus(status = '') {
        const normalized = String(status || '').trim();
        return STATUS_OPTIONS.find((option) => option.aliases.includes(normalized))?.value || normalized || 'Pending';
    }

    function statusClass(status = '') {
        return normalizeStatus(status).toLowerCase().replace(/\s+/g, '-');
    }

    function statusLabel(status = '') {
        return STATUS_OPTIONS.find((option) => option.value === normalizeStatus(status))?.label || normalizeStatus(status);
    }

    function showAdminMessage(container, title, message, isError = false) {
        if (!container) return;
        container.innerHTML = `
            <div class="admin-inline-message ${isError ? 'error' : ''}">
                <h4>${AdminShared.escapeHtml(title)}</h4>
                <p>${message}</p>
            </div>
        `;
        container.style.display = 'block';
    }

    function hideAdminMessage(container) {
        if (container) {
            container.innerHTML = '';
            container.style.display = 'none';
        }
    }

    function normalizeOrdersPayload(data) {
        return data?.orders || data?.data || (Array.isArray(data) ? data : []);
    }

    function getOrderItems(order) {
        const candidates = [order?.order_details, order?.items, order?.products];
        const list = candidates.find(Array.isArray) || [];
        return list.map((item) => ({
            name: AdminShared.getLocalized(item.name || item.product_name || item.title, 'Produk'),
            quantity: Number(item.quantity || item.qty || 0),
            price: Number(item.price || item.unit_price || 0),
            subtotal: Number(item.subtotal || item.total || (Number(item.price || 0) * Number(item.quantity || item.qty || 0)))
        }));
    }

    function getCustomer(order) {
        const profile = order?.profiles || order?.profile || {};
        const address = order?.shipping_address || {};
        return {
            name: order?.customer_name || order?.user_fullname || profile.full_name || address.name || address.recipient_name || 'Customer',
            phone: order?.customer_phone || profile.phone_number || address.phone || address.phone_number || '-',
            email: order?.customer_email || profile.email || order?.email || '-'
        };
    }

    function getAddress(order) {
        const addr = order?.shipping_address || {};
        if (typeof addr === 'string') return addr;
        return [addr.address, addr.street, addr.village, addr.district, addr.regency || addr.city, addr.province, addr.country, addr.postal_code]
            .filter(Boolean)
            .join(', ') || '-';
    }

    function getShippingZone(order) {
        const addr = order?.shipping_address || {};
        return order?.shipping_zone || order?.shipping_zone_name || addr.zone || addr.shipping_zone || addr.district || '-';
    }

    function getOrderDate(order, long = false) {
        if (!order?.created_at) return '-';
        const locale = window.Alpine?.store?.('i18n')?.lang === 'en' ? 'en-US' : 'id-ID';
        return new Date(order.created_at).toLocaleDateString(locale, long
            ? { day: '2-digit', month: 'long', year: 'numeric' }
            : { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function updateStats(state) {
        const stats = {
            total: allOrders.length,
            pending: allOrders.filter((o) => normalizeStatus(o.status) === 'Pending').length,
            processing: allOrders.filter((o) => normalizeStatus(o.status) === 'Diproses').length,
            shipped: allOrders.filter((o) => normalizeStatus(o.status) === 'Dikirim').length,
            completed: allOrders.filter((o) => normalizeStatus(o.status) === 'Selesai').length
        };
        Object.entries(stats).forEach(([key, value]) => {
            const el = state.root?.querySelector(`[data-order-stat="${key}"]`);
            if (el) el.textContent = value;
        });
    }

    async function fetchOrders(state) {
        try {
            state.loadingMessage.textContent = 'Memuat pesanan...';
            state.loadingMessage.style.display = 'block';
            hideAdminMessage(state.adminMessageContainer);

            const { data, error } = await window.supabase
                .from('orders')
                .select('*, profiles(full_name, phone_number, email)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            allOrders = normalizeOrdersPayload(data);
            updateStats(state);
            applySortAndFilter(state);
            state.loadingMessage.style.display = 'none';
        } catch (error) {
            console.error('[ADMIN ORDER LOAD ERROR]', error);
            state.loadingMessage.textContent = 'Gagal memuat pesanan.';
            showAdminMessage(state.adminMessageContainer, 'Gagal Memuat Pesanan', AdminShared.escapeHtml(error.message || 'Unknown error'), true);
        }
    }

    function applySortAndFilter(state) {
        if (!state.ordersGrid) return;
        let processedOrders = [...allOrders];
        const orderQuery = (state.searchOrderInput?.value || '').trim().toLowerCase();
        const customerQuery = (state.searchCustomerInput?.value || '').trim().toLowerCase();
        const statusFilter = state.filterStatusSelect?.value || 'all';

        if (orderQuery) {
            processedOrders = processedOrders.filter((order) => String(order.order_code || order.id || '').toLowerCase().includes(orderQuery));
        }
        if (customerQuery) {
            processedOrders = processedOrders.filter((order) => getCustomer(order).name.toLowerCase().includes(customerQuery));
        }
        if (statusFilter !== 'all') {
            processedOrders = processedOrders.filter((order) => normalizeStatus(order.status) === statusFilter);
        }

        const timeSort = state.sortTimeSelect?.value || 'newest';
        processedOrders.sort((a, b) => {
            const dateA = new Date(a?.created_at || 0);
            const dateB = new Date(b?.created_at || 0);
            return timeSort === 'oldest' ? dateA - dateB : dateB - dateA;
        });

        renderOrders(state, processedOrders);
    }

    function paymentClass(status = '') {
        const value = String(status || '').toLowerCase();
        if (['paid', 'settlement', 'capture', 'success'].includes(value)) return 'payment-paid';
        if (['pending', 'unpaid'].includes(value)) return 'payment-pending';
        return '';
    }

    function paymentLabel(order) {
        return order.payment_status || order.transaction_status || order.payment?.status || '-';
    }

    function trackingNumber(order) {
        return order.tracking_number || order.resi || order.shipping_tracking_number || '-';
    }

    function renderOrders(state, orders) {
        state.ordersGrid.innerHTML = '';
        if (!orders.length) {
            state.ordersGrid.innerHTML = `<tr><td colspan="8" class="empty-state">${AdminShared.t('admin.orders.empty', 'Tidak ada pesanan yang sesuai filter.')}</td></tr>`;
            return;
        }

        orders.forEach((order) => {
            const customer = getCustomer(order);
            const items = getOrderItems(order);
            const orderId = order.order_code || order.id || '-';
            const row = document.createElement('tr');
            row.id = `order-${order.id}`;
            row.innerHTML = `
                <td><div class="order-code">#${AdminShared.escapeHtml(orderId)}</div><div class="order-date">${AdminShared.escapeHtml(getOrderDate(order, true))}</div></td>
                <td><button type="button" class="order-action-btn customer-drawer-btn">${AdminShared.escapeHtml(customer.name)}</button><div class="order-date">${AdminShared.escapeHtml(customer.phone)}</div></td>
                <td>${window.formatRupiah(order.total_amount || items.reduce((sum, item) => sum + item.subtotal, 0))}</td>
                <td><select class="order-status-select" data-order-id="${order.id}">${STATUS_OPTIONS.map((option) => `<option value="${option.value}" ${normalizeStatus(order.status) === option.value ? 'selected' : ''}>${option.label}</option>`).join('')}</select></td>
                <td><span class="status-badge payment-badge ${paymentClass(paymentLabel(order))}">${AdminShared.escapeHtml(paymentLabel(order))}</span></td>
                <td>${AdminShared.escapeHtml(trackingNumber(order))}</td>
                <td>${AdminShared.escapeHtml(getOrderDate(order))}</td>
                <td><button type="button" class="order-action-btn order-detail-btn">Detail</button></td>
            `;
            row.querySelector('.order-status-select')?.addEventListener('change', (event) => updateOrderStatus(state, order, event.target.value));
            row.querySelector('.customer-drawer-btn')?.addEventListener('click', () => {
                AdminShared.notify(`Customer: ${customer.name} · ${customer.email} · ${getAddress(order)}`);
            });
            row.querySelector('.order-detail-btn')?.addEventListener('click', () => {
                const summary = items.length ? items.map((item) => `${item.name} x${item.quantity}`).join(', ') : 'Tidak ada item';
                AdminShared.notify(`Order #${orderId}: ${summary}`);
            });
            state.ordersGrid.appendChild(row);
        });
    }

    async function updateOrderStatus(state, order, newStatus) {
        const previous = order.status;
        order.status = newStatus;
        updateStats(state);
        try {
            const { data, error } = await window.supabase
                .from('orders')
                .update({ status: newStatus })
                .eq('id', order.id)
                .select('id,status');
            if (error) throw error;
            if (!data || data.length === 0) throw new Error('Tidak ada baris order yang diperbarui. Periksa permission admin/RLS.');
            AdminShared.notify('Status pesanan berhasil diperbarui.');
        } catch (error) {
            order.status = previous;
            updateStats(state);
            applySortAndFilter(state);
            AdminShared.notify(`Gagal memperbarui status: ${error.message}`, true);
        }
    }

    function resetFilters(state) {
        if (state.searchOrderInput) state.searchOrderInput.value = '';
        if (state.searchCustomerInput) state.searchCustomerInput.value = '';
        if (state.filterStatusSelect) state.filterStatusSelect.value = 'all';
        if (state.sortTimeSelect) state.sortTimeSelect.value = 'newest';
        applySortAndFilter(state);
    }

    async function init() {
        await AdminShared.waitForI18n();
        const root = document.getElementById('orders-admin-root') || document;
        const state = {
            root,
            ordersGrid: document.getElementById('orders-grid'),
            loadingMessage: document.getElementById('loading-message'),
            adminMessageContainer: document.getElementById('admin-message-container'),
            sortTimeSelect: document.getElementById('sort-time'),
            filterStatusSelect: document.getElementById('filter-status'),
            searchOrderInput: document.getElementById('search-order-id'),
            searchCustomerInput: document.getElementById('search-customer'),
            resetButton: document.getElementById('reset-order-filters')
        };
        if (!state.ordersGrid || !state.loadingMessage) return;

        [state.sortTimeSelect, state.filterStatusSelect, state.searchOrderInput, state.searchCustomerInput].forEach((control) => {
            if (control && !control.dataset.listenerBound) {
                control.addEventListener(control.tagName === 'INPUT' ? 'input' : 'change', () => applySortAndFilter(state));
                control.dataset.listenerBound = 'true';
            }
        });
        if (state.resetButton && !state.resetButton.dataset.listenerBound) {
            state.resetButton.addEventListener('click', () => resetFilters(state));
            state.resetButton.dataset.listenerBound = 'true';
        }
        await fetchOrders(state);
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
    window.AdminOrdersPage.init();
});

function normalizeContentItems(data, preferredKey) {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== 'object') return [];
    return data?.[preferredKey] || data?.data || data?.items || [];
}

async function loadContentItems(table, preferredKey, label) {
    const { data, error } = await window.supabase.from(table).select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return normalizeContentItems(data, preferredKey);
}

document.addEventListener('alpine:init', () => {
    Alpine.data('contentManager', () => ({
        activeTab: 'products',
        products: [],
        news: [],
        isLoading: { products: false, news: false },
        errors: { products: '', news: '' },
        searchQuery: { products: '', news: '' },
        filters: { products: { category: 'all' }, news: { status: 'all' } },
        sort: { products: 'newest', news: 'newest' },
        selectedProducts: [],
        productPage: 1,
        newsPage: 1,
        pageSize: 8,
        bulkDiscountPercent: 10,

        init() {
            window.addEventListener('admin:global-search', (event) => {
                this.searchQuery[this.activeTab] = event.detail || '';
                this.productPage = 1;
                this.newsPage = 1;
            });
            this.switchTab(window.AdminInitialContentTab || 'products');
        },
        async switchTab(tab) {
            this.activeTab = tab;
            if (tab === 'products' && this.products.length === 0 && !this.isLoading.products) await this.loadProducts();
            if (tab === 'news' && this.news.length === 0 && !this.isLoading.news) await this.loadNews();
        },
        async loadProducts() {
            this.isLoading.products = true; this.errors.products = '';
            try { this.products = await loadContentItems('products', 'products', 'products'); }
            catch (err) { this.products = []; this.errors.products = err?.message || 'Gagal memuat produk.'; }
            finally { this.isLoading.products = false; this.selectedProducts = this.selectedProducts.filter((id) => this.products.some((product) => product.id === id)); }
        },
        async loadNews() {
            this.isLoading.news = true; this.errors.news = '';
            try { this.news = await loadContentItems('news', 'news', 'news'); }
            catch (err) { this.news = []; this.errors.news = err?.message || 'Gagal memuat berita.'; }
            finally { this.isLoading.news = false; }
        },
        displayName(value, fallback = '-') { return AdminShared.getLocalized(value, fallback); },
        isPublished(item) {
            if (typeof item?.is_published === 'boolean') return item.is_published;
            if (typeof item?.published === 'boolean') return item.published;
            const status = String(item?.status || '').toLowerCase();
            return status ? ['published', 'active', 'publish'].includes(status) : true;
        },
        get productCategories() {
            return [...new Set(this.products.map((product) => product?.category).filter(Boolean))].sort();
        },
        get filteredProducts() {
            const query = this.searchQuery.products.trim().toLowerCase();
            let rows = this.products.filter((product) => {
                const name = AdminShared.getLocalized(product?.name, '');
                const matchesQuery = !query || String(name).toLowerCase().includes(query) || String(product?.category || '').toLowerCase().includes(query);
                const matchesCategory = this.filters.products.category === 'all' || product?.category === this.filters.products.category;
                return matchesQuery && matchesCategory;
            });
            rows = [...rows].sort((a, b) => {
                if (this.sort.products === 'name') return this.displayName(a.name, '').localeCompare(this.displayName(b.name, ''));
                if (this.sort.products === 'priceAsc') return Number(a.price || 0) - Number(b.price || 0);
                if (this.sort.products === 'priceDesc') return Number(b.price || 0) - Number(a.price || 0);
                if (this.sort.products === 'stockAsc') return Number(a.stock ?? a.quantity ?? 0) - Number(b.stock ?? b.quantity ?? 0);
                return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            });
            return rows;
        },
        get productTotalPages() { return Math.max(1, Math.ceil(this.filteredProducts.length / this.pageSize)); },
        get paginatedProducts() {
            if (this.productPage > this.productTotalPages) this.productPage = this.productTotalPages;
            const start = (this.productPage - 1) * this.pageSize;
            return this.filteredProducts.slice(start, start + this.pageSize);
        },
        get pageProductIds() { return this.paginatedProducts.map((product) => product.id); },
        get filteredNews() {
            const query = this.searchQuery.news.trim().toLowerCase();
            let rows = this.news.filter((item) => {
                const title = AdminShared.getLocalized(item?.title, '');
                const excerpt = AdminShared.getLocalized(item?.excerpt, '');
                const status = this.isPublished(item) ? 'published' : 'draft';
                return (!query || String(title).toLowerCase().includes(query) || String(excerpt).toLowerCase().includes(query)) && (this.filters.news.status === 'all' || this.filters.news.status === status);
            });
            rows = [...rows].sort((a, b) => this.sort.news === 'title' ? this.displayName(a.title, '').localeCompare(this.displayName(b.title, '')) : new Date(b.created_at || 0) - new Date(a.created_at || 0));
            return rows;
        },
        get newsTotalPages() { return Math.max(1, Math.ceil(this.filteredNews.length / this.pageSize)); },
        get paginatedNews() {
            if (this.newsPage > this.newsTotalPages) this.newsPage = this.newsTotalPages;
            const start = (this.newsPage - 1) * this.pageSize;
            return this.filteredNews.slice(start, start + this.pageSize);
        },
        resetProductsView() { this.searchQuery.products = ''; this.filters.products.category = 'all'; this.sort.products = 'newest'; this.productPage = 1; },
        resetNewsView() { this.searchQuery.news = ''; this.filters.news.status = 'all'; this.sort.news = 'newest'; this.newsPage = 1; },
        toggleProductPage(checked) {
            const ids = this.pageProductIds;
            this.selectedProducts = checked ? [...new Set([...this.selectedProducts, ...ids])] : this.selectedProducts.filter((id) => !ids.includes(id));
        },
        async bulkDeleteProducts() {
            if (!this.selectedProducts.length || !window.confirm(`Hapus ${this.selectedProducts.length} produk terpilih?`)) return;
            const { error } = await window.supabase.from('products').delete().in('id', this.selectedProducts);
            if (error) { AdminShared.notify(`Gagal bulk delete: ${error.message}`, true); return; }
            this.selectedProducts = [];
            AdminShared.notify('Produk terpilih berhasil dihapus.');
            await this.loadProducts();
        },
        async bulkPublishProducts() {
            if (!this.selectedProducts.length) return;
            const sample = this.products.find((product) => this.selectedProducts.includes(product.id)) || {};
            const payload = Object.prototype.hasOwnProperty.call(sample, 'is_published') ? { is_published: true } : { status: 'published' };
            const { error } = await window.supabase.from('products').update(payload).in('id', this.selectedProducts);
            if (error) { AdminShared.notify(`Gagal bulk publish: ${error.message}`, true); return; }
            this.selectedProducts = [];
            AdminShared.notify('Produk terpilih berhasil dipublish.');
            await this.loadProducts();
        },
        async deleteItem(id, imageUrl) {
            const isNews = this.activeTab === 'news';
            const table = isNews ? 'news' : 'products';
            if (!window.confirm(`Hapus ${isNews ? 'berita' : 'produk'} ini?`)) return;
            const { error } = await window.supabase.from(table).delete().eq('id', id);
            if (error) { AdminShared.notify(`Gagal menghapus data: ${error.message}`, true); return; }
            if (typeof window.deleteImageFromStorage === 'function' && imageUrl) await window.deleteImageFromStorage(imageUrl);
            AdminShared.notify(`${isNews ? 'Berita' : 'Produk'} berhasil dihapus.`);
            if (isNews) await this.loadNews(); else await this.loadProducts();
        },
        async applyBulkDiscount() {
            const percent = Number(this.bulkDiscountPercent);
            if (!Number.isFinite(percent) || percent < 1 || percent > 90) { AdminShared.notify('Persentase diskon harus di antara 1 hingga 90.', true); return; }
            const eligibleProducts = this.products.filter((product) => !product?.discount_price);
            for (const product of eligibleProducts) {
                const discountPrice = Math.max(0, Math.round(Number(product.price || 0) * (1 - percent / 100)));
                const { error } = await window.supabase.from('products').update({ discount_price: discountPrice }).eq('id', product.id);
                if (error) { AdminShared.notify(`Gagal menerapkan diskon: ${error.message}`, true); return; }
            }
            AdminShared.notify(`Diskon ${percent}% berhasil diterapkan.`);
            await this.loadProducts();
        }
    }));
});
