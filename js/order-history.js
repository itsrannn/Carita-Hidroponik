document.addEventListener('DOMContentLoaded', async () => {
    if (!window.supabase) {
        return;
    }

    const orderListContainer = document.getElementById('order-list-container');
    const loadingMessage = document.getElementById('loading-message');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        loadingMessage.innerHTML = 'You must be logged in to view your order history. Redirecting to login page...';
        setTimeout(() => {
            window.location.href = 'login page.html';
        }, 3000);
        return;
    }
    const user = session.user;

    function getStatusClass(status) {
        if (!status) return 'status-default';
        return `status-${status.toLowerCase().replace(/\s+/g, '-')}`;
    }

    function renderOrders(orders) {
        orderListContainer.innerHTML = '';
        if (!orders || orders.length === 0) {
            orderListContainer.innerHTML = '<p>You have no order history.</p>';
            return;
        }

        orders.forEach(order => {
            const orderCard = document.createElement('div');
            orderCard.className = 'order-card';
            orderCard.id = `order-${order.id}`;

            const orderDate = new Date(order.created_at).toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });

            let itemsHtml = '<p>Order details not available.</p>';
            const orderItems = order.order_details || order.items;
            if (orderItems && Array.isArray(orderItems) && orderItems.length > 0) {
                itemsHtml = orderItems.map(item => {
                    if (item.name && item.quantity) {
                        return `
                            <div class="item">
                                <div class="item-info">
                                    <div class="item-name">${item.name}</div>
                                    <div class="item-qty">Quantity: ${item.quantity}</div>
                                </div>
                            </div>
                        `;
                    }
                    return '';
                }).join('');
            }

            const statusText = window.translateStatus(order.status) || 'Not Updated';
            const statusClass = getStatusClass(order.status);

            orderCard.innerHTML = `
                <div class="order-header">
                    <div>
                        <div class="order-code">Order ID: ${order.order_code || order.id}</div>
                        <div class="order-date">${orderDate}</div>
                    </div>
                    <div class="order-status ${statusClass}">${statusText}</div>
                </div>
                <div class="order-body">
                    <strong>Order Summary:</strong>
                    ${itemsHtml}
                </div>
                <div class="order-footer">
                    <strong>Total:</strong> ${window.formatRupiah(order.total_amount) || 'N/A'}
                </div>
            `;
            orderListContainer.appendChild(orderCard);
        });
    }

    async function fetchOrders() {
        try {
            const { data: orders, error } = await supabase
                .from('orders')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            loadingMessage.style.display = 'none';
            renderOrders(orders);
        } catch (error) {
            loadingMessage.textContent = 'Failed to load order history.';
        }
    }

    fetchOrders();

    const subscription = supabase
        .channel('public:orders')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `user_id=eq.${user.id}`
        }, payload => {
            fetchOrders();
        })
        .subscribe();

    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {
                const { error } = await supabase.auth.signOut();
                if (error) throw error;
                window.location.href = 'login page.html';
            } catch (error) {
                alert('Error logging out: ' + error.message);
            }
        });
    }
});
