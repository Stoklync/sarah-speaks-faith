/**
 * OpenAI (ChatGPT) API — analyze post analytics and suggest next moves.
 * Uses VITE_OPENAI_API_KEY or key from localStorage (Settings).
 * Model: gpt-4o-mini (cheap, great for engagement tips).
 */

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech';

function getApiKey() {
  try {
    return import.meta.env.VITE_OPENAI_API_KEY || localStorage.getItem('faith-studio-openai-api-key') || '';
  } catch {
    return '';
  }
}

export function hasOpenAIKey() {
  return !!getApiKey().trim();
}

/**
 * Text-to-Speech using OpenAI TTS-1-HD.
 * Returns an audio/mpeg Blob ready to createObjectURL().
 */
export async function generateTTS(text, voice = 'onyx', speed = 1.0) {
  const key = getApiKey();
  if (!key.trim()) throw new Error('Add your OpenAI API key in App Settings to use AI Voice.');
  const res = await fetch(OPENAI_TTS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'tts-1-hd', voice, input: text.slice(0, 4096), speed }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `TTS error ${res.status}`);
  }
  return res.blob();
}

export async function analyzePosts(posts, businessName = 'your brand') {
  const key = getApiKey();
  if (!key.trim()) {
    throw new Error('Add your OpenAI API key in App Settings. Get a key at platform.openai.com');
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

  const prompt = `You are a growth coach for a faith-based digital creator. Analyze this post performance data for "${businessName}" and give actionable, concise advice focused on engagement and tips.

POST DATA (JSON):
${JSON.stringify(summary, null, 2)}

Respond in this exact format (keep it short):
**Best time to post:** [day + time range based on their top performers, or general tip if not enough data]
**Next move:** [1–2 specific actions they should try next]
**What's working:** [pattern from top posts]
**Hook tip:** [suggestion for next video/post hook — authentic and testimony-driven; avoid "stop scrolling", "God told me to post this", or "this is your sign"]
**Engagement tip:** [how to boost comments, saves, or shares]
**Platform focus:** [which platform to prioritize and why]

Be encouraging and practical. If they have fewer than 3 posts, encourage them to log more and give general best practices.`;

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
      temperature: 0.7
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI API error: ${res.status}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('No response from AI');
  return text;
}
