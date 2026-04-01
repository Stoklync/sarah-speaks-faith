/**
 * AI content generation & analytics — uses Groq (fast) with Anthropic as fallback.
 * Requires: GROQ_API_KEY (and optionally ANTHROPIC_API_KEY)
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mode, topic, description, niche, format, analyticsData, chatHistory, brandName, brandType, brandDesc, preferredModel } = req.body || {};

  if (!topic && !analyticsData) {
    return res.status(400).json({ error: 'topic or analyticsData is required' });
  }

  let prompt;
  let isChat = false;

  if (mode === 'chat') {
    isChat = true;
    const brand = brandName || 'Sarah Speaks Faith';
    const type = brandType || 'faith';
    const history = (chatHistory || []).map(m => `${m.role === 'user' ? 'Creator' : 'Coach'}: ${m.text}`).join('\n');

    const isFaith = type === 'faith';
    const isStewardship = type === 'stewardship';
    const isBusiness = !isFaith && !isStewardship;

    let brandContext = '';

    if (isFaith) {
      brandContext = `You are a world-class Christian content strategist and ministry coach coaching Sarah on "${brand}".

BRAND PURPOSE: Ministry first — discipleship, spreading the gospel, saving souls, spiritual growth, prayer, faith lifestyle for women. This is NOT a sales brand. The goal is to reach souls and glorify God. Impact drives everything.

ABOUT SARAH (the creator): Single woman, no kids, no husband. She speaks to women on their faith journey regardless of life stage. NEVER suggest content about marriage, parenting, raising children, or being a wife — that is not her story. Her content is about personal faith, following God, spiritual growth, and encouraging women who are walking with God on their own.

CONNECTED SHOW: Her Stewardship (podcast that lives inside the Sarah Speaks Faith YouTube channel) — same audience, covers faith + finances. Weave it into Sarah Speaks Faith's schedule naturally (Mon/Fri = faith Reels, Wed = Her Stewardship, Sun = devotional).

PLATFORMS: Instagram Reels + posts, YouTube ("Sarah Speaks Faith" is the channel name).
AUDIENCE: Christian women — real, raw, faith-filled content. Women at all life stages, not just moms or wives.
TOOLS: DaVinci Resolve (editing), Lightroom (photos), Canva (graphics). Walk her through step by step when asked.`;

    } else if (isStewardship) {
      brandContext = `You are coaching Sarah on "${brand}" — a faith-based financial stewardship podcast/show that lives inside the Sarah Speaks Faith YouTube channel. Same Christian women audience, focused on biblical money management and financial freedom through faith. Wednesday is the primary content day. Blend faith and practical finance in every suggestion. Sarah is a single woman with no kids — never assume she is married or a parent.`;

    } else {
      const descContext = brandDesc ? `\n\nBRAND DESCRIPTION (what this business actually is):\n${brandDesc}\n\nUse this to make every recommendation specific to what ${brand} sells, who they serve, and what problem they solve.` : `\n\nNOTE: No brand description provided yet — ask Sarah to describe what ${brand} sells and who it serves if you need more context.`;

      brandContext = `You are a world-class marketing strategist, sales expert, SEO specialist, and business growth coach coaching Sarah on her business "${brand}".

BRAND PURPOSE: This is a BUSINESS. The goal is revenue, growth, sales, and market dominance. Completely separate from the faith brands — no religious overlay unless this brand specifically targets that niche.
${descContext}

YOUR FULL EXPERTISE for this brand:
- Marketing strategy: content marketing, paid ads, organic growth, brand positioning, campaign planning
- SEO: keyword research, on-page SEO, content strategy that ranks, local SEO, technical SEO basics
- Sales: funnels, conversion optimisation, closing, pricing, upsells, follow-up sequences
- Content for business: what to post, which platform, which format drives sales vs awareness
- Analytics: what metrics matter (CAC, LTV, conversion rate, ROAS), what to track, what to fix
- Social media for business: Instagram, YouTube, TikTok, LinkedIn — platform-specific strategy per goal
- Product/service launches, seasonal promotions, competitor analysis
- Polls, surveys, audience research to validate offers before building them
- Time management: when to post, what cadence, what to automate

Every recommendation must have a business reason — awareness, leads, or sales. Use real frameworks: AIDA, hook-story-offer, StoryBrand, 80/20. Be a genius marketing partner, not a cheerleader.

TOOLS: DaVinci Resolve, Lightroom, Canva. Walk her through step by step when asked.`;
    }

    prompt = `${brandContext}

CRITICAL: You are ONLY focused on "${brand}" right now. Do NOT mix in context, advice, or strategy from other brands.

RULES:
- Be specific to THIS brand and niche — no generic advice
- When real analytics data is available, use it first
- When data is missing, use your deep knowledge of what actually works in this space right now — current algorithm patterns, viral trends, what top creators in this niche are doing — and be clear it's a starting point to test and refine
- Be a genius strategist, not a cheerleader — say the hard truth when needed
- Think outside the box. The best advice is often unexpected

ACTIONS YOU CAN TAKE:
If the user explicitly asks you to update, change, edit, or save a Brand Kit field — return an action. ONLY include an action if the user clearly wants to make a change. For regular conversation and advice, set action to null.

UPDATABLE FIELDS (use exact field name):
- "contentPillars" — their core content themes (comma-separated)
- "targetAudience" — who this brand serves
- "description" — what the brand does / sells
- "brandVoice" — tone (must be one of: Inspirational, Educational, Bold, Conversational, Prophetic, Professional, Encouraging, Raw & Real)
- "contentGoals" — array like ["Grow audience","Drive sales"]
- "activePlatforms" — array like ["Instagram","YouTube","TikTok"]
- "website" — URL string
- "podcastName" — podcast name string
- "socialHandle" — @handle string
- "name" — brand name

RESPONSE FORMAT — output ONLY a raw JSON object, no markdown, no code fences, no explanation outside the JSON:
{"reply": "your conversational message here — can include line breaks, bullet points with \\n•, numbered lists with \\n1.", "action": null}

When updating a brand field:
{"reply": "Done! Here is what I updated.", "action": {"type": "updateBrand", "field": "fieldName", "value": "new value", "label": "Field Name"}}

CRITICAL: The "reply" value must be a plain string — never nest JSON inside "reply". Write naturally using \\n for new lines and • for bullets.

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

    const aBrandType = analyticsData?.brandType || 'faith';
    const aDesc = analyticsData?.brandDesc || brandDesc || '';
    const aNiche = aBrandType === 'faith'
      ? 'Christian faith creator — discipleship, gospel, saving souls, spiritual growth, prayer, faith lifestyle for women. Creator (Sarah) is a single woman with no kids.'
      : aBrandType === 'stewardship'
      ? 'Faith-based financial stewardship podcast — biblical money management, faith + finances for Christian women.'
      : `Business brand "${brandName}"${aDesc ? ` — ${aDesc}` : ' — marketing, sales, SEO, content that converts. No faith overlay.'}`;

    prompt = `You are a world-class social media strategist and content marketing expert. You analyze data like a pro and give brutally honest, specific, actionable advice tailored to this exact brand and niche.

CREATOR NICHE: ${aNiche}
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
    const { posts, account, growth, audience, brandName: rBrand, previousRoadmaps, brandDesc: rDesc } = analyticsData || {};
    const effectiveBrandDesc = rDesc || brandDesc || '';
    const sortedByViews = [...(posts||[])].sort((a,b) => (b.views||0)-(a.views||0));
    const top5 = sortedByViews.slice(0,5).map(p => `"${p.title?.slice(0,60)}" — ${p.views||0} views, ${p.engagement||0} engagement, type: ${p.mediaType}`).join('\n');
    const topCountries = (audience?.topCountries||[]).map(c=>`${c.name} (${c.count})`).join(', ');
    const topCities = (audience?.topCities||[]).map(c=>`${c.name} (${c.count})`).join(', ');
    const genderAge = JSON.stringify(audience?.genderAge || {});

    const rType = analyticsData?.brandType || 'faith';
    const isFaithRoadmap = rType === 'faith';
    const isStewardshipRoadmap = rType === 'stewardship';
    const isBusinessRoadmap = !isFaithRoadmap && !isStewardshipRoadmap;

    const rNiche = isFaithRoadmap
      ? 'Christian faith creator — discipleship, gospel, saving souls, spiritual growth, prayer, faith lifestyle for women. Creator (Sarah) is a single woman with no kids — do NOT suggest content about marriage, parenting, or raising children. She speaks to women on their faith journey, single or not.'
      : isStewardshipRoadmap
      ? 'Faith-based financial stewardship podcast — biblical money management and faith + finances for Christian women. Creator is Sarah, a single woman.'
      : `Business brand "${rBrand}" — completely separate from any faith brands. Focus: marketing, sales, SEO, content that converts, revenue growth, lead generation, brand authority. No religious overlay unless this brand specifically serves that market.`;

    const brandContextBlock = isFaithRoadmap ? `
IMPORTANT BRAND CONTEXT:
- Sarah Speaks Faith is the PRIMARY brand and YouTube channel name
- Her Stewardship is a podcast/show series that lives INSIDE the Sarah Speaks Faith channel — same audience, same women, deeper topic (faith + finances)
- Cross-brand posting schedule: Mon/Fri = faith Reels, Wed = Her Stewardship episode/faith+finance content, Sun = devotional with soft Her Stewardship mention
- The roadmap must weave Her Stewardship naturally into the Sarah Speaks Faith schedule — they are ONE ecosystem
- NEVER suggest topics about marriage, kids, or parenting — Sarah is a single woman without children` : isStewardshipRoadmap ? `
IMPORTANT BRAND CONTEXT:
- Her Stewardship is a faith + finance podcast/show for Christian women
- Primary day: Wednesday — also surfaces in Sarah Speaks Faith Sunday devotionals
- Focus: biblical money, budgeting, financial freedom, stewardship — always through a faith lens
- NEVER suggest parenting or marriage content — creator is a single woman` : `
IMPORTANT BRAND CONTEXT:
- "${rBrand}" is a STANDALONE BUSINESS brand — completely separate from any faith/ministry brands
- This roadmap must focus ONLY on business growth: marketing, sales, content strategy, brand positioning, SEO, lead generation, audience building for business goals
- Do NOT include any faith, gospel, devotional, or ministry content in this roadmap
- Content pillars must be business-oriented: brand awareness, lead gen, social proof, education, conversion
${effectiveBrandDesc ? `
WHAT THIS BUSINESS IS:
${effectiveBrandDesc}

Build the entire roadmap around these specifics — the products/services, target customer, and goals described above. Every content idea, hook, and pillar must directly serve this business.` : `- NOTE: No brand description provided. Build a general business growth roadmap. The creator should add a brand description (pencil icon next to brand name in sidebar) for more targeted results.`}`;

    const roadmapPostTemplate = isFaithRoadmap ? `
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
    ]}` : `
    {"week": 1, "theme": "Week theme", "goal": "Specific business goal (awareness/leads/sales)", "posts": [
      {"day": "Mon", "brand": "${rBrand}", "type": "Reel/Carousel/Post", "topic": "Exact business topic", "hook": "Opening hook", "audienceWhy": "Business reason this content drives awareness, leads, or sales"},
      {"day": "Wed", "brand": "${rBrand}", "type": "Reel/Carousel/Post", "topic": "Exact business topic", "hook": "Opening hook", "audienceWhy": "Why this converts or builds authority"},
      {"day": "Fri", "brand": "${rBrand}", "type": "Reel/Carousel/Post", "topic": "Exact business topic", "hook": "Opening hook", "audienceWhy": "Why this drives action"}
    ]},
    {"week": 2, "theme": "Week theme", "goal": "Specific business goal", "posts": [
      {"day": "Mon", "brand": "${rBrand}", "type": "Reel/Carousel/Post", "topic": "Exact business topic", "hook": "Opening hook", "audienceWhy": "Business reason"},
      {"day": "Wed", "brand": "${rBrand}", "type": "Reel/Carousel/Post", "topic": "Exact business topic", "hook": "Opening hook", "audienceWhy": "Why this converts"},
      {"day": "Fri", "brand": "${rBrand}", "type": "Reel/Carousel/Post", "topic": "Exact business topic", "hook": "Opening hook", "audienceWhy": "Why this drives action"}
    ]},
    {"week": 3, "theme": "Week theme", "goal": "Specific business goal", "posts": [
      {"day": "Mon", "brand": "${rBrand}", "type": "Reel/Carousel/Post", "topic": "Exact business topic", "hook": "Opening hook", "audienceWhy": "Business reason"},
      {"day": "Wed", "brand": "${rBrand}", "type": "Reel/Carousel/Post", "topic": "Exact business topic", "hook": "Opening hook", "audienceWhy": "Why this converts"},
      {"day": "Fri", "brand": "${rBrand}", "type": "Reel/Carousel/Post", "topic": "Exact business topic", "hook": "Opening hook", "audienceWhy": "Why this drives action"}
    ]},
    {"week": 4, "theme": "Week theme", "goal": "Specific business goal", "posts": [
      {"day": "Mon", "brand": "${rBrand}", "type": "Reel/Carousel/Post", "topic": "Exact business topic", "hook": "Opening hook", "audienceWhy": "Business reason"},
      {"day": "Wed", "brand": "${rBrand}", "type": "Reel/Carousel/Post", "topic": "Exact business topic", "hook": "Opening hook", "audienceWhy": "Why this converts"},
      {"day": "Fri", "brand": "${rBrand}", "type": "Reel/Carousel/Post", "topic": "Exact business topic", "hook": "Opening hook", "audienceWhy": "Why this drives action"}
    ]}`;

    prompt = `You are a world-class content strategist and audience growth expert. Build a data-driven content roadmap that tells the creator exactly what their audience wants — not what they feel like posting.

BRAND: ${rBrand || 'Sarah Speaks Faith'}
NICHE: ${rNiche}
FOLLOWERS: ${account?.followers||0} | POSTS ANALYZED: ${posts?.length||0}
NEW FOLLOWERS (30d): ${growth?.newFollowers30d||0} | REACH (30d): ${growth?.reach30d||0}

TOP PERFORMING CONTENT:
${top5 || 'no data yet'}

AUDIENCE LOCATION: ${topCountries || 'unknown'}
AUDIENCE CITIES: ${topCities || 'unknown'}
GENDER/AGE BREAKDOWN: ${genderAge}
${brandContextBlock}

${previousRoadmaps?.length > 0 ? `
PREVIOUS ROADMAP HISTORY (${previousRoadmaps.length} prior plans):
${previousRoadmaps.map((r, i) => `Plan ${i+1} (${r.generatedAt}):
- Audience insight: ${r.audienceInsight || 'not recorded'}
- Content pillars: ${r.contentPillars || 'not recorded'}
${r.whatEvolved ? `- What evolved: ${r.whatEvolved}` : ''}`).join('\n')}

EVOLUTION INSTRUCTIONS:
- Analyze the pattern across previous plans. What stayed consistent? What shifted?
- If the audience insight is changing, explain why — is the content attracting a different person now?
- Adjust the content pillars if data shows certain topics outperforming others
- In the "whatEvolved" field, explain specifically what changed from the last plan and why the data justified it
- If this is working well, double down. If something isn't, pivot with a clear reason.
` : ''}
Build a strategic 30-day content roadmap based on what the DATA says this audience craves. Think like a strategist, not a creator. Be flexible — the best strategy evolves with real data.

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
  "roadmap": [${roadmapPostTemplate}
  ],
  "seriesIdea": {"name": "A recurring series title", "concept": "What this series is about", "why": "Why this will build a loyal returning audience"},
  "viralOpportunity": "The single highest-probability viral content idea for THIS specific audience right now — be very specific",
  "whatEvolved": "If previous roadmaps exist: what changed from the last plan and exactly why the data justified it. If this is the first plan, say 'First roadmap — baseline established.'"
}

RULES:
- When real post data exists, lead with it — reference actual numbers and patterns
- When data is missing, draw on real-world knowledge: what works on this platform right now, current algorithm behaviour, proven viral patterns in this niche — flag it as a starting hypothesis to validate
- Think like a data scientist AND a creative director AND someone who lives on social media
- Never be generic. Every recommendation must be specific to this niche, this audience, and this moment
- Be outside-the-box brilliant — not just safe and predictable
- CRITICAL: Only generate content ideas that match THIS brand's niche. No crossover between business and faith brands.

Return ONLY valid JSON. Be audience-obsessed and strategically fearless.`;

  } else if (mode === 'competitor') {
    // Competitor intelligence — analyze a competitor's channel vs the user's own brand
    const { competitor, myStats } = req.body || {};
    const ch = competitor?.channel || {};
    const topVids = (competitor?.topVideos || []).slice(0, 8);

    const myContext = myStats
      ? `\n\nYOUR STATS (${brandName}):\nSubscribers: ${myStats.subscribers || 'unknown'}\nAvg views: ${myStats.avgViews || 'unknown'}\nPosting: ${myStats.postingFrequency || 'unknown'}`
      : '';

    const topVidList = topVids
      .map((v, i) => `${i + 1}. "${v.title}" — ${(v.views || 0).toLocaleString()} views, ${(v.likes || 0).toLocaleString()} likes, ${(v.comments || 0).toLocaleString()} comments`)
      .join('\n');

    prompt = `You are a world-class competitive intelligence analyst and content strategist. Analyze this competitor and give ${brandName || 'the creator'} a ruthless, specific battle plan to beat them.

COMPETITOR: ${ch.name || 'Unknown'}
Channel URL: ${ch.url || ''}
Subscribers: ${(ch.subscribers || 0).toLocaleString()}
Total views: ${(ch.totalViews || 0).toLocaleString()}
Videos posted: ${ch.videoCount || 0}
Posting frequency: ${ch.postingFrequency || 'unknown'}
Avg views (top 12): ${(ch.avgViewsTop12 || 0).toLocaleString()}
Niche/description: ${ch.description?.slice(0, 200) || 'N/A'}

TOP PERFORMING VIDEOS:
${topVidList || 'No video data'}
${myContext}

YOUR JOB: Be brutally honest and genius-level strategic. Return ONLY valid JSON:
{
  "theirStrategy": "2-3 sentences: what content strategy is clearly working for them based on their top videos",
  "contentPatterns": ["Pattern 1 — specific observation about their hooks/topics/format", "Pattern 2", "Pattern 3"],
  "audienceTheyOwn": "Who exactly is their core audience and what emotional need are they serving",
  "weaknesses": ["Gap 1 — something their audience clearly wants but they're not delivering", "Gap 2 — format or topic weakness", "Gap 3"],
  "yourEdge": "Specific competitive advantage ${brandName || 'you'} can own that this competitor cannot easily copy",
  "beatThemPlan": [
    {"action": "Specific content move to take their audience", "why": "Why this works against their weakness", "urgency": "high|medium"},
    {"action": "Second move", "why": "Why", "urgency": "high|medium"},
    {"action": "Third move", "why": "Why", "urgency": "high|medium"}
  ],
  "stealThisIdea": "One specific video concept from their top performers you can reframe for your brand RIGHT NOW",
  "positioningStatement": "One sentence that defines how ${brandName || 'you'} should position against this competitor — what makes you the better choice for their audience"
}`;

  } else {
    // Content generation mode — brand-type aware
    const cgType = brandType || 'faith';
    const cgBrand = brandName || 'Sarah Speaks Faith';
    const cgIsFaith = cgType === 'faith';
    const cgIsStewardship = cgType === 'stewardship';
    const cgIsBusiness = !cgIsFaith && !cgIsStewardship;

    const cgCreatorContext = cgIsFaith
      ? `Creator: Sarah (${cgBrand}) — a single Christian woman (no kids, not married) passionate about discipleship, spreading the gospel, saving souls, faith lifestyle, prayer, and helping women grow spiritually. Her audience are Christian women seeking real, raw, faith-filled content. NEVER include marriage or parenting references.`
      : cgIsStewardship
      ? `Creator: Sarah (${cgBrand}) — faith + finances podcast for Christian women. Focuses on biblical money management, stewardship, and financial freedom through faith. Creator is a single woman.`
      : `Brand: ${cgBrand} — a business brand. This is NOT a faith brand. Generate business-focused content ideas, hooks, and captions. No religious content.${brandDesc ? `\n\nABOUT THIS BUSINESS: ${brandDesc}\n\nAll content must be specific to what this business sells and who it serves.` : ''}`;

    prompt = `You are an expert content strategist who creates platform-native content that stops the scroll. You understand strong hooks, emotional resonance, and compelling CTAs.

${cgCreatorContext}
Format: ${format || '9:16 Reel'}
Topic: ${topic}
${description ? `Context: ${description}` : ''}
Niche: ${niche || (cgIsFaith ? 'faith/discipleship/gospel' : cgIsStewardship ? 'faith/finance/stewardship' : 'business/marketing')}

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

  // Helper: call Gemini — tries multiple models across v1 and v1beta
  const callGemini = async (maxTokens) => {
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    if (!geminiKey) throw new Error('No Gemini key');
    const attempts = [
      { version: 'v1beta', model: 'gemini-2.5-flash-preview-05-20' },
      { version: 'v1beta', model: 'gemini-2.5-flash-preview-04-17' },
      { version: 'v1beta', model: 'gemini-2.5-flash' },
      { version: 'v1beta', model: 'gemini-2.0-flash' },
      { version: 'v1beta', model: 'gemini-2.0-flash-lite' },
      { version: 'v1',     model: 'gemini-1.5-flash-latest' },
    ];
    const errors = [];
    for (const { version, model } of attempts) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens } }),
          }
        );
        const d = await geminiRes.json();
        if (d.error) {
          errors.push(`${model}: ${d.error.status} — ${d.error.message?.slice(0, 80)}`);
          continue;
        }
        const t = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (t) return t;
        errors.push(`${model}: empty response`);
      } catch (e) {
        errors.push(`${model}: ${e.message}`);
      }
    }
    throw new Error(errors.join(' | '));
  };

  // Helper: call OpenAI GPT-4o mini
  const callOpenAI = async (maxTokens) => {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) throw new Error('No OpenAI key');
    const oRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    });
    const d = await oRes.json();
    if (d.error) throw new Error(`OpenAI error: ${d.error.message}`);
    const t = d.choices?.[0]?.message?.content || '';
    if (!t) throw new Error('Empty OpenAI response');
    return t;
  };

  // Helper: call Groq/Llama
  const callGroq = async (maxTokens) => {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) throw new Error('No Groq key');
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    });
    const d = await groqRes.json();
    if (d.error) throw new Error(`Groq error: ${d.error.message}`);
    const t = d.choices?.[0]?.message?.content || '';
    if (!t) throw new Error('Empty Groq response');
    return t;
  };

  // Extract the FIRST complete JSON object from text (brace-depth matching)
  const extractFirstJson = (text) => {
    let depth = 0, start = -1;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') { if (depth === 0) start = i; depth++; }
      else if (text[i] === '}') { depth--; if (depth === 0 && start !== -1) return text.slice(start, i + 1); }
    }
    return null;
  };

  // Helper: parse chat response text → { reply, action }
  const parseChatText = (text) => {
    // Strip markdown code fences
    const clean = text.replace(/```(?:json)?/gi, '').trim();
    // Try to find and parse first JSON object
    const jsonStr = extractFirstJson(clean);
    if (jsonStr) {
      try {
        const obj = JSON.parse(jsonStr);
        let reply = obj?.reply;
        if (reply) {
          // Unwrap if reply is itself a JSON string (up to 2 levels deep)
          for (let i = 0; i < 2; i++) {
            if (typeof reply === 'string' && reply.trim().startsWith('{')) {
              try { const inner = JSON.parse(reply); if (inner?.reply) { reply = inner.reply; continue; } } catch {}
            }
            break;
          }
          return { reply: String(reply).trim(), action: obj.action || null };
        }
      } catch {}
    }
    // No valid JSON — return the raw text (strip any leftover JSON prefix)
    const fallback = clean.replace(/^\s*\{[^}]*"reply"\s*:\s*"/, '').replace(/"[,\s]*"action"[\s\S]*$/, '').trim();
    return { reply: fallback || clean, action: null };
  };

  // Helper: parse JSON response text
  const parseJsonText = (text) => {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in response');
    return JSON.parse(match[0]);
  };

  // --- CHAT MODE: respect preferredModel, then fallback chain ---
  if (isChat) {
    const callClaude = async () => {
      if (!process.env.ANTHROPIC_API_KEY) throw new Error('No Anthropic key');
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const message = await client.messages.create({ model: 'claude-sonnet-4-5', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] });
      return message.content[0]?.text || '';
    };

    // If user picked a specific model, try it — if not connected, tell them clearly
    if (preferredModel === 'claude') {
      if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(200).json({ reply: "◆ Claude isn't connected yet. To use it, add your Anthropic API key to Vercel (Settings → Environment Variables → ANTHROPIC_API_KEY). It's pay-per-use — pennies per conversation. For now, switch to Auto to keep using Gemini for free.", model: 'System', action: null });
      }
      try { return res.status(200).json({ ...parseChatText(await callClaude()), model: 'Claude' }); }
      catch (e) { return res.status(200).json({ reply: `Claude ran into an issue: ${e.message}. Try switching to Auto.`, model: 'System', action: null }); }
    }
    if (preferredModel === 'gemini') {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(200).json({ reply: "✦ Gemini isn't connected. Add GEMINI_API_KEY to Vercel to use it.", model: 'System', action: null });
      }
      try { return res.status(200).json({ ...parseChatText(await callGemini(1000)), model: 'Gemini' }); }
      catch (e) {
        console.error('Gemini preferred failed:', e.message);
        return res.status(200).json({ reply: `⚠️ Gemini error: ${e.message} — falling back to Groq.`, model: 'System', action: null });
      }
    }
    if (preferredModel === 'openai') {
      if (!process.env.OPENAI_API_KEY) {
        return res.status(200).json({ reply: "⊕ GPT-4o isn't connected yet. Add your OPENAI_API_KEY to Vercel when you're ready. Switch to Auto to use Gemini for free in the meantime.", model: 'System', action: null });
      }
      try { return res.status(200).json({ ...parseChatText(await callOpenAI(800)), model: 'GPT-4o' }); }
      catch (e) { console.error('GPT preferred failed:', e.message); }
    }

    // Auto / fallback chain: Gemini → Groq → GPT-4o → Claude
    if (process.env.GEMINI_API_KEY) {
      try { return res.status(200).json({ ...parseChatText(await callGemini(1000)), model: 'Gemini' }); }
      catch (e) { console.error('Gemini chat failed:', e.message); }
    }
    if (process.env.GROQ_API_KEY) {
      try { return res.status(200).json({ ...parseChatText(await callGroq(800)), model: 'Groq' }); }
      catch (e) { console.error('Groq chat failed:', e.message); }
    }
    if (process.env.OPENAI_API_KEY) {
      try { return res.status(200).json({ ...parseChatText(await callOpenAI(800)), model: 'GPT-4o' }); }
      catch (e) { console.error('OpenAI chat failed:', e.message); }
    }
    if (process.env.ANTHROPIC_API_KEY) {
      try { return res.status(200).json({ ...parseChatText(await callClaude()), model: 'Claude' }); }
      catch (e) { console.error('Anthropic chat failed:', e.message); }
    }
    return res.status(500).json({ error: 'No AI available for chat.' });
  }

  // --- ALL OTHER MODES: Groq first (fast), Gemini fallback (long context), Anthropic last ---
  const maxTokens = (mode === 'roadmap' || mode === 'analytics') ? 4000 : 1500;

  if (process.env.GROQ_API_KEY) {
    try {
      const text = await callGroq(maxTokens);
      return res.status(200).json(parseJsonText(text));
    } catch (e) { console.error('Groq failed:', e.message); }
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      const text = await callGemini(maxTokens);
      return res.status(200).json({ ...parseJsonText(text), poweredBy: 'gemini' });
    } catch (e) { console.error('Gemini failed:', e.message); }
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const text = await callOpenAI(maxTokens);
      return res.status(200).json({ ...parseJsonText(text), poweredBy: 'openai' });
    } catch (e) { console.error('OpenAI failed:', e.message); }
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: anthropicKey });
      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = message.content[0]?.text || '';
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
