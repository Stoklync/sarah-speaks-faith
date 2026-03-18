/**
 * Store Instagram access token from FB.login popup flow.
 * Receives short-lived token, exchanges for long-lived (60d), stores in Supabase.
 * Requires: META_APP_ID, META_APP_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!appId || !appSecret || !supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Server config missing' });
  }

  const { accessToken, userKey } = req.body || {};
  if (!accessToken) {
    return res.status(400).json({ error: 'accessToken required' });
  }

  try {
    // Exchange short-lived for long-lived (60 days)
    const exchangeRes = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${accessToken}`
    );
    const data = await exchangeRes.json();
    const longLived = data.access_token || accessToken;
    const expiresIn = data.expires_in || 5184000; // 60 days default
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);
    const key = userKey || 'local-default';
    const { error } = await supabase.from('social_tokens').upsert(
      {
        user_key: key,
        platform: 'instagram',
        access_token: longLived,
        refresh_token: null,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_key,platform' }
    );
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ ok: true, message: 'Instagram connected' });
  } catch (err) {
    console.error('store-token error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to store token' });
  }
}
