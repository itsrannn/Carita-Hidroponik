window.AdminDashboardPage = (() => {
    let revenueChart;
    let statusChart;

    const normalizeStatus = (status = '') => {
        const value = String(status || '').trim();
        const map = {
            pending: 'Pending', 'Menunggu Konfirmasi': 'Pending', Pending: 'Pending',
            processing: 'Diproses', Diproses: 'Diproses',
            shipped: 'Dikirim', 'Dalam Pengiriman': 'Dikirim', Dikirim: 'Dikirim',
            completed: 'Selesai', Selesai: 'Selesai',
            rejected: 'Dibatalkan', Ditolak: 'Dibatalkan', Dibatalkan: 'Dibatalkan', cancelled: 'Dibatalkan', canceled: 'Dibatalkan'
        };
        return map[value] || value || 'Pending';
    };

    const localized = (value, fallback = '-') => {
        const lang = window.Alpine?.store?.('i18n')?.lang || 'id';
        if (value && typeof value === 'object') return value[lang] || value.id || value.en || fallback;
        return value || fallback;
    };

    const itemsOf = (order) => (Array.isArray(order?.order_details) ? order.order_details : (Array.isArray(order?.items) ? order.items : []));
    const number = (value) => Number(value || 0);

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    async function fetchOrders() {
        const { data, error } = await window.supabase
            .from('orders')
            .select('*, profiles(full_name, email)')
            .order('created_at', { ascending: false })
            .limit(500);
        if (error) throw error;
        return Array.isArray(data) ? data : [];
    }

    function buildAnalytics(orders) {
        const completed = orders.filter((order) => normalizeStatus(order.status) === 'Selesai');
        const revenueOrders = completed.length ? completed : orders.filter((order) => !['Dibatalkan'].includes(normalizeStatus(order.status)));
        const productCounts = {};
        orders.forEach((order) => itemsOf(order).forEach((item) => {
            const name = localized(item.name || item.product_name, 'Produk');
            productCounts[name] = (productCounts[name] || 0) + number(item.quantity || item.qty);
        }));
        const topProducts = Object.entries(productCounts).sort((a, b) => b[1] - a[1]);
        const statusCounts = ['Pending', 'Diproses', 'Dikirim', 'Selesai', 'Dibatalkan'].reduce((acc, status) => {
            acc[status] = orders.filter((order) => normalizeStatus(order.status) === status).length;
            return acc;
        }, {});
        return {
            totalOrders: orders.length,
            totalRevenue: revenueOrders.reduce((sum, order) => sum + number(order.total_amount), 0),
            pendingOrders: statusCounts.Pending,
            completedOrders: statusCounts.Selesai,
            topProducts,
            statusCounts
        };
    }

    function renderKpis(analytics) {
        setText('total-orders', analytics.totalOrders);
        setText('total-revenue', window.formatRupiah(analytics.totalRevenue));
        setText('pending-orders', analytics.pendingOrders);
        setText('completed-orders', analytics.completedOrders);
        setText('best-selling-product', analytics.topProducts[0] ? `${analytics.topProducts[0][0]} (${analytics.topProducts[0][1]})` : '-');
    }

    function renderRevenueChart(orders) {
        const canvas = document.getElementById('salesTrendChart');
        if (!canvas || !window.Chart) return;
        const monthly = new Map();
        orders.forEach((order) => {
            const date = new Date(order.created_at);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthly.set(key, (monthly.get(key) || 0) + number(order.total_amount));
        });
        const labels = Array.from(monthly.keys()).sort().slice(-12);
        if (revenueChart) revenueChart.destroy();
        revenueChart = new Chart(canvas, {
            type: 'line',
            data: { labels, datasets: [{ label: 'Revenue', data: labels.map((label) => monthly.get(label)), borderColor: '#15803d', backgroundColor: 'rgba(21,128,61,.15)', tension: .25, fill: true }] },
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: (v) => window.formatRupiah(v) } } } }
        });
    }

    function renderStatusChart(analytics) {
        const canvas = document.getElementById('productSalesChart');
        if (!canvas || !window.Chart) return;
        const labels = Object.keys(analytics.statusCounts);
        if (statusChart) statusChart.destroy();
        statusChart = new Chart(canvas, {
            type: 'doughnut',
            data: { labels, datasets: [{ data: labels.map((label) => analytics.statusCounts[label]), backgroundColor: ['#f59e0b', '#0ea5e9', '#6366f1', '#16a34a', '#dc2626'] }] },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        });
    }

    function renderRecentOrders(orders) {
        const body = document.getElementById('recent-transactions-body');
        const loading = document.getElementById('loading-transactions');
        if (!body) return;
        const locale = window.Alpine?.store?.('i18n')?.lang === 'en' ? 'en-US' : 'id-ID';
        const recent = [...orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8);
        body.innerHTML = recent.length ? recent.map((order) => {
            const profile = order.profiles || order.profile || {};
            const customer = order.customer_name || order.user_fullname || profile.full_name || order.shipping_address?.name || 'Customer';
            const id = order.order_code ? `#${order.order_code}` : `#${String(order.id || '').slice(0, 8)}`;
            const date = order.created_at ? new Date(order.created_at).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
            const status = normalizeStatus(order.status);
            return `<tr><td>${id}</td><td>${date}</td><td>${customer}</td><td>${window.formatRupiah(order.total_amount)}</td><td><span class="status-badge status-${status.toLowerCase().replace(/\s+/g, '-')}">${status}</span></td></tr>`;
        }).join('') : '<tr><td colspan="5" style="text-align:center;">Belum ada order.</td></tr>';
        if (loading) loading.style.display = 'none';
    }

    async function init() {
        if (!window.supabase) return;
        const rootCheck = document.getElementById('total-revenue');
        if (!rootCheck) return;
        try {
            const store = window.Alpine?.store?.('i18n');
            if (store && !store.ready && typeof store.init === 'function') await store.init().catch(() => undefined);
            const orders = await fetchOrders();
            const analytics = buildAnalytics(orders);
            renderKpis(analytics);
            renderRevenueChart(orders.filter((order) => normalizeStatus(order.status) !== 'Dibatalkan'));
            renderStatusChart(analytics);
            renderRecentOrders(orders);
        } catch (error) {
            console.error('[ADMIN ANALYTICS ERROR]', error);
            setText('total-revenue', 'Gagal memuat data');
        }
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
    window.AdminDashboardPage.init();
});
