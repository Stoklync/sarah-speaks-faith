/**
 * Instagram OAuth callback — exchange code for token, store in Supabase.
 * Requires: META_APP_ID, META_APP_SECRET, BASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
export default async function handler(req, res) {
  const baseUrl = process.env.BASE_URL || 'https://sarah-speaks-faith.vercel.app';
  try {
    const { code, state } = req?.query || {};
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
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
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);
      const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;
      const { error } = await supabase.from('social_tokens').upsert(
        { user_key: userKey, platform: 'instagram', access_token: accessToken, refresh_token: null, expires_at: expiresAt, updated_at: new Date().toISOString() },
        { onConflict: 'user_key,platform' }
      );
      if (error) {
        return res.redirect(302, `${baseUrl}?auth_error=supabase_${encodeURIComponent(error.message)}`);
      }
    }

    return res.redirect(302, `${baseUrl}?instagram_connected=1&state=${encodeURIComponent(userKey)}`);
  } catch (err) {
    console.error('Instagram callback error:', err);
    return res.redirect(302, `${baseUrl}?auth_error=${encodeURIComponent(err?.message || 'callback_failed')}`);
  }
}
