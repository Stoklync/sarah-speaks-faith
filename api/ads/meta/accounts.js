/**
 * GET /api/ads/meta/accounts
 * Returns the user's Meta ad accounts (name, id, currency, balance).
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Token must have: ads_read permission
 */
import { createClient } from '@supabase/supabase-js';

const FB = 'https://graph.facebook.com/v18.0';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userKey = req.headers['x-user-key'];
  if (!userKey) return res.status(401).json({ error: 'Missing X-User-Key header' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Supabase not configured' });

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: row, error } = await supabase
    .from('social_tokens')
    .select('access_token')
    .eq('user_key', userKey)
    .eq('platform', 'instagram')
    .single();

  if (error || !row?.access_token) {
    return res.status(401).json({ error: 'Instagram not connected. Connect Instagram first to access Meta Ads.' });
  }

  const token = row.access_token;

  const r = await fetch(`${FB}/me/adaccounts?fields=id,name,currency,balance,account_status&access_token=${token}`);
  const data = await r.json().catch(() => ({}));

  if (data.error) {
    return res.status(400).json({
      error: data.error.message || 'Could not fetch ad accounts. Make sure your Meta App has ads_read permission approved.',
    });
  }

  const accounts = (data.data || []).map(a => ({
    id: a.id,
    name: a.name || a.id,
    currency: a.currency || 'USD',
    balance: a.balance != null ? `$${(Number(a.balance) / 100).toFixed(2)}` : 'N/A',
    status: a.account_status === 1 ? 'active' : 'inactive',
  }));

  return res.status(200).json({ accounts });
}
