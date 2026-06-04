const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://thetdckuftpzyubvlbju.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function setCorsHeaders(res) {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => res.setHeader(key, value));
}

async function fetchShippingConfig() {
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json'
  };

  const [zonesRes, settingsRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/shipping_zones?select=*&is_active=eq.true`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/shipping_settings?id=eq.1&select=*`, { headers })
  ]);

  const zones = await zonesRes.json();
  const settingsData = await settingsRes.json();
  return { zones: Array.isArray(zones) ? zones : [], settings: settingsData?.[0] || null };
}

function text(value) {
  return String(value || '').toLowerCase();
}

function zonePrice(zone) {
  return Number(zone?.price ?? zone?.base_rate ?? 0);
}

function findZoneByCode(zones, code) {
  return zones.find((zone) => String(zone.zone_code || '') === String(code));
}

function findMatchingZone(address, zones) {
  const district = text(address?.district || address?.kecamatan || address?.city);
  const regency = text(address?.regency || address?.kabupaten || address?.city);
  const province = text(address?.province || address?.provinsi);
  const country = text(address?.country || address?.negara || 'Indonesia');

  if (country && country !== 'indonesia') return findZoneByCode(zones, '98');
  if (district.includes('turen')) return findZoneByCode(zones, '11');
  if (regency.includes('malang')) return findZoneByCode(zones, '24');
  if (province.includes('jawa timur') || province.includes('east java')) return findZoneByCode(zones, '37');
  return findZoneByCode(zones, '62') || zones.find((zone) => text(zone.region_name || zone.zone_name).includes('indonesia'));
}

function calculateShipping(address, _weightKg, zones, settings) {
  const zone = findMatchingZone(address, zones);
  if (zone) return { cost: zonePrice(zone), zone };
  return {
    cost: Number(settings?.international_flat_rate || 2),
    zone: { zone_code: '98', region_name: 'Luar Negeri', zone_name: 'Luar Negeri', currency: 'USD', is_international: true }
  };
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });
  if (!SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ success: false, error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' });

  try {
    const weightGrams = Number(req.body?.totalWeight || req.body?.weight || 0);
    const quantity = Math.max(1, Number(req.body?.quantity || 1));
    const normalizedWeightGrams = weightGrams > 0 ? weightGrams : 0;
    const billedWeightKg = Math.max(1, Math.ceil((normalizedWeightGrams * quantity) / 1000));

    const { zones, settings } = await fetchShippingConfig();
    const shipping = calculateShipping(req.body?.address || {}, billedWeightKg, zones, settings);

    return res.status(200).json({
      success: true,
      cost: Number(shipping.cost),
      billed_weight_kg: billedWeightKg,
      recommendation: {
        courier: 'rekomendasi-kami',
        cost: Number(shipping.cost),
        zone_name: shipping.zone.region_name || shipping.zone.zone_name || 'Unknown',
        zone_code: shipping.zone.zone_code || null,
        currency: shipping.zone.currency || 'IDR'
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to calculate shipping cost' });
  }
};
