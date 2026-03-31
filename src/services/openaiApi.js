/**
 * AI service — all calls route through secure backend /api/ai/
 * API keys are stored server-side only. Never exposed to browser.
 */

export function hasOpenAIKey() {
  // Always true — backend handles the key
  return true;
}

/**
 * Text-to-Speech — routes through backend
 */
export async function generateTTS(text, voice = 'onyx', speed = 1.0) {
  const res = await fetch('/api/ai/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text.slice(0, 4096), voice, speed }),
  });
  if (!res.ok) throw new Error('TTS failed. Please try again.');
  return res.blob();
}

/**
 * Transcribe video/audio — routes through backend
 */
export async function transcribeVideo(blob) {
  const ext = blob.type.includes('webm') ? 'webm' : 'mp4';
  const formData = new FormData();
  formData.append('file', new File([blob], `media.${ext}`, { type: blob.type || 'video/mp4' }));
  const res = await fetch('/api/ai/transcribe', {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Transcription failed. File may be over 25MB.');
  return res.json();
}

/**
 * Generate caption + hashtags
 */
export async function generateCaption(topic, platform = 'instagram') {
  const res = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'caption', topic, format: platform }),
  });
  if (!res.ok) throw new Error('Caption generation failed.');
  const data = await res.json();
  return data.result || data.caption || '';
}

/**
 * Repurpose content across platforms
 */
export async function repurposeContent(script) {
  const res = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'repurpose', topic: script }),
  });
  if (!res.ok) throw new Error('Repurpose failed.');
  const data = await res.json();
  return data.result || data.text || '';
}

/**
 * Analyze posts
 */
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
    }),
  });
  if (!res.ok) throw new Error('Analytics AI failed.');
  const data = await res.json();
  return data.result || data.text || JSON.stringify(data);
}
