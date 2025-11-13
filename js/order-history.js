document.addEventListener('DOMContentLoaded', async () => {
    // Pastikan Supabase sudah tersedia
    if (!window.supabase) {
        console.error('Supabase client not found. Pastikan supabase-client.js dimuat dengan benar.');
        return;
    }

    const orderListContainer = document.getElementById('order-list-container');
    const loadingMessage = document.getElementById('loading-message');

    // --- Autentikasi pengguna ---
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        loadingMessage.innerHTML = 'Anda harus masuk untuk melihat riwayat pesanan. Mengalihkan ke halaman login...';
        setTimeout(() => {
            window.location.href = 'login page.html';
        }, 3000);
        return;
    }
    const user = session.user;

    // --- Fungsi status order ---
    function getStatusClass(status) {
        const statusMap = {
            'Menunggu Konfirmasi': 'status-menunggu-konfirmasi',
            'Diproses': 'status-diterima',
            'Ditolak': 'status-ditolak',
            'Dalam Pengiriman': 'status-dalam-pengiriman',
            'Selesai': 'status-sudah-tiba'
        };
        return statusMap[status] || 'status-default';
    }

    // --- Fungsi render order ---
    function renderOrders(orders) {
        orderListContainer.innerHTML = ''; // Kosongkan kontainer
        if (!orders || orders.length === 0) {
            orderListContainer.innerHTML = '<p>Anda belum memiliki riwayat pesanan.</p>';
            return;
        }

        orders.forEach(order => {
            const orderCard = document.createElement('div');
            orderCard.className = 'order-card';
            orderCard.id = `order-${order.id}`;

            const orderDate = new Date(order.created_at).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });

            // Rincian item — gunakan order_details jika ada, fallback ke items
            let itemsHtml = '<p>Rincian pesanan tidak tersedia.</p>';
            const orderItems = order.order_details || order.items;
            if (orderItems && Array.isArray(orderItems) && orderItems.length > 0) {
                itemsHtml = orderItems.map(item => {
                    if (item.name && item.quantity) {
                        return `
                            <div class="item">
                                <div class="item-info">
                                    <div class="item-name">${item.name}</div>
                                    <div class="item-qty">Jumlah: ${item.quantity}</div>
                                </div>
                            </div>
                        `;
                    }
                    return '';
                }).join('');
            }

            orderCard.innerHTML = `
                <div class="order-header">
                    <div>
                        <div class="order-code">ID Pesanan: ${order.order_code || order.id}</div>
                        <div class="order-date">${orderDate}</div>
                    </div>
                    <div class="order-status ${getStatusClass(order.status)}">${order.status}</div>
                </div>
                <div class="order-body">
                    <strong>Ringkasan Pesanan:</strong>
                    ${itemsHtml}
                </div>
                <div class="order-footer">
                    <strong>Total:</strong> Rp ${order.total_amount ? order.total_amount.toLocaleString('id-ID') : 'N/A'}
                </div>
            `;
            orderListContainer.appendChild(orderCard);
        });
    }

    // --- Ambil data orders ---
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
            console.error('Error fetching orders:', error);
            loadingMessage.textContent = 'Gagal memuat riwayat pesanan.';
        }
    }

    // Jalankan saat halaman dimuat
    fetchOrders();

    // --- Real-time update ---
    const subscription = supabase
        .channel('public:orders')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `user_id=eq.${user.id}`
        }, payload => {
            console.log('Perubahan terdeteksi, memuat ulang pesanan...', payload);
            fetchOrders();
        })
        .subscribe();

    // --- Logout Functionality ---
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
