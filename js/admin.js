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

            const customerName = order.shipping_address?.full_name || 'N/A';
            const total = `Rp ${order.total_amount.toLocaleString('id-ID')}`;
            const date = new Date(order.created_at).toLocaleDateString('id-ID');

            tr.innerHTML = `
                <td>${order.order_code}</td>
                <td>${customerName}</td>
                <td>${total}</td>
                <td>${order.status}</td>
                <td>${date}</td>
                <td class="action-buttons">
                    <!-- Action buttons will be added here -->
                </td>
            `;

            // Add action buttons based on status
            const actionsCell = tr.querySelector('.action-buttons');
            addActions(actionsCell, order);

            ordersTableBody.appendChild(tr);
        });
    }

    function addActions(cell, order) {
        // Clear previous buttons
        cell.innerHTML = '';

        if (order.status === 'Menunggu Konfirmasi') {
            const acceptBtn = createButton('Terima', () => updateOrderStatus(order.id, 'Diterima'));
            const rejectBtn = createButton('Tolak', () => updateOrderStatus(order.id, 'Ditolak'));
            cell.append(acceptBtn, rejectBtn);
        } else if (order.status === 'Diterima') {
            const shipBtn = createButton('Kirim', () => handleShipping(order.id));
            cell.append(shipBtn);
        } else if (order.status === 'Dalam Pengiriman') {
            const deliveredBtn = createButton('Sudah Tiba', () => updateOrderStatus(order.id, 'Sudah Tiba'));
            cell.append(deliveredBtn);
        } else {
            // No actions for 'Ditolak' or 'Sudah Tiba'
            cell.textContent = '-';
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

    async function handleShipping(orderId) {
        const receiptNumber = prompt('Masukkan nomor resi pengiriman:');
        if (receiptNumber && receiptNumber.trim() !== '') {
            const { error } = await supabase
                .from('orders')
                .update({
                    status: 'Dalam Pengiriman',
                    shipping_receipt: receiptNumber.trim()
                })
                .eq('id', orderId);

            if (error) {
                console.error('Error updating shipping info:', error);
                alert('Gagal memperbarui informasi pengiriman.');
            } else {
                alert('Informasi pengiriman berhasil diperbarui.');
                fetchOrders(); // Refresh the list
            }
        }
    }

    // Initial fetch
    fetchOrders();
});
