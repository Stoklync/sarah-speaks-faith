/**
 * Fetch public competitor YouTube channel data.
 * Uses the authenticated user's OAuth token to call YouTube Data API v3 for any public channel.
 * Does NOT touch /api/sync/youtube — this is read-only competitor intelligence.
 *
 * Query params:
 *   handle   — YouTube @handle  (e.g. "@SarahSpeaksFaith")
 *   username — legacy username  (e.g. "SarahSpeaksFaith")
 *   channelId — direct channel ID (e.g. "UCxxxxxx")
 *
 * Headers:
 *   X-User-Key — same key used by youtube sync (to fetch OAuth token from Supabase)
 */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { handle, username, channelId } = req.query;

  if (!handle && !username && !channelId) {
    return res.status(400).json({ error: 'Provide handle, username, or channelId' });
  }

  // --- Get auth token from Supabase (reuse existing youtube connection) ---
  const userKey = req.headers['x-user-key'];
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let authHeader = {};

  if (userKey && supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey.trim(), {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: row } = await supabase
        .from('social_tokens')
        .select('access_token')
        .eq('user_key', userKey)
        .eq('platform', 'youtube')
        .single();
      if (row?.access_token) {
        authHeader = { Authorization: `Bearer ${row.access_token}` };
      }
    } catch (_) {}
  }

  // Fall back to API key if no OAuth token
  const apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY;
  const keyParam = !authHeader.Authorization && apiKey ? `&key=${apiKey}` : '';

  // --- 1. Resolve channel ID ---
  let resolvedChannelId = channelId || null;
  let channelSnippet = null;
  let channelStats = null;

  if (!resolvedChannelId) {
    const lookupParam = handle
      ? `forHandle=${encodeURIComponent(handle)}`
      : `forUsername=${encodeURIComponent(username)}`;

    const channelRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=id,snippet,statistics&${lookupParam}${keyParam}`,
      { headers: authHeader }
    );
    const channelData = await channelRes.json().catch(() => ({}));

    if (channelData.error) {
      return res.status(400).json({ error: channelData.error.message || 'Could not find channel' });
    }

    const item = channelData.items?.[0];
    if (!item) {
      return res.status(404).json({ error: 'Channel not found. Try the channel ID directly.' });
    }

    resolvedChannelId = item.id;
    channelSnippet = item.snippet;
    channelStats = item.statistics;
  } else {
    // Fetch snippet + stats by ID
    const channelRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${resolvedChannelId}${keyParam}`,
      { headers: authHeader }
    );
    const channelData = await channelRes.json().catch(() => ({}));
    const item = channelData.items?.[0];
    if (item) {
      channelSnippet = item.snippet;
      channelStats = item.statistics;
    }
  }

  // --- 2. Fetch top 12 videos by view count ---
  const searchRes = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${resolvedChannelId}&order=viewCount&maxResults=12&type=video${keyParam}`,
    { headers: authHeader }
  );
  const searchData = await searchRes.json().catch(() => ({}));

  const videoIds = (searchData.items || [])
    .map(i => i.id?.videoId)
    .filter(Boolean);

  // --- 3. Fetch video statistics ---
  let videoItems = [];
  if (videoIds.length > 0) {
    const statsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${videoIds.join(',')}${keyParam}`,
      { headers: authHeader }
    );
    const statsData = await statsRes.json().catch(() => ({}));
    videoItems = statsData.items || [];
  }

  // --- 4. Fetch recent 10 videos (by date) for posting frequency ---
  const recentRes = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${resolvedChannelId}&order=date&maxResults=10&type=video${keyParam}`,
    { headers: authHeader }
  );
  const recentData = await recentRes.json().catch(() => ({}));
  const recentDates = (recentData.items || [])
    .map(i => i.snippet?.publishedAt?.slice(0, 10))
    .filter(Boolean);

  // --- 5. Calculate posting frequency ---
  let postingFrequency = 'Unknown';
  if (recentDates.length >= 2) {
    const newest = new Date(recentDates[0]);
    const oldest = new Date(recentDates[recentDates.length - 1]);
    const daySpan = Math.max(1, Math.round((newest - oldest) / (1000 * 60 * 60 * 24)));
    const postsPerWeek = ((recentDates.length / daySpan) * 7).toFixed(1);
    postingFrequency = `~${postsPerWeek} videos/week`;
  }

  // --- 6. Shape response ---
  const topVideos = videoItems.map(v => ({
    id: v.id,
    title: v.snippet?.title || '',
    publishedAt: v.snippet?.publishedAt?.slice(0, 10) || '',
    views: Number(v.statistics?.viewCount) || 0,
    likes: Number(v.statistics?.likeCount) || 0,
    comments: Number(v.statistics?.commentCount) || 0,
    duration: v.contentDetails?.duration || '',
    thumbnail: v.snippet?.thumbnails?.medium?.url || '',
    url: `https://www.youtube.com/watch?v=${v.id}`,
  })).sort((a, b) => b.views - a.views);

  const totalViews = Number(channelStats?.viewCount) || 0;
  const subscribers = Number(channelStats?.subscriberCount) || 0;
  const videoCount = Number(channelStats?.videoCount) || 0;
  const avgViews = topVideos.length
    ? Math.round(topVideos.reduce((s, v) => s + v.views, 0) / topVideos.length)
    : 0;

  return res.status(200).json({
    channel: {
      id: resolvedChannelId,
      handle: handle || username || null,
      name: channelSnippet?.title || 'Unknown',
      description: channelSnippet?.description?.slice(0, 300) || '',
      thumbnail: channelSnippet?.thumbnails?.medium?.url || '',
      country: channelSnippet?.country || null,
      publishedAt: channelSnippet?.publishedAt?.slice(0, 10) || '',
      url: `https://www.youtube.com/channel/${resolvedChannelId}`,
      subscribers,
      totalViews,
      videoCount,
      postingFrequency,
      avgViewsTop12: avgViews,
    },
    topVideos,
    recentDates,
  });
}
