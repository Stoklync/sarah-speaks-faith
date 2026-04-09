import crypto from 'crypto';

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { username, password } = req.body || {};
  const ADMIN_USER = process.env.ADMIN_USER;
  const ADMIN_PASS = process.env.ADMIN_PASSWORD;
  const SECRET     = process.env.AUTH_SECRET;

  if (!ADMIN_USER || !ADMIN_PASS || !SECRET) {
    return res.status(500).json({ error: 'Auth not configured. Set ADMIN_USER, ADMIN_PASSWORD, AUTH_SECRET in environment variables.' });
  }

  if (!username || !password) {
    return res.status(400).json({ error: 'Missing credentials.' });
  }

  // Timing-safe comparison to prevent brute-force timing attacks
  let userMatch = false;
  let passMatch = false;
  try {
    userMatch = crypto.timingSafeEqual(Buffer.from(username), Buffer.from(ADMIN_USER));
    passMatch = crypto.timingSafeEqual(Buffer.from(password), Buffer.from(ADMIN_PASS));
  } catch {
    // Buffer length mismatch means no match
  }

  if (!userMatch || !passMatch) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  // Build a signed token: base64(payload).hmac
  const payload = JSON.stringify({ u: username, iat: Date.now(), exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  const data    = Buffer.from(payload).toString('base64url');
  const sig     = crypto.createHmac('sha256', SECRET).update(data).digest('hex');

  res.json({ token: `${data}.${sig}` });
}
