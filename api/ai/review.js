/**
 * AI content review — analyzes caption, script, image, or video before posting.
 * Uses Gemini (supports vision) with Groq as text fallback.
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { type, content, imageBase64, imageMimeType } = req.body || {};
  if (!type || (!content && !imageBase64)) return res.status(400).json({ error: 'type and content or imageBase64 required' });

  const systemContext = `You are an expert social media content strategist and coach for Sarah Speaks Faith — a Christian creator focused on discipleship, spreading the gospel, saving souls, faith lifestyle, and spiritual growth for women. You review content before it gets posted and give brutally honest, specific, actionable feedback to maximize reach and impact.`;

  const prompts = {
    caption: `${systemContext}

Review this Instagram caption before posting:
"${content}"

Respond in JSON:
{
  "score": 85,
  "verdict": "One sentence overall verdict",
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "suggestions": ["specific fix 1", "specific fix 2", "specific fix 3"],
  "rewrite": "Your improved version of the full caption",
  "hashtags": ["hashtag1","hashtag2","hashtag3","hashtag4","hashtag5","hashtag6","hashtag7","hashtag8","hashtag9","hashtag10"],
  "bestTimeToPost": "Best day and time to post this specific content"
}`,

    script: `${systemContext}

Review this Reel script before filming:
"${content}"

Respond in JSON:
{
  "score": 85,
  "verdict": "One sentence overall verdict",
  "hookStrength": "Assessment of the first 3 seconds hook",
  "retentionRisk": "Where viewers might drop off and why",
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "suggestions": ["specific fix 1", "specific fix 2", "specific fix 3"],
  "rewrittenHook": "A stronger opening hook",
  "rewrittenCTA": "A stronger call to action",
  "predictedPerformance": "Honest prediction of how this will perform and why"
}`,

    idea: `${systemContext}

Review this content idea before creating it:
"${content}"

Respond in JSON:
{
  "score": 85,
  "verdict": "One sentence verdict on this idea",
  "viralPotential": "Low/Medium/High — with reasoning",
  "audienceFit": "How well this fits the Sarah Speaks Faith audience",
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["specific improvement 1", "specific improvement 2", "specific improvement 3"],
  "betterAngle": "A stronger way to approach this same topic",
  "hook": "The strongest possible hook for this idea",
  "formatRecommendation": "Reel, Carousel, or Single image — and why"
}`,

    thumbnail: `${systemContext}

Review this thumbnail/image for Instagram. Analyze it as an expert visual content strategist.

Respond in JSON:
{
  "score": 85,
  "verdict": "One sentence verdict",
  "clickability": "Assessment of how likely people are to stop scrolling",
  "textReadability": "Is text clear and readable on mobile?",
  "visualStrengths": ["visual strength 1", "visual strength 2"],
  "visualWeaknesses": ["weakness 1", "weakness 2"],
  "suggestions": ["specific improvement 1", "specific improvement 2", "specific improvement 3"],
  "colorFeedback": "Feedback on colors and contrast",
  "overallRecommendation": "Post it / Improve first / Start over"
}`
  };

  const prompt = prompts[type] || prompts.caption;

  // Try Gemini (supports vision)
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const parts = [];
      if (imageBase64 && imageMimeType) {
        parts.push({ inline_data: { mime_type: imageMimeType, data: imageBase64 } });
      }
      parts.push({ text: prompt });

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts }] }),
        }
      );
      const geminiData = await geminiRes.json();
      const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (text) {
        const match = text.match(/\{[\s\S]*\}/);
        const result = JSON.parse(match ? match[0] : text);
        return res.status(200).json({ ...result, poweredBy: 'gemini' });
      }
    } catch (e) {
      console.warn('Gemini review failed:', e.message);
    }
  }

  // Fallback: Groq
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1000,
          temperature: 0.7,
        }),
      });
      const groqData = await groqRes.json();
      const text = groqData.choices?.[0]?.message?.content || '';
      if (text) {
        const match = text.match(/\{[\s\S]*\}/);
        const result = JSON.parse(match ? match[0] : text);
        return res.status(200).json({ ...result, poweredBy: 'groq' });
      }
    } catch (e) {
      console.error('Groq review failed:', e.message);
    }
  }

  return res.status(500).json({ error: 'No AI API key configured.' });
}
