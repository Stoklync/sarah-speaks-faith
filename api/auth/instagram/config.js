/**
 * Returns Meta App ID for the Facebook JS SDK (safe to expose).
 * Used by the client to initialize FB.init().
 */
export default function handler(req, res) {
  const appId = process.env.META_APP_ID;
  if (!appId) {
    return res.status(500).json({ error: 'META_APP_ID not configured' });
  }
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).json({ appId });
}
