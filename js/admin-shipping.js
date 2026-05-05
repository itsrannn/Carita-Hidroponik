window.AdminShippingPage = (() => {
  const API_BASE_URL = window.location.hostname.includes('localhost') ? 'http://localhost:3000/api' : 'https://caritahidroponik.com/api';
  let shippingZones = [];

  function state() {
    return {
      root: document.getElementById('shipping-admin-root'),
      tbody: document.getElementById('shipping-rates-tbody'),
      notice: document.getElementById('shipping-admin-notice'),
      editId: document.getElementById('editing-rate-id'),
      zoneName: document.getElementById('zone-name'),
      districtMatch: document.getElementById('district-match'),
      provinceMatch: document.getElementById('province-match'),
      baseRate: document.getElementById('base-rate'),
      extraRate: document.getElementById('extra-rate'),
      isActive: document.getElementById('rate-active'),
      saveBtn: document.getElementById('save-rate-btn'),
      intlRate: document.getElementById('intl-rate'),
      saveIntlBtn: document.getElementById('save-intl-btn')
    };
  }

  const getValue = (id) => document.getElementById(id)?.value || '';
  function showNotice(text) { const n = document.getElementById('shipping-admin-notice'); if (n) { n.textContent = text; n.classList.add('show'); setTimeout(()=>n.classList.remove('show'),2200);} }

  function validateZonePayload(payload) {
    if (!payload.zone_name) throw new Error('zone_name wajib diisi');
    if (!Number.isFinite(payload.base_rate)) throw new Error('base_rate harus angka');
    if (!Number.isFinite(payload.extra_per_kg)) throw new Error('extra_per_kg harus angka');
  }

  function renderZones(zones) {
    const table = document.getElementById('shipping-rates-tbody');
    if (!table) return;
    if (!zones.length) {
      table.innerHTML = '<tr><td colspan="7">Tidak ada data zona</td></tr>';
      return;
    }
    table.innerHTML = zones.map((z) => `
      <tr>
        <td>${z.zone_name}</td>
        <td>${z.district_match || '-'}</td>
        <td>${z.province_match || '-'}</td>
        <td>${window.formatRupiah(Number(z.base_rate || 0))}</td>
        <td>${window.formatRupiah(Number(z.extra_per_kg || 0))}</td>
        <td>${z.is_active ? 'Aktif' : 'Nonaktif'}</td>
        <td>
          <button class="btn-action btn-primary" data-edit-id="${z.id}">Edit</button>
          <button class="btn-action btn-danger" data-delete-id="${z.id}">Hapus</button>
        </td>
      </tr>`).join('');
  }

  async function loadZones() {
    const res = await fetch(`${API_BASE_URL}/shipping/zones`);
    if (!res.ok) throw new Error('Gagal memuat data zona');
    const data = await res.json();
    shippingZones = data?.data || [];
    renderZones(shippingZones);
  }

  async function saveZone() {
    const s = state();
    const payload = {
      zone_name: getValue('zone-name').trim(),
      district_match: getValue('district-match').trim(),
      province_match: getValue('province-match').trim(),
      base_rate: Number(getValue('base-rate')),
      extra_per_kg: Number(getValue('extra-rate')),
      is_active: getValue('rate-active') === 'true'
    };
    validateZonePayload(payload);

    const method = s.editId.value ? 'PUT' : 'POST';
    const endpoint = s.editId.value ? `${API_BASE_URL}/shipping/zones/${s.editId.value}` : `${API_BASE_URL}/shipping/zones`;
    const res = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error('Failed to save zone');

    s.editId.value = '';
    s.zoneName.value = ''; s.districtMatch.value = ''; s.provinceMatch.value = ''; s.baseRate.value = ''; s.extraRate.value = ''; s.isActive.value = 'true';
    await loadZones();
    showNotice('Zona berhasil disimpan');
  }

  async function deleteZone(id) {
    const res = await fetch(`${API_BASE_URL}/shipping/zones/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Gagal menghapus zona');
    await loadZones();
    showNotice('Zona berhasil dihapus');
  }

  async function loadSettings() {
    const res = await fetch(`${API_BASE_URL}/shipping/settings`);
    if (!res.ok) throw new Error('Gagal memuat pengaturan internasional');
    const data = await res.json();
    if (state().intlRate) state().intlRate.value = Number(data?.data?.international_flat_rate || 0);
  }

  async function saveInternationalRate() {
    const rate = Number(document.getElementById('intl-rate').value);
    const res = await fetch(`${API_BASE_URL}/shipping/settings`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ international_flat_rate: rate, is_international_enabled: true })
    });
    if (!res.ok) throw new Error('Gagal menyimpan tarif internasional');
    showNotice('Tarif internasional disimpan');
  }

  function bindEvents() {
    const s = state();
    s.saveBtn?.addEventListener('click', async () => { try { await saveZone(); } catch (e) { alert(e.message); } });
    s.saveIntlBtn?.addEventListener('click', async () => { try { await saveInternationalRate(); } catch (e) { alert(e.message); } });
    s.tbody?.addEventListener('click', async (event) => {
      const editId = event.target?.dataset?.editId;
      const deleteId = event.target?.dataset?.deleteId;
      if (editId) {
        const z = shippingZones.find((zone) => String(zone.id) === String(editId));
        if (z) {
          s.editId.value = z.id; s.zoneName.value = z.zone_name || ''; s.districtMatch.value = z.district_match || ''; s.provinceMatch.value = z.province_match || ''; s.baseRate.value = z.base_rate; s.extraRate.value = z.extra_per_kg; s.isActive.value = String(Boolean(z.is_active));
        }
      }
      if (deleteId && window.confirm('Hapus zona ini?')) { try { await deleteZone(deleteId); } catch (e) { alert(e.message); } }
    });
  }

  async function init() {
    if (!state().root) return;
    bindEvents();
    await Promise.all([loadZones(), loadSettings()]);
  }

  return { init };
})();
