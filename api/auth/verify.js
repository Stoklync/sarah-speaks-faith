import crypto from 'crypto';

export default function handler(req, res) {
  const token  = (req.headers['x-auth-token'] || req.query.token || '').trim();
  const SECRET = process.env.AUTH_SECRET;

  if (!SECRET)  return res.status(500).json({ valid: false, reason: 'Auth not configured.' });
  if (!token)   return res.status(401).json({ valid: false, reason: 'No token.' });

  const dot = token.lastIndexOf('.');
  if (dot === -1) return res.status(401).json({ valid: false, reason: 'Malformed token.' });

  const data = token.slice(0, dot);
  const sig  = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', SECRET).update(data).digest('hex');

  let sigMatch = false;
  try { sigMatch = crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex')); } catch {}

  if (!sigMatch) return res.status(401).json({ valid: false, reason: 'Invalid signature.' });

  let payload;
  try { payload = JSON.parse(Buffer.from(data, 'base64url').toString()); } catch {
    return res.status(401).json({ valid: false, reason: 'Malformed payload.' });
  }

  if (Date.now() > payload.exp) return res.status(401).json({ valid: false, reason: 'Session expired.' });

  res.json({ valid: true, username: payload.u });
}
