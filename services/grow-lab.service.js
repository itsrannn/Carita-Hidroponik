const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://thetdckuftpzyubvlbju.supabase.co').replace(/\/+$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAID_STATUSES = ['paid', 'settlement', 'completed'];

async function sb(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...options, headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', ...(options.headers || {}) } });
  if (!response.ok) throw new Error(await response.text());
  return response;
}

module.exports = { sb, PAID_STATUSES };
