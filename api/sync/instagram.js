/**
 * Fetch Instagram Business media + insights. Uses Facebook Graph API.
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Token must have: instagram_basic, instagram_manage_insights, pages_show_list, pages_read_engagement
 */
import { createClient } from '@supabase/supabase-js';

const FB = 'https://graph.facebook.com/v18.0';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userKey = req.headers['x-user-key'] || req.query.state;
  if (!userKey) {
    return res.status(401).json({ error: 'Missing X-User-Key. Connect your Instagram account first.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured.' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: row, error } = await supabase.from('social_tokens').select('access_token').eq('user_key', userKey).eq('platform', 'instagram').single();

  if (error || !row?.access_token) {
    return res.status(401).json({ error: 'Instagram not connected. Go to Post Analytics and click Connect Instagram.' });
  }

  const token = row.access_token;

  // 1. Get Facebook Pages with Instagram Business Account
  const pagesRes = await fetch(`${FB}/me/accounts?fields=id,name,instagram_business_account&access_token=${token}`);
  const pagesData = await pagesRes.json().catch(() => ({}));

  if (pagesData.error) {
    return res.status(400).json({ error: pagesData.error?.message || 'Could not fetch pages. Ensure your Instagram is a Business/Creator account linked to a Facebook Page.' });
  }

  const pages = pagesData.data || [];
  const pageWithIg = pages.find(p => p.instagram_business_account);
  const igAccount = pageWithIg?.instagram_business_account;
  const igUserId = typeof igAccount === 'object' ? igAccount?.id : igAccount;
  if (!igUserId) {
    return res.status(400).json({ error: 'No Instagram Business account found. Link your Instagram Business/Creator account to a Facebook Page in Meta Business Settings.' });
  }
  const igUsername = (typeof igAccount === 'object' && igAccount?.username) || 'Instagram';

  // 2. Get media
  const mediaRes = await fetch(
    `${FB}/${igUserId}/media?fields=id,caption,timestamp,media_type,permalink,like_count,comments_count&limit=25&access_token=${token}`
  );
  const mediaData = await mediaRes.json().catch(() => ({}));

  if (mediaData.error) {
    return res.status(400).json({ error: mediaData.error?.message || 'Could not fetch media' });
  }

  const mediaList = mediaData.data || [];

  // 3. Get insights for each media (engagement, impressions, reach, saved)
  const posts = [];
  for (const m of mediaList) {
    let engagement = (m.like_count || 0) + (m.comments_count || 0);
    let impressions = 0;
    let reach = 0;
    let saved = 0;

    const metrics = m.media_type === 'VIDEO' ? 'engagement,impressions,reach,saved,video_views' : 'engagement,impressions,reach,saved';
    const insightsRes = await fetch(`${FB}/${m.id}/insights?metric=${metrics}&access_token=${token}`);
    const insightsData = await insightsRes.json().catch(() => ({}));

    if (insightsData.data) {
      insightsData.data.forEach(metric => {
        const v = metric.values?.[0]?.value ?? 0;
        if (metric.name === 'engagement') engagement = Number(v);
        else if (metric.name === 'impressions') impressions = Number(v);
        else if (metric.name === 'reach') reach = Number(v);
        else if (metric.name === 'saved') saved = Number(v);
      });
    }

    posts.push({
      id: 'ig-' + m.id,
      title: (m.caption || '').slice(0, 80) || 'Instagram post',
      platform: 'instagram',
      postedAt: (m.timestamp || '').slice(0, 10),
      views: impressions || reach,
      likes: m.like_count ?? engagement,
      comments: m.comments_count || 0,
      shares: 0,
      saves: saved,
      notes: m.permalink ? `Link: ${m.permalink}` : '',
      source: 'instagram_api',
    });
  }

  return res.status(200).json({
    account: { id: igUserId, username: igUsername },
    posts,
  });
}
