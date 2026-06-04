window.AdminShippingPage = (() => {
  const DEFAULT_ZONES = [
    { zone_code: '11', region_name: 'Kecamatan Turen', price: 8000, currency: 'IDR' },
    { zone_code: '24', region_name: 'Kabupaten Malang', price: 10000, currency: 'IDR' },
    { zone_code: '37', region_name: 'Provinsi Jawa Timur', price: 15000, currency: 'IDR' },
    { zone_code: '62', region_name: 'Indonesia', price: 30000, currency: 'IDR' },
    { zone_code: '98', region_name: 'Luar Negeri', price: 2, currency: 'USD' }
  ];
  let zones = [];

  const el = (id) => document.getElementById(id);
  const fmt = (z) => `${z.currency || 'IDR'} ${Number(z.price ?? z.base_rate ?? 0).toLocaleString((z.currency || 'IDR') === 'USD' ? 'en-US' : 'id-ID')}`;
  const notice = (text, isError = false) => {
    const n = el('shipping-admin-notice'); if (!n) return;
    n.textContent = text; n.className = `shipping-notice show ${isError ? 'error' : ''}`;
    setTimeout(() => n.classList.remove('show'), 3000);
  };

  function normalizeZone(z) {
    return {
      id: z.id,
      zone_code: z.zone_code || zoneCodeFromOld(z),
      region_name: z.region_name || z.zone_name || [z.district_match, z.province_match].filter(Boolean).join(', ') || '-',
      price: Number(z.price ?? z.base_rate ?? 0),
      currency: z.currency || (z.is_international ? 'USD' : 'IDR'),
      updated_at: z.updated_at
    };
  }
  function zoneCodeFromOld(z) {
    const name = String(z.zone_name || '').toLowerCase();
    if (name.includes('turen')) return '11'; if (name.includes('malang')) return '24'; if (name.includes('jawa timur')) return '37'; if (name.includes('indonesia')) return '62'; if (z.is_international) return '98'; return String(z.id || '');
  }

  async function loadZones() {
    const { data, error } = await window.supabase.from('shipping_zones').select('*').order('zone_code', { ascending: true });
    if (error) throw error;
    zones = (data || []).map(normalizeZone);
    renderZones();
  }

  function filteredZones() {
    const query = (el('shipping-zone-search')?.value || '').toLowerCase().trim();
    const sort = el('shipping-zone-sort')?.value || 'asc';
    return zones
      .filter((z) => !query || z.zone_code.includes(query) || z.region_name.toLowerCase().includes(query))
      .sort((a, b) => sort === 'desc' ? Number(b.zone_code) - Number(a.zone_code) : Number(a.zone_code) - Number(b.zone_code));
  }

  function renderZones() {
    const tbody = el('shipping-rates-tbody'); if (!tbody) return;
    const list = filteredZones();
    tbody.innerHTML = list.length ? list.map((z) => `<tr>
      <td><strong>${z.zone_code}</strong></td>
      <td>${z.region_name}</td>
      <td><div class="price-editor"><select data-currency-id="${z.id}"><option value="IDR" ${z.currency === 'IDR' ? 'selected' : ''}>IDR</option><option value="USD" ${z.currency === 'USD' ? 'selected' : ''}>USD</option></select><input type="number" min="0" step="${z.currency === 'USD' ? '0.01' : '1'}" value="${z.price}" data-price-id="${z.id}"></div><small>${fmt(z)}</small></td>
      <td>${z.updated_at ? new Date(z.updated_at).toLocaleString('id-ID') : '-'}</td>
      <td><button class="btn-action btn-primary" data-save-id="${z.id}">Save</button></td>
    </tr>`).join('') : '<tr><td colspan="5">Belum ada zona ongkir. Jalankan migration seed shipping_zones.</td></tr>';
  }

  async function saveZone(id) {
    const zone = zones.find((z) => String(z.id) === String(id)); if (!zone) return;
    const price = Number(document.querySelector(`[data-price-id="${id}"]`)?.value);
    const currency = document.querySelector(`[data-currency-id="${id}"]`)?.value || zone.currency;
    if (!Number.isFinite(price) || price < 0) throw new Error('Harga tidak valid.');
    const payload = { zone_code: zone.zone_code, region_name: zone.region_name, price, currency, updated_at: new Date().toISOString() };
    const { error } = await window.supabase.from('shipping_zones').update(payload).eq('id', id);
    if (error) throw error;
    zone.price = price; zone.currency = currency; zone.updated_at = payload.updated_at;
    renderZones(); notice('Harga ongkir berhasil disimpan.');
  }

  async function seedDefaults() {
    for (const zone of DEFAULT_ZONES) {
      const exists = zones.some((z) => z.zone_code === zone.zone_code);
      if (!exists) {
        const { error } = await window.supabase.from('shipping_zones').insert({ ...zone, updated_at: new Date().toISOString() });
        if (error) throw error;
      }
    }
    await loadZones(); notice('Zona default berhasil dibuat.');
  }

  function bindEvents() {
    el('shipping-rates-tbody')?.addEventListener('click', async (event) => {
      const id = event.target?.dataset?.saveId;
      if (id) { try { await saveZone(id); } catch (e) { notice(e.message, true); } }
    });
    el('shipping-zone-search')?.addEventListener('input', renderZones);
    el('shipping-zone-sort')?.addEventListener('change', renderZones);
    el('seed-shipping-zones-btn')?.addEventListener('click', async () => { try { await seedDefaults(); } catch (e) { notice(e.message, true); } });
  }

  async function init() {
    if (!el('shipping-admin-root') || !window.supabase) return;
    bindEvents();
    try { await loadZones(); } catch (e) { notice(e.message, true); }
  }
  return { init };
})();
