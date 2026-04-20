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
const REQUIRED_REQUEST_WRAPPER = 'data';
const REQUEST_CONTRACT_FIELDS = new Set([
  ...ALLOWED_PROFILE_FIELDS,
  'user_id',
  'userId',
  'profileId',
  'phone'
]);

function normalizeRequestPayload(rawPayload = {}) {
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    return rawPayload;
  }

  const normalized = { ...rawPayload };
  const normalizedUserId = normalized.user_id || normalized.userId || normalized.profileId || null;
  normalized.user_id = normalizedUserId;

  if (normalized.phone !== undefined && normalized.phone_number === undefined) {
    normalized.phone_number = normalized.phone;
  }

  return normalized;
}

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

function validateRequestContract(rawPayload, authenticatedUserId) {
  const errors = [];
  const isObjectPayload = rawPayload !== null && typeof rawPayload === 'object' && !Array.isArray(rawPayload);

  if (!isObjectPayload) {
    errors.push({
      field: REQUIRED_REQUEST_WRAPPER,
      reason: 'must be an object.'
    });
    return errors;
  }

  const userId = rawPayload.user_id;
  if (!userId || typeof userId !== 'string') {
    errors.push({
      field: 'user_id',
      reason: 'is required and must be a non-empty string.'
    });
  } else if (userId !== authenticatedUserId) {
    errors.push({
      field: 'user_id',
      reason: 'must match the authenticated user id from the bearer token.',
      received: userId,
      expected: authenticatedUserId
    });
  }

  const unknownFields = Object.keys(rawPayload).filter((key) => !REQUEST_CONTRACT_FIELDS.has(key));
  if (unknownFields.length > 0) {
    errors.push({
      field: 'payload',
      reason: 'contains unsupported field names.',
      unsupportedFields: unknownFields,
      allowedFields: Array.from(REQUEST_CONTRACT_FIELDS)
    });
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

    const hasExpectedWrapper = Object.prototype.hasOwnProperty.call(req.body || {}, REQUIRED_REQUEST_WRAPPER);
    if (!hasExpectedWrapper) {
      return res.status(400).json({
        message: 'Invalid request payload contract.',
        details: [
          {
            field: REQUIRED_REQUEST_WRAPPER,
            reason: `missing top-level "${REQUIRED_REQUEST_WRAPPER}" wrapper.`
          }
        ]
      });
    }

    const rawPayload = normalizeRequestPayload(req.body?.data);
    const pick = (source, ...keys) => {
      const result = {};
      keys.forEach((key) => {
        if (source && Object.prototype.hasOwnProperty.call(source, key)) {
          result[key] = source[key];
        }
      });
      return result;
    };
    const toText = (value) => {
      if (value === undefined || value === null) return null;
      const text = String(value).trim();
      return text === '' ? null : text;
    };

    const normalizedPayload = {
      ...pick(rawPayload, 'user_id'),
      full_name: toText(rawPayload?.full_name),
      phone_number: toText(rawPayload?.phone_number),
      address: toText(rawPayload?.address),
      postal_code: toText(rawPayload?.postal_code),
      province: toText(rawPayload?.province),
      city: toText(rawPayload?.city),
      regency: toText(rawPayload?.regency),
      district: toText(rawPayload?.district),
      village: toText(rawPayload?.village),
      province_id: toText(rawPayload?.province_id),
      city_id: toText(rawPayload?.city_id),
      regency_id: toText(rawPayload?.regency_id),
      district_id: toText(rawPayload?.district_id),
      village_id: toText(rawPayload?.village_id),
      latitude:
        rawPayload?.latitude === '' || rawPayload?.latitude === null || rawPayload?.latitude === undefined
          ? null
          : Number(rawPayload.latitude),
      longitude:
        rawPayload?.longitude === '' || rawPayload?.longitude === null || rawPayload?.longitude === undefined
          ? null
          : Number(rawPayload.longitude)
    };

    const payload = Object.fromEntries(
      Object.entries(normalizedPayload).filter(([key, value]) => {
        if (key === 'user_id') return false;
        return value !== null && value !== undefined && value !== '';
      })
    );

    const contractErrors = validateRequestContract(normalizedPayload, user.id);
    if (contractErrors.length > 0) {
      console.warn('[AUDIT] /api/update-profile contract validation failed', contractErrors);
      return res.status(400).json({
        message: 'Profile request contract validation failed.',
        details: contractErrors
      });
    }

    const requiredProfileFields = ['full_name', 'phone_number'];
    const missingRequiredFields = requiredProfileFields.filter((field) => !payload[field]);
    if (missingRequiredFields.length > 0) {
      console.warn('[AUDIT] /api/update-profile missing required profile fields', {
        missingRequiredFields
      });
    }

    const hasLatitude = payload.latitude !== undefined && payload.latitude !== null && payload.latitude !== '';
    const hasLongitude = payload.longitude !== undefined && payload.longitude !== null && payload.longitude !== '';
    if (hasLatitude && !Number.isFinite(Number(payload.latitude))) {
      return res.status(400).json({
        message: 'Profile payload validation failed.',
        details: [{ field: 'latitude', reason: 'must be numeric if provided.' }]
      });
    }
    if (hasLongitude && !Number.isFinite(Number(payload.longitude))) {
      return res.status(400).json({
        message: 'Profile payload validation failed.',
        details: [{ field: 'longitude', reason: 'must be numeric if provided.' }]
      });
    }

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({
        message: 'No valid profile fields provided.',
        details: {
          expectedWrapper: REQUIRED_REQUEST_WRAPPER,
          receivedTopLevelKeys: Object.keys(req.body || {}),
          receivedDataKeys: Object.keys(normalizedPayload || {}),
          allowedFields: Array.from(ALLOWED_PROFILE_FIELDS)
        }
      });
    }

    console.log('[FINAL PAYLOAD]', payload);

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
