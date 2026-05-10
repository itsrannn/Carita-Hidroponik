window.AdminShippingPage = (() => {
  const API_BASE_URL = window.location.hostname.includes('localhost') ? 'http://localhost:3000/api' : 'https://caritahidroponik.com/api';
  let shippingZones = [];

  const fmtIdr = (n) => `Rp${Number(n || 0).toLocaleString('id-ID')}`;
  const fmtUsd = (n) => `$${Number(n || 0).toLocaleString('en-US')}/kg`;

  function el(id) { return document.getElementById(id); }
  function showNotice(text, isError = false) {
    const n = el('shipping-admin-notice');
    if (!n) return;
    n.textContent = text;
    n.className = `shipping-notice show ${isError ? 'error' : ''}`;
    setTimeout(() => n.classList.remove('show'), 2500);
  }

  function getPayload() {
    return {
      type: el('zone-type').value,
      province: el('province').value.trim(),
      regency: el('regency').value.trim(),
      district: el('district').value.trim(),
      price_per_kg: Number(el('price-per-kg').value),
      estimate: el('estimate').value.trim(),
      is_international: el('is-international').checked
    };
  }

  function renderZones() {
    const tbody = el('shipping-rates-tbody');
    if (!tbody) return;
    if (!shippingZones.length) {
      tbody.innerHTML = '<tr><td colspan="5">Belum ada zona ongkir.</td></tr>';
      return;
    }
    tbody.innerHTML = shippingZones.map((z, i) => {
      const wilayah = [z.district, z.regency, z.province].filter(Boolean).join(', ') || '-';
      const price = z.is_international ? fmtUsd(z.price_per_kg) : fmtIdr(z.price_per_kg);
      return `<tr>
        <td>${i + 1}</td>
        <td>${wilayah}</td>
        <td>${price}</td>
        <td>${z.estimate || '-'}</td>
        <td>
          <button class="btn-action btn-primary" data-edit-id="${z.id}">Edit</button>
          <button class="btn-action btn-danger" data-delete-id="${z.id}">Hapus</button>
        </td>
      </tr>`;
    }).join('');
  }

  async function loadZones() {
    const res = await fetch(`${API_BASE_URL}/admin/shipping-zones`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message || 'Gagal memuat data ongkir.');
    shippingZones = json?.data || json || [];
    renderZones();
  }

  function openModal(editId = null) {
    const modal = el('shipping-modal');
    const title = el('shipping-modal-title');
    el('editing-rate-id').value = editId || '';
    if (editId) {
      const z = shippingZones.find((x) => String(x.id) === String(editId));
      if (z) {
        el('zone-type').value = z.type || 'district';
        el('province').value = z.province || '';
        el('regency').value = z.regency || '';
        el('district').value = z.district || '';
        el('price-per-kg').value = z.price_per_kg || 0;
        el('estimate').value = z.estimate || '';
        el('is-international').checked = Boolean(z.is_international);
      }
      title.textContent = 'Edit Zona Ongkir';
    } else {
      el('shipping-form').reset();
      title.textContent = 'Tambah Zona Ongkir';
    }
    modal.style.display = 'flex';
  }

  function closeModal() { el('shipping-modal').style.display = 'none'; }

  async function saveZone() {
    const id = el('editing-rate-id').value;
    const payload = getPayload();
    const endpoint = id ? `${API_BASE_URL}/admin/shipping-zones/${id}` : `${API_BASE_URL}/admin/shipping-zones`;
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message || 'Gagal menyimpan zona ongkir.');
    closeModal();
    await loadZones();
    showNotice('Zona ongkir berhasil disimpan.');
  }

  async function deleteZone(id) {
    const res = await fetch(`${API_BASE_URL}/admin/shipping-zones/${id}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message || 'Gagal menghapus zona ongkir.');
    await loadZones();
    showNotice('Zona ongkir berhasil dihapus.');
  }

  function bindEvents() {
    el('open-shipping-modal-btn')?.addEventListener('click', () => openModal());
    el('close-shipping-modal-btn')?.addEventListener('click', closeModal);
    el('save-rate-btn')?.addEventListener('click', async () => { try { await saveZone(); } catch (e) { showNotice(e.message, true); } });
    el('shipping-rates-tbody')?.addEventListener('click', async (e) => {
      const editId = e.target?.dataset?.editId;
      const deleteId = e.target?.dataset?.deleteId;
      if (editId) openModal(editId);
      if (deleteId && window.confirm('Hapus zona ongkir ini?')) {
        try { await deleteZone(deleteId); } catch (err) { showNotice(err.message, true); }
      }
    });
  }

  async function init() {
    if (!el('shipping-admin-root')) return;
    bindEvents();
    try { await loadZones(); } catch (e) { showNotice(e.message, true); }
  }
  return { init };
})();
