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
  const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=province,regency,city,city_id,regency_id,district,address,latitude,longitude,destination_city_id`, {
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

function getCityNameFromProfile(profile = {}) {
  return profile.regency
    || profile.city
    || profile.kota
    || profile.kabupaten
    || null;
}

async function resolveDestinationCityId(profile) {
  const directCityId = profile?.destination_city_id
    || profile?.destinationCityId
    || profile?.city_id
    || profile?.cityId
    || profile?.regency_id
    || profile?.regencyId
    || null;
  if (directCityId) return String(directCityId);

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

  const targetRegency = normalizeRegionName(getCityNameFromProfile(profile));
  if (!targetRegency) return null;
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

async function resolveDestination(req, res) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (auth.error) {
      return res.status(401).json({ message: auth.error });
    }

    const profile = await getUserShippingProfile(auth.token, auth.user.id);
    const requestRegion = req.body?.regency || req.body?.city || null;
    const requestProvince = req.body?.province || null;
    const sourceProfile = {
      ...(profile || {}),
      regency: requestRegion || profile?.regency || profile?.city || null,
      city: requestRegion || profile?.city || profile?.regency || null,
      province: requestProvince || profile?.province || null,
      destination_city_id: req.body?.destination_city_id || req.body?.destinationCityId || profile?.destination_city_id || null
    };

    console.info('[Shipping] Resolve destination input:', {
      user_id: auth.user.id,
      province: sourceProfile.province,
      regency: sourceProfile.regency,
      city: sourceProfile.city,
      city_id: sourceProfile.city_id,
      regency_id: sourceProfile.regency_id
    });

    const destinationCityId = await resolveDestinationCityId(sourceProfile);
    if (!destinationCityId) {
      return res.status(422).json({ message: 'Unable to resolve destination city ID.' });
    }

    return res.json({
      status: 'success',
      destinationCityId,
      destination_city_id: destinationCityId
    });
  } catch (error) {
    console.error('Error resolving destination city ID:', error);
    return res.status(500).json({ message: 'Internal server error resolving destination city ID.' });
  }
}

async function calculateCost(req, res) {
  const { weight, courier, destination } = req.body;

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

    const destinationCityId = destination || await resolveDestinationCityId(profile);
    if (!destinationCityId) {
      return res.status(422).json({ message: 'Unable to resolve shipping destination from profile address.' });
    }

    console.info('[Shipping] Cost request payload:', {
      user_id: auth.user.id,
      courier,
      weight,
      destination_city_id: destinationCityId,
      latitude: profile.latitude,
      longitude: profile.longitude
    });

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

    const shippingResult = data.rajaongkir.results?.[0] || {};
    const services = Array.isArray(shippingResult.costs) ? shippingResult.costs : [];

    console.info('[Shipping] Cost response summary:', {
      courier: shippingResult.code || courier,
      service_count: services.length
    });

    return res.json({
      status: 'success',
      courier: shippingResult.code || courier,
      destination_city_id: destinationCityId,
      data: services,
      shippingOption: shippingResult
    });
  } catch (error) {
    console.error('Error calculating cost:', error);
    return res.status(500).json({ message: 'Internal server error calculating shipping cost.' });
  }
}

module.exports = {
  getProvinces,
  getCities,
  resolveDestination,
  calculateCost
};
