const { sb, PAID_STATUSES } = require('../services/grow-lab.service');

const phases = [
  { name: 'Germination', until: 14 },
  { name: 'Vegetative', until: 45 },
  { name: 'Flowering', until: 80 },
  { name: 'Fruiting', until: 120 },
  { name: 'Harvest', until: 9999 }
];

const parseName = (name) => (typeof name === 'object' ? (name.en || name.id || Object.values(name)[0]) : name);

async function paidProductIds(userId) {
  const or = PAID_STATUSES.map((s) => `status.eq.${s}`).join(',');
  const orders = await (await sb(`orders?user_id=eq.${userId}&or=(${or})&select=order_details,status`)).json();
  return [...new Set(orders.flatMap((o) => (Array.isArray(o.order_details) ? o.order_details.map((i) => i.id || i.product_id) : [])).filter(Boolean))];
}

async function mySeeds(req, res) {
  try {
    const productIds = await paidProductIds(req.user.id);
    if (!productIds.length) return res.json({ seeds: [] });
    const products = await (await sb(`products?id=in.(${productIds.join(',')})&select=id,name,image_url,grow_duration_days,grow_difficulty`)).json();
    const activations = await (await sb(`grow_lab_activations?user_id=eq.${req.user.id}&product_id=in.(${productIds.join(',')})&select=*`)).json();
    const amap = new Map(activations.map((a) => [a.product_id, a]));
    const seeds = products.map((p) => ({ ...p, name: parseName(p.name), activation_id: amap.get(p.id)?.id || null, status: amap.get(p.id) ? 'ACTIVE' : 'NOT ACTIVATED', button: amap.get(p.id) ? 'Continue Growing' : 'Activate Grow Lab' }));
    res.json({ seeds });
  } catch (e) { res.status(500).json({ message: 'Failed to load seeds.', error: e.message }); }
}

async function dashboard(req, res) {
  try {
    const acts = await (await sb(`grow_lab_activations?user_id=eq.${req.user.id}&is_completed=eq.false&select=*&order=activated_at.desc&limit=1`)).json();
    const a = acts[0];
    const day = a ? Math.max(1, Math.floor((Date.now() - Date.parse(a.activated_at)) / 86400000) + 1) : 0;
    const phase = phases.find((p) => day <= p.until)?.name || 'Germination';
    const harvestCountdown = a?.estimated_harvest_date ? Math.max(0, Math.ceil((Date.parse(a.estimated_harvest_date) - Date.now()) / 86400000)) : '-';
    const statsRows = await (await sb(`grow_stats?user_id=eq.${req.user.id}&select=*&limit=1`)).json();
    res.json({ dashboard: { currentDay: day || '-', currentPhase: phase, harvestCountdown, targetPpm: 800 }, stats: statsRows[0] || { total_days: 0 } });
  } catch (e) { res.status(500).json({ message: 'Failed to load dashboard.', error: e.message }); }
}

async function timeline(req, res) {
  try {
    const act = await (await sb(`grow_lab_activations?id=eq.${req.params.activationId}&user_id=eq.${req.user.id}&select=*&limit=1`)).json();
    if (!act[0]) return res.status(404).json({ message: 'Activation not found.' });
    const day = Math.max(1, Math.floor((Date.now() - Date.parse(act[0].activated_at)) / 86400000) + 1);
    const rows = await (await sb(`grow_timelines?product_id=eq.${act[0].product_id}&select=*&order=day_number.asc`)).json();
    res.json({ timeline: rows.map((r) => ({ ...r, state: r.day_number < day ? 'completed' : r.day_number === day ? 'current' : 'future' })) });
  } catch (e) { res.status(500).json({ message: 'Failed to load timeline.', error: e.message }); }
}

async function secret(req, res) { try { const owned = (await paidProductIds(req.user.id)).includes(req.params.productId); if (!owned) return res.status(403).json({ message: 'Secret recipes require valid purchase.' }); const secrets = await (await sb(`grow_secret_contents?product_id=eq.${req.params.productId}&select=*`)).json(); res.json({ secrets }); } catch (e) { res.status(500).json({ message: 'Failed to fetch secret.', error: e.message }); } }

async function activate(req, res) { try { const { product_id } = req.body || {}; if (!product_id) return res.status(400).json({ message: 'product_id is required.' }); const owned = (await paidProductIds(req.user.id)).includes(product_id); if (!owned) return res.status(403).json({ message: 'Activation only allowed for paid orders.' }); const existing = await (await sb(`grow_lab_activations?user_id=eq.${req.user.id}&product_id=eq.${product_id}&select=id&limit=1`)).json(); if (existing[0]) return res.status(409).json({ message: 'Already activated.' }); const created = await (await sb('grow_lab_activations?select=*', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify([{ user_id: req.user.id, product_id, activation_code: null, current_phase: 'Germination', progress_percent: 0 }]) })).json(); res.status(201).json({ activation: created[0] }); } catch (e) { res.status(500).json({ message: 'Failed to activate.', error: e.message }); } }

async function completeTask(req, res) { try { const { task_id } = req.body || {}; if (!task_id) return res.status(400).json({ message: 'task_id is required.' }); const updated = await (await sb(`grow_tasks?id=eq.${task_id}&select=*`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ is_completed: true }) })).json(); res.json({ task: updated[0] || null }); } catch (e) { res.status(500).json({ message: 'Failed to complete task.', error: e.message }); } }

module.exports = { dashboard, mySeeds, timeline, secret, activate, completeTask };
