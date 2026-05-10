(function () {
  const SHIPPING_STEPS = ['Dibuat', 'Dibayar', 'Diproses', 'Dikirim', 'Selesai'];
  const REFUND_BANK_METHODS = ['BCA', 'Mandiri', 'BRI', 'BNI', 'SeaBank', 'Bank Lainnya'];
  const SHIPPED_STATUSES = ['shipped', 'delivered', 'completed', 'dalam pengiriman', 'selesai', 'dikirim'];

  const state = {
    order: null,
    refund: null,
    session: null,
    countdownInterval: null
  };

  const els = {
    loading: document.getElementById('order-loading'),
    content: document.getElementById('order-detail-content'),
    empty: document.getElementById('order-detail-empty'),
    orderId: document.getElementById('order-id'),
    orderDate: document.getElementById('order-date'),
    orderStatus: document.getElementById('order-status-badge'),
    refundStatus: document.getElementById('refund-status-badge'),
    timeline: document.getElementById('shipping-timeline'),
    productList: document.getElementById('order-products'),
    costSummary: document.getElementById('cost-summary'),
    refundActionBtn: document.getElementById('open-refund-modal'),
    refundModal: document.getElementById('refund-modal'),
    refundModalClose: document.getElementById('refund-modal-close'),
    refundCancelBtn: document.getElementById('refund-cancel-btn'),
    refundForm: document.getElementById('refund-form'),
    refundReason: document.getElementById('refund-reason'),
    refundMethod: document.getElementById('refund-method'),
    refundAccountLabel: document.getElementById('refund-account-label'),
    refundAccount: document.getElementById('refund-account'),
    refundSubmitBtn: document.getElementById('refund-submit-btn'),
    payNowBtn: document.getElementById('pay-now-btn'),
    paymentCountdown: document.getElementById('payment-countdown')
  };
  const PAYMENT_EXPIRY_MS = 15 * 60 * 1000;

  const showNotification = (message, isError = false) => {
    const notification = document.getElementById('notification');
    if (!notification) return;
    notification.textContent = message;
    notification.style.backgroundColor = isError ? '#b91c1c' : '#1a4d2e';
    notification.classList.add('show');
    setTimeout(() => notification.classList.remove('show'), 2800);
  };

  const normalizeStatus = (status = '') => String(status || '').trim().toLowerCase();

  const getStatusClass = (status = '') => {
    const slug = normalizeStatus(status).replace(/\s+/g, '-');
    return `status-${slug || 'default'}`;
  };

  const translateStatus = (status = '') => {
    const map = {
      'menunggu konfirmasi': 'Menunggu Konfirmasi',
      paid: 'Dibayar',
      diproses: 'Diproses',
      'dalam pengiriman': 'Dalam Pengiriman',
      shipped: 'Dikirim',
      delivered: 'Delivered',
      completed: 'Selesai',
      selesai: 'Selesai',
      ditolak: 'Ditolak'
    };
    return map[normalizeStatus(status)] || status || 'Belum Diperbarui';
  };

  const isRefundAllowed = (status = '') => !SHIPPED_STATUSES.includes(normalizeStatus(status));

  const getTimelineStep = (status = '') => {
    const normalized = normalizeStatus(status);
    if (['menunggu konfirmasi', 'pending', 'created'].includes(normalized)) return 0;
    if (['paid', 'dibayar'].includes(normalized)) return 1;
    if (['diproses', 'processed'].includes(normalized)) return 2;
    if (['dalam pengiriman', 'shipped', 'dikirim', 'delivered'].includes(normalized)) return 3;
    if (['completed', 'selesai'].includes(normalized)) return 4;
    return 0;
  };

  const readOrderIdFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('id');
    console.log('Order ID from URL:', orderId);
    return orderId;
  };

  const getOrderItems = (order = {}) => {
    const details = Array.isArray(order.order_details) ? order.order_details : [];
    return details;
  };

  const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const computeSummary = (order = {}) => {
    const items = getOrderItems(order);
    const subtotal = items.reduce((total, item) => total + (toNumber(item.price) * toNumber(item.quantity)), 0);
    const total = toNumber(order.total_amount);
    const shipping = toNumber(order.shipping_cost || order.ongkir || 0);
    const serviceFee = toNumber(order.service_fee || order.biaya_layanan || Math.max(0, total - subtotal - shipping));

    return {
      subtotal,
      shipping,
      serviceFee,
      total
    };
  };

  async function fetchOrderById(orderId) {
    const { data, error } = await window.supabase.auth.getSession();
    if (error) throw error;

    state.session = data?.session || null;
    const userId = state.session?.user?.id;
    if (!userId) {
      window.location.href = window.toAppPath(`login-page.html?redirect=order-detail.html%3Fid%3D${encodeURIComponent(orderId)}`);
      return null;
    }

    const query = window.supabase
      .from('orders')
      .select('id, order_code, created_at, status, total_amount, shipping_cost, service_fee, order_details, user_id')
      .eq('user_id', userId)
      .eq('id', orderId)
      .limit(1)
      .maybeSingle();

    const { data: orderData, error: orderError } = await query;

    if (orderError) throw orderError;
    console.log('Order detail response:', orderData);
    return orderData || null;
  }

  async function fetchRefundStatus(order = {}) {
    const orderCode = order.order_code || order.id;
    if (!orderCode) return null;

    const authHeader = state.session?.access_token
      ? { Authorization: `Bearer ${state.session.access_token}` }
      : {};

    const endpoints = [
      `/api/refund-request/status?order_id=${encodeURIComponent(orderCode)}`,
      `/api/refund-requests/status?order_id=${encodeURIComponent(orderCode)}`
    ];

    for (const path of endpoints) {
      try {
        const response = await window.fetchWithDebug(window.toApiPath(path), {
          method: 'GET',
          headers: authHeader,
          skipJsonContentType: true
        });

        if (!response.ok) continue;

        const result = await response.json();
        const payload = result?.data || result;
        if (payload?.status) return payload;
      } catch (_error) {
        // continue to next strategy
      }
    }

    const { data, error } = await window.supabase
      .from('refund_requests')
      .select('status, reason, refund_method, refund_account, created_at')
      .or(`order_id.eq.${order.id},order_id.eq.${orderCode}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('[Order Detail] Failed to fetch refund status:', error);
      return null;
    }

    return data || null;
  }

  function renderOrderHeader(order) {
    els.orderId.textContent = order.order_code || order.id;
    els.orderDate.textContent = new Date(order.created_at).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric'
    });

    els.orderStatus.className = `status-badge ${getStatusClass(order.status)}`;
    els.orderStatus.textContent = translateStatus(order.status);
  }

  function renderTimeline(order) {
    const activeStep = getTimelineStep(order.status);
    els.timeline.innerHTML = SHIPPING_STEPS
      .map((label, index) => `<div class="timeline-item ${index <= activeStep ? 'active' : ''}">${label}</div>`)
      .join('');
  }

  function renderProducts(order) {
    const items = getOrderItems(order);
    if (!items.length) {
      els.productList.innerHTML = '<p class="muted-text">Tidak ada produk pada pesanan ini.</p>';
      return;
    }

    els.productList.innerHTML = items.map((item) => {
      const quantity = toNumber(item.quantity);
      const price = toNumber(item.price);
      const subtotal = quantity * price;
      const image = window.fixImagePath(item.image_url || item.img || item.image || item.thumbnail || 'img/coming-soon.jpg');

      return `
        <article class="product-item">
          <img src="${image}" alt="${item.name || 'Produk'}" onerror="window.applyImageFallback(this); this.onerror();" />
          <div>
            <div class="product-title">${item.name || '-'}</div>
            <div class="product-meta">Qty: ${quantity} · ${window.formatRupiah(price)}</div>
          </div>
          <div class="product-subtotal">${window.formatRupiah(subtotal)}</div>
        </article>
      `;
    }).join('');
  }

  function renderCostSummary(order) {
    const summary = computeSummary(order);

    els.costSummary.innerHTML = `
      <div class="cost-row"><span>Subtotal</span><strong>${window.formatRupiah(summary.subtotal)}</strong></div>
      <div class="cost-row"><span>Ongkir</span><strong>${window.formatRupiah(summary.shipping)}</strong></div>
      <div class="cost-row"><span>Biaya Layanan</span><strong>${window.formatRupiah(summary.serviceFee)}</strong></div>
      <div class="cost-row total"><span>Total</span><strong>${window.formatRupiah(summary.total)}</strong></div>
    `;
  }

  function renderRefundStatus(refundStatus) {
    if (!refundStatus?.status) {
      els.refundStatus.classList.add('hidden');
      els.refundStatus.textContent = '';
      return;
    }

    const normalized = normalizeStatus(refundStatus.status);
    const map = {
      pending: 'Refund Pending',
      approved: 'Refund Approved',
      rejected: 'Refund Rejected'
    };

    els.refundStatus.classList.remove('hidden');
    els.refundStatus.textContent = map[normalized] || `Refund ${refundStatus.status}`;
  }

  function renderRefundAction(order) {
    if (isRefundAllowed(order.status)) {
      els.refundActionBtn.classList.remove('hidden');
    } else {
      els.refundActionBtn.classList.add('hidden');
    }
  }

  function getPaymentTimerKey(orderId) {
    return `payment_token_created_at:${orderId}`;
  }

  function startPaymentCountdown(createdAt) {
    if (!els.paymentCountdown || !state.order) return;
    if (state.countdownInterval) clearInterval(state.countdownInterval);

    const expiryTime = new Date(createdAt).getTime() + PAYMENT_EXPIRY_MS;
    const update = () => {
      const remaining = expiryTime - Date.now();
      if (remaining <= 0) {
        els.paymentCountdown.textContent = 'Payment expires in: Token expired';
        clearInterval(state.countdownInterval);
        state.countdownInterval = null;
        return;
      }
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      els.paymentCountdown.textContent = `Payment expires in: ${minutes}:${String(seconds).padStart(2, '0')}`;
    };

    update();
    state.countdownInterval = setInterval(update, 1000);
  }

  async function loadMidtransSnapScript(clientKey) {
    if (window.snap?.pay) return window.snap;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://app.sandbox.midtrans.com/snap/snap.js';
      script.setAttribute('data-client-key', clientKey || '');
      script.onload = () => resolve(window.snap);
      script.onerror = () => reject(new Error('Gagal memuat script Midtrans Snap.'));
      document.body.appendChild(script);
    });
  }

  async function handlePayNow() {
    if (!state.order || !els.payNowBtn) return;
    const orderId = state.order.id;
    const response = await window.fetchWithDebug(window.toApiPath(`/api/orders/${encodeURIComponent(orderId)}/pay-now`), {
      method: 'POST'
    });
    const result = await response.json().catch(() => ({}));
    const snapToken = result?.snapToken || result?.snap_token || result?.token;
    if (!response.ok || !snapToken) throw new Error(result?.message || 'Gagal membuat token pembayaran.');

    const createdAt = result.created_at || new Date().toISOString();
    localStorage.setItem(getPaymentTimerKey(state.order.id), createdAt);
    startPaymentCountdown(createdAt);

    const snap = await loadMidtransSnapScript(result.clientKey);
    if (!snap?.pay) throw new Error('Midtrans Snap tidak tersedia.');
    window.snap.pay(snapToken, {
      onSuccess: () => window.location.reload(),
      onPending: () => window.location.reload(),
      onClose: () => showNotification('Popup pembayaran ditutup. Anda bisa coba lagi lewat tombol Pay Now.', true)
    });
  }

  function openRefundModal() {
    els.refundModal.classList.remove('hidden');
    els.refundModal.setAttribute('aria-hidden', 'false');
  }

  function closeRefundModal() {
    els.refundModal.classList.add('hidden');
    els.refundModal.setAttribute('aria-hidden', 'true');
  }

  function updateAccountLabel() {
    const method = els.refundMethod.value;
    const isBank = REFUND_BANK_METHODS.includes(method);
    els.refundAccountLabel.textContent = isBank ? 'Nomor Rekening' : 'Nomor Telepon / ID Akun';
    els.refundAccount.placeholder = isBank ? 'Masukkan nomor rekening' : 'Masukkan nomor telepon / ID akun';
  }

  function clearValidationErrors() {
    ['reason', 'method', 'account'].forEach((name) => {
      const errorEl = document.getElementById(`refund-${name}-error`);
      if (errorEl) errorEl.textContent = '';
    });
  }

  function validateForm() {
    clearValidationErrors();
    let valid = true;

    if (!els.refundReason.value.trim()) {
      document.getElementById('refund-reason-error').textContent = 'Alasan wajib diisi.';
      valid = false;
    }

    if (!els.refundMethod.value) {
      document.getElementById('refund-method-error').textContent = 'Metode refund wajib dipilih.';
      valid = false;
    }

    if (!els.refundAccount.value.trim()) {
      document.getElementById('refund-account-error').textContent = 'Nomor rekening / akun wajib diisi.';
      valid = false;
    }

    if (!valid) showNotification('Mohon lengkapi semua field wajib.', true);
    return valid;
  }

  async function submitRefundRequest() {
    if (!state.order) return;

    const payload = {
      order_id: state.order.order_code || state.order.id,
      reason: els.refundReason.value.trim(),
      refund_method: els.refundMethod.value,
      refund_account: els.refundAccount.value.trim()
    };

    const authHeader = state.session?.access_token
      ? { Authorization: `Bearer ${state.session.access_token}` }
      : {};

    const endpoints = ['/api/refund-request', '/api/refund-requests'];
    let submitted = false;

    for (const path of endpoints) {
      try {
        const response = await window.fetchWithDebug(window.toApiPath(path), {
          method: 'POST',
          headers: {
            ...authHeader,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          submitted = true;
          break;
        }
      } catch (_error) {
        // try the next endpoint
      }
    }

    if (!submitted) {
      const { error } = await window.supabase.from('refund_requests').insert({
        order_id: state.order.id,
        reason: payload.reason,
        refund_method: payload.refund_method,
        refund_account: payload.refund_account,
        status: 'pending'
      });

      if (error) throw error;
    }

    showNotification('Pengajuan refund berhasil dikirim.');
    closeRefundModal();
    els.refundForm.reset();
    updateAccountLabel();
    state.refund = await fetchRefundStatus(state.order);
    renderRefundStatus(state.refund);
  }

  function bindEvents() {
    if (!els.refundActionBtn || !els.refundModalClose || !els.refundCancelBtn || !els.refundMethod || !els.refundForm) {
      return;
    }
    els.refundActionBtn.addEventListener('click', openRefundModal);
    els.refundModalClose.addEventListener('click', closeRefundModal);
    els.refundCancelBtn.addEventListener('click', closeRefundModal);
    els.refundMethod.addEventListener('change', updateAccountLabel);

    els.refundForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!validateForm()) return;

      els.refundSubmitBtn.disabled = true;
      try {
        await submitRefundRequest();
      } catch (error) {
        console.error('[Order Detail] Failed to submit refund request:', error);
        showNotification('Gagal mengirim pengajuan refund.', true);
      } finally {
        els.refundSubmitBtn.disabled = false;
      }
    });

    if (els.payNowBtn) {
      els.payNowBtn.addEventListener('click', async () => {
        els.payNowBtn.disabled = true;
        try {
          await handlePayNow();
        } catch (error) {
          console.error('[Order Detail] Failed to start payment:', error);
          showNotification(error?.message || 'Gagal memulai pembayaran.', true);
        } finally {
          els.payNowBtn.disabled = false;
        }
      });
    }
  }

  async function initPage() {
    try {
      const orderId = readOrderIdFromUrl();
      if (!orderId) {
        els.empty.classList.remove('hidden');
        els.loading.classList.add('hidden');
        return;
      }

      const order = await fetchOrderById(orderId);
      if (!order) {
        els.empty.classList.remove('hidden');
        els.loading.classList.add('hidden');
        return;
      }

      state.order = order;
      state.refund = await fetchRefundStatus(order);

      renderOrderHeader(order);
      renderTimeline(order);
      renderProducts(order);
      renderCostSummary(order);
      renderRefundAction(order);
      renderRefundStatus(state.refund);
      if (normalizeStatus(order.status) === 'pending_payment' && els.payNowBtn) {
        els.payNowBtn.classList.remove('hidden');
        const savedCreatedAt = localStorage.getItem(getPaymentTimerKey(order.id));
        if (savedCreatedAt) startPaymentCountdown(savedCreatedAt);
      }

      els.loading.classList.add('hidden');
      els.content.classList.remove('hidden');
    } catch (error) {
      console.error('[Order Detail] Failed to initialize page:', error);
      els.loading.classList.add('hidden');
      els.empty.classList.remove('hidden');
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    bindEvents();
    updateAccountLabel();
    await initPage();
  });
})();
