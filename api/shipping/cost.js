const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

const COURIER_RATES = {
  jne: { baseCost: 12000, ratePerKg: 3000, etd: '1-2 hari' },
  tiki: { baseCost: 10000, ratePerKg: 2500, etd: '2-3 hari' },
  pos: { baseCost: 9000, ratePerKg: 2000, etd: '2-4 hari' }
};

function setCorsHeaders(res) {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCourier(rawCourier) {
  const normalized = String(rawCourier || '').trim().toLowerCase();
  if (!normalized || normalized === 'rekomendasi-kami') return 'jne';
  return normalized;
}

module.exports = function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    console.log('shipping payload:', req.body);

    const courier = normalizeCourier(req.body?.courier);
    const quantity = Math.max(1, Math.floor(toNumber(req.body?.quantity || 1)));
    const weight = toNumber(req.body?.weight);
    const totalWeight = toNumber(req.body?.totalWeight);
    const effectiveWeight = totalWeight > 0
      ? totalWeight
      : (weight > 0 ? weight : 0) * quantity;

    if (!courier || effectiveWeight <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid shipping payload'
      });
    }

    const rate = COURIER_RATES[courier];
    if (!rate) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported courier'
      });
    }

    const billedWeightKg = Math.max(1, Math.ceil(effectiveWeight / 1000));
    const shippingCost = rate.baseCost + (billedWeightKg * rate.ratePerKg);
    const normalizedCost = Number(shippingCost);

    const response = {
      success: true,
      courier,
      cost: normalizedCost,
      etd: rate.etd,
      recommendation: {
        courier,
        cost: normalizedCost,
        etd: rate.etd,
        zone_name: 'Manual Internal'
      }
    };

    console.log('shipping final response:', response);
    return res.status(200).json(response);
  } catch (error) {
    console.error('shipping error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to calculate shipping cost'
    });
  }
};
