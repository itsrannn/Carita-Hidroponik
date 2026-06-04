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

    function renderOrders(state, orders) {
        state.ordersGrid.innerHTML = '';
        if (!orders.length) {
            state.ordersGrid.innerHTML = `<div class="empty-state">${AdminShared.t('admin.orders.empty', 'Tidak ada pesanan yang sesuai filter.')}</div>`;
            return;
        }

        orders.forEach((order) => {
            const customer = getCustomer(order);
            const items = getOrderItems(order);
            const orderId = order.order_code || order.id || '-';
            const card = document.createElement('article');
            card.className = 'admin-order-card compact-card';
            card.id = `order-${order.id}`;
            const isOpen = activeOrderId === order.id;
            card.innerHTML = `
                <button type="button" class="order-summary-toggle" aria-expanded="${isOpen}">
                    <div>
                        <div class="order-code">#${AdminShared.escapeHtml(orderId)}</div>
                        <div class="order-customer">${AdminShared.escapeHtml(customer.name)}</div>
                        <div class="order-date">${AdminShared.escapeHtml(getOrderDate(order, true))}</div>
                    </div>
                    <span class="status-badge status-${statusClass(order.status)}">${AdminShared.escapeHtml(statusLabel(order.status))}</span>
                </button>
                <div class="order-detail-panel" ${isOpen ? '' : 'hidden'}>
                    <div class="detail-grid">
                        <section class="detail-box">
                            <h4>Informasi Customer</h4>
                            <p><strong>Nama:</strong> ${AdminShared.escapeHtml(customer.name)}</p>
                            <p><strong>Telepon:</strong> ${AdminShared.escapeHtml(customer.phone)}</p>
                            <p><strong>Email:</strong> ${AdminShared.escapeHtml(customer.email)}</p>
                        </section>
                        <section class="detail-box">
                            <h4>Informasi Pengiriman</h4>
                            <p><strong>Alamat:</strong> ${AdminShared.escapeHtml(getAddress(order))}</p>
                            <p><strong>Zona Ongkir:</strong> ${AdminShared.escapeHtml(getShippingZone(order))}</p>
                        </section>
                    </div>
                    <section class="detail-box order-items-box">
                        <h4>Ringkasan Pesanan</h4>
                        <div class="order-items-table-wrap">
                            <table class="order-items-table">
                                <thead><tr><th>Produk</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead>
                                <tbody>${items.length ? items.map((item) => `<tr><td>${AdminShared.escapeHtml(item.name)}</td><td>${item.quantity}</td><td>${window.formatRupiah(item.price)}</td><td>${window.formatRupiah(item.subtotal)}</td></tr>`).join('') : '<tr><td colspan="4">Tidak ada item.</td></tr>'}</tbody>
                                <tfoot><tr><td colspan="3">Total</td><td>${window.formatRupiah(order.total_amount || items.reduce((sum, item) => sum + item.subtotal, 0))}</td></tr></tfoot>
                            </table>
                        </div>
                    </section>
                    <section class="detail-box status-editor-box">
                        <label for="status-${order.id}">Status Pesanan</label>
                        <select id="status-${order.id}" class="order-status-select" data-order-id="${order.id}">
                            ${STATUS_OPTIONS.map((option) => `<option value="${option.value}" ${normalizeStatus(order.status) === option.value ? 'selected' : ''}>${option.label}</option>`).join('')}
                        </select>
                    </section>
                </div>
            `;
            card.querySelector('.order-summary-toggle').addEventListener('click', () => {
                activeOrderId = activeOrderId === order.id ? null : order.id;
                renderOrders(state, orders);
            });
            card.querySelector('.order-status-select')?.addEventListener('change', (event) => updateOrderStatus(state, order, event.target.value));
            state.ordersGrid.appendChild(card);
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
        bulkDiscountPercent: 10,

        init() { this.switchTab('products'); },
        async switchTab(tab) {
            this.activeTab = tab;
            if (tab === 'products' && this.products.length === 0 && !this.isLoading.products) await this.loadProducts();
            if (tab === 'news' && this.news.length === 0 && !this.isLoading.news) await this.loadNews();
        },
        async loadProducts() {
            this.isLoading.products = true; this.errors.products = '';
            try { this.products = await loadContentItems('products', 'products', 'products'); }
            catch (err) { this.products = []; this.errors.products = err?.message || 'Gagal memuat produk.'; }
            finally { this.isLoading.products = false; }
        },
        async loadNews() {
            this.isLoading.news = true; this.errors.news = '';
            try { this.news = await loadContentItems('news', 'news', 'news'); }
            catch (err) { this.news = []; this.errors.news = err?.message || 'Gagal memuat berita.'; }
            finally { this.isLoading.news = false; }
        },
        get filteredProducts() {
            const query = this.searchQuery.products.trim().toLowerCase();
            if (!query) return this.products;
            return this.products.filter((product) => {
                const name = AdminShared.getLocalized(product?.name, '');
                return String(name).toLowerCase().includes(query) || String(product?.category || '').toLowerCase().includes(query);
            });
        },
        get filteredNews() {
            const query = this.searchQuery.news.trim().toLowerCase();
            if (!query) return this.news;
            return this.news.filter((item) => {
                const title = AdminShared.getLocalized(item?.title, '');
                const excerpt = AdminShared.getLocalized(item?.excerpt, '');
                return String(title).toLowerCase().includes(query) || String(excerpt).toLowerCase().includes(query);
            });
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
