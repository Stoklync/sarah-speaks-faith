/**
 * Gemini API — analyze post analytics and suggest next moves.
 * Uses VITE_GEMINI_API_KEY or key from localStorage (Settings).
 * Free tier: ai.google.dev — no credit card required.
 */

const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-1.5-pro'];

function getApiKey() {
  try {
    return import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('faith-studio-gemini-api-key') || '';
  } catch {
    return '';
  }
}

export function hasGeminiKey() {
  return !!getApiKey().trim();
}

export async function analyzePosts(posts, businessName = 'your brand') {
  const key = getApiKey();
  if (!key.trim()) {
    throw new Error('Add your Gemini API key in App Settings. Get a free key at aistudio.google.com/apikey');
  }

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

  const prompt = `You are a growth coach for a faith-based digital creator. Analyze this post performance data for "${businessName}" and give actionable, concise advice.

POST DATA (JSON):
${JSON.stringify(summary, null, 2)}

Respond in this exact format (keep it short):
**Best time to post:** [day + time range based on their top performers, or general tip if not enough data]
**Next move:** [1–2 specific actions they should try next]
**What's working:** [pattern from top posts]
**Hook tip:** [suggestion for next video/post hook — avoid clichés like "stop scrolling", "God told me to post this", "this is your sign"; suggest authentic personal testimony or a real question the audience is wrestling with]
**Platform focus:** [which platform to prioritize and why]

Be encouraging and practical. If they have fewer than 3 posts, encourage them to log more and give general best practices.`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 600 }
  };

  let lastErr = null;
  for (const model of MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    }
    lastErr = await res.json().catch(() => ({}));
  }

  throw new Error(lastErr?.error?.message || 'No Gemini model available. Try a new API key from aistudio.google.com/apikey');
}
