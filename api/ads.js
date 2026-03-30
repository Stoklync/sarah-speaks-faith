/**
 * /api/ads — Meta Ads Manager (single function, routes by ?action=)
 *
 * GET  ?action=accounts                         → list ad accounts
 * GET  ?action=campaigns&account_id=act_XXXX    → list campaigns + insights
 * POST ?action=create  body:{account_id,name,objective,daily_budget,days,url}  → create campaign
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Token must have: ads_read, ads_management (ads_management needs Meta App Review for live accounts)
 */
import { createClient } from '@supabase/supabase-js';

const FB = 'https://graph.facebook.com/v18.0';

async function getToken(userKey) {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase
    .from('social_tokens')
    .select('access_token')
    .eq('user_key', userKey)
    .eq('platform', 'instagram')
    .single();
  if (error || !data?.access_token) throw new Error('Instagram not connected. Connect Instagram first to access Meta Ads.');
  return data.access_token;
}

async function getAccounts(token) {
  const r = await fetch(`${FB}/me/adaccounts?fields=id,name,currency,balance,account_status&access_token=${token}`);
  const data = await r.json().catch(() => ({}));
  if (data.error) throw new Error(data.error.message || 'Could not fetch ad accounts. Ensure your Meta App has ads_read permission approved.');
  return (data.data || []).map(a => ({
    id: a.id,
    name: a.name || a.id,
    currency: a.currency || 'USD',
    balance: a.balance != null ? `$${(Number(a.balance) / 100).toFixed(2)}` : 'N/A',
    status: a.account_status === 1 ? 'active' : 'inactive',
  }));
}

async function getCampaigns(token, accountId) {
  const r = await fetch(
    `${FB}/${accountId}/campaigns?fields=id,name,objective,status,daily_budget,lifetime_budget&access_token=${token}`
  );
  const data = await r.json().catch(() => ({}));
  if (data.error) throw new Error(data.error.message);
  const campaigns = data.data || [];
  return Promise.all(campaigns.map(async (c) => {
    try {
      const ir = await fetch(`${FB}/${c.id}/insights?fields=spend,impressions,clicks&date_preset=this_month&access_token=${token}`);
      const id = await ir.json().catch(() => ({}));
      const ins = id.data?.[0] || {};
      return { id: c.id, name: c.name, objective: c.objective, status: c.status, spend: Math.round(Number(ins.spend || 0) * 100), impressions: Number(ins.impressions || 0), clicks: Number(ins.clicks || 0) };
    } catch {
      return { id: c.id, name: c.name, objective: c.objective, status: c.status, spend: 0, impressions: 0, clicks: 0 };
    }
  }));
}

async function createCampaign(token, { account_id, name, objective, daily_budget, days, url }) {
  // 1. Campaign
  const cr = await fetch(`${FB}/${account_id}/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, objective, status: 'PAUSED', special_ad_categories: [], access_token: token }),
  });
  const cd = await cr.json().catch(() => ({}));
  if (cd.error) throw new Error(cd.error.message || 'Failed to create campaign');

  // 2. Ad Set
  const endTime = new Date(Date.now() + (Number(days) || 7) * 86400000).toISOString();
  const asr = await fetch(`${FB}/${account_id}/adsets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `${name} - Ad Set`, campaign_id: cd.id, daily_budget: Number(daily_budget),
      billing_event: 'IMPRESSIONS',
      optimization_goal: objective === 'OUTCOME_TRAFFIC' ? 'LINK_CLICKS' : objective === 'OUTCOME_LEADS' ? 'LEAD_GENERATION' : 'REACH',
      targeting: { geo_locations: { countries: ['US', 'CA', 'GB', 'AU'] }, age_min: 18, age_max: 65 },
      end_time: endTime, status: 'PAUSED', access_token: token,
    }),
  });
  const asd = await asr.json().catch(() => ({}));
  if (asd.error) throw new Error(asd.error.message || 'Failed to create ad set');

  // 3. Creative
  const ccr = await fetch(`${FB}/${account_id}/adcreatives`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `${name} - Creative`,
      object_story_spec: {
        link_data: { link: url, message: name, call_to_action: { type: 'LEARN_MORE', value: { link: url } } },
        page_id: 'me',
      },
      access_token: token,
    }),
  });
  const ccd = await ccr.json().catch(() => ({}));
  if (ccd.error) throw new Error(ccd.error.message || 'Failed to create creative');

  // 4. Ad
  const ar = await fetch(`${FB}/${account_id}/ads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `${name} - Ad`, adset_id: asd.id, creative: { creative_id: ccd.id }, status: 'PAUSED', access_token: token }),
  });
  const ad = await ar.json().catch(() => ({}));
  if (ad.error) throw new Error(ad.error.message || 'Failed to create ad');

  return { campaign_id: cd.id, adset_id: asd.id, ad_id: ad.id, status: 'PAUSED', message: 'Campaign created in PAUSED state. Go to Meta Ads Manager to review and activate.' };
}

export default async function handler(req, res) {
  const userKey = req.headers['x-user-key'];
  if (!userKey) return res.status(401).json({ error: 'Missing X-User-Key header' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ error: 'Supabase not configured' });

  const action = req.query.action;

  try {
    const token = await getToken(userKey);

    if (action === 'accounts' && req.method === 'GET') {
      const accounts = await getAccounts(token);
      return res.status(200).json({ accounts });
    }

    if (action === 'campaigns' && req.method === 'GET') {
      const { account_id } = req.query;
      if (!account_id) return res.status(400).json({ error: 'Missing account_id' });
      const campaigns = await getCampaigns(token, account_id);
      return res.status(200).json({ campaigns });
    }

    if (action === 'create' && req.method === 'POST') {
      const body = req.body || {};
      if (!body.account_id || !body.name || !body.objective || !body.daily_budget || !body.url) {
        return res.status(400).json({ error: 'Missing required fields: account_id, name, objective, daily_budget, url' });
      }
      const result = await createCampaign(token, body);
      return res.status(200).json(result);
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
