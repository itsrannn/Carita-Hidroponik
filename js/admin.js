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

    async function fetchOrders(state) {
        try {
            const { data: orders, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    profiles (
                        full_name,
                        phone_number
                    )
                `);
            if (error) throw error;

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
        let processedOrders = [...allOrders];

        const statusFilter = state.filterStatusSelect.value;
        if (statusFilter !== 'all') {
            processedOrders = processedOrders.filter(order => order.status === statusFilter);
        }

        const timeSort = state.sortTimeSelect.value;
        processedOrders.sort((a, b) => {
            const dateA = new Date(a.created_at);
            const dateB = new Date(b.created_at);
            return timeSort === 'newest' ? dateB - dateA : dateA - dateB;
        });

        renderOrders(state, processedOrders);
    }

    function renderOrders(state, orders) {
        state.ordersGrid.innerHTML = '';
        const t = Alpine.store('i18n').t;

        if (orders.length === 0) {
            state.ordersGrid.innerHTML = `<p>${t('admin.orders.empty')}</p>`;
            return;
        }

        orders.forEach(order => {
            const card = document.createElement('div');
            card.className = 'admin-order-card';
            card.id = `order-${order.id}`;

            let itemsList = `<li>${t('admin.orders.card.noItems')}</li>`;
            const orderItems = order.order_details || order.items;
            if (orderItems && orderItems.length > 0) {
                itemsList = orderItems.map(item => `<li>${item.name} (x${item.quantity})</li>`).join('');
            }

            const profile = order.profiles;
            const customerInfo = profile ? `${profile.full_name || 'Name not available'} <br><small>(${profile.phone_number || 'Phone not available'})</small>` : 'Customer not found';

            let addressInfo = 'Address not available';
            if (order.shipping_address) {
                const addr = order.shipping_address;
                const addressParts = [addr.address, addr.village, addr.district, addr.regency, addr.province, addr.postal_code];
                addressInfo = addressParts.filter(part => part).join(', ');
            }

            const orderDate = new Date(order.created_at).toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' });

            card.innerHTML = `
                <div class="admin-order-card">
                    <div class="order-header">
                        <h3>${t('admin.orders.orderIdLabel')} #${order.order_code || order.id}</h3>
                        <span class="status-badge status-${(order.status || '').toLowerCase().replace(/\s+/g, '-')}">${window.translateStatus(order.status)}</span>
                    </div>
                    <div class="order-body">
                        <div class="info-group"><label>${t('admin.dashboard.transactions.date')}</label><p>${orderDate}</p></div>
                        <div class="info-group"><label>${t('admin.dashboard.transactions.customer')}</label><p>${customerInfo}</p></div>
                        <div class="info-group"><label>${t('admin.orders.card.shippingAddress')}</label><p>${addressInfo}</p></div>
                        <div class="info-group"><label>${t('admin.orders.card.orderSummary')}</label><ul>${itemsList}</ul></div>
                    </div>
                    <div class="order-footer action-buttons"></div>
                </div>
            `;

            const actionsContainer = card.querySelector('.action-buttons');
            addActions(state, actionsContainer, order);
            state.ordersGrid.appendChild(card);
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
                const actionText = t(actionKey, window.translateStatus(action));
                const actionBtn = createButton(actionText, () => updateOrderStatus(state, order, action), buttonClass);
                cell.appendChild(actionBtn);
            });
        } else if (order.status === 'Selesai' || order.status === 'Ditolak') {
            cell.textContent = window.translateStatus(order.status);
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
