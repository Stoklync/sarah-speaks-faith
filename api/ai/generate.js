import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const { topic, description, niche = 'faith/lifestyle', format = '9:16 Reel' } = req.body || {};

  if (!topic) {
    return res.status(400).json({ error: 'topic is required' });
  }

  const client = new Anthropic({ apiKey });

  const prompt = `You are an expert Instagram content strategist specializing in faith, lifestyle, and personal growth creators.
You understand the Instagram algorithm deeply — specifically what makes Reels go viral: strong hooks in the first 3 seconds, emotional resonance, clear value, and a compelling CTA.

The creator is: Sarah — a faith-based lifestyle creator sharing personal growth, prayer, and real-life content.
Video format: ${format}
Video topic: ${topic}
${description ? `Additional context: ${description}` : ''}
Niche: ${niche}

Generate the following in valid JSON format:

{
  "hooks": [
    "Hook option 1 (under 8 words, creates curiosity or urgency)",
    "Hook option 2 (starts with a question or bold statement)",
    "Hook option 3 (vulnerable/relatable opener)"
  ],
  "caption": "Full Instagram caption (2-4 sentences, conversational, ends with a question to drive comments)",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5", "hashtag6", "hashtag7", "hashtag8", "hashtag9", "hashtag10"],
  "postingTip": "One specific tip for posting this content to maximize reach (e.g., best time, day, or strategy)",
  "cta": "One strong call-to-action line for the caption"
}

Return ONLY the JSON object, no markdown, no explanation.`;

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0]?.text || '';
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      // Try to extract JSON if there's surrounding text
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        result = JSON.parse(match[0]);
      } else {
        throw new Error('Invalid JSON from AI');
      }
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('AI generate error:', err);
    return res.status(500).json({ error: err.message || 'AI generation failed' });
  }
}
