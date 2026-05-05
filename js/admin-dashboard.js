window.AdminDashboardPage = (() => {
    let salesTrendChart;
    let productSalesChart;
    let allOrdersData = [];

    function safeTranslateStatus(status) {
        if (typeof window.translateStatus === 'function') return window.translateStatus(status);
        return status || '-';
    }

    async function init() {
        if (!window.supabase || !window.Chart) {
            console.error('Supabase client or Chart.js not found.');
            return;
        }

        const totalRevenueEl = document.getElementById('total-revenue');
        const salesTrendChartCanvas = document.getElementById('salesTrendChart');
        if (!totalRevenueEl || !salesTrendChartCanvas) {
            return;
        }

        const supabase = window.supabase;
        const t = Alpine.store('i18n').t;
        const lang = Alpine.store('i18n').lang;

        const totalOrdersEl = document.getElementById('total-orders');
        const bestSellingProductEl = document.getElementById('best-selling-product');
        const productSalesChartCanvas = document.getElementById('productSalesChart');
        const revenuePeriodFilter = document.getElementById('revenue-period-filter');
        const chartDateRangeEl = document.getElementById('chart-date-range');
        const prevPeriodBtn = document.getElementById('prev-period');
        const nextPeriodBtn = document.getElementById('next-period');
        const productChartTypeFilter = document.getElementById('product-chart-type');
        const productPeriodFilter = document.getElementById('product-period-filter');
        const productMonthFilter = document.getElementById('product-month-filter');
        const productSalesChartWrapper = document.querySelector('#product-sales-chart-container .chart-canvas-wrapper');
        const transactionsBody = document.getElementById('recent-transactions-body');
        const loadingTransactionsEl = document.getElementById('loading-transactions');

        let currentDate = new Date();
        let activePeriod = 'daily';
        let productChartType = 'bar';
        let productPeriod = 'total';
        let selectedMonth = new Date().getMonth();

        if (salesTrendChart) salesTrendChart.destroy();
        if (productSalesChart) productSalesChart.destroy();

        const displayKPIs = (orders) => {
            const totalRevenue = orders.reduce((acc, order) => acc + order.total_amount, 0);
            totalRevenueEl.textContent = window.formatRupiah(totalRevenue);
            totalOrdersEl.textContent = orders.length;

            const productCounts = {};
            orders.forEach(order => {
                if (Array.isArray(order.order_details)) {
                    order.order_details.forEach(item => {
                        const itemName = (item.name && item.name[lang]) ? item.name[lang] : (item.name || 'Unknown');
                        productCounts[itemName] = (productCounts[itemName] || 0) + item.quantity;
                    });
                }
            });

            const bestSelling = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0];
            bestSellingProductEl.textContent = bestSelling ? bestSelling[0] : '-';
        };

        const updateChartDateRange = (startDate, endDate, period) => {
            const options = { month: 'short', day: 'numeric', year: 'numeric' };
            const locale = lang === 'id' ? 'id-ID' : 'en-US';
            if (period === 'daily') {
                chartDateRangeEl.textContent = `${startDate.toLocaleDateString(locale, options)} - ${endDate.toLocaleDateString(locale, options)}`;
            } else if (period === 'weekly') {
                chartDateRangeEl.textContent = startDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
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

            const labels = (lang === 'id') ? ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const values = Array(7).fill(0);
            orders.filter(order => {
                const orderDate = new Date(order.created_at);
                return orderDate >= startOfWeek && orderDate <= endOfWeek;
            }).forEach(order => {
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
            const weekLabel = (lang === 'id') ? 'Minggu' : 'Week';
            const numWeeks = Math.ceil((firstDayOfMonth + daysInMonth) / 7);

            for (let i = 1; i <= numWeeks; i++) {
                labels.push(`${weekLabel} ${i}`);
                values.push(0);
            }

            monthOrders.forEach(order => {
                const dayOfMonth = new Date(order.created_at).getDate();
                const weekIndex = Math.floor((firstDayOfMonth + dayOfMonth - 1) / 7);
                if (weekIndex < values.length) values[weekIndex] += order.total_amount;
            });

            return { labels, values };
        };

        const getYearData = (orders, date) => {
            const year = date.getFullYear();
            const startOfYear = new Date(year, 0, 1);
            const endOfYear = new Date(year, 11, 31);
            updateChartDateRange(startOfYear, endOfYear, 'monthly');

            const labels = (lang === 'id')
                ? ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
                : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const values = Array(12).fill(0);
            orders.filter(order => new Date(order.created_at).getFullYear() === year).forEach(order => {
                values[new Date(order.created_at).getMonth()] += order.total_amount;
            });

            return { labels, values };
        };

        const updateRevenueChart = () => {
            let data;
            if (activePeriod === 'daily') data = getWeekData(allOrdersData, currentDate);
            if (activePeriod === 'weekly') data = getMonthData(allOrdersData, currentDate);
            if (activePeriod === 'monthly') data = getYearData(allOrdersData, currentDate);

            if (salesTrendChart) salesTrendChart.destroy();
            salesTrendChart = new Chart(salesTrendChartCanvas, {
                type: 'line',
                data: {
                    labels: data.labels,
                    datasets: [{ label: t('admin.dashboard.kpi.totalRevenue'), data: data.values, borderColor: 'rgba(75, 192, 192, 1)', backgroundColor: 'rgba(75, 192, 192, 0.2)', tension: 0.1, fill: true }]
                },
                options: { responsive: true, scales: { y: { beginAtZero: true, ticks: { callback: (value) => window.formatRupiah(value) } } }, plugins: { legend: { display: false } } }
            });
        };

        const processProductSalesData = (orders) => {
            const productSales = {};
            orders.forEach(order => {
                if (Array.isArray(order.order_details)) {
                    order.order_details.forEach(item => {
                        const itemName = item.name;
                        productSales[itemName] = (productSales[itemName] || 0) + item.quantity;
                    });
                }
            });

            let sortedProducts = Object.entries(productSales).sort((a, b) => b[1] - a[1]);
            if (productChartType === 'pie' && sortedProducts.length > 5) {
                const top5 = sortedProducts.slice(0, 5);
                const othersCount = sortedProducts.slice(5).reduce((acc, curr) => acc + curr[1], 0);
                sortedProducts = [...top5, [t('admin.dashboard.productSales.others', 'Others'), othersCount]];
            }

            return { labels: sortedProducts.map(p => p[0]), values: sortedProducts.map(p => p[1]) };
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
            if (productSalesChart) productSalesChart.destroy();
            productSalesChartWrapper.classList.toggle('limit-chart-width', productChartType === 'pie');

            const chartOptions = {
                responsive: true,
                plugins: {
                    legend: { display: productChartType === 'pie', position: 'top' },
                    tooltip: { callbacks: { label: function(context) {
                        let label = context.label ? `${context.label}: ` : '';
                        if (context.parsed !== null) {
                            if (productChartType === 'pie') {
                                const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                                label += `${context.raw} (${((context.parsed / total) * 100).toFixed(2)}%)`;
                            } else {
                                label += `${context.raw} ${t('admin.dashboard.productSales.sold', 'sold')}`;
                            }
                        }
                        return label;
                    } } }
                }
            };

            if (productChartType === 'bar') {
                chartOptions.indexAxis = 'y';
                chartOptions.scales = { x: { beginAtZero: true, ticks: { precision: 0 } } };
                chartOptions.plugins.legend.display = false;
            }

            productSalesChart = new Chart(productSalesChartCanvas, {
                type: productChartType,
                data: { labels, datasets: [{ label: t('admin.dashboard.productSales.quantitySold', 'Quantity Sold'), data: values, backgroundColor: ['rgba(255, 99, 132, 0.7)','rgba(54, 162, 235, 0.7)','rgba(255, 206, 86, 0.7)','rgba(75, 192, 192, 0.7)','rgba(153, 102, 255, 0.7)','rgba(255, 159, 64, 0.7)','rgba(201, 203, 207, 0.7)'], borderColor: '#fff', borderWidth: 1 }] },
                options: chartOptions
            });
        };

        const displayRecentTransactions = (orders) => {
            if (!transactionsBody) return;
            loadingTransactionsEl.style.display = 'block';

            const recentOrders = orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
            if (recentOrders.length === 0) {
                transactionsBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">${t('admin.dashboard.transactions.empty', 'No completed transactions found.')}</td></tr>`;
                loadingTransactionsEl.style.display = 'none';
                return;
            }

            transactionsBody.innerHTML = recentOrders.map(order => {
                const locale = lang === 'id' ? 'id-ID' : 'en-US';
                const orderDate = new Date(order.created_at).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
                const customerName = order.user_fullname || t('admin.dashboard.transactions.notAvailable', 'N/A');
                const shortOrderId = order.order_code ? `#${order.order_code}` : (order.id ? `...${order.id.slice(-6)}` : t('admin.dashboard.transactions.notAvailable', 'N/A'));
                return `<tr><td>${shortOrderId}</td><td>${orderDate}</td><td>${customerName}</td><td>${window.formatRupiah(order.total_amount)}</td><td><span class="status-badge status-${(order.status || '').toLowerCase().replace(' ', '-')}">${safeTranslateStatus(order.status)}</span></td></tr>`;
            }).join('');

            loadingTransactionsEl.style.display = 'none';
        };

        const fetchAllOrdersWithNames = async () => {
            const { data, error } = await supabase
                .from('orders')
                .select('*, profile:profiles(full_name)')
                .eq('status', 'Selesai')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) {
                console.error('Error fetching orders:', error);
                return [];
            }

            return data.map(order => ({ ...order, user_fullname: order.profile ? order.profile.full_name : t('admin.dashboard.transactions.guest', 'Guest') }));
        };

        productMonthFilter.innerHTML = '';
        const locale = lang === 'id' ? 'id-ID' : 'en-US';
        for (let i = 0; i < 12; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = new Date(2000, i, 1).toLocaleDateString(locale, { month: 'long' });
            productMonthFilter.appendChild(option);
        }
        productMonthFilter.value = String(selectedMonth);

        revenuePeriodFilter.onchange = (e) => {
            activePeriod = e.target.value;
            currentDate = new Date();
            updateRevenueChart();
        };
        prevPeriodBtn.onclick = () => { if (activePeriod === 'daily') currentDate.setDate(currentDate.getDate() - 7); else if (activePeriod === 'weekly') currentDate.setMonth(currentDate.getMonth() - 1); else currentDate.setFullYear(currentDate.getFullYear() - 1); updateRevenueChart(); };
        nextPeriodBtn.onclick = () => { if (activePeriod === 'daily') currentDate.setDate(currentDate.getDate() + 7); else if (activePeriod === 'weekly') currentDate.setMonth(currentDate.getMonth() + 1); else currentDate.setFullYear(currentDate.getFullYear() + 1); updateRevenueChart(); };
        productChartTypeFilter.onchange = (e) => { productChartType = e.target.value; updateProductSalesChart(); };
        productPeriodFilter.onchange = (e) => { productPeriod = e.target.value; productMonthFilter.style.display = productPeriod === 'monthly' ? 'inline-block' : 'none'; updateProductSalesChart(); };
        productMonthFilter.onchange = (e) => { selectedMonth = e.target.value; updateProductSalesChart(); };

        allOrdersData = await fetchAllOrdersWithNames();
        displayKPIs(allOrdersData);
        updateRevenueChart();
        updateProductSalesChart();
        displayRecentTransactions(allOrdersData);
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
    window.AdminDashboardPage.init();
});
