/**
 * YouTube OAuth callback — exchange code for tokens, store in Supabase, redirect back.
 * Requires: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const { code, state } = req.query;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = process.env.BASE_URL || (req.headers['x-vercel-url'] ? `https://${req.headers['x-vercel-url']}` : req.headers.origin || 'http://localhost:5173');
  const userKey = state || 'local-default';

  if (!code || !clientId || !clientSecret) {
    return res.redirect(302, `${baseUrl}?auth_error=missing_config`);
  }

  const redirectUri = `${baseUrl}/api/auth/youtube/callback`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const tokens = await tokenRes.json().catch(() => ({}));

  if (tokens.error) {
    return res.redirect(302, `${baseUrl}?auth_error=${encodeURIComponent(tokens.error_description || tokens.error)}`);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseKey) {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;
    await supabase.from('social_tokens').upsert(
      { user_key: userKey, platform: 'youtube', access_token: tokens.access_token, refresh_token: tokens.refresh_token || null, expires_at: expiresAt, updated_at: new Date().toISOString() },
      { onConflict: 'user_key,platform' }
    );
  }

  return res.redirect(302, `${baseUrl}?youtube_connected=1&state=${encodeURIComponent(userKey)}`);
}
