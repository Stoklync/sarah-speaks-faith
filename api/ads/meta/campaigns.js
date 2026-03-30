/**
 * GET /api/ads/meta/campaigns?account_id=act_XXXXX
 * Returns active campaigns with spend, impressions, and clicks.
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Token must have: ads_read permission
 */
import { createClient } from '@supabase/supabase-js';

const FB = 'https://graph.facebook.com/v18.0';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userKey = req.headers['x-user-key'];
  const accountId = req.query.account_id;
  if (!userKey) return res.status(401).json({ error: 'Missing X-User-Key header' });
  if (!accountId) return res.status(400).json({ error: 'Missing account_id query param' });

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
    return res.status(401).json({ error: 'Instagram not connected' });
  }

  const token = row.access_token;

  // Get campaigns
  const campaignsRes = await fetch(
    `${FB}/${accountId}/campaigns?fields=id,name,objective,status,daily_budget,lifetime_budget&access_token=${token}`
  );
  const campaignsData = await campaignsRes.json().catch(() => ({}));

  if (campaignsData.error) {
    return res.status(400).json({ error: campaignsData.error.message });
  }

  const campaigns = campaignsData.data || [];

  // Get insights for each campaign (spend, impressions, clicks)
  const results = await Promise.all(campaigns.map(async (c) => {
    try {
      const insightsRes = await fetch(
        `${FB}/${c.id}/insights?fields=spend,impressions,clicks&date_preset=this_month&access_token=${token}`
      );
      const insightsData = await insightsRes.json().catch(() => ({}));
      const ins = insightsData.data?.[0] || {};
      return {
        id: c.id,
        name: c.name,
        objective: c.objective,
        status: c.status,
        spend: Math.round(Number(ins.spend || 0) * 100),
        impressions: Number(ins.impressions || 0),
        clicks: Number(ins.clicks || 0),
        daily_budget: c.daily_budget,
      };
    } catch {
      return { id: c.id, name: c.name, objective: c.objective, status: c.status, spend: 0, impressions: 0, clicks: 0 };
    }
  }));

  return res.status(200).json({ campaigns: results });
}
