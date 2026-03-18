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

/**
 * Transcribe video/audio using OpenAI Whisper — returns timed segments.
 */
export async function transcribeVideo(blob) {
  const key = getApiKey();
  if (!key.trim()) throw new Error('Add your OpenAI API key in App Settings to use Auto-Caption.');
  const ext = blob.type.includes('webm') ? 'webm' : 'mp4';
  const formData = new FormData();
  formData.append('file', new File([blob], `media.${ext}`, { type: blob.type || 'video/mp4' }));
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'segment');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Whisper error ${res.status} — file may be over 25 MB`);
  }
  return res.json();
}

/**
 * Generate a platform-specific caption + hashtags from a topic/script.
 */
export async function generateCaption(topic, platform = 'instagram') {
  const key = getApiKey();
  if (!key.trim()) throw new Error('Add your OpenAI API key in App Settings.');
  const guides = {
    instagram: 'Instagram Reels: 1-line hook (no "stop scrolling"), 3-4 short paragraphs with line breaks, personal story or testimony, end with a question. 150-250 words.',
    tiktok: 'TikTok: 2-3 punchy lines max. Hook + insight + emoji CTA. Ultra short.',
    youtube: 'YouTube: SEO description. First 2 lines are the hook. 200 words. End with subscribe CTA.',
    facebook: 'Facebook: warm, story-based, conversational. 100-180 words.',
  };
  const prompt = `You are a faith-based content creator assistant. Write an authentic caption for ${platform}.

TOPIC/SCRIPT: "${topic}"

STYLE RULES:
- Personal testimony, real experience
- No clichés: never say "stop scrolling", "God told me to post this", "this is your sign", "I wasn't going to post this"
- Conversational but inspiring
- Faith-centered and accessible
- End with a question or clear CTA

PLATFORM GUIDE: ${guides[platform] || guides.instagram}

Also generate 25 hashtags: 5 broad faith (#faith #christian), 10 niche faith-creator specific, 5 engagement (#foryoupage), 5 topic-specific.

Format your response EXACTLY as:
CAPTION:
[caption here]

HASHTAGS:
[hashtags here]`;
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 900, temperature: 0.78 }),
  });
  if (!res.ok) throw new Error(`Caption AI error ${res.status}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

/**
 * Repurpose one script into 6 platform versions + 3 hooks.
 */
export async function repurposeContent(script) {
  const key = getApiKey();
  if (!key.trim()) throw new Error('Add your OpenAI API key in App Settings.');
  const prompt = `You are a faith-based content creator assistant. Repurpose this content for every platform. No clichés. Keep it authentic.

ORIGINAL CONTENT: "${script}"

Generate ALL of the following — clearly labelled:

INSTAGRAM CAPTION:
[authentic IG caption, testimony-driven, ends with question, 150-220 words]

TIKTOK CAPTION:
[2-3 punchy lines max]

YOUTUBE DESCRIPTION:
[SEO hook + body + subscribe CTA, 180 words]

EMAIL SUBJECT + PREVIEW:
[Subject | Preview text]

TWEET:
[under 280 chars, punchy and real]

3 HOOK OPTIONS:
1. [curiosity hook]
2. [testimony/story hook]
3. [question hook]

HASHTAGS:
[25 hashtags for IG/TikTok]`;
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 1400, temperature: 0.78 }),
  });
  if (!res.ok) throw new Error(`Repurpose AI error ${res.status}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
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
