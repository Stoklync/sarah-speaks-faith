/**
 * AI Media Generation via fal.ai
 * POST { mediaType, prompt, style, ratio, model, duration }
 * mediaType: 'image' (default) | 'video'
 * Returns { url }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { mediaType = 'image', prompt, style, ratio, model = 'kling', duration = 5 } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });
  const apiKey = process.env.FAL_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Media generation not configured. Add FAL_API_KEY to Vercel.' });

  // --- VIDEO ---
  if (mediaType === 'video') {
    const endpoints = {
      kling:   'fal-ai/kling-video/v1.6/standard/text-to-video',
      luma:    'fal-ai/luma-dream-machine/ray-2-flash',
      minimax: 'fal-ai/minimax-video-01-live',
    };
    const endpoint = endpoints[model] || endpoints.kling;
    try {
      const submitRes = await fetch(`https://queue.fal.run/${endpoint}`, {
        method: 'POST',
        headers: { 'Authorization': `Key ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, duration: String(duration), aspect_ratio: ratio || '16:9' }),
      });
      const submitData = await submitRes.json();
      if (!submitRes.ok) return res.status(submitRes.status).json({ error: submitData?.detail || submitData?.message || 'Submission failed' });
      const requestId = submitData.request_id;
      if (!requestId) return res.status(500).json({ error: 'No request ID returned' });

      const start = Date.now();
      while (Date.now() - start < 180000) {
        await new Promise(r => setTimeout(r, 4000));
        const statusRes = await fetch(`https://queue.fal.run/${endpoint}/requests/${requestId}/status`, { headers: { 'Authorization': `Key ${apiKey}` } });
        const statusData = await statusRes.json();
        if (statusData.status === 'COMPLETED') {
          const resultRes = await fetch(`https://queue.fal.run/${endpoint}/requests/${requestId}`, { headers: { 'Authorization': `Key ${apiKey}` } });
          const result = await resultRes.json();
          const url = result.video?.url || result.videos?.[0]?.url;
          if (!url) return res.status(500).json({ error: 'No video URL in result' });
          return res.status(200).json({ url });
        }
        if (statusData.status === 'FAILED') return res.status(500).json({ error: statusData.error || 'Generation failed' });
      }
      return res.status(504).json({ error: 'Video generation timed out. Try a shorter duration.' });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to generate video: ' + e.message });
    }
  }

  // --- IMAGE ---
  const sizeMap = { '1:1': 'square_hd', '9:16': 'portrait_16_9', '16:9': 'landscape_16_9', '4:5': 'portrait_4_3' };
  const stylePrefix = {
    'photorealistic': 'photorealistic, ultra detailed, 8k, professional photography, ',
    'cinematic':      'cinematic, movie still, dramatic lighting, film grain, ',
    '3d':             '3D render, octane render, hyperrealistic 3D, studio lighting, ',
    'artistic':       'digital art, artistic, painterly, vibrant colors, ',
    'minimal':        'minimalist, clean, simple, white background, product photo, ',
    'none':           '',
  };
  const fullPrompt = (stylePrefix[style] || '') + prompt;
  const imageSize  = sizeMap[ratio] || 'square_hd';
  try {
    const r = await fetch('https://fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: { 'Authorization': `Key ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: fullPrompt, image_size: imageSize, num_inference_steps: 4, num_images: 1, enable_safety_checker: true }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.detail || data?.message || 'Generation failed' });
    const url = data.images?.[0]?.url;
    if (!url) return res.status(500).json({ error: 'No image returned' });
    return res.status(200).json({ url });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to generate image: ' + e.message });
  }
}
