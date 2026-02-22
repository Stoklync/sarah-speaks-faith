/**
 * Instagram OAuth callback — exchange code for token, store in Supabase.
 * Requires: META_APP_ID, META_APP_SECRET, BASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const { code, state } = req.query;
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const baseUrl = process.env.BASE_URL || (req.headers['x-vercel-url'] ? `https://${req.headers['x-vercel-url']}` : req.headers.origin || 'http://localhost:5173');
  const userKey = state || 'local-default';

  if (!code || !appId || !appSecret) {
    return res.redirect(302, `${baseUrl}?auth_error=missing_config`);
  }

  const redirectUri = `${baseUrl}/api/auth/instagram/callback`;

  const tokenRes = await fetch(
    `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`
  );
  const tokens = await tokenRes.json().catch(() => ({}));

  if (tokens.error) {
    return res.redirect(302, `${baseUrl}?auth_error=${encodeURIComponent(tokens.error?.message || 'Instagram auth failed')}`);
  }

  const accessToken = tokens.access_token;
  if (!accessToken) {
    return res.redirect(302, `${baseUrl}?auth_error=no_token`);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseKey) {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;
    await supabase.from('social_tokens').upsert(
      { user_key: userKey, platform: 'instagram', access_token: accessToken, refresh_token: null, expires_at: expiresAt, updated_at: new Date().toISOString() },
      { onConflict: 'user_key,platform' }
    );
  }

  return res.redirect(302, `${baseUrl}?instagram_connected=1&state=${encodeURIComponent(userKey)}`);
}
