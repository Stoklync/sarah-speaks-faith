/**
 * Debug: see what redirect_uri the app would send to Meta.
 * Open /api/debug-redirect-uri to verify it matches Meta's Valid OAuth Redirect URIs.
 * Delete this file after debugging.
 */
export default function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID || '(not set)';
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    GOOGLE_CLIENT_ID: clientId,
    GOOGLE_CLIENT_ID_length: clientId.length,
    GOOGLE_CLIENT_SECRET_set: !!process.env.GOOGLE_CLIENT_SECRET,
  });
}
