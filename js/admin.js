// js/admin.js

window.AdminOrdersPage = (() => {
    let allOrders = [];

    function showAdminMessage(container, title, message) {
        if (!container) return;
        container.innerHTML = `
            <div style="padding: 1rem; background-color: #fff3cd; border: 1px solid #ffeeba; border-radius: 8px;">
                <h4 style="margin-top: 0; color: #856404;">${title}</h4>
                <p style="margin-bottom: 0;">${message}</p>
            </div>
        `;
        container.style.display = 'block';
    }

    function safeTranslateStatus(status) {
        if (typeof window.translateStatus === 'function') {
            return window.translateStatus(status);
        }
        return status || '-';
    }

    function normalizeOrdersPayload(data) {
        return data?.orders || data?.data || (Array.isArray(data) ? data : []);
    }

    async function fetchOrders(state) {
        console.log('[ADMIN] fetch orders start');
        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    profiles (
                        full_name,
                        phone_number
                    )
                `);

            console.log('[ADMIN] API response', { data, error });
            if (error) throw error;

            const orders = normalizeOrdersPayload(data);
            console.log('[ADMIN] normalized orders', orders);

            if (!orders || orders.length === 0) {
                state.loadingMessage.textContent = 'No orders found.';
                showAdminMessage(
                    state.adminMessageContainer,
                    'No Orders Found',
                    'This could be because:<br>1. No orders have been placed yet.<br>2. You are not registered as an admin.<br>3. RLS policies are incorrect.'
                );
                return;
            }

            allOrders = orders;
            applySortAndFilter(state);
            state.loadingMessage.style.display = 'none';
        } catch (error) {
            console.error('[ADMIN ERROR]', error);
            state.loadingMessage.textContent = 'Failed to load orders.';
            showAdminMessage(
                state.adminMessageContainer,
                'Failed to Load Orders',
                `An error occurred: <strong>${error.message}</strong><br>Ensure you are logged in & have a stable internet connection.`
            );
        }
    }

    function applySortAndFilter(state) {
        if (!state.ordersGrid || !state.sortTimeSelect || !state.filterStatusSelect) return;

        state.ordersGrid.innerHTML = '';
        let processedOrders = Array.isArray(allOrders) ? [...allOrders] : [];

        const statusFilter = state.filterStatusSelect.value;
        if (statusFilter !== 'all') {
            processedOrders = processedOrders.filter(order => order?.status === statusFilter);
        }

        const timeSort = state.sortTimeSelect.value;
        processedOrders.sort((a, b) => {
            const dateA = new Date(a?.created_at || 0);
            const dateB = new Date(b?.created_at || 0);
            return timeSort === 'newest' ? dateB - dateA : dateA - dateB;
        });

        try {
            renderOrders(state, processedOrders);
        } catch (err) {
            console.error('[ADMIN ORDER RENDER ERROR]', err);
            showAdminMessage(
                state.adminMessageContainer,
                'Order Render Error',
                'Some order data failed to render. Check console for details.'
            );
        }
    }

    function renderOrders(state, orders) {
        state.ordersGrid.innerHTML = '';
        const t = Alpine.store('i18n').t;
        const safeOrders = Array.isArray(orders) ? orders : [];

        if (safeOrders.length === 0) {
            state.ordersGrid.innerHTML = `<p>${t('admin.orders.empty')}</p>`;
            return;
        }

        safeOrders.forEach(order => {
            try {
                const card = document.createElement('div');
                card.className = 'admin-order-card card';
                card.id = `order-${order?.id || 'unknown'}`;

                let itemsList = `<li>${t('admin.orders.card.noItems')}</li>`;
                const orderItems = order?.order_details || order?.items;
                if (Array.isArray(orderItems) && orderItems.length > 0) {
                    itemsList = orderItems.map(item => `<li>${item?.name || '-'} (x${item?.quantity || 0})</li>`).join('');
                }

                const profile = order?.profiles;
                const customerInfo = profile ? `${profile.full_name || 'Name not available'} <br><small>(${profile.phone_number || 'Phone not available'})</small>` : 'Customer not found';

                let addressInfo = 'Address not available';
                if (order?.shipping_address) {
                    const addr = order.shipping_address;
                    const addressParts = [addr.address, addr.village, addr.district, addr.regency, addr.province, addr.postal_code];
                    addressInfo = addressParts.filter(part => part).join(', ');
                }

                const orderDate = order?.created_at
                    ? new Date(order.created_at).toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' })
                    : '-';

                card.innerHTML = `
                    <div class="order-header">
                        <h3>${t('admin.orders.orderIdLabel')} #${order?.order_code || order?.id || '-'}</h3>
                        <span class="status-badge status-${(order?.status || '').toLowerCase().replace(/\s+/g, '-')}">${safeTranslateStatus(order?.status)}</span>
                    </div>
                    <div class="order-body card-content">
                        <div class="info-group"><label>${t('admin.dashboard.transactions.date')}</label><p>${orderDate}</p></div>
                        <div class="info-group"><label>${t('admin.dashboard.transactions.customer')}</label><p>${customerInfo}</p></div>
                        <div class="info-group"><label>${t('admin.orders.card.shippingAddress')}</label><p>${addressInfo}</p></div>
                        <div class="info-group"><label>${t('admin.orders.card.orderSummary')}</label><ul>${itemsList}</ul></div>
                    </div>
                    <div class="order-footer action-buttons"></div>
                `;

                const actionsContainer = card.querySelector('.action-buttons');
                addActions(state, actionsContainer, order || {});
                state.ordersGrid.appendChild(card);
            } catch (err) {
                console.error('[ADMIN ORDER ITEM RENDER ERROR]', { err, order });
            }
        });
    }

    function addActions(state, cell, order) {
        cell.innerHTML = '';
        const t = Alpine.store('i18n').t;

        const statusTransitions = {
            'Menunggu Konfirmasi': ['Diproses', 'Ditolak'],
            'Diproses': ['Dalam Pengiriman'],
            'Dalam Pengiriman': ['Selesai']
        };

        const availableActions = statusTransitions[order.status];
        if (availableActions) {
            availableActions.forEach(action => {
                const buttonClass = action === 'Ditolak' ? 'btn-admin-reject' : 'btn-admin-approve';
                const actionKey = `admin.orders.status.${action.toLowerCase().replace(/\s+/g, '-')}`;
                const actionText = t(actionKey, safeTranslateStatus(action));
                const actionBtn = createButton(actionText, () => updateOrderStatus(state, order, action), buttonClass);
                cell.appendChild(actionBtn);
            });
        } else if (order.status === 'Selesai' || order.status === 'Ditolak') {
            cell.textContent = safeTranslateStatus(order.status);
        } else {
            cell.textContent = t('admin.orders.card.noActions');
        }
    }

    function createButton(text, onClick, aClass) {
        const button = document.createElement('button');
        button.textContent = text;
        button.onclick = onClick;
        button.className = `btn-admin ${aClass}`;
        return button;
    }

    async function updateOrderStatus(state, order, newStatus) {
        const { data, error } = await supabase.from('orders').update({ status: newStatus }).eq('id', order.id).select();
        if (error) {
            alert(`Failed to update order status: ${error.message}`);
            return;
        }
        if (!data || data.length === 0) {
            alert('Update Failed: You may not have permission to change this order.');
            return;
        }

        alert('Order status updated successfully.');
        const orderInState = allOrders.find(o => o.id === order.id);
        if (orderInState) {
            orderInState.status = newStatus;
        }
        applySortAndFilter(state);
    }

    function init() {
        const state = {
            ordersGrid: document.getElementById('orders-grid'),
            loadingMessage: document.getElementById('loading-message'),
            adminMessageContainer: document.getElementById('admin-message-container'),
            sortTimeSelect: document.getElementById('sort-time'),
            filterStatusSelect: document.getElementById('filter-status')
        };

        if (!state.ordersGrid || !state.loadingMessage || !state.sortTimeSelect || !state.filterStatusSelect) {
            return;
        }

        if (!state.sortTimeSelect.dataset.listenerBound) {
            state.sortTimeSelect.addEventListener('change', () => applySortAndFilter(state));
            state.sortTimeSelect.dataset.listenerBound = 'true';
        }

        if (!state.filterStatusSelect.dataset.listenerBound) {
            state.filterStatusSelect.addEventListener('change', () => applySortAndFilter(state));
            state.filterStatusSelect.dataset.listenerBound = 'true';
        }

        fetchOrders(state);
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
    console.log(`[ADMIN CONTENT] Loading ${label}...`);
    const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false });
    if (error) throw error;
    console.log(`[ADMIN CONTENT] ${label} response:`, data);
    const items = normalizeContentItems(data, preferredKey);
    console.log(`[ADMIN CONTENT] ${label} parsed:`, items);
    return Array.isArray(items) ? items : [];
}

document.addEventListener('alpine:init', () => {
    Alpine.data('contentManager', () => ({
        activeTab: 'products',
        products: [],
        news: [],
        isLoading: {
            products: false,
            news: false
        },
        errors: {
            products: '',
            news: ''
        },
        searchQuery: {
            products: '',
            news: ''
        },
        bulkDiscountPercent: 10,

        init() {
            this.switchTab('products');
        },

        async switchTab(tab) {
            this.activeTab = tab;
            if (tab === 'products' && this.products.length === 0 && !this.isLoading.products) {
                await this.loadProducts();
            }
            if (tab === 'news' && this.news.length === 0 && !this.isLoading.news) {
                await this.loadNews();
            }
        },

        async loadProducts() {
            this.isLoading.products = true;
            this.errors.products = '';
            try {
                this.products = await loadContentItems('products', 'products', 'products');
            } catch (err) {
                console.error('[PRODUCT LOAD ERROR]', err);
                this.products = [];
                this.errors.products = err?.message || 'Gagal memuat produk.';
            } finally {
                this.isLoading.products = false;
            }
        },

        async loadNews() {
            this.isLoading.news = true;
            this.errors.news = '';
            try {
                this.news = await loadContentItems('news', 'news', 'news');
            } catch (err) {
                console.error('[NEWS LOAD ERROR]', err);
                this.news = [];
                this.errors.news = err?.message || 'Gagal memuat berita.';
            } finally {
                this.isLoading.news = false;
            }
        },

        get filteredProducts() {
            const query = this.searchQuery.products.trim().toLowerCase();
            if (!query) return this.products;
            return this.products.filter((product) => {
                const name = product?.name?.en || product?.name?.id || product?.name || '';
                const category = product?.category || '';
                return String(name).toLowerCase().includes(query) || String(category).toLowerCase().includes(query);
            });
        },

        get filteredNews() {
            const query = this.searchQuery.news.trim().toLowerCase();
            if (!query) return this.news;
            return this.news.filter((item) => {
                const title = item?.title?.en || item?.title?.id || item?.title || '';
                const excerpt = item?.excerpt?.en || item?.excerpt?.id || item?.excerpt || '';
                return String(title).toLowerCase().includes(query) || String(excerpt).toLowerCase().includes(query);
            });
        },

        async deleteItem(id, imageUrl) {
            const isNews = this.activeTab === 'news';
            const table = isNews ? 'news' : 'products';
            const confirmed = window.confirm(`Hapus ${isNews ? 'berita' : 'produk'} ini?`);
            if (!confirmed) return;

            const { error } = await supabase.from(table).delete().eq('id', id);
            if (error) {
                window.showNotification(`Gagal menghapus data: ${error.message}`, true);
                return;
            }

            if (typeof window.deleteImageFromStorage === 'function' && imageUrl) {
                await window.deleteImageFromStorage(imageUrl);
            }

            window.showNotification(`${isNews ? 'Berita' : 'Produk'} berhasil dihapus.`);
            if (isNews) {
                await this.loadNews();
            } else {
                await this.loadProducts();
            }
        },

        async applyBulkDiscount() {
            const percent = Number(this.bulkDiscountPercent);
            if (!Number.isFinite(percent) || percent < 1 || percent > 90) {
                window.showNotification('Persentase diskon harus di antara 1 hingga 90.', true);
                return;
            }

            const eligibleProducts = this.products.filter((product) => !product?.discount_price);
            if (eligibleProducts.length === 0) {
                window.showNotification('Tidak ada produk yang memenuhi syarat untuk diskon massal.');
                return;
            }

            for (const product of eligibleProducts) {
                const discountPrice = Math.max(0, Math.round(product.price * (1 - percent / 100)));
                const { error } = await supabase
                    .from('products')
                    .update({ discount_price: discountPrice })
                    .eq('id', product.id);
                if (error) {
                    window.showNotification(`Gagal menerapkan diskon: ${error.message}`, true);
                    return;
                }
            }

            window.showNotification(`Diskon ${percent}% berhasil diterapkan.`);
            await this.loadProducts();
        }
    }));
});
