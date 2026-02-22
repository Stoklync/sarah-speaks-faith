/**
 * Instagram (via Facebook Login) OAuth — start the flow.
 * Requires: META_APP_ID, BASE_URL
 * Note: Instagram Business/Creator account must be linked to a Facebook Page.
 */
export default function handler(req, res) {
  const appId = process.env.META_APP_ID;
  const baseUrl = process.env.BASE_URL || (req.headers['x-vercel-url'] ? `https://${req.headers['x-vercel-url']}` : req.headers.origin || 'http://localhost:5173');
  const state = req.query.state || `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  if (!appId) {
    return res.status(500).json({ error: 'META_APP_ID not set. Add it in Vercel environment variables.' });
  }

  const redirectUri = `${baseUrl}/api/auth/instagram/callback`;
  const scope = encodeURIComponent('instagram_basic,instagram_manage_insights,pages_show_list,pages_read_engagement');
  const url = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${encodeURIComponent(state)}&response_type=code`;

  res.redirect(302, url);
}
