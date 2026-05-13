const { sb, getMyProducts, PAID_STATUSES } = require('../services/grow-lab.service');

async function myProducts(req, res) {
  try {
    const data = await getMyProducts(req.user.id);
    res.json({ products: data });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch grow lab products.', error: error.message });
  }
}

async function activate(req, res) {
  const { product_id: productId } = req.body || {};
  if (!productId) return res.status(400).json({ message: 'product_id is required.' });

  try {
    const products = await getMyProducts(req.user.id);
    const eligible = products.find((p) => p.id === productId);
    if (!eligible) return res.status(403).json({ message: 'Product is not eligible for activation.' });
    if (eligible.is_activated) return res.status(409).json({ message: 'Grow Lab already activated for this product.' });

    const duration = Number(eligible.grow_duration_days || 120);
    const activatedAt = new Date();
    const estimatedHarvestDate = new Date(activatedAt.getTime() + duration * 86400000);

    const response = await sb('grow_lab_activations?select=*', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify([{ user_id: req.user.id, product_id: productId, activated_at: activatedAt.toISOString(), current_day: 1, current_phase: 'Germination', estimated_harvest_date: estimatedHarvestDate.toISOString() }])
    });
    const created = await response.json();
    res.status(201).json({ activation: created[0] });
  } catch (error) {
    res.status(500).json({ message: 'Failed to activate grow lab.', error: error.message });
  }
}

async function secret(req, res) {
  const { productId } = req.params;
  try {
    const products = await getMyProducts(req.user.id);
    const owned = products.some((p) => p.id === productId);
    if (!owned) return res.status(403).json({ message: 'Secret content locked.' });

    const result = await sb(`grow_secret_contents?product_id=eq.${productId}&select=id,title,content,created_at&order=created_at.asc`);
    res.json({ secrets: await result.json() });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch secret content.', error: error.message });
  }
}

async function activateByCode(req, res) {
  const { activation_code: code } = req.body || {};
  if (!code) return res.status(400).json({ message: 'activation_code is required.' });

  try {
    const orderRes = await sb(`orders?user_id=eq.${req.user.id}&activation_code=eq.${encodeURIComponent(code)}&select=id,status,order_details&limit=1`);
    const rows = await orderRes.json();
    const order = rows[0];
    if (!order) return res.status(404).json({ message: 'Activation code not found.' });
    if (!PAID_STATUSES.includes(order.status)) return res.status(403).json({ message: 'Order is not paid yet.' });
    const firstItem = Array.isArray(order.order_details) ? order.order_details[0] : null;
    if (!firstItem?.id) return res.status(400).json({ message: 'Order has no eligible product.' });

    req.body.product_id = firstItem.id;
    return activate(req, res);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to activate by code.', error: error.message });
  }
}

module.exports = { myProducts, activate, secret, activateByCode };
