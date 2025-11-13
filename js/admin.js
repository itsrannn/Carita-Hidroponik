// js/admin.js

document.addEventListener('DOMContentLoaded', async () => {
    const ordersTableBody = document.getElementById('orders-table-body');
    const loadingMessage = document.getElementById('loading-message');

    async function fetchOrders() {
        try {
            // Fetch all orders. Assumes RLS is set up for admin role.
            const { data: orders, error } = await supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (orders.length === 0) {
                loadingMessage.textContent = 'Tidak ada pesanan yang ditemukan.';
                return;
            }

            renderOrders(orders);
            loadingMessage.style.display = 'none';
        } catch (error) {
            console.error('Error fetching orders:', error);
            loadingMessage.textContent = 'Gagal memuat pesanan.';
        }
    }

    function renderOrders(orders) {
        ordersTableBody.innerHTML = ''; // Clear existing rows

        orders.forEach(order => {
            const tr = document.createElement('tr');

            // Create a summary of the order items from 'order_details'
            let summary = 'Tidak ada item';
            if (order.order_details && order.order_details.length > 0) {
                summary = order.order_details.map(item => `${item.name} (x${item.quantity})`).join(', ');
            }

            tr.innerHTML = `
                <td>${order.order_code || order.id}</td>
                <td>${summary}</td>
                <td><span class="status-${order.status.toLowerCase().replace(/\s+/g, '-')}">${order.status}</span></td>
                <td class="action-buttons">
                    <!-- Action buttons will be dynamically inserted here -->
                </td>
            `;

            const actionsCell = tr.querySelector('.action-buttons');
            addActions(actionsCell, order);

            ordersTableBody.appendChild(tr);
        });
    }

    function addActions(cell, order) {
        cell.innerHTML = ''; // Clear previous buttons

        // Map status to potential next statuses
        const statusTransitions = {
            'Menunggu Konfirmasi': ['Diproses', 'Ditolak'],
            'Diproses': ['Dalam Pengiriman'],
            'Dalam Pengiriman': ['Selesai']
        };

        const availableActions = statusTransitions[order.status];

        if (availableActions) {
            availableActions.forEach(action => {
                const actionBtn = createButton(action, () => updateOrderStatus(order.id, action));
                cell.appendChild(actionBtn);
            });
        } else {
            // For 'Ditolak' and 'Selesai', no more actions
            cell.textContent = 'Selesai';
        }
    }

    function createButton(text, onClick) {
        const button = document.createElement('button');
        button.textContent = text;
        button.onclick = onClick;
        return button;
    }

    async function updateOrderStatus(orderId, newStatus) {
        const { error } = await supabase
            .from('orders')
            .update({ status: newStatus })
            .eq('id', orderId);

        if (error) {
            console.error('Error updating status:', error);
            alert('Gagal memperbarui status pesanan.');
        } else {
            alert('Status pesanan berhasil diperbarui.');
            fetchOrders(); // Refresh the list
        }
    }

    // Initial fetch
    fetchOrders();
});
