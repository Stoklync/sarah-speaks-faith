/**
 * YouTube OAuth — start the flow.
 * Requires: GOOGLE_CLIENT_ID, BASE_URL env vars.
 */
export default function handler(req, res) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const baseUrl = (process.env.BASE_URL || 'https://sarah-speaks-faith.vercel.app').replace(/\/$/, '');
    const state = (req.query && req.query.state) || `user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    if (!clientId) {
      return res.status(500).json({ error: 'GOOGLE_CLIENT_ID not set in Vercel environment variables.' });
    }

    const redirectUri = `${baseUrl}/api/auth/youtube/callback`;
    const scope = 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/userinfo.email';
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;

    res.setHeader('Location', url);
    res.status(302).end();
  } catch (err) {
    res.status(500).json({ error: err.message || 'YouTube auth failed' });
  }
}
