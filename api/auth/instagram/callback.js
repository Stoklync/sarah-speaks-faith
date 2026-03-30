/**
 * Instagram OAuth callback — exchange code for token, store in Supabase.
 * Requires: META_APP_ID, META_APP_SECRET, BASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  let baseUrl = process.env.BASE_URL || 'https://sarah-speaks-faith.vercel.app';
  baseUrl = (baseUrl || '').replace(/\/$/, ''); // no trailing slash
  const redirect = (url) => {
    try {
      res.setHeader('Location', url);
      res.status(302).end();
    } catch (e) {
      console.error('Redirect failed:', e);
    }
  };
  try {
    let code = req?.query?.code;
    let state = req?.query?.state;
    if ((!code || !state) && req?.url) {
      try {
        const u = new URL(req.url, 'https://x');
        code = code || u.searchParams.get('code');
        state = state || u.searchParams.get('state');
      } catch (_) {}
    }
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const userKey = state || 'local-default';

    if (!code || !appId || !appSecret) {
      redirect(`${baseUrl}?auth_error=missing_config`);
      return;
    }

    const redirectUri = `${baseUrl}/api/auth/instagram/callback`;
    const tokenRes = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`
    );
    const tokens = await tokenRes.json().catch(() => ({}));

    if (tokens.error) {
      redirect(`${baseUrl}?auth_error=${encodeURIComponent(tokens.error?.message || 'Instagram auth failed')}`);
      return;
    }

    const accessToken = tokens.access_token;
    if (!accessToken) {
      redirect(`${baseUrl}?auth_error=no_token`);
      return;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey.trim(), {
        auth: { autoRefreshToken: false, persistSession: false }
      });
      const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;
      const { error } = await supabase.from('social_tokens').upsert(
        { user_key: userKey, platform: 'instagram', access_token: accessToken, refresh_token: null, expires_at: expiresAt, updated_at: new Date().toISOString() },
        { onConflict: 'user_key,platform' }
      );
      if (error) {
        redirect(`${baseUrl}?auth_error=supabase_${encodeURIComponent(error.message)}`);
        return;
      }
    }

    redirect(`${baseUrl}?instagram_connected=1&state=${encodeURIComponent(userKey)}`);
  } catch (err) {
    console.error('Instagram callback error:', err);
    redirect(`${baseUrl}?auth_error=${encodeURIComponent(err?.message || 'callback_failed')}`);
  }
}
