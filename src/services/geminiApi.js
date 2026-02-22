/**
 * Gemini API — analyze post analytics and suggest next moves.
 * Uses VITE_GEMINI_API_KEY or key from localStorage (Settings).
 * Free tier: ai.google.dev — no credit card required.
 */

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

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
**Hook tip:** [suggestion for next video/post hook]
**Platform focus:** [which platform to prioritize and why]

Be encouraging and practical. If they have fewer than 3 posts, encourage them to log more and give general best practices.`;

  const res = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 600,
      }
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API error: ${res.status}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No response from AI');
  return text;
}
