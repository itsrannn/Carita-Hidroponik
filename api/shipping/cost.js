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

function findMatchingZone(address, zones) {
  const city = String(address?.city || address?.district || '').toLowerCase();
  const province = String(address?.province || '').toLowerCase();

  return zones.find((z) => city.includes(String(z.district_match || '').toLowerCase())
      && province.includes(String(z.province_match || '').toLowerCase())
      && z.is_active);
}

function calculateShipping(address, weightKg, zones, settings) {
  const zone = findMatchingZone(address, zones);
  if (zone) return { cost: zone.base_rate + (weightKg * zone.extra_per_kg), zone };
  return {
    cost: Number(settings?.international_flat_rate || 0),
    zone: { zone_name: 'International Flat Rate', is_international: true }
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
        zone_name: shipping.zone.zone_name || 'Unknown'
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to calculate shipping cost' });
  }
};
