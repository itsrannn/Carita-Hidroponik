const express = require('express');

const router = express.Router();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://thetdckuftpzyubvlbju.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function requireServiceKey(res) {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ message: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the backend.' });
    return false;
  }
  return true;
}

function supabaseHeaders() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json'
  };
}

function parseIntField(value, fieldName, required = true) {
  if ((value === undefined || value === null || value === '') && !required) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) throw new Error(`${fieldName} must be a number`);
  return Math.max(0, Math.round(num));
}

function normalizeZonePayload(body = {}) {
  const zone_name = String(body.zone_name || '').trim();
  if (!zone_name) throw new Error('zone_name is required');

  return {
    zone_name,
    district_match: body.district_match ? String(body.district_match).trim() : null,
    province_match: body.province_match ? String(body.province_match).trim() : null,
    base_rate: parseIntField(body.base_rate, 'base_rate'),
    extra_per_kg: parseIntField(body.extra_per_kg, 'extra_per_kg'),
    is_active: Boolean(body.is_active)
  };
}

router.get('/zones', async (_req, res, next) => {
  if (!requireServiceKey(res)) return;
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/shipping_zones?select=*&order=created_at.asc`, {
      headers: supabaseHeaders()
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ message: 'Failed to load shipping zones', error: data });
    return res.json({ data });
  } catch (error) { next(error); }
});

router.post('/zones', async (req, res, next) => {
  if (!requireServiceKey(res)) return;
  try {
    const payload = normalizeZonePayload(req.body);
    const response = await fetch(`${SUPABASE_URL}/rest/v1/shipping_zones?select=*`, {
      method: 'POST',
      headers: { ...supabaseHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ message: 'Failed to create shipping zone', error: data });
    return res.status(201).json({ data: data[0] || null });
  } catch (error) {
    if (error.message.includes('required') || error.message.includes('number')) return res.status(400).json({ message: error.message });
    return next(error);
  }
});

router.put('/zones/:id', async (req, res, next) => {
  if (!requireServiceKey(res)) return;
  try {
    const payload = normalizeZonePayload(req.body);
    const response = await fetch(`${SUPABASE_URL}/rest/v1/shipping_zones?id=eq.${encodeURIComponent(req.params.id)}&select=*`, {
      method: 'PATCH',
      headers: { ...supabaseHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ message: 'Failed to update shipping zone', error: data });
    return res.json({ data: data[0] || null });
  } catch (error) {
    if (error.message.includes('required') || error.message.includes('number')) return res.status(400).json({ message: error.message });
    return next(error);
  }
});

router.delete('/zones/:id', async (req, res, next) => {
  if (!requireServiceKey(res)) return;
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/shipping_zones?id=eq.${encodeURIComponent(req.params.id)}`, {
      method: 'DELETE',
      headers: supabaseHeaders()
    });
    if (!response.ok) {
      const data = await response.json();
      return res.status(response.status).json({ message: 'Failed to delete shipping zone', error: data });
    }
    return res.json({ success: true });
  } catch (error) { return next(error); }
});

router.get('/settings', async (_req, res, next) => {
  if (!requireServiceKey(res)) return;
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/shipping_settings?id=eq.1&select=*`, { headers: supabaseHeaders() });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ message: 'Failed to load shipping settings', error: data });
    return res.json({ data: data[0] || null });
  } catch (error) { return next(error); }
});

router.put('/settings', async (req, res, next) => {
  if (!requireServiceKey(res)) return;
  try {
    const payload = {
      id: 1,
      international_flat_rate: parseIntField(req.body?.international_flat_rate, 'international_flat_rate'),
      is_international_enabled: Boolean(req.body?.is_international_enabled)
    };
    const response = await fetch(`${SUPABASE_URL}/rest/v1/shipping_settings?id=eq.1&select=*`, {
      method: 'PATCH',
      headers: { ...supabaseHeaders(), Prefer: 'return=representation,resolution=merge-duplicates' },
      body: JSON.stringify(payload)
    });
    let data = await response.json();
    if (!response.ok || !Array.isArray(data) || data.length === 0) {
      const insertResponse = await fetch(`${SUPABASE_URL}/rest/v1/shipping_settings?select=*`, {
        method: 'POST',
        headers: { ...supabaseHeaders(), Prefer: 'return=representation' },
        body: JSON.stringify(payload)
      });
      data = await insertResponse.json();
      if (!insertResponse.ok) return res.status(insertResponse.status).json({ message: 'Failed to save shipping settings', error: data });
    }
    return res.json({ data: data[0] || null });
  } catch (error) {
    if (error.message.includes('number')) return res.status(400).json({ message: error.message });
    return next(error);
  }
});

module.exports = router;
