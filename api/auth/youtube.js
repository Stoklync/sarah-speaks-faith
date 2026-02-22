/**
 * YouTube OAuth — start the flow.
 * Requires: GOOGLE_CLIENT_ID, BASE_URL env vars.
 */
export default function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const baseUrl = process.env.BASE_URL || (req.headers['x-vercel-url'] ? `https://${req.headers['x-vercel-url']}` : req.headers.origin || 'http://localhost:5173');
  const state = req.query.state || `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  if (!clientId) {
    return res.status(500).json({ error: 'GOOGLE_CLIENT_ID not set. Add it in Vercel environment variables.' });
  }

  const redirectUri = `${baseUrl}/api/auth/youtube/callback`;
  const scope = encodeURIComponent('https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/userinfo.email');
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;

  res.redirect(302, url);
}
