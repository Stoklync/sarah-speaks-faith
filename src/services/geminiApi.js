/**
 * Gemini API — routes through secure backend /api/ai/generate
 * Keys are stored server-side only. Never exposed to browser.
 */

export function hasGeminiKey() {
  // Always true — backend handles the key
  return true;
}

export async function analyzePosts(posts, businessName = 'your brand') {
  const summary = posts.map(p => ({
    title: p.title,
    platform: p.platform,
    date: p.postedAt,
    views: p.views,
    likes: p.likes,
    comments: p.comments,
    saves: p.saves,
    notes: p.notes || ''
  }));

  const res = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'analytics',
      analyticsData: { posts: summary },
      brandName: businessName,
    })
  });

  if (!res.ok) throw new Error('AI analysis failed. Please try again.');
  const data = await res.json();
  return data.result || data.text || JSON.stringify(data);
}
