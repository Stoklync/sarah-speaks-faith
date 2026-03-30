/**
 * POST /api/ads/meta/create
 * Creates a Meta ad campaign + ad set + ad creative + ad.
 * Body: { account_id, name, objective, daily_budget (cents), days, url }
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Token must have: ads_management permission (requires Meta App Review for live use)
 */
import { createClient } from '@supabase/supabase-js';

const FB = 'https://graph.facebook.com/v18.0';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const userKey = req.headers['x-user-key'];
  if (!userKey) return res.status(401).json({ error: 'Missing X-User-Key header' });

  const { account_id, name, objective, daily_budget, days, url } = req.body || {};
  if (!account_id || !name || !objective || !daily_budget || !url) {
    return res.status(400).json({ error: 'Missing required fields: account_id, name, objective, daily_budget, url' });
  }

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

  // 1. Create Campaign
  const campaignRes = await fetch(`${FB}/${account_id}/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      objective,
      status: 'PAUSED', // Start paused — user reviews before activating
      special_ad_categories: [],
      access_token: token,
    }),
  });
  const campaignData = await campaignRes.json().catch(() => ({}));
  if (campaignData.error) {
    return res.status(400).json({ error: campaignData.error.message || 'Failed to create campaign' });
  }
  const campaignId = campaignData.id;

  // 2. Create Ad Set
  const endTime = new Date(Date.now() + (Number(days) || 7) * 24 * 60 * 60 * 1000).toISOString();
  const adSetRes = await fetch(`${FB}/${account_id}/adsets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `${name} - Ad Set`,
      campaign_id: campaignId,
      daily_budget: Number(daily_budget),
      billing_event: 'IMPRESSIONS',
      optimization_goal: objective === 'OUTCOME_TRAFFIC' ? 'LINK_CLICKS' : objective === 'OUTCOME_LEADS' ? 'LEAD_GENERATION' : 'REACH',
      targeting: {
        geo_locations: { countries: ['US', 'CA', 'GB', 'AU'] },
        age_min: 18,
        age_max: 65,
      },
      end_time: endTime,
      status: 'PAUSED',
      access_token: token,
    }),
  });
  const adSetData = await adSetRes.json().catch(() => ({}));
  if (adSetData.error) {
    return res.status(400).json({ error: adSetData.error.message || 'Failed to create ad set' });
  }
  const adSetId = adSetData.id;

  // 3. Create Ad Creative (link ad)
  const creativeRes = await fetch(`${FB}/${account_id}/adcreatives`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `${name} - Creative`,
      object_story_spec: {
        link_data: {
          link: url,
          message: name,
          call_to_action: { type: 'LEARN_MORE', value: { link: url } },
        },
        page_id: 'me', // Will use the connected Facebook Page
      },
      access_token: token,
    }),
  });
  const creativeData = await creativeRes.json().catch(() => ({}));
  if (creativeData.error) {
    return res.status(400).json({ error: creativeData.error.message || 'Failed to create creative' });
  }
  const creativeId = creativeData.id;

  // 4. Create Ad
  const adRes = await fetch(`${FB}/${account_id}/ads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `${name} - Ad`,
      adset_id: adSetId,
      creative: { creative_id: creativeId },
      status: 'PAUSED',
      access_token: token,
    }),
  });
  const adData = await adRes.json().catch(() => ({}));
  if (adData.error) {
    return res.status(400).json({ error: adData.error.message || 'Failed to create ad' });
  }

  return res.status(200).json({
    campaign_id: campaignId,
    adset_id: adSetId,
    ad_id: adData.id,
    status: 'PAUSED',
    message: 'Campaign created in PAUSED state. Go to Meta Ads Manager to review and activate it.',
  });
}
