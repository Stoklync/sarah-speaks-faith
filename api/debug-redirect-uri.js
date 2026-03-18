/**
 * Debug: see what redirect_uri the app would send to Meta.
 * Open /api/debug-redirect-uri to verify it matches Meta's Valid OAuth Redirect URIs.
 * Delete this file after debugging.
 */
export default function handler(req, res) {
  let baseUrl = process.env.BASE_URL || (req.headers['x-vercel-url'] ? `https://${req.headers['x-vercel-url']}` : req.headers.origin || 'unknown');
  baseUrl = (baseUrl || '').replace(/\/$/, '');
  const redirectUri = `${baseUrl}/api/auth/instagram/callback`;
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    BASE_URL_env: process.env.BASE_URL || '(not set)',
    baseUrl_used: baseUrl,
    redirect_uri_sent_to_meta: redirectUri,
    message: 'Meta Valid OAuth Redirect URIs must contain exactly: ' + redirectUri,
  });
}
