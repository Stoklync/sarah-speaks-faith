/**
 * Instagram OAuth callback — exchange code for token, store in Supabase.
 * CommonJS for Vercel Node.js compatibility.
 */
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  const baseUrl = process.env.BASE_URL || 'https://sarah-speaks-faith.vercel.app';
  try {
    const q = req.query || {};
    const code = q.code;
    const state = q.state;
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const userKey = state || 'local-default';

    if (!code || !appId || !appSecret) {
      res.setHeader('Location', baseUrl + '?auth_error=missing_config');
      res.status(302).end();
      return;
    }

    const redirectUri = baseUrl + '/api/auth/instagram/callback';
    const tokenUrl = 'https://graph.facebook.com/v18.0/oauth/access_token?client_id=' + appId + '&client_secret=' + appSecret + '&redirect_uri=' + encodeURIComponent(redirectUri) + '&code=' + code;

    const tokenRes = await fetch(tokenUrl);
    const tokens = await tokenRes.json().catch(() => ({}));

    if (tokens.error) {
      res.setHeader('Location', baseUrl + '?auth_error=' + encodeURIComponent(tokens.error?.message || 'Instagram auth failed'));
      res.status(302).end();
      return;
    }

    const accessToken = tokens.access_token;
    if (!accessToken) {
      res.setHeader('Location', baseUrl + '?auth_error=no_token');
      res.status(302).end();
      return;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;
      const { error } = await supabase.from('social_tokens').upsert(
        { user_key: userKey, platform: 'instagram', access_token: accessToken, refresh_token: null, expires_at: expiresAt, updated_at: new Date().toISOString() },
        { onConflict: 'user_key,platform' }
      );
      if (error) {
        res.setHeader('Location', baseUrl + '?auth_error=supabase_' + encodeURIComponent(error.message));
        res.status(302).end();
        return;
      }
    }

    res.setHeader('Location', baseUrl + '?instagram_connected=1&state=' + encodeURIComponent(userKey));
    res.status(302).end();
  } catch (err) {
    console.error('Instagram callback error:', err);
    res.setHeader('Location', baseUrl + '?auth_error=' + encodeURIComponent(err?.message || 'callback_failed'));
    res.status(302).end();
  }
};
