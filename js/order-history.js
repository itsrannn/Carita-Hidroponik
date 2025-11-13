document.addEventListener('DOMContentLoaded', async () => {
    // Ensure supabase is available
    if (!window.supabase) {
        console.error('Supabase client not found. Make sure supabase-client.js is loaded correctly.');
        return;
    }

    const orderListContainer = document.getElementById('order-list-container');
    const loadingMessage = document.getElementById('loading-message');
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        loadingMessage.innerHTML = 'Anda harus masuk untuk melihat riwayat pesanan. Mengalihkan ke halaman login...';
        setTimeout(() => {
            window.location.href = '/login%20page.html';
        }, 3000);
        return;
    }

    // Function to map status to a CSS class
    function getStatusClass(status) {
        const statusMap = {
            'Menunggu Konfirmasi': 'status-menunggu-konfirmasi',
            'Diproses': 'status-diterima', // Assuming 'Diterima' class for 'Diproses'
            'Ditolak': 'status-ditolak',
            'Dalam Pengiriman': 'status-dalam-pengiriman',
            'Selesai': 'status-sudah-tiba' // Assuming 'Sudah Tiba' class for 'Selesai'
        };
        return statusMap[status] || 'status-default';
    }


    function renderOrders(orders) {
        orderListContainer.innerHTML = ''; // Clear previous content
        if (orders.length === 0) {
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

            // Generate item list HTML
            let itemsHtml = '';
            if (order.items && order.items.length > 0) {
                 itemsHtml = order.items.map(item => `
                    <div class="item">
                        <div class="item-info">
                            <div class="item-name">${item.name}</div>
                            <div class="item-qty">Jumlah: ${item.quantity}</div>
                        </div>
                    </div>
                `).join('');
            } else {
                itemsHtml = '<p>Rincian pesanan tidak tersedia.</p>';
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

    // Fetch initial orders
    fetchOrders();

    // Subscribe to real-time changes on the orders table
    const subscription = supabase
        .channel('public:orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` }, payload => {
            console.log('Perubahan terdeteksi, memuat ulang pesanan...', payload);
            fetchOrders();
        })
        .subscribe();
});
