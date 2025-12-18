document.addEventListener('DOMContentLoaded', async () => {
    // Pastikan Supabase client sudah tersedia
    if (!window.supabase) {
        console.error('Supabase client not found. Make sure supabase-client.js is loaded correctly.');
        return;
    }
    const supabase = window.supabase;

    // Elemen-elemen UI
    const totalRevenueEl = document.getElementById('total-revenue');
    const totalOrdersEl = document.getElementById('total-orders');
    const bestSellingProductEl = document.getElementById('best-selling-product');
    const salesTrendChartCanvas = document.getElementById('salesTrendChart');
    const productSalesChartCanvas = document.getElementById('productSalesChart');
    const filterControls = document.querySelector('.filter-controls');

    let salesTrendChart;
    let productSalesChart;
    let allOrdersData = [];

    // Fungsi untuk format mata uang
    const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

    // Fungsi untuk mengambil semua data pesanan yang relevan
    const fetchAllOrders = async () => {
        const { data, error } = await supabase
            .from('orders')
            .select('created_at, total_price, status, order_items')
            .eq('status', 'Selesai');

        if (error) {
            console.error('Error fetching orders:', error);
            return [];
        }
        return data;
    };

    // Fungsi untuk menghitung dan menampilkan KPI
    const displayKPIs = (orders) => {
        // 1. Total Pendapatan
        const totalRevenue = orders.reduce((acc, order) => acc + order.total_price, 0);
        totalRevenueEl.textContent = formatCurrency(totalRevenue);

        // 2. Total Pesanan Selesai
        totalOrdersEl.textContent = orders.length;

        // 3. Produk Terlaris
        const productCounts = {};
        orders.forEach(order => {
            if (Array.isArray(order.order_items)) {
                order.order_items.forEach(item => {
                    productCounts[item.name] = (productCounts[item.name] || 0) + item.quantity;
                });
            }
        });

        const bestSelling = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0];
        if (bestSelling) {
            bestSellingProductEl.textContent = bestSelling[0];
        } else {
            bestSellingProductEl.textContent = '-';
        }
    };

    // Fungsi untuk mengolah data tren penjualan
    const processSalesTrendData = (orders, period) => {
        const dataMap = new Map();
        const now = new Date();

        orders.forEach(order => {
            const date = new Date(order.created_at);
            let key;
            let dateKey; // a sortable date object

            if (period === 'daily') {
                if ((now - date) > 7 * 24 * 60 * 60 * 1000) return;
                date.setHours(0, 0, 0, 0);
                dateKey = date;
                key = date.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
            } else if (period === 'weekly') {
                if ((now - date) > 28 * 24 * 60 * 60 * 1000) return;
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay());
                weekStart.setHours(0, 0, 0, 0);
                dateKey = weekStart;
                key = `Minggu ${weekStart.toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}`;
            } else if (period === 'monthly') {
                const monthDiff = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
                if (monthDiff >= 12) return;

                const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
                dateKey = monthStart;
                key = date.toLocaleDateString('id-ID', { year: 'numeric', month: 'long' });
            }

            if (key) {
                if (!dataMap.has(key)) {
                    dataMap.set(key, { value: 0, date: dateKey });
                }
                dataMap.get(key).value += order.total_price;
            }
        });

        // Convert map to array and sort by date
        const sortedData = [...dataMap.entries()].sort((a, b) => a[1].date - b[1].date);

        return {
            labels: sortedData.map(item => item[0]),
            values: sortedData.map(item => item[1].value)
        };
    };

    // Fungsi untuk membuat/memperbarui grafik tren penjualan
    const renderSalesTrendChart = (period = 'daily') => {
        const { labels, values } = processSalesTrendData(allOrdersData, period);

        if (salesTrendChart) {
            salesTrendChart.destroy();
        }

        salesTrendChart = new Chart(salesTrendChartCanvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Pendapatan',
                    data: values,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.1,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => formatCurrency(value)
                        }
                    }
                }
            }
        });
    };

    // Fungsi untuk mengolah data penjualan per produk
    const processProductSalesData = (orders) => {
        const productSales = {};
        orders.forEach(order => {
            if (Array.isArray(order.order_items)) {
                order.order_items.forEach(item => {
                    productSales[item.name] = (productSales[item.name] || 0) + (item.price * item.quantity);
                });
            }
        });

        const sortedProducts = Object.entries(productSales).sort((a, b) => b[1] - a[1]);
        const top5Products = sortedProducts.slice(0, 10);

        return {
            labels: top5Products.map(p => p[0]),
            values: top5Products.map(p => p[1])
        };
    };

    // Fungsi untuk membuat grafik penjualan per produk
    const renderProductSalesChart = () => {
        const { labels, values } = processProductSalesData(allOrdersData);
        if (productSalesChart) {
            productSalesChart.destroy();
        }
        productSalesChart = new Chart(productSalesChartCanvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Total Penjualan',
                    data: values,
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.5)',
                        'rgba(54, 162, 235, 0.5)',
                        'rgba(255, 206, 86, 0.5)',
                        'rgba(75, 192, 192, 0.5)',
                        'rgba(153, 102, 255, 0.5)',
                        'rgba(255, 159, 64, 0.5)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)',
                        'rgba(255, 159, 64, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => formatCurrency(value)
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    };


    // Event listener untuk filter
    filterControls.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            renderSalesTrendChart(e.target.dataset.period);
        }
    });

    const transactionsBody = document.getElementById('recent-transactions-body');
    const loadingTransactionsEl = document.getElementById('loading-transactions');

    // Fungsi untuk menampilkan transaksi terakhir
    const displayRecentTransactions = (orders) => {
        if (!transactionsBody) return;

        loadingTransactionsEl.style.display = 'block';

        // Ambil 5 transaksi terbaru
        const recentOrders = orders
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 5);

        if (recentOrders.length === 0) {
            transactionsBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Tidak ada transaksi yang selesai.</td></tr>';
            loadingTransactionsEl.style.display = 'none';
            return;
        }

        transactionsBody.innerHTML = recentOrders.map(order => {
            const orderDate = new Date(order.created_at).toLocaleDateString('id-ID', {
                day: '2-digit', month: 'short', year: 'numeric'
            });
            // Asumsi `order.user_fullname` ada dari join, jika tidak, kita butuh query baru
            const customerName = order.user_fullname || 'N/A';
            const shortOrderId = order.id ? `...${order.id.slice(-6)}` : 'N/A';

            return `
                <tr>
                    <td>${shortOrderId}</td>
                    <td>${orderDate}</td>
                    <td>${customerName}</td>
                    <td>${formatCurrency(order.total_price)}</td>
                    <td><span class="status-badge status-${order.status.toLowerCase().replace(' ', '-')}">${order.status}</span></td>
                </tr>
            `;
        }).join('');

        loadingTransactionsEl.style.display = 'none';
    };

    // Fungsi untuk mengambil semua data pesanan yang relevan
    const fetchAllOrdersWithNames = async () => {
         const { data, error } = await supabase
            .from('orders')
            .select('*, profile:profiles(full_name)')
            .eq('status', 'Selesai')
            .order('created_at', { ascending: false })
            .limit(100); // Batasi untuk performa

        if (error) {
            console.error('Error fetching orders:', error);
            return [];
        }

        // Flatten the profile data
        return data.map(order => ({
            ...order,
            user_fullname: order.profile ? order.profile.full_name : 'Guest'
        }));
    };


    // Inisialisasi
    const init = async () => {
        // Ganti fetchAllOrders dengan yang baru
        allOrdersData = await fetchAllOrdersWithNames();
        displayKPIs(allOrdersData);
        renderSalesTrendChart('daily');
        renderProductSalesChart();
        displayRecentTransactions(allOrdersData);
    };

    init();
});
