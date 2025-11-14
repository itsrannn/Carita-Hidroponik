// js/admin.js

document.addEventListener('DOMContentLoaded', async () => {
    const ordersGrid = document.getElementById('orders-grid');
    const loadingMessage = document.getElementById('loading-message');
    const adminMessageContainer = document.getElementById('admin-message-container');

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
        try {
            const { data: orders, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    profiles (
                        full_name,
                        phone_number
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!orders || orders.length === 0) {
                loadingMessage.textContent = 'Tidak ada pesanan yang ditemukan.';
                showAdminMessage(
                    'Tidak Ada Pesanan Ditemukan',
                    'Ini bisa terjadi karena:<br>' +
                    '1. Belum ada pesanan masuk.<br>' +
                    '2. Anda belum terdaftar sebagai admin.<br>' +
                    '3. Kebijakan RLS salah.'
                );
                return;
            }

            renderOrders(orders);
            loadingMessage.style.display = 'none';
        } catch (error) {
            console.error('Error fetching orders:', error);
            loadingMessage.textContent = 'Gagal memuat pesanan.';
            showAdminMessage(
                'Gagal Memuat Pesanan',
                `Terjadi kesalahan: <strong>${error.message}</strong><br>Pastikan login & koneksi internet stabil.`
            );
        }
    }

    function renderOrders(orders) {
        ordersGrid.innerHTML = '';

        orders.forEach(order => {
            const card = document.createElement('div');
            card.className = 'admin-order-card';
            card.id = `order-${order.id}`;

            // Items
            let itemsList = '<li>Tidak ada item</li>';
            const orderItems = order.order_details || order.items;
            if (orderItems && orderItems.length > 0) {
                itemsList = orderItems.map(item =>
                    `<li>${item.name} (x${item.quantity})</li>`
                ).join('');
            }

            // Customer
            const profile = order.profiles;
            const customerInfo = profile
                ? `${profile.full_name || 'Nama tidak ada'} <br><small>(${profile.phone_number || 'No HP tidak ada'})</small>`
                : 'Pelanggan tidak ditemukan';

            // Address (versi modern)
            let addressInfo = 'Alamat tidak tersedia';
            if (order.shipping_address) {
                const addr = order.shipping_address;
                const addressParts = [
                    addr.address,
                    addr.village,
                    addr.district,
                    addr.regency,
                    addr.province,
                    addr.postal_code
                ];
                addressInfo = addressParts.filter(part => part).join(', ');
            }

            // Date
            const orderDate = new Date(order.created_at).toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });

            card.innerHTML = `
                <div class="admin-order-card">
                    <div class="order-header">
                        <h3>Pesanan #${order.order_code || order.id}</h3>
                        <span class="status-badge status-${order.status.toLowerCase().replace(/\s+/g, '-')}">
                            ${order.status}
                        </span>
                    </div>

                    <div class="order-body">
                        <div class="info-group">
                            <label>Tanggal</label>
                            <p>${orderDate}</p>
                        </div>

                        <div class="info-group">
                            <label>Pelanggan</label>
                            <p>${customerInfo}</p>
                        </div>

                        <div class="info-group">
                            <label>Alamat Kirim</label>
                            <p>${addressInfo}</p>
                        </div>

                        <div class="info-group">
                            <label>Item</label>
                            <ul>${itemsList}</ul>
                        </div>
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

        const statusTransitions = {
            'Menunggu Konfirmasi': ['Diproses', 'Ditolak'],
            'Diproses': ['Dalam Pengiriman'],
            'Dalam Pengiriman': ['Selesai']
        };

        const availableActions = statusTransitions[order.status];

        if (availableActions) {
            availableActions.forEach(action => {
                const buttonClass = action === 'Ditolak'
                    ? 'btn-admin-reject'
                    : 'btn-admin-approve';

                const actionBtn = createButton(
                    action,
                    () => updateOrderStatus(order, action),
                    buttonClass
                );

                cell.appendChild(actionBtn);
            });
        } else {
            cell.textContent = 'Selesai';
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
        const { data, error } = await supabase
            .from('orders')
            .update({ status: newStatus })
            .eq('id', order.id)
            .select();

        if (error) {
            console.error('Error updating status:', error);
            alert(`Gagal memperbarui status pesanan: ${error.message}`);
            return;
        }

        if (!data || data.length === 0) {
            console.error('Update failed silently. Likely RLS policy violation.');
            alert('Pembaruan Gagal: Anda mungkin tidak memiliki izin untuk mengubah pesanan ini.');
            return;
        }

        alert('Status pesanan berhasil diperbarui.');

        order.status = newStatus;

        const card = document.getElementById(`order-${order.id}`);
        if (!card) return;

        const statusEl = card.querySelector('.status-badge');
        if (statusEl) {
            statusEl.textContent = newStatus;
            statusEl.className = `status-badge status-${newStatus.toLowerCase().replace(/\s+/g, '-')}`;
        }

        const actionsContainer = card.querySelector('.action-buttons');
        if (actionsContainer) {
            addActions(actionsContainer, order);
        }
    }

    fetchOrders();
});
