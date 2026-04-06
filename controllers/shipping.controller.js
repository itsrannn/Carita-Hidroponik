/**
 * Controller for RajaOngkir API Proxy
 */

const RAJAONGKIR_API_KEY = process.env.RAJAONGKIR_API_KEY;
const RAJAONGKIR_BASE_URL = 'https://api.rajaongkir.com/starter';
const SHOP_ORIGIN_ID = '398'; // Kabupaten Serang
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://thetdckuftpzyubvlbju.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZXRkY2t1ZnRwenl1YnZsYmp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3Nzk2NzgsImV4cCI6MjA3ODM1NTY3OH0.79TyhVbyQzKa9xFeg9JxVLxcN0NVyYBx-_VniQFfQZg';

function normalizeRegionName(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\b(kabupaten|kab|kota|city|regency)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function getAuthenticatedUser(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return { error: 'Authentication required.' };
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    return { error: 'Invalid or expired session token.' };
  }

  const user = await response.json();
  return { token, user };
}

async function getUserShippingProfile(token, userId) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=province,regency,district,address,latitude,longitude`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });

  if (!response.ok) return null;
  const rows = await response.json();
  return rows?.[0] || null;
}

async function resolveDestinationCityId(profile) {
  const provinceResponse = await fetch(`${RAJAONGKIR_BASE_URL}/province`, {
    headers: { key: RAJAONGKIR_API_KEY }
  });
  const provinceData = await provinceResponse.json();
  if (provinceData?.rajaongkir?.status?.code !== 200) return null;

  const provinceMatch = provinceData.rajaongkir.results.find((item) => {
    return normalizeRegionName(item.province) === normalizeRegionName(profile.province);
  });
  if (!provinceMatch?.province_id) return null;

  const cityResponse = await fetch(`${RAJAONGKIR_BASE_URL}/city?province=${provinceMatch.province_id}`, {
    headers: { key: RAJAONGKIR_API_KEY }
  });
  const cityData = await cityResponse.json();
  if (cityData?.rajaongkir?.status?.code !== 200) return null;

  const targetRegency = normalizeRegionName(profile.regency);
  const cityMatch = cityData.rajaongkir.results.find((item) => normalizeRegionName(item.city_name) === targetRegency)
    || cityData.rajaongkir.results.find((item) => normalizeRegionName(item.city_name).includes(targetRegency))
    || cityData.rajaongkir.results.find((item) => targetRegency.includes(normalizeRegionName(item.city_name)));

  return cityMatch?.city_id || null;
}

async function getProvinces(req, res) {
  try {
    const response = await fetch(`${RAJAONGKIR_BASE_URL}/province`, {
      headers: { 'key': RAJAONGKIR_API_KEY }
    });
    const data = await response.json();

    if (data.rajaongkir.status.code !== 200) {
      return res.status(data.rajaongkir.status.code).json({ message: data.rajaongkir.status.description });
    }

    return res.json(data.rajaongkir.results);
  } catch (error) {
    console.error('Error fetching provinces:', error);
    return res.status(500).json({ message: 'Internal server error fetching provinces.' });
  }
}

async function getCities(req, res) {
  const { provinceId } = req.params;
  try {
    const response = await fetch(`${RAJAONGKIR_BASE_URL}/city?province=${provinceId}`, {
      headers: { 'key': RAJAONGKIR_API_KEY }
    });
    const data = await response.json();

    if (data.rajaongkir.status.code !== 200) {
      return res.status(data.rajaongkir.status.code).json({ message: data.rajaongkir.status.description });
    }

    return res.json(data.rajaongkir.results);
  } catch (error) {
    console.error('Error fetching cities:', error);
    return res.status(500).json({ message: 'Internal server error fetching cities.' });
  }
}

async function calculateCost(req, res) {
  const { weight, courier } = req.body;

  if (!weight || !courier) {
    return res.status(400).json({ message: 'Weight and courier are required.' });
  }

  try {
    const auth = await getAuthenticatedUser(req);
    if (auth.error) {
      return res.status(401).json({ message: auth.error });
    }

    const profile = await getUserShippingProfile(auth.token, auth.user.id);
    const requiredFields = ['province', 'regency', 'district', 'address', 'latitude', 'longitude'];
    const profileIncomplete = !profile || requiredFields.some((field) => profile[field] == null || String(profile[field]).trim() === '');
    if (profileIncomplete) {
      return res.status(409).json({ message: 'Profile address is incomplete. Please complete your profile first.' });
    }

    const destinationCityId = await resolveDestinationCityId(profile);
    if (!destinationCityId) {
      return res.status(422).json({ message: 'Unable to resolve shipping destination from profile address.' });
    }

    const response = await fetch(`${RAJAONGKIR_BASE_URL}/cost`, {
      method: 'POST',
      headers: {
        'key': RAJAONGKIR_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        origin: SHOP_ORIGIN_ID,
        destination: destinationCityId,
        weight: weight,
        courier: courier
      })
    });

    const data = await response.json();

    if (data.rajaongkir.status.code !== 200) {
      return res.status(data.rajaongkir.status.code).json({ message: data.rajaongkir.status.description });
    }

    return res.json({
      ...data.rajaongkir.results[0],
      destination_city_id: destinationCityId
    });
  } catch (error) {
    console.error('Error calculating cost:', error);
    return res.status(500).json({ message: 'Internal server error calculating shipping cost.' });
  }
}

module.exports = {
  getProvinces,
  getCities,
  calculateCost
};
