/**
 * AI content generation & analytics — uses Groq (fast) with Anthropic as fallback.
 * Requires: GROQ_API_KEY (and optionally ANTHROPIC_API_KEY)
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mode, topic, description, niche, format, analyticsData, chatHistory, brandName, brandType } = req.body || {};

  if (!topic && !analyticsData) {
    return res.status(400).json({ error: 'topic or analyticsData is required' });
  }

  let prompt;
  let isChat = false;

  if (mode === 'chat') {
    isChat = true;
    const brand = brandName || 'Sarah Speaks Faith';
    const type = brandType || 'faith';
    const nicheDesc = type === 'faith'
      ? 'Christian creator focused on discipleship, spreading the gospel, saving souls, faith lifestyle, and spiritual growth for women'
      : type === 'service'
      ? 'service-based business focused on helping clients achieve results'
      : type === 'product'
      ? 'product-based business focused on sales, marketing, and customer growth'
      : 'creator and entrepreneur';
    const history = (chatHistory || []).map(m => `${m.role === 'user' ? 'Creator' : 'Coach'}: ${m.text}`).join('\n');
    prompt = `You are a world-class social media coach, content strategist, marketing expert, and creative tools instructor coaching Sarah directly.

SARAH'S BRAND ECOSYSTEM — know this deeply:

1. SARAH SPEAKS FAITH (primary brand, current focus)
   - Christian content creator: discipleship, gospel, saving souls, faith lifestyle, spiritual growth for women
   - Platform: Instagram (Reels + posts) + YouTube channel
   - Audience: Christian women seeking real, raw, faith-filled content
   - YouTube channel name: "Sarah Speaks Faith" (the personal brand is the channel)

2. HER STEWARDSHIP (second brand — lives INSIDE Sarah Speaks Faith)
   - A podcast/show series that lives on the Sarah Speaks Faith YouTube channel
   - Focus: financial stewardship, biblical money management, faith + finances for women
   - Same audience as Sarah Speaks Faith — same Christian women, just deeper into their journey
   - Cross-posting strategy: Sarah Speaks Faith builds the audience → Her Stewardship converts/deepens them
   - Recommended posting schedule: Mon/Fri = faith Reels (Sarah Speaks Faith), Wed = Her Stewardship episode or faith + finance content, Sun = devotional with soft Her Stewardship mention
   - When suggesting content plans, always weave Her Stewardship into the Sarah Speaks Faith schedule naturally

3. STOKLYNC (separate business — product/tech)
4. SKIN PRODUCTS (separate business — beauty/product)

CONTENT WORKFLOW Sarah uses:
- Films on phone/camera → edits in DaVinci Resolve → color grades photos in Adobe Lightroom → designs graphics in Canva → plans/writes content in this app → posts

TOOLS Sarah uses — you know all of these deeply:
- DaVinci Resolve: Cut page, Edit page, Color page (wheels, curves, LUTs, nodes), Fusion (Text+), Deliver page. Export for Reels: H.264, 1080x1920, 30fps. Give step-by-step instructions with exact menu/button names and keyboard shortcuts (Cmd on Mac).
- Adobe Lightroom: Basic panel, HSL/Color Mix, Tone Curve, Detail, Presets, export for Instagram (JPEG, sRGB, 1080px). Step-by-step instructions.
- Canva: canvas sizing (1080x1920 for Reels), brand kit, templates, export. Step-by-step instructions.

CURRENT BRAND in focus: "${brand}" (type: ${type})

Be specific, practical, and brilliant. Give real answers — not generic advice. No fluff. When Sarah asks about DaVinci, Lightroom or Canva, walk her through it step by step like a patient expert sitting next to her. When she asks about planning, always consider both Sarah Speaks Faith AND Her Stewardship as a connected ecosystem.

Conversation:
${history}
Coach:`;
  } else if (mode === 'analytics') {
    const { posts, account, growth, insights, audience, brandName } = analyticsData || {};
    const sortedByViews = [...(posts||[])].sort((a,b) => (b.views||0)-(a.views||0));
    const sortedByEng = [...(posts||[])].sort((a,b) => (b.engagement||0)-(a.engagement||0));
    const top5Views = sortedByViews.slice(0,5).map(p => `- "${p.title?.slice(0,70)}" | ${p.views||0} views | ${p.likes||0} likes | ${p.saves||0} saves | ${p.comments||0} comments | type: ${p.mediaType||p.platform} | posted: ${p.postedAt} | hour: ${p.hour!=null?p.hour+'h':'?'}${p.avgWatchTimeMs?` | avg watch: ${(p.avgWatchTimeMs/1000).toFixed(1)}s`:''}`).join('\n');
    const bottom5 = sortedByViews.slice(-3).map(p => `- "${p.title?.slice(0,70)}" | ${p.views||0} views`).join('\n');
    const avgViews = posts?.length ? Math.round(posts.reduce((s,p)=>s+(p.views||0),0)/posts.length) : 0;
    const avgEng = posts?.length ? Math.round(posts.reduce((s,p)=>s+(p.engagement||0),0)/posts.length) : 0;
    const reels = (posts||[]).filter(p=>p.mediaType==='REEL');
    const images = (posts||[]).filter(p=>p.mediaType==='IMAGE');
    const avgReelViews = reels.length ? Math.round(reels.reduce((s,p)=>s+(p.views||0),0)/reels.length) : 0;
    const avgImgViews = images.length ? Math.round(images.reduce((s,p)=>s+(p.views||0),0)/images.length) : 0;
    const hourMap = {};
    (posts||[]).forEach(p => { if(p.hour!=null) hourMap[p.hour] = (hourMap[p.hour]||0) + (p.views||0); });
    const bestHours = Object.entries(hourMap).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([h])=>`${h}:00`).join(', ');
    const topCountries = (audience?.topCountries||[]).map(c=>`${c.name} (${c.count})`).join(', ');
    const topCities = (audience?.topCities||[]).map(c=>`${c.name} (${c.count})`).join(', ');

    prompt = `You are a world-class social media strategist and content marketing expert with deep expertise in faith-based creators, Instagram growth, and viral content strategy. You analyze data like a pro and give brutally honest, specific, actionable advice.

CREATOR NICHE: Christian faith creator — discipleship, gospel, saving souls, spiritual growth, prayer, faith lifestyle for women
BRAND: ${brandName || 'Sarah Speaks Faith'}
ACCOUNT: @${account?.username || 'unknown'} | ${account?.followers||0} followers | ${account?.following||0} following
GROWTH (last 30 days): +${growth?.newFollowers30d||0} new followers | ${(growth?.reach30d||0).toLocaleString()} reach | ${(growth?.profileViews30d||0).toLocaleString()} profile views

CONTENT PERFORMANCE (${posts?.length||0} posts analyzed):
Average views per post: ${avgViews.toLocaleString()}
Average engagement per post: ${avgEng}
Reels: ${reels.length} posts, avg ${avgReelViews.toLocaleString()} views
Images: ${images.length} posts, avg ${avgImgViews.toLocaleString()} views
Best posting hours by views: ${bestHours || 'not enough data'}

TOP 5 PERFORMING POSTS:
${top5Views || 'no data'}

LOWEST PERFORMING POSTS:
${bottom5 || 'no data'}

AUDIENCE:
Top countries: ${topCountries || 'not available'}
Top cities: ${topCities || 'not available'}

${insights?.topPost ? `ALL-TIME TOP POST: "${insights.topPost.title}" — ${insights.topPost.engagement} engagement` : ''}

Analyze this data deeply and respond in this EXACT JSON format:
{
  "verdict": "2-3 sentence honest assessment of where this account stands and its biggest opportunity",
  "whatIsWorking": ["specific thing 1 backed by data", "specific thing 2", "specific thing 3"],
  "whatIsNotWorking": ["specific problem 1 with data", "specific problem 2"],
  "contentStrategy": "Detailed strategy paragraph — what to post, how often, what formats, what topics convert for this specific faith audience",
  "bestTimeToPost": "Specific days and times based on their data with reasoning",
  "contentIdeas": [
    {"title": "Content idea 1 title", "hook": "Opening hook for this video", "why": "Why this will work for their audience"},
    {"title": "Content idea 2 title", "hook": "Opening hook", "why": "Why this works"},
    {"title": "Content idea 3 title", "hook": "Opening hook", "why": "Why this works"},
    {"title": "Content idea 4 title", "hook": "Opening hook", "why": "Why this works"},
    {"title": "Content idea 5 title", "hook": "Opening hook", "why": "Why this works"}
  ],
  "growthHack": "One specific unconventional tactic to grow faster in the next 30 days",
  "warningSign": "One critical thing they must fix or stop doing immediately",
  "weeklyPlan": {
    "monday": "What to post Monday",
    "wednesday": "What to post Wednesday",
    "friday": "What to post Friday",
    "sunday": "What to post Sunday"
  }
}

Return ONLY valid JSON. Be specific, data-driven, and brutally helpful. Reference their actual numbers.`;

  } else if (mode === 'roadmap') {
    const { posts, account, growth, audience, brandName: rBrand } = analyticsData || {};
    const sortedByViews = [...(posts||[])].sort((a,b) => (b.views||0)-(a.views||0));
    const top5 = sortedByViews.slice(0,5).map(p => `"${p.title?.slice(0,60)}" — ${p.views||0} views, ${p.engagement||0} engagement, type: ${p.mediaType}`).join('\n');
    const topCountries = (audience?.topCountries||[]).map(c=>`${c.name} (${c.count})`).join(', ');
    const topCities = (audience?.topCities||[]).map(c=>`${c.name} (${c.count})`).join(', ');
    const genderAge = JSON.stringify(audience?.genderAge || {});

    prompt = `You are a world-class content strategist and audience growth expert. Build a data-driven content roadmap that tells the creator exactly what their audience wants — not what they feel like posting.

BRAND: ${rBrand || 'Sarah Speaks Faith'}
NICHE: Christian faith creator — discipleship, gospel, saving souls, spiritual growth, prayer, faith lifestyle for women
FOLLOWERS: ${account?.followers||0} | POSTS ANALYZED: ${posts?.length||0}
NEW FOLLOWERS (30d): ${growth?.newFollowers30d||0} | REACH (30d): ${growth?.reach30d||0}

TOP PERFORMING CONTENT:
${top5 || 'no data yet'}

AUDIENCE LOCATION: ${topCountries || 'unknown'}
AUDIENCE CITIES: ${topCities || 'unknown'}
GENDER/AGE BREAKDOWN: ${genderAge}

IMPORTANT BRAND CONTEXT:
- Sarah Speaks Faith is the PRIMARY brand and YouTube channel name
- Her Stewardship is a podcast/show series that lives INSIDE the Sarah Speaks Faith channel — same audience, same women, deeper topic (faith + finances)
- Cross-brand schedule: Mon/Fri = faith Reels, Wed = Her Stewardship episode/faith+finance content, Sun = devotional with soft Her Stewardship mention
- The roadmap must weave Her Stewardship naturally into the Sarah Speaks Faith schedule — they are one ecosystem, not two competing brands

Build a strategic 30-day content roadmap based on what the DATA says this audience craves. Weave Her Stewardship into the plan at the right moments. Think like a strategist, not a creator.

Respond in this EXACT JSON:
{
  "audienceInsight": "2-3 sentences: who exactly is watching, what do they want, what emotional state are they in when they find this creator",
  "audiencePersona": {
    "who": "Specific description of the core audience (age range, life stage, struggles, desires)",
    "whatTheyWant": "The 3 core things this audience is searching for",
    "whatStopsThemScrolling": "What visual or verbal trigger makes them stop and watch",
    "bestEmotionalTrigger": "The single most powerful emotion to target with every post"
  },
  "contentPillars": [
    {"pillar": "Pillar name", "why": "Why this works for THIS audience based on data", "percentage": "% of content", "exampleTopics": ["topic 1", "topic 2", "topic 3"]},
    {"pillar": "Pillar name", "why": "Why", "percentage": "% of content", "exampleTopics": ["topic 1", "topic 2", "topic 3"]},
    {"pillar": "Pillar name", "why": "Why", "percentage": "% of content", "exampleTopics": ["topic 1", "topic 2", "topic 3"]},
    {"pillar": "Pillar name", "why": "Why", "percentage": "% of content", "exampleTopics": ["topic 1", "topic 2", "topic 3"]}
  ],
  "roadmap": [
    {"week": 1, "theme": "Week theme", "goal": "Specific measurable goal", "posts": [
      {"day": "Mon", "brand": "Sarah Speaks Faith", "type": "Reel/Carousel/Single", "topic": "Exact topic", "hook": "Opening hook", "audienceWhy": "Why THIS audience will engage"},
      {"day": "Wed", "brand": "Her Stewardship", "type": "Reel/Podcast clip/Carousel", "topic": "Exact faith+finance topic", "hook": "Opening hook", "audienceWhy": "Why this bridges faith and stewardship for her audience"},
      {"day": "Fri", "brand": "Sarah Speaks Faith", "type": "Reel/Carousel/Single", "topic": "Exact topic", "hook": "Opening hook", "audienceWhy": "Why THIS audience will engage"},
      {"day": "Sun", "brand": "Sarah Speaks Faith", "type": "Single/Carousel", "topic": "Devotional — soft Her Stewardship mention", "hook": "Opening hook", "audienceWhy": "Sunday devotional content performs high for faith audiences"}
    ]},
    {"week": 2, "theme": "Week theme", "goal": "Specific measurable goal", "posts": [
      {"day": "Mon", "brand": "Sarah Speaks Faith", "type": "Reel/Carousel/Single", "topic": "Exact topic", "hook": "Opening hook", "audienceWhy": "Why THIS audience will engage"},
      {"day": "Wed", "brand": "Her Stewardship", "type": "Reel/Podcast clip/Carousel", "topic": "Exact faith+finance topic", "hook": "Opening hook", "audienceWhy": "Why this works"},
      {"day": "Fri", "brand": "Sarah Speaks Faith", "type": "Reel/Carousel/Single", "topic": "Exact topic", "hook": "Opening hook", "audienceWhy": "Why THIS audience will engage"},
      {"day": "Sun", "brand": "Sarah Speaks Faith", "type": "Single/Carousel", "topic": "Devotional — soft Her Stewardship mention", "hook": "Opening hook", "audienceWhy": "Sunday devotional"}
    ]},
    {"week": 3, "theme": "Week theme", "goal": "Specific measurable goal", "posts": [
      {"day": "Mon", "brand": "Sarah Speaks Faith", "type": "Reel/Carousel/Single", "topic": "Exact topic", "hook": "Opening hook", "audienceWhy": "Why THIS audience will engage"},
      {"day": "Wed", "brand": "Her Stewardship", "type": "Reel/Podcast clip/Carousel", "topic": "Exact faith+finance topic", "hook": "Opening hook", "audienceWhy": "Why this works"},
      {"day": "Fri", "brand": "Sarah Speaks Faith", "type": "Reel/Carousel/Single", "topic": "Exact topic", "hook": "Opening hook", "audienceWhy": "Why THIS audience will engage"},
      {"day": "Sun", "brand": "Sarah Speaks Faith", "type": "Single/Carousel", "topic": "Devotional — soft Her Stewardship mention", "hook": "Opening hook", "audienceWhy": "Sunday devotional"}
    ]},
    {"week": 4, "theme": "Week theme", "goal": "Specific measurable goal", "posts": [
      {"day": "Mon", "brand": "Sarah Speaks Faith", "type": "Reel/Carousel/Single", "topic": "Exact topic", "hook": "Opening hook", "audienceWhy": "Why THIS audience will engage"},
      {"day": "Wed", "brand": "Her Stewardship", "type": "Reel/Podcast clip/Carousel", "topic": "Exact faith+finance topic", "hook": "Opening hook", "audienceWhy": "Why this works"},
      {"day": "Fri", "brand": "Sarah Speaks Faith", "type": "Reel/Carousel/Single", "topic": "Exact topic", "hook": "Opening hook", "audienceWhy": "Why THIS audience will engage"},
      {"day": "Sun", "brand": "Sarah Speaks Faith", "type": "Single/Carousel", "topic": "Devotional — soft Her Stewardship mention", "hook": "Opening hook", "audienceWhy": "Sunday devotional"}
    ]}
  ],
  "seriesIdea": {"name": "A recurring series title", "concept": "What this series is about", "why": "Why this will build a loyal returning audience"},
  "viralOpportunity": "The single highest-probability viral content idea for THIS specific audience right now — be very specific"
}

Return ONLY valid JSON. Be audience-obsessed. Every decision must be justified by what the audience data tells you.`;

  } else {
    // Content generation mode
    prompt = `You are an expert Instagram content strategist and gospel content coach specializing in Christian creators, discipleship content, and faith-based growth. You understand what makes Reels go viral: strong hooks in the first 3 seconds, emotional resonance, spiritual truth, and a compelling CTA.

Creator: Sarah (Sarah Speaks Faith) — a Christian content creator passionate about discipleship, spreading the gospel, saving souls, faith lifestyle, prayer, and helping women grow spiritually. Her audience are Christian women seeking real, raw, faith-filled content.
Format: ${format || '9:16 Reel'}
Topic: ${topic}
${description ? `Context: ${description}` : ''}
Niche: ${niche || 'faith/discipleship/gospel'}

Generate in valid JSON:
{
  "hooks": ["Hook 1 (under 8 words, curiosity/urgency)", "Hook 2 (question or bold statement)", "Hook 3 (vulnerable/relatable)"],
  "caption": "Full caption (2-4 sentences, conversational, ends with question)",
  "hashtags": ["hashtag1","hashtag2","hashtag3","hashtag4","hashtag5","hashtag6","hashtag7","hashtag8","hashtag9","hashtag10"],
  "postingTip": "Specific tip to maximize reach for this content",
  "cta": "One strong call-to-action line"
}

Return ONLY the JSON object.`;
  }

  // Try Groq first (fast)
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: isChat ? 800 : 1500,
          temperature: 0.7,
        }),
      });
      const groqData = await groqRes.json();
      const text = groqData.choices?.[0]?.message?.content || '';
      if (text) {
        if (isChat) return res.status(200).json({ reply: text.trim() });
        const match = text.match(/\{[\s\S]*\}/);
        const result = JSON.parse(match ? match[0] : text);
        return res.status(200).json(result);
      }
    } catch (e) {
      console.warn('Groq failed:', e.message);
    }
  }

  // Fallback: Anthropic Claude
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: anthropicKey });
      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: isChat ? 800 : 1500,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = message.content[0]?.text || '';
      if (isChat) return res.status(200).json({ reply: text.trim() });
      const match = text.match(/\{[\s\S]*\}/);
      const result = JSON.parse(match ? match[0] : text);
      return res.status(200).json(result);
    } catch (e) {
      console.error('Anthropic failed:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(500).json({ error: 'No AI API key configured.' });
}
