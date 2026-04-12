const SUPABASE_URL = process.env.SUPABASE_URL || 'https://thetdckuftpzyubvlbju.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_PROFILE_FIELDS = new Set([
  'full_name',
  'phone_number',
  'address',
  'postal_code',
  'latitude',
  'longitude',
  'province',
  'city',
  'regency',
  'district',
  'village',
  'province_id',
  'city_id',
  'regency_id',
  'district_id',
  'village_id'
]);

function sanitizePayload(payload = {}) {
  const sanitized = {};
  Object.entries(payload).forEach(([key, value]) => {
    if (!ALLOWED_PROFILE_FIELDS.has(key)) return;
    sanitized[key] = value === undefined ? null : value;
  });
  return sanitized;
}

async function updateProfile(req, res) {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ message: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the backend.' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${token}`
      }
    });

    if (!authResponse.ok) {
      return res.status(401).json({ message: 'Invalid or expired session token.' });
    }
    const user = await authResponse.json();

    const payload = sanitizePayload(req.body?.data || {});
    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ message: 'No valid profile fields provided.' });
    }

    const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=*`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(payload)
    });

    if (!updateResponse.ok) {
      const details = await updateResponse.text();
      console.error('[ProfileAPI] Failed to update profile:', details);
      return res.status(500).json({ message: 'Failed to update profile.' });
    }
    const rows = await updateResponse.json();
    const profile = Array.isArray(rows) ? rows[0] : rows;

    return res.status(200).json({
      message: 'Profile updated successfully.',
      profile
    });
  } catch (error) {
    console.error('[ProfileAPI] Unhandled error while updating profile:', error);
    return res.status(500).json({ message: 'Internal server error while updating profile.' });
  }
}

module.exports = {
  updateProfile
};
