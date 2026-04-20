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

function validateProfilePayload(payload = {}) {
  const errors = [];
  const hasLatitude = payload.latitude !== undefined && payload.latitude !== null && payload.latitude !== '';
  const hasLongitude = payload.longitude !== undefined && payload.longitude !== null && payload.longitude !== '';

  if (hasLatitude) {
    const latitude = Number(payload.latitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      errors.push({
        field: 'latitude',
        reason: 'must be a finite number between -90 and 90.'
      });
    }
  }

  if (hasLongitude) {
    const longitude = Number(payload.longitude);
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      errors.push({
        field: 'longitude',
        reason: 'must be a finite number between -180 and 180.'
      });
    }
  }

  return errors;
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

    const rawPayload = req.body?.data || {};
    const payload = sanitizePayload(rawPayload);
    if (Object.keys(payload).length === 0) {
      return res.status(400).json({
        message: 'No valid profile fields provided.',
        details: {
          expectedWrapper: 'data',
          receivedTopLevelKeys: Object.keys(req.body || {}),
          receivedDataKeys: Object.keys(rawPayload || {}),
          allowedFields: Array.from(ALLOWED_PROFILE_FIELDS)
        }
      });
    }

    const validationErrors = validateProfilePayload(payload);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: 'Profile payload validation failed.',
        details: validationErrors
      });
    }

    const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=*`, {
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
    let profile = Array.isArray(rows) ? rows[0] : rows;

    // Safety net: some tenants may not have an existing profile row yet.
    // In that case PATCH returns 200 with an empty array and nothing is persisted.
    // We upsert by id to guarantee persistence for authenticated users.
    if (!profile) {
      const upsertPayload = {
        id: user.id,
        ...payload
      };

      const upsertResponse = await fetch(`${SUPABASE_URL}/rest/v1/profiles?on_conflict=id&select=*`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify(upsertPayload)
      });

      if (!upsertResponse.ok) {
        const details = await upsertResponse.text();
        console.error('[ProfileAPI] Failed to upsert profile:', details);
        return res.status(500).json({ message: 'Failed to persist profile update.' });
      }

      const upsertRows = await upsertResponse.json();
      profile = Array.isArray(upsertRows) ? upsertRows[0] : upsertRows;
    }

    if (!profile?.id) {
      return res.status(500).json({ message: 'Profile update did not return persisted data.' });
    }

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
