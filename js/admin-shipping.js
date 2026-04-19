window.AdminShippingPage = (() => {
  let shippingRates = [];

  function state() {
    return {
      root: document.getElementById('shipping-admin-root'),
      tbody: document.getElementById('shipping-rates-tbody'),
      notice: document.getElementById('shipping-admin-notice'),
      toggle: document.getElementById('recommended-shipping-toggle'),
      editId: document.getElementById('editing-rate-id'),
      zoneName: document.getElementById('zone-name'),
      districtMatch: document.getElementById('district-match'),
      provinceMatch: document.getElementById('province-match'),
      baseRate: document.getElementById('base-rate'),
      extraRate: document.getElementById('extra-rate'),
      isActive: document.getElementById('rate-active'),
      saveBtn: document.getElementById('save-rate-btn')
    };
  }

  function showNotice(text = 'Perubahan berhasil disimpan.') {
    const el = document.getElementById('shipping-admin-notice');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2200);
  }

  async function loadSettings() {
    const { data, error } = await supabase.from('shipping_settings').select('*').limit(1).maybeSingle();
    if (error) throw error;
    const settings = data || { recommended_shipping_enabled: true };
    const toggle = document.getElementById('recommended-shipping-toggle');
    if (toggle) toggle.checked = Boolean(settings.recommended_shipping_enabled);
  }

  async function saveSettings() {
    const toggle = document.getElementById('recommended-shipping-toggle');
    if (!toggle) return;

    const payload = { id: 1, recommended_shipping_enabled: Boolean(toggle.checked), updated_at: new Date().toISOString() };
    const { error } = await supabase.from('shipping_settings').upsert(payload, { onConflict: 'id' });
    if (error) throw error;
    showNotice('Status rekomendasi pengiriman berhasil disimpan.');
  }

  function clearForm() {
    const s = state();
    s.editId.value = '';
    s.zoneName.value = '';
    s.districtMatch.value = '';
    s.provinceMatch.value = '';
    s.baseRate.value = '';
    s.extraRate.value = '';
    s.isActive.value = 'true';
  }

  function populateForm(rate) {
    const s = state();
    s.editId.value = String(rate.id);
    s.zoneName.value = rate.zone_name || '';
    s.districtMatch.value = rate.district_match || '';
    s.provinceMatch.value = rate.province_match || '';
    s.baseRate.value = Number(rate.base_rate || 0);
    s.extraRate.value = Number(rate.extra_per_kg || 0);
    s.isActive.value = String(Boolean(rate.is_active));
  }

  async function loadRates() {
    const s = state();
    const { data, error } = await supabase.from('shipping_rates').select('*').order('id', { ascending: true });
    if (error) throw error;
    shippingRates = Array.isArray(data) ? data : [];

    s.tbody.innerHTML = '';
    shippingRates.forEach((rate) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${rate.zone_name || '-'}</td>
        <td>${rate.district_match || '-'}</td>
        <td>${rate.province_match || '-'}</td>
        <td>${window.formatRupiah(Number(rate.base_rate || 0))}</td>
        <td>${window.formatRupiah(Number(rate.extra_per_kg || 0))}</td>
        <td>${rate.is_active ? 'Aktif' : 'Nonaktif'}</td>
        <td>
          <button class="btn-action btn-primary" data-edit-id="${rate.id}">Edit</button>
          <button class="btn-action btn-danger" data-delete-id="${rate.id}">Hapus</button>
        </td>
      `;
      s.tbody.appendChild(tr);
    });
  }

  async function saveRate() {
    const s = state();
    const editingId = s.editId.value ? Number(s.editId.value) : null;

    const payload = {
      zone_name: s.zoneName.value.trim(),
      district_match: s.districtMatch.value.trim() || null,
      province_match: s.provinceMatch.value.trim() || null,
      base_rate: Number(s.baseRate.value || 0),
      extra_per_kg: Number(s.extraRate.value || 0),
      is_active: s.isActive.value === 'true',
      updated_at: new Date().toISOString()
    };

    if (!payload.zone_name) {
      alert('Zone name wajib diisi.');
      return;
    }

    let query = supabase.from('shipping_rates');
    if (editingId) {
      const { error } = await query.update(payload).eq('id', editingId);
      if (error) throw error;
    } else {
      const { error } = await query.insert(payload);
      if (error) throw error;
    }

    clearForm();
    await loadRates();
    showNotice('Zona ongkir berhasil disimpan.');
  }

  async function deleteRate(id) {
    if (!window.confirm('Hapus zona ongkir ini?')) return;
    const { error } = await supabase.from('shipping_rates').delete().eq('id', id);
    if (error) throw error;
    await loadRates();
    showNotice('Zona ongkir berhasil dihapus.');
  }

  function bindEvents() {
    const s = state();
    s.saveBtn?.addEventListener('click', async () => {
      try {
        await saveRate();
      } catch (error) {
        alert(`Gagal menyimpan zona: ${error.message}`);
      }
    });

    s.toggle?.addEventListener('change', async () => {
      try {
        await saveSettings();
      } catch (error) {
        alert(`Gagal menyimpan pengaturan: ${error.message}`);
      }
    });

    s.tbody?.addEventListener('click', async (event) => {
      const editId = event.target?.dataset?.editId;
      const deleteId = event.target?.dataset?.deleteId;
      if (editId) {
        const rate = shippingRates.find((item) => Number(item.id) === Number(editId));
        if (rate) populateForm(rate);
      }

      if (deleteId) {
        try {
          await deleteRate(Number(deleteId));
        } catch (error) {
          alert(`Gagal menghapus zona: ${error.message}`);
        }
      }
    });
  }

  async function init() {
    const s = state();
    if (!s.root) return;

    bindEvents();
    try {
      await Promise.all([loadSettings(), loadRates()]);
    } catch (error) {
      alert(`Gagal memuat data ongkir: ${error.message}`);
    }
  }

  return { init };
})();
