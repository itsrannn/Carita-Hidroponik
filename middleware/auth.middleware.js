const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://thetdckuftpzyubvlbju.supabase.co').replace(/\/+$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function requireAuth(req, res, next) {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ message: 'SUPABASE_SERVICE_ROLE_KEY is not configured.' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return res.status(401).json({ message: 'Authentication required.' });

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) return res.status(401).json({ message: 'Invalid or expired session token.' });

    req.user = await response.json();
    req.accessToken = token;
    return next();
  } catch (error) {
    return res.status(500).json({ message: 'Failed to validate session.', error: error.message });
  }
}

module.exports = { requireAuth };
