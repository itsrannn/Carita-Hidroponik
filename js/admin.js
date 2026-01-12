// js/admin.js

const ordersGrid = document.getElementById('orders-grid');
const loadingMessage = document.getElementById('loading-message');
const adminMessageContainer = document.getElementById('admin-message-container');
const sortTimeSelect = document.getElementById('sort-time');
const filterStatusSelect = document.getElementById('filter-status');

let allOrders = [];

function showAdminMessage(title, message) {
    adminMessageContainer.innerHTML = `
        <div style="padding: 1rem; background-color: #fff3cd; border: 1px solid #ffeeba; border-radius: 8px;">
            <h4 style="margin-top: 0; color: #856404;">${title}</h4>
            <p style="margin-bottom: 0;">${message}</p>
        </div>
    `;
    adminMessageContainer.style.display = 'block';
}

async function fetchOrders() {
    window.showLoader();
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
            loadingMessage.textContent = 'No orders found.';
            showAdminMessage(
                'No Orders Found',
                'This could be because:<br>1. No orders have been placed yet.<br>2. You are not registered as an admin.<br>3. RLS policies are incorrect.'
            );
            return;
        }

        allOrders = orders;
        applySortAndFilter();
        loadingMessage.style.display = 'none';

    } catch (error) {
        loadingMessage.textContent = 'Failed to load orders.';
        showAdminMessage(
            'Failed to Load Orders',
            `An error occurred: <strong>${error.message}</strong><br>Ensure you are logged in & have a stable internet connection.`
        );
    } finally {
        window.hideLoader();
    }
}

function applySortAndFilter() {
    ordersGrid.innerHTML = '';
    let processedOrders = [...allOrders];

    const statusFilter = filterStatusSelect.value;
    if (statusFilter !== 'all') {
        processedOrders = processedOrders.filter(order => order.status === statusFilter);
    }

    const timeSort = sortTimeSelect.value;
    processedOrders.sort((a, b) => {
        const dateA = new Date(a.created_at);
        const dateB = new Date(b.created_at);
        return timeSort === 'newest' ? dateB - dateA : dateA - dateB;
    });

    renderOrders(processedOrders);
}

function renderOrders(orders) {
    ordersGrid.innerHTML = '';
    const t = Alpine.store('i18n').t;

    if (orders.length === 0) {
        ordersGrid.innerHTML = `<p>${t('admin.orders.empty') || 'No orders match your filter criteria.'}</p>`;
        return;
    }

    orders.forEach(order => {
        const card = document.createElement('div');
        card.className = 'admin-order-card';
        card.id = `order-${order.id}`;

        let itemsList = `<li>${t('admin.orders.card.noItems') || 'No items found'}</li>`;
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
                    <h3>${t('account.orders.orderId')} #${order.order_code || order.id}</h3>
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
        addActions(actionsContainer, order);
        ordersGrid.appendChild(card);
    });
}

function addActions(cell, order) {
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
            const actionBtn = createButton(actionText, () => updateOrderStatus(order, action), buttonClass);
            cell.appendChild(actionBtn);
        });
    } else if (order.status === 'Selesai' || order.status === 'Ditolak'){
        cell.textContent = window.translateStatus(order.status);
    } else {
        cell.textContent = t('admin.orders.card.noActions') || 'No actions available';
    }
}

function createButton(text, onClick, a_class) {
    const button = document.createElement('button');
    button.textContent = text;
    button.onclick = onClick;
    button.className = `btn-admin ${a_class}`;
    return button;
}

async function updateOrderStatus(order, newStatus) {
    window.showLoader();
    try {
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
        applySortAndFilter();
    } finally {
        window.hideLoader();
    }
}

sortTimeSelect.addEventListener('change', applySortAndFilter);
filterStatusSelect.addEventListener('change', applySortAndFilter);

fetchOrders();
