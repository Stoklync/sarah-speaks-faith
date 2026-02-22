/**
 * Fetch YouTube channel videos. Reads token from Supabase using X-User-Key header.
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userKey = req.headers['x-user-key'] || req.query.state;
  if (!userKey) {
    return res.status(401).json({ error: 'Missing X-User-Key. Connect your YouTube account first.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: row, error } = await supabase.from('social_tokens').select('access_token').eq('user_key', userKey).eq('platform', 'youtube').single();

  if (error || !row?.access_token) {
    return res.status(401).json({ error: 'YouTube not connected. Go to Post Analytics and click Connect YouTube.' });
  }

  const token = row.access_token;

  const channelRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=id,snippet,statistics&mine=true', {
    headers: { Authorization: `Bearer ${token}` },
  });

  const channelData = await channelRes.json().catch(() => ({}));

  if (channelData.error || !channelData.items?.length) {
    return res.status(400).json({ error: channelData.error?.message || 'Could not fetch channel' });
  }

  const channelId = channelData.items[0].id;
  const channelTitle = channelData.items[0].snippet?.title || 'Unknown';

  const videosRes = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&maxResults=25&type=video`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const videosData = await videosRes.json().catch(() => ({}));

  if (videosData.error) {
    return res.status(400).json({ error: videosData.error?.message || 'Could not fetch videos' });
  }

  const videoIds = (videosData.items || []).map(i => i.id?.videoId).filter(Boolean);
  let videoStats = {};

  if (videoIds.length > 0) {
    const statsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds.join(',')}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const statsData = await statsRes.json().catch(() => ({}));
    (statsData.items || []).forEach(v => {
      videoStats[v.id] = v.statistics || {};
    });
  }

  const posts = (videosData.items || []).map(i => ({
    id: 'yt-' + (i.id?.videoId || Date.now()),
    title: i.snippet?.title || '',
    platform: 'youtube',
    postedAt: i.snippet?.publishedAt?.slice(0, 10) || '',
    views: Number(videoStats[i.id?.videoId]?.viewCount) || 0,
    likes: Number(videoStats[i.id?.videoId]?.likeCount) || 0,
    comments: Number(videoStats[i.id?.videoId]?.commentCount) || 0,
    shares: 0,
    saves: 0,
    notes: '',
    source: 'youtube_api',
  }));

  return res.status(200).json({
    channel: { id: channelId, title: channelTitle },
    posts,
  });
}
