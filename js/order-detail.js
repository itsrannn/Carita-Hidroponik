(function () {
  const ORDER_STEPS = [
    { key: 'pending_payment', label: 'Menunggu Pembayaran', description: 'Pesanan dibuat dan menunggu pembayaran.' },
    { key: 'paid', label: 'Dibayar', description: 'Pembayaran Midtrans berhasil diterima.' },
    { key: 'processing', label: 'Diproses', description: 'Pesanan sedang diproses oleh admin.' },
    { key: 'shipped', label: 'Dikirim', description: 'Pesanan sudah diserahkan ke kurir.' },
    { key: 'completed', label: 'Selesai', description: 'Pesanan telah selesai.' }
  ];
  const ALLOWED_ORDER_STATUSES = ['pending_payment', 'paid', 'processing', 'shipped', 'completed', 'cancelled', 'rejected'];
  const REFUND_BANK_METHODS = ['BCA', 'Mandiri', 'BRI', 'BNI', 'SeaBank', 'Bank Lainnya'];
  const FALLBACK_IMAGE = 'img/coming-soon.jpg';

  const state = {
    order: null,
    items: [],
    refund: null,
    session: null,
    payment: null,
    countdownInterval: null,
    paymentExpired: false
  };

  const els = {
    loading: document.getElementById('order-loading'),
    content: document.getElementById('order-detail-content'),
    empty: document.getElementById('order-detail-empty'),
    error: document.getElementById('order-detail-error'),
    errorMessage: document.getElementById('order-error-message'),
    retryBtn: document.getElementById('retry-order-detail'),
    orderId: document.getElementById('order-id'),
    orderDate: document.getElementById('order-date'),
    orderStatus: document.getElementById('order-status-badge'),
    refundStatus: document.getElementById('refund-status-badge'),
    orderInfo: document.getElementById('order-info'),
    statusDetail: document.getElementById('order-status-detail'),
    productList: document.getElementById('order-products'),
    costSummary: document.getElementById('cost-summary'),
    shippingInfo: document.getElementById('shipping-info'),
    paymentActionCard: document.getElementById('payment-action-card'),
    paymentActionContent: document.getElementById('payment-action-content'),
    refundActionCard: document.getElementById('refund-action-card'),
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

  const fallbackFormatRupiah = (value) => new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(toNumber(value));

  const formatRupiah = (value) => (typeof window.formatRupiah === 'function'
    ? window.formatRupiah(value)
    : fallbackFormatRupiah(value));

  const showNotification = (message, isError = false) => {
    const notification = document.getElementById('notification');
    if (!notification) return;
    notification.textContent = message;
    notification.style.backgroundColor = isError ? '#b91c1c' : '#1a4d2e';
    notification.classList.add('show');
    setTimeout(() => notification.classList.remove('show'), 2800);
  };

  const normalizeStatus = (status = '') => String(status || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
  const escapeHtml = (value = '') => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));

  function toNumber(value) {
    if (typeof value === 'string') {
      const normalized = value.replace(/[^\d.-]/g, '');
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function firstString(...values) {
    for (const value of values) {
      if (typeof value === 'string' || typeof value === 'number') {
        const text = String(value).trim();
        if (text && text !== '[object Object]' && text !== 'undefined' && text !== 'null') return text;
      }
    }
    return '';
  }

  function asObject(value) {
    if (isPlainObject(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return isPlainObject(parsed) ? parsed : {};
      } catch (_error) {
        return {};
      }
    }
    return {};
  }

  function firstObject(...values) {
    for (const value of values) {
      const objectValue = asObject(value);
      if (Object.keys(objectValue).length) return objectValue;
    }
    return {};
  }

  function asArray(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch (_error) {
        return [];
      }
    }
    return [];
  }

  function canonicalStatus(status = '') {
    const normalized = normalizeStatus(status);
    return ALLOWED_ORDER_STATUSES.includes(normalized) ? normalized : 'pending_payment';
  }

  function translateStatus(status = '') {
    const map = {
      pending_payment: 'Menunggu Pembayaran',
      paid: 'Dibayar',
      processing: 'Diproses',
      shipped: 'Dikirim',
      completed: 'Selesai',
      cancelled: 'Dibatalkan',
      rejected: 'Ditolak'
    };
    return map[canonicalStatus(status)] || firstString(status, 'Belum Diperbarui');
  }

  function getStatusClass(status = '') {
    return `status-${canonicalStatus(status).replace(/_/g, '-') || 'default'}`;
  }

  function isPendingPaymentStatus(status = '') {
    return canonicalStatus(status) === 'pending_payment';
  }

  function isRefundAllowed(status = '') {
    return ['paid', 'processing', 'shipped'].includes(canonicalStatus(status));
  }

  function isTrackableStatus(status = '') {
    return ['shipped', 'completed'].includes(canonicalStatus(status));
  }

  function getTimelineStep(status = '') {
    return ORDER_STEPS.findIndex((step) => step.key === canonicalStatus(status));
  }

  function getPaymentDeadline(order = {}) {
    const candidate = firstString(order.payment_deadline, order.paymentDeadline, order.payment_expired_at, order.payment_expiry);
    const timestamp = candidate ? new Date(candidate).getTime() : NaN;
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  function readOrderIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('id') || params.get('order_id') || params.get('order_code');
    return orderId;
  }

  function getOrderItems(order = {}) {
    return [
      ...asArray(order.order_items),
      ...asArray(order.items),
      ...asArray(order.order_details),
      ...asArray(order.details)
    ];
  }

  function normalizeItem(item = {}) {
    const product = firstObject(item.product, item.products, item.product_detail);
    const name = firstString(
      item.name,
      item.product_name,
      item.title,
      product.name,
      product.product_name,
      product.title,
      'Produk'
    );
    const quantity = toNumber(item.quantity || item.qty || item.count || 1) || 1;
    const price = toNumber(
      item.price ??
      item.unit_price ??
      item.product_price ??
      item.amount ??
      product.price ??
      product.product_price
    );
    const explicitSubtotal = toNumber(item.subtotal ?? item.total ?? item.total_price ?? item.line_total);
    const imageCandidate = firstString(
      item.image_url,
      item.image,
      item.img,
      item.thumbnail,
      item.product_image,
      product.image_url,
      product.image,
      product.img,
      product.thumbnail,
      FALLBACK_IMAGE
    );
    const image = typeof window.fixImagePath === 'function' ? window.fixImagePath(imageCandidate) : imageCandidate;

    return {
      id: firstString(item.id, item.product_id, product.id),
      name,
      quantity,
      price,
      subtotal: explicitSubtotal || quantity * price,
      image: image || FALLBACK_IMAGE
    };
  }

  function getTrackingNumber(order = {}) {
    return firstString(
      order.shipping_receipt,
      order.shipping_resi,
      order.tracking_number,
      order.resi,
      order.receipt_number,
      order.awb
    );
  }

  function getSpecialReason(order = {}) {
    const status = canonicalStatus(order.status);
    if (status === 'rejected') {
      return firstString(order.reject_reason, order.rejection_reason, order.rejected_reason, order.admin_reason, order.reason, order.notes, 'Alasan belum tersedia.');
    }
    return firstString(order.cancel_reason, order.cancellation_reason, order.cancelled_reason, order.expired_reason, order.reason, order.notes, 'Pembayaran melewati batas waktu atau dibatalkan sistem.');
  }

  function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function computeSummary(order = {}, items = state.items) {
    const subtotal = items.reduce((total, item) => total + toNumber(item.subtotal), 0);
    const total = toNumber(order.total_amount || order.totalAmount || order.grand_total || order.total || subtotal);
    const shipping = toNumber(order.shipping_cost || order.ongkir || order.shippingCost || 0);
    const serviceFee = toNumber(order.service_fee || order.biaya_layanan || Math.max(0, total - subtotal - shipping));

    return {
      subtotal,
      shipping,
      serviceFee,
      total: total || subtotal + shipping + serviceFee
    };
  }

  async function fetchOrderItemsFromTable(order) {
    if (!window.supabase || !order?.id) return [];
    try {
      const { data, error } = await window.supabase
        .from('order_items')
        .select('*, products(*)')
        .eq('order_id', order.id);
      if (error) throw error;
      return asArray(data);
    } catch (error) {
      console.warn('[Order Detail] order_items table fallback skipped:', error?.message || error);
      return [];
    }
  }

  async function fetchOrderById(orderId) {
    const { data, error } = await window.supabase.auth.getSession();
    if (error) throw error;

    state.session = data?.session || null;
    const userId = state.session?.user?.id;
    if (!userId) {
      window.location.href = window.toAppPath(`login-page.html?redirect=order-detail.html%3Fid%3D${encodeURIComponent(orderId)}`);
      return null;
    }

    let query = window.supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .limit(1);

    if (/^\d+$/.test(String(orderId))) {
      query = query.or(`id.eq.${orderId},order_code.eq.${orderId}`);
    } else {
      query = query.eq('order_code', orderId);
    }

    const { data: orderData, error: orderError } = await query.maybeSingle();
    if (orderError) throw orderError;
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

    try {
      const { data, error } = await window.supabase
        .from('refund_requests')
        .select('status, reason, refund_method, refund_account, created_at')
        .or(`order_id.eq.${order.id},order_id.eq.${orderCode}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data || null;
    } catch (error) {
      console.warn('[Order Detail] Failed to fetch refund status:', error);
      return null;
    }
  }

  function renderOrderHeader(order) {
    els.orderId.textContent = firstString(order.order_code, order.id, '-');
    els.orderDate.textContent = formatDate(order.created_at);
    els.orderStatus.className = `status-badge ${getStatusClass(order.status)}`;
    els.orderStatus.textContent = translateStatus(order.status);
  }

  function renderOrderInfo(order) {
    const summary = computeSummary(order);
    els.orderInfo.innerHTML = `
      <div class="info-row"><span>ID Pesanan</span><strong>${escapeHtml(firstString(order.order_code, order.id, '-'))}</strong></div>
      <div class="info-row"><span>Tanggal Pesanan</span><strong>${escapeHtml(formatDate(order.created_at))}</strong></div>
      <div class="info-row"><span>Status Pesanan</span><strong>${escapeHtml(translateStatus(order.status))}</strong></div>
      <div class="info-row"><span>Total Pembayaran</span><strong>${escapeHtml(formatRupiah(summary.total))}</strong></div>
    `;
  }

  function renderStatusDetail(order) {
    const status = canonicalStatus(order.status);
    if (status === 'cancelled' || status === 'rejected') {
      const title = status === 'cancelled' ? 'Pesanan Dibatalkan' : 'Pesanan Ditolak';
      els.statusDetail.innerHTML = `
        <article class="special-status-card status-${status}">
          <span>Status Pesanan:</span>
          <strong>${title}</strong>
          <div class="reason-box">
            <span>Alasan:</span>
            <p>${escapeHtml(getSpecialReason(order))}</p>
          </div>
        </article>
      `;
      return;
    }

    const activeStep = Math.max(0, getTimelineStep(order.status));
    els.statusDetail.innerHTML = `
      <div class="timeline" id="order-status-timeline">
        ${ORDER_STEPS.map((step, index) => `
          <div class="timeline-item ${index <= activeStep ? 'active' : ''} ${index === activeStep ? 'current' : ''}">
            <div class="timeline-dot"></div>
            <div>
              <strong>${step.label}</strong>
              <p>${step.description}</p>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderProducts(items) {
    if (!items.length) {
      els.productList.innerHTML = `
        <div class="empty-inline">
          <strong>Produk tidak tersedia</strong>
          <p>Data produk pada pesanan ini belum tersedia.</p>
        </div>
      `;
      return;
    }

    els.productList.innerHTML = items.map((item) => `
      <article class="product-item">
        <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" onerror="this.onerror=null; this.src=window.toAppPath ? window.toAppPath('img/coming-soon.jpg') : 'img/coming-soon.jpg'" />
        <div class="product-copy">
          <div class="product-title">${escapeHtml(item.name)}</div>
          <dl class="product-meta">
            <div><dt>Qty</dt><dd>${escapeHtml(item.quantity)}</dd></div>
            <div><dt>Harga</dt><dd>${escapeHtml(formatRupiah(item.price))}</dd></div>
          </dl>
        </div>
        <div class="product-subtotal">
          <span>Subtotal</span>
          <strong>${escapeHtml(formatRupiah(item.subtotal))}</strong>
        </div>
      </article>
    `).join('');
  }

  function renderCostSummary(order) {
    const summary = computeSummary(order);

    els.costSummary.innerHTML = `
      <div class="cost-row"><span>Subtotal</span><strong>${escapeHtml(formatRupiah(summary.subtotal))}</strong></div>
      <div class="cost-row"><span>Ongkir</span><strong>${escapeHtml(formatRupiah(summary.shipping))}</strong></div>
      <div class="cost-row"><span>Biaya Layanan</span><strong>${escapeHtml(formatRupiah(summary.serviceFee))}</strong></div>
      <div class="cost-row total"><span>Total</span><strong>${escapeHtml(formatRupiah(summary.total))}</strong></div>
    `;
  }

  function renderShippingInfo(order) {
    const address = firstObject(order.shipping_address, order.address);
    const addressParts = [
      address.recipient_name || address.name || order.recipient_name || order.customer_name,
      address.phone || address.phone_number || order.phone_number || order.customer_phone,
      address.address || firstString(order.shipping_address, order.address),
      address.village || order.village,
      address.district || order.district,
      address.regency || address.city || order.regency || order.city,
      address.province || order.province,
      address.postal_code || order.postal_code
    ].map((part) => firstString(part)).filter(Boolean);
    const resi = getTrackingNumber(order);

    let html = addressParts.length
      ? `<div class="address-box">${addressParts.map((part) => `<p>${escapeHtml(part)}</p>`).join('')}</div>`
      : '<div class="empty-inline"><strong>Alamat belum tersedia</strong><p>Informasi pengiriman belum tersimpan.</p></div>';

    if (isTrackableStatus(order.status) && resi) {
      html += `
        <div class="tracking-box">
          <span>Nomor Resi</span>
          <strong>${escapeHtml(resi)}</strong>
        </div>
      `;
    }

    els.shippingInfo.innerHTML = html;
  }

  function renderPaymentAction(order) {
    if (!els.paymentActionCard) return;
    if (!isPendingPaymentStatus(order.status)) {
      els.paymentActionCard.classList.add('hidden');
      if (state.countdownInterval) clearInterval(state.countdownInterval);
      state.countdownInterval = null;
      return;
    }

    els.paymentActionCard.classList.remove('hidden');
    els.paymentActionContent?.classList.remove('is-expired');
    state.paymentExpired = false;
    if (els.payNowBtn) {
      els.payNowBtn.textContent = 'Bayar Sekarang';
      els.payNowBtn.classList.remove('hidden');
      els.payNowBtn.disabled = false;
    }
    startPaymentCountdown(order);
  }

  function renderRefundStatus(refundStatus) {
    if (!refundStatus?.status) {
      els.refundStatus.classList.add('hidden');
      els.refundStatus.textContent = '';
      return;
    }

    const normalized = normalizeStatus(refundStatus.status);
    const map = {
      pending: 'Pembatalan Diajukan',
      approved: 'Pembatalan Disetujui',
      rejected: 'Pembatalan Ditolak'
    };

    els.refundStatus.classList.remove('hidden');
    els.refundStatus.textContent = map[normalized] || `Pembatalan ${refundStatus.status}`;
  }

  function renderRefundAction(order) {
    if (!els.refundActionBtn || !els.refundActionCard) return;
    if (isRefundAllowed(order.status)) {
      els.refundActionCard.classList.remove('hidden');
      els.refundActionBtn.classList.remove('hidden');
    } else {
      els.refundActionBtn.classList.add('hidden');
      els.refundActionCard.classList.add('hidden');
    }
  }

  function startPaymentCountdown(order) {
    if (!els.paymentCountdown || !state.order) return;
    if (state.countdownInterval) clearInterval(state.countdownInterval);

    const expiryTime = getPaymentDeadline(order);

    if (!expiryTime) {
      state.paymentExpired = false;
      els.paymentCountdown.textContent = '-';
      if (els.payNowBtn) {
        els.payNowBtn.disabled = false;
        els.payNowBtn.textContent = 'Bayar Sekarang';
      }
      return;
    }

    const update = () => {
      const remaining = expiryTime - Date.now();
      if (remaining <= 0) {
        state.paymentExpired = true;
        els.paymentCountdown.textContent = 'Expired';
        if (els.paymentActionContent) els.paymentActionContent.classList.add('is-expired');
        if (els.payNowBtn) {
          els.payNowBtn.disabled = true;
          els.payNowBtn.textContent = 'Pembayaran Expired';
        }
        clearInterval(state.countdownInterval);
        state.countdownInterval = null;
        return;
      }

      state.paymentExpired = false;
      const hours = Math.floor(remaining / 3600000);
      const minutes = Math.floor((remaining % 3600000) / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      els.paymentCountdown.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    update();
    if (!state.paymentExpired) state.countdownInterval = setInterval(update, 1000);
  }

  async function loadMidtransSnapScript(clientKey) {
    if (window.snap?.pay) return window.snap;
    return new Promise((resolve, reject) => {
      const existingScript = document.getElementById('midtrans-snap-script');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(window.snap));
        existingScript.addEventListener('error', () => reject(new Error('Gagal memuat script Midtrans Snap.')));
        return;
      }

      const script = document.createElement('script');
      script.id = 'midtrans-snap-script';
      script.src = 'https://app.sandbox.midtrans.com/snap/snap.js';
      script.setAttribute('data-client-key', clientKey || '');
      script.onload = () => resolve(window.snap);
      script.onerror = () => reject(new Error('Gagal memuat script Midtrans Snap.'));
      document.body.appendChild(script);
    });
  }

  function extractSnapPayload(result = {}) {
    const payload = result?.data || result?.payment || result;
    const snapToken = firstString(payload.snapToken, payload.snap_token, payload.token, result.snapToken, result.snap_token, result.token);
    const clientKey = firstString(payload.clientKey, payload.client_key, result.clientKey, result.client_key);
    return snapToken ? { ...payload, snapToken, clientKey } : null;
  }

  async function requestPaymentToken(order) {
    const authHeader = state.session?.access_token ? { Authorization: `Bearer ${state.session.access_token}` } : {};
    const response = await window.fetchWithDebug(window.toApiPath(`/api/orders/${encodeURIComponent(order.id)}/retry-payment`), {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({ order_id: order.id, order_code: order.order_code || order.id })
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(firstString(result.message, result.error, 'Gagal membuat token pembayaran terbaru.'));
    }

    const snapPayload = extractSnapPayload(result);
    if (!snapPayload) throw new Error('Token pembayaran tidak tersedia.');
    return snapPayload;
  }

  async function handlePayNow() {
    if (!state.order || !els.payNowBtn || state.paymentExpired) return;
    const result = await requestPaymentToken(state.order);
    state.payment = result;
    const snap = await loadMidtransSnapScript(result.clientKey || result.client_key);
    if (!snap?.pay) throw new Error('Midtrans Snap tidak tersedia.');
    window.snap.pay(result.snapToken, {
      onSuccess: () => {
        window.location.href = window.toAppPath(`order-detail.html?id=${encodeURIComponent(state.order.id)}`);
      },
      onPending: () => window.location.reload(),
      onClose: () => showNotification('Popup pembayaran ditutup. Anda bisa melanjutkan lewat tombol Bayar Sekarang.', true)
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
    const method = els.refundMethod?.value;
    const isBank = REFUND_BANK_METHODS.includes(method);
    if (els.refundAccountLabel) els.refundAccountLabel.textContent = isBank ? 'Nomor Rekening' : 'Nomor Telepon / ID Akun';
    if (els.refundAccount) els.refundAccount.placeholder = isBank ? 'Masukkan nomor rekening' : 'Masukkan nomor telepon / ID akun';
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

    showNotification('Pengajuan pembatalan berhasil dikirim.');
    closeRefundModal();
    els.refundForm.reset();
    updateAccountLabel();
    state.refund = await fetchRefundStatus(state.order);
    renderRefundStatus(state.refund);
  }

  function setView(view) {
    els.loading?.classList.toggle('hidden', view !== 'loading');
    els.content?.classList.toggle('hidden', view !== 'content');
    els.empty?.classList.toggle('hidden', view !== 'empty');
    els.error?.classList.toggle('hidden', view !== 'error');
  }

  async function renderOrder(order) {
    const embeddedItems = getOrderItems(order);
    const tableItems = embeddedItems.length ? [] : await fetchOrderItemsFromTable(order);
    state.items = [...embeddedItems, ...tableItems].map(normalizeItem);
    state.refund = await fetchRefundStatus(order);

    renderOrderHeader(order);
    renderOrderInfo(order);
    renderStatusDetail(order);
    renderProducts(state.items);
    renderCostSummary(order);
    renderShippingInfo(order);
    renderPaymentAction(order);
    renderRefundAction(order);
    renderRefundStatus(state.refund);
  }

  async function initPage() {
    setView('loading');
    try {
      const orderId = readOrderIdFromUrl();
      if (!orderId) {
        setView('empty');
        return;
      }

      const order = await fetchOrderById(orderId);
      if (!order) {
        setView('empty');
        return;
      }

      state.order = order;
      await renderOrder(order);
      setView('content');
    } catch (error) {
      console.error('[Order Detail] Failed to initialize page:', error);
      if (els.errorMessage) els.errorMessage.textContent = error?.message || 'Silakan coba muat ulang halaman.';
      setView('error');
    }
  }

  function bindEvents() {
    if (els.refundActionBtn) els.refundActionBtn.addEventListener('click', openRefundModal);
    if (els.refundModalClose) els.refundModalClose.addEventListener('click', closeRefundModal);
    if (els.refundCancelBtn) els.refundCancelBtn.addEventListener('click', closeRefundModal);
    if (els.refundMethod) els.refundMethod.addEventListener('change', updateAccountLabel);
    if (els.retryBtn) els.retryBtn.addEventListener('click', initPage);

    if (els.refundForm) {
      els.refundForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!validateForm()) return;

        els.refundSubmitBtn.disabled = true;
        try {
          await submitRefundRequest();
        } catch (error) {
          console.error('[Order Detail] Failed to submit refund request:', error);
          showNotification('Gagal mengirim pengajuan pembatalan.', true);
        } finally {
          els.refundSubmitBtn.disabled = false;
        }
      });
    }

    if (els.payNowBtn) {
      els.payNowBtn.addEventListener('click', async () => {
        if (state.paymentExpired) return;
        els.payNowBtn.disabled = true;
        try {
          await handlePayNow();
        } catch (error) {
          console.error('[Order Detail] Failed to start payment:', error);
          showNotification(error?.message || 'Gagal memulai pembayaran.', true);
        } finally {
          if (!state.paymentExpired) els.payNowBtn.disabled = false;
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    bindEvents();
    updateAccountLabel();
    await initPage();
  });
})();
