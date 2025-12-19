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
    const revenuePeriodFilter = document.getElementById('revenue-period-filter');
    const chartDateRangeEl = document.getElementById('chart-date-range');
    const prevPeriodBtn = document.getElementById('prev-period');
    const nextPeriodBtn = document.getElementById('next-period');
    const productChartTypeFilter = document.getElementById('product-chart-type');
    const productPeriodFilter = document.getElementById('product-period-filter');
    const productMonthFilter = document.getElementById('product-month-filter');


    let salesTrendChart;
    let productSalesChart;
    let allOrdersData = [];
    let currentDate = new Date();
    let activePeriod = 'daily';

    // State untuk grafik penjualan produk
    let productChartType = 'bar';
    let productPeriod = 'total';
    let selectedMonth = new Date().getMonth();

    // Fungsi untuk format mata uang
    const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

    // Fungsi untuk mengambil semua data pesanan yang relevan
    const fetchAllOrders = async () => {
        const { data, error } = await supabase
            .from('orders')
            .select('created_at, total_amount, status, order_details')
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
        const totalRevenue = orders.reduce((acc, order) => acc + order.total_amount, 0);
        totalRevenueEl.textContent = formatCurrency(totalRevenue);

        // 2. Total Pesanan Selesai
        totalOrdersEl.textContent = orders.length;

        // 3. Produk Terlaris
        const productCounts = {};
        orders.forEach(order => {
            if (Array.isArray(order.order_details)) {
                order.order_details.forEach(item => {
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

    const updateChartDateRange = (startDate, endDate, period) => {
        const options = { month: 'short', day: 'numeric', year: 'numeric' };
        if (period === 'daily') {
            chartDateRangeEl.textContent = `${startDate.toLocaleDateString('id-ID', options)} - ${endDate.toLocaleDateString('id-ID', options)}`;
        } else if (period === 'weekly') {
            chartDateRangeEl.textContent = startDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        } else if (period === 'monthly') {
            chartDateRangeEl.textContent = startDate.getFullYear();
        }
    };

    const getWeekData = (orders, date) => {
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        updateChartDateRange(startOfWeek, endOfWeek, 'daily');

        const weekOrders = orders.filter(order => {
            const orderDate = new Date(order.created_at);
            return orderDate >= startOfWeek && orderDate <= endOfWeek;
        });

        const labels = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        const values = Array(7).fill(0);

        weekOrders.forEach(order => {
            const dayIndex = new Date(order.created_at).getDay();
            values[dayIndex] += order.total_amount;
        });

        return { labels, values };
    };

    const getMonthData = (orders, date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const startOfMonth = new Date(year, month, 1);
        const endOfMonth = new Date(year, month + 1, 0);

        updateChartDateRange(startOfMonth, endOfMonth, 'weekly');

        const monthOrders = orders.filter(order => {
            const orderDate = new Date(order.created_at);
            return orderDate.getFullYear() === year && orderDate.getMonth() === month;
        });

        const labels = [];
        const values = [];
        const firstDayOfMonth = startOfMonth.getDay();
        const daysInMonth = endOfMonth.getDate();

        // Calculate number of weeks in the month
        const numWeeks = Math.ceil((firstDayOfMonth + daysInMonth) / 7);
        for (let i = 1; i <= numWeeks; i++) {
            labels.push(`Minggu ${i}`);
            values.push(0);
        }

        monthOrders.forEach(order => {
            const orderDate = new Date(order.created_at);
            // Day of the month (1-31)
            const dayOfMonth = orderDate.getDate();
            // Calculate which week of the month this day falls into
            const weekIndex = Math.floor((firstDayOfMonth + dayOfMonth - 1) / 7);
            if (weekIndex < values.length) {
                 values[weekIndex] += order.total_amount;
            }
        });

        return { labels, values };
    };

    const getYearData = (orders, date) => {
        const year = date.getFullYear();
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year, 11, 31);

        updateChartDateRange(startOfYear, endOfYear, 'monthly');

        const yearOrders = orders.filter(order => new Date(order.created_at).getFullYear() === year);

        const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const values = Array(12).fill(0);

        yearOrders.forEach(order => {
            const monthIndex = new Date(order.created_at).getMonth();
            values[monthIndex] += order.total_amount;
        });

        return { labels, values };
    };

    const navigatePeriod = (direction) => {
        if (activePeriod === 'daily') {
            currentDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
        } else if (activePeriod === 'weekly') {
            currentDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
        } else if (activePeriod === 'monthly') {
            currentDate.setFullYear(currentDate.getFullYear() + (direction === 'next' ? 1 : -1));
        }
        updateRevenueChart();
    };

    const updateRevenueChart = () => {
        let data;
        if (activePeriod === 'daily') {
            data = getWeekData(allOrdersData, currentDate);
        } else if (activePeriod === 'weekly') {
            data = getMonthData(allOrdersData, currentDate);
        } else if (activePeriod === 'monthly') {
            data = getYearData(allOrdersData, currentDate);
        }

        if (salesTrendChart) {
            salesTrendChart.destroy();
        }

        salesTrendChart = new Chart(salesTrendChartCanvas, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Pendapatan',
                    data: data.values,
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
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    };

    // --- LOGIKA BARU UNTUK GRAFIK PENJUALAN PRODUK ---

    const populateMonthFilter = () => {
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        months.forEach((month, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = month;
            productMonthFilter.appendChild(option);
        });
        // Set bulan saat ini sebagai default
        productMonthFilter.value = new Date().getMonth();
    };

    const processProductSalesData = (orders) => {
        const productSales = {};
        orders.forEach(order => {
            if (Array.isArray(order.order_details)) {
                order.order_details.forEach(item => {
                    productSales[item.name] = (productSales[item.name] || 0) + item.quantity;
                });
            }
        });

        let sortedProducts = Object.entries(productSales).sort((a, b) => b[1] - a[1]);

        if (productChartType === 'pie' && sortedProducts.length > 5) {
            const top5 = sortedProducts.slice(0, 5);
            const othersCount = sortedProducts.slice(5).reduce((acc, curr) => acc + curr[1], 0);
            const others = ['Lainnya', othersCount];
            sortedProducts = [...top5, others];
        }

        return {
            labels: sortedProducts.map(p => p[0]),
            values: sortedProducts.map(p => p[1])
        };
    };

    const updateProductSalesChart = () => {
        let dataToProcess = allOrdersData;

        if (productPeriod === 'monthly') {
            const currentYear = new Date().getFullYear();
            dataToProcess = allOrdersData.filter(order => {
                const orderDate = new Date(order.created_at);
                return orderDate.getFullYear() === currentYear && orderDate.getMonth() == selectedMonth;
            });
        }

        const { labels, values } = processProductSalesData(dataToProcess);

        if (productSalesChart) {
            productSalesChart.destroy();
        }

        const chartOptions = {
            responsive: true,
            plugins: {
                legend: {
                    display: productChartType === 'pie', // Tampilkan legenda hanya untuk pie
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                if (productChartType === 'pie') {
                                     const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                                     const percentage = ((context.parsed / total) * 100).toFixed(2) + '%';
                                     label += `${context.raw} (${percentage})`;
                                } else {
                                     label += `${context.raw} terjual`;
                                }
                            }
                            return label;
                        }
                    }
                }
            }
        };

        if (productChartType === 'bar') {
            chartOptions.indexAxis = 'y';
            chartOptions.scales = {
                x: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0 // Hanya tampilkan angka bulat
                    }
                }
            };
             chartOptions.plugins.legend.display = false;
        }


        productSalesChart = new Chart(productSalesChartCanvas, {
            type: productChartType,
            data: {
                labels: labels,
                datasets: [{
                    label: 'Jumlah Terjual',
                    data: values,
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.7)',
                        'rgba(54, 162, 235, 0.7)',
                        'rgba(255, 206, 86, 0.7)',
                        'rgba(75, 192, 192, 0.7)',
                        'rgba(153, 102, 255, 0.7)',
                        'rgba(255, 159, 64, 0.7)',
                        'rgba(201, 203, 207, 0.7)'
                    ],
                    borderColor: '#fff',
                    borderWidth: 1
                }]
            },
            options: chartOptions
        });
    };

    // --- Event Listeners ---

    revenuePeriodFilter.addEventListener('change', (e) => {
        activePeriod = e.target.value;
        currentDate = new Date(); // Reset tanggal ke hari ini
        updateRevenueChart();
    });

    prevPeriodBtn.addEventListener('click', () => navigatePeriod('prev'));
    nextPeriodBtn.addEventListener('click', () => navigatePeriod('next'));

    productChartTypeFilter.addEventListener('change', (e) => {
        productChartType = e.target.value;
        updateProductSalesChart();
    });

    productPeriodFilter.addEventListener('change', (e) => {
        productPeriod = e.target.value;
        if (productPeriod === 'monthly') {
            productMonthFilter.style.display = 'inline-block';
        } else {
            productMonthFilter.style.display = 'none';
        }
        updateProductSalesChart();
    });

    productMonthFilter.addEventListener('change', (e) => {
        selectedMonth = e.target.value;
        updateProductSalesChart();
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
                    <td>${formatCurrency(order.total_amount)}</td>
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
        populateMonthFilter();
        allOrdersData = await fetchAllOrdersWithNames();
        displayKPIs(allOrdersData);
        updateRevenueChart();
        updateProductSalesChart();
        displayRecentTransactions(allOrdersData);
    };

    init();
});
