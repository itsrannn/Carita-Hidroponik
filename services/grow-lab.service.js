const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://thetdckuftpzyubvlbju.supabase.co').replace(/\/+$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PAID_STATUSES = ['paid', 'settlement', 'completed'];

async function sb(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error(await response.text());
  return response;
}

function parseOrderDetails(order) {
  const details = Array.isArray(order.order_details) ? order.order_details : [];
  return details.map((item) => ({ product_id: item.id || item.product_id, name: item.name })).filter((x) => x.product_id);
}

async function getMyProducts(userId) {
  const statuses = PAID_STATUSES.map((s) => `status.eq.${s}`).join(',');
  const ordersRes = await sb(`orders?user_id=eq.${userId}&or=(${statuses})&select=id,status,created_at,order_details`);
  const orders = await ordersRes.json();
  const productIds = [...new Set(orders.flatMap(parseOrderDetails).map((x) => x.product_id))];
  if (!productIds.length) return [];

  const productsRes = await sb(`products?id=in.(${productIds.join(',')})&select=id,name,image_url,grow_duration_days`);
  const products = await productsRes.json();

  const actRes = await sb(`grow_lab_activations?user_id=eq.${userId}&product_id=in.(${productIds.join(',')})&select=*`);
  const activations = await actRes.json();
  const activationMap = new Map(activations.map((a) => [a.product_id, a]));

  return products.map((p) => {
    const activation = activationMap.get(p.id);
    const duration = Number(p.grow_duration_days || 120);
    const activatedAt = activation?.activated_at || null;
    const now = Date.now();
    const day = activatedAt ? Math.max(1, Math.floor((now - Date.parse(activatedAt)) / 86400000) + 1) : 0;
    return {
      ...p,
      is_activated: Boolean(activation),
      activated_at: activatedAt,
      current_day: activation ? day : null,
      current_phase: activation?.current_phase || null,
      estimated_harvest_date: activation?.estimated_harvest_date || null,
      progress_percent: activation ? Math.min(100, Math.round((day / duration) * 100)) : 0
    };
  });
}

module.exports = { sb, getMyProducts, PAID_STATUSES };
