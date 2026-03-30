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

  const supabase = createClient(supabaseUrl, supabaseKey.trim(), { auth: { autoRefreshToken: false, persistSession: false } });
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

  // 2. Get account profile (followers, following, posts count)
  const profileRes = await fetch(
    `${FB}/${igUserId}?fields=followers_count,follows_count,media_count,biography,website,profile_picture_url,name,username&access_token=${token}`
  );
  const profile = await profileRes.json().catch(() => ({}));

  // 3. Get account-level insights (reach, profile views, follower growth last 30 days)
  const since = Math.floor((Date.now() - 30 * 86400000) / 1000);
  const until = Math.floor(Date.now() / 1000);
  const accountInsightsRes = await fetch(
    `${FB}/${igUserId}/insights?metric=reach,profile_views,follower_count&period=day&since=${since}&until=${until}&access_token=${token}`
  );
  const accountInsightsData = await accountInsightsRes.json().catch(() => ({}));

  // Process follower growth over last 30 days
  let followerGrowth = [];
  let totalNewFollowers = 0;
  let totalReach30d = 0;
  let profileViews30d = 0;

  if (accountInsightsData.data) {
    accountInsightsData.data.forEach(metric => {
      if (metric.name === 'follower_count') {
        followerGrowth = (metric.values || []).map(v => ({ date: v.end_time?.slice(0,10), value: Number(v.value) }));
        totalNewFollowers = followerGrowth.reduce((s, v) => s + v.value, 0);
      }
      if (metric.name === 'reach') totalReach30d = (metric.values || []).reduce((s, v) => s + Number(v.value), 0);
      if (metric.name === 'profile_views') profileViews30d = (metric.values || []).reduce((s, v) => s + Number(v.value), 0);
    });
  }

  // 3b. Audience demographics (lifetime metrics)
  const audienceRes = await fetch(
    `${FB}/${igUserId}/insights?metric=audience_gender_age,audience_city,audience_country&period=lifetime&access_token=${token}`
  );
  const audienceData = await audienceRes.json().catch(() => ({}));
  let audience = { genderAge: {}, topCities: [], topCountries: [] };
  if (audienceData.data) {
    audienceData.data.forEach(metric => {
      if (metric.name === 'audience_gender_age') {
        audience.genderAge = metric.values?.[0]?.value || {};
      } else if (metric.name === 'audience_city') {
        const v = metric.values?.[0]?.value || {};
        audience.topCities = Object.entries(v).sort((a,b) => b[1]-a[1]).slice(0,5).map(([name,count]) => ({ name, count }));
      } else if (metric.name === 'audience_country') {
        const v = metric.values?.[0]?.value || {};
        audience.topCountries = Object.entries(v).sort((a,b) => b[1]-a[1]).slice(0,5).map(([name,count]) => ({ name, count }));
      }
    });
  }

  // 4. Get media
  const mediaRes = await fetch(
    `${FB}/${igUserId}/media?fields=id,caption,timestamp,media_type,permalink,like_count,comments_count&limit=25&access_token=${token}`
  );
  const mediaData = await mediaRes.json().catch(() => ({}));

  if (mediaData.error) {
    return res.status(400).json({ error: mediaData.error?.message || 'Could not fetch media' });
  }

  const mediaList = mediaData.data || [];

  // 5. Get insights for each media
  const posts = [];
  for (const m of mediaList) {
    // likes + comments always available from basic fields — no insights permission needed
    const likes = m.like_count || 0;
    const comments = m.comments_count || 0;
    let reach = 0;
    let saved = 0;
    let videoViews = 0;
    let avgWatchTime = 0;
    let totalPlays = 0;

    // Use v22+ supported metrics: impressions/video_views deprecated, use reach + views
    const isReel = m.media_type === 'REEL';
    const isVideo = m.media_type === 'VIDEO';
    const isCarousel = m.media_type === 'CAROUSEL_ALBUM';
    // Reels-specific metrics only valid for REEL type, not regular VIDEO
    const metrics = isReel ? 'reach,saved,views,ig_reels_avg_watch_time,ig_reels_aggregated_all_plays_count'
      : isVideo ? 'reach,saved,views'
      : isCarousel ? 'reach,saved'
      : 'reach,saved';
    const insightsRes = await fetch(`${FB}/${m.id}/insights?metric=${metrics}&access_token=${token}`);
    const insightsData = await insightsRes.json().catch(() => ({}));

    if (insightsData.data) {
      insightsData.data.forEach(metric => {
        const v = metric.values?.[0]?.value ?? metric.value ?? 0;
        if (metric.name === 'reach') reach = Number(v);
        else if (metric.name === 'saved') saved = Number(v);
        else if (metric.name === 'views') videoViews = Number(v);
        else if (metric.name === 'ig_reels_avg_watch_time') avgWatchTime = Number(v); // milliseconds
        else if (metric.name === 'ig_reels_aggregated_all_plays_count') totalPlays = Number(v);
      });
    } else if (insightsData.error) {
      console.warn(`Insights error for ${m.id}:`, insightsData.error?.code, insightsData.error?.message);
    }

    posts.push({
      id: 'ig-' + m.id,
      title: (m.caption || '').slice(0, 80) || 'Instagram post',
      platform: 'instagram',
      mediaType: m.media_type,
      postedAt: (m.timestamp || '').slice(0, 10),
      hour: m.timestamp ? new Date(m.timestamp).getHours() : null,
      views: (isReel || isVideo) ? (videoViews || reach || null) : (reach || null),
      reach: reach || 0,
      likes,
      comments,
      shares: 0,
      saves: saved,
      videoViews,
      avgWatchTimeMs: avgWatchTime || null,
      totalPlays: totalPlays || null,
      engagement: likes + comments + saved,
      permalink: m.permalink || '',
      notes: m.permalink ? `Link: ${m.permalink}` : '',
      source: 'instagram_api',
    });
  }

  // 6. Analyze what works
  const reels = posts.filter(p => p.mediaType === 'VIDEO');
  const images = posts.filter(p => p.mediaType === 'IMAGE');
  const avgReelEngagement = reels.length ? Math.round(reels.reduce((s,p) => s + p.engagement, 0) / reels.length) : 0;
  const avgImageEngagement = images.length ? Math.round(images.reduce((s,p) => s + p.engagement, 0) / images.length) : 0;
  const bestHour = posts.length ? (() => {
    const hours = {};
    posts.forEach(p => { if (p.hour != null) hours[p.hour] = (hours[p.hour] || 0) + p.engagement; });
    return Object.entries(hours).sort((a,b) => b[1]-a[1])[0]?.[0];
  })() : null;
  const topPost = posts.length ? posts.reduce((a,b) => b.engagement > a.engagement ? b : a, posts[0]) : null;

  return res.status(200).json({
    account: {
      id: igUserId,
      username: profile.username || igUsername,
      name: profile.name || '',
      followers: profile.followers_count || 0,
      following: profile.follows_count || 0,
      mediaCount: profile.media_count || 0,
      bio: profile.biography || '',
      website: profile.website || '',
    },
    growth: {
      newFollowers30d: totalNewFollowers,
      reach30d: totalReach30d,
      profileViews30d,
      followerGrowth,
    },
    insights: {
      avgReelEngagement,
      avgImageEngagement,
      bestPostingHour: bestHour ? `${bestHour}:00` : null,
      topPost: topPost ? { title: topPost.title, engagement: topPost.engagement, permalink: topPost.permalink } : null,
      reelCount: reels.length,
      imageCount: images.length,
    },
    audience,
    posts,
  });
}
