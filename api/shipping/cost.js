const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

const SHIPPING_COSTS = {
  jawa: 10000,
  sumatera: 15000,
  kalimantan: 20000,
  default: 25000
};

function setCorsHeaders(res) {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
}

export default function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const region = String(req.body?.region || req.query?.region || '').trim().toLowerCase();

  if (!region) {
    return res.status(400).json({ success: false, message: 'Region is required' });
  }

  const cost = SHIPPING_COSTS[region] ?? SHIPPING_COSTS.default;

  return res.status(200).json({
    success: true,
    cost
  });
}
