const SUPABASE_URL = process.env.SUPABASE_URL || 'https://thetdckuftpzyubvlbju.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZXRkY2t1ZnRwenl1YnZsYmp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3Nzk2NzgsImV4cCI6MjA3ODM1NTY3OH0.79TyhVbyQzKa9xFeg9JxVLxcN0NVyYBx-_VniQFfQZg';

const SHIPPING_ORIGIN = {
  district: 'Turen',
  regency: 'Kabupaten Malang',
  province: 'Jawa Timur'
};

function normalizeRegionName(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\b(kabupaten|kab|kota|city|regency|kec|kecamatan|provinsi|province)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toWeightKg(rawWeight) {
  const parsedWeight = Number(rawWeight || 0);
  if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) return 1;
  return Math.max(1, Math.ceil(parsedWeight / 1000));
}

function calculateShippingCost({ weightKg, baseRate, extraPerKg }) {
  const minimumWeightKg = Math.max(1, Number(weightKg || 1));
  const safeBaseRate = Math.max(0, Number(baseRate || 0));
  const safeExtraPerKg = Math.max(0, Number(extraPerKg || 0));
  const additionalWeight = Math.max(0, minimumWeightKg - 1);

  return safeBaseRate + (additionalWeight * safeExtraPerKg);
}

function calculateFallbackShippingCost({ weightKg, distanceKm, destinationProvince }) {
  const minimumWeightKg = Math.max(1, Number(weightKg || 1));
  const normalizedProvince = normalizeRegionName(destinationProvince);
  const safeDistanceKm = Math.max(1, Number(distanceKm || 10));

  const baseRate = 12000;
  const perKgRate = 2500;
  const perKmRate = 150;

  const longHaulMultiplier = safeDistanceKm > 80 ? 1.15 : 1;
  const provinceMultiplier = normalizedProvince.includes('jawa timur') ? 1 : 1.2;

  const subtotal = baseRate + ((minimumWeightKg - 1) * perKgRate) + (safeDistanceKm * perKmRate);
  return Math.round(subtotal * longHaulMultiplier * provinceMultiplier);
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
  const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=province,regency,city,district,address,village,postal_code`, {
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

async function getActiveShippingRates(token) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/shipping_rates?select=*&is_active=eq.true&order=id.asc`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch shipping rates configuration.');
  }

  const rates = await response.json();
  return Array.isArray(rates) ? rates : [];
}


async function getShippingSettings(token) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/shipping_settings?select=recommended_shipping_enabled&limit=1`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch shipping settings.');
  }

  const rows = await response.json();
  return rows?.[0] || { recommended_shipping_enabled: true };
}
function resolveShippingRate(profile = {}, rates = []) {
  const district = normalizeRegionName(profile.district);
  const regency = normalizeRegionName(profile.regency || profile.city);
  const province = normalizeRegionName(profile.province);

  let fallbackRate = null;

  for (const rate of rates) {
    const districtMatch = normalizeRegionName(rate.district_match);
    const provinceMatch = normalizeRegionName(rate.province_match);

    if (!districtMatch && !provinceMatch && !fallbackRate) {
      fallbackRate = rate;
      continue;
    }

    if (districtMatch && (district.includes(districtMatch) || regency.includes(districtMatch))) {
      return rate;
    }

    if (provinceMatch && province.includes(provinceMatch)) {
      return rate;
    }
  }

  return fallbackRate;
}

async function calculateCost(req, res) {
  const { weight, distanceKm } = req.body || {};

  try {
    const auth = await getAuthenticatedUser(req);
    if (auth.error) {
      return res.status(401).json({ message: auth.error });
    }

    const profile = await getUserShippingProfile(auth.token, auth.user.id);
    const requiredFields = ['province', 'regency', 'district', 'address'];
    const profileIncomplete = !profile || requiredFields.some((field) => profile[field] == null || String(profile[field]).trim() === '');
    if (profileIncomplete) {
      return res.status(409).json({ message: 'Profile address is incomplete. Please complete your profile first.' });
    }

    const settings = await getShippingSettings(auth.token);
    if (!settings.recommended_shipping_enabled) {
      return res.status(503).json({ message: 'Metode Rekomendasi Kami sedang dinonaktifkan oleh admin.' });
    }

    const weightKg = toWeightKg(weight);
    const rates = await getActiveShippingRates(auth.token);
    const matchedRate = resolveShippingRate(profile, rates);
    const hasConfiguredRate = Boolean(matchedRate);

    const shippingCost = hasConfiguredRate
      ? calculateShippingCost({
          weightKg,
          baseRate: matchedRate.base_rate,
          extraPerKg: matchedRate.extra_per_kg
        })
      : calculateFallbackShippingCost({
          weightKg,
          distanceKm,
          destinationProvince: profile.province
        });

    return res.json({
      status: 'success',
      origin: SHIPPING_ORIGIN,
      recommendation: {
        code: 'rekomendasi-kami',
        label: 'Rekomendasi Kami',
        badge: 'Direkomendasikan',
        zone_name: hasConfiguredRate ? matchedRate.zone_name : 'Fallback Manual',
        base_rate: Number(hasConfiguredRate ? matchedRate.base_rate : 12000),
        extra_per_kg: Number(hasConfiguredRate ? matchedRate.extra_per_kg : 2500),
        weight_kg: weightKg,
        cost: shippingCost,
        etd: '1-4 hari kerja'
      }
    });
  } catch (error) {
    console.error('Error calculating internal shipping cost:', error);
    return res.status(500).json({ message: 'Internal server error calculating shipping cost.' });
  }
}

module.exports = {
  calculateCost
};
