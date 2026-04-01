import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles, Film, Share2, Copy, CheckCircle, Loader2,
  ExternalLink, ChevronRight, ArrowRight, Mic, MicOff,
  Lightbulb, Clapperboard, Layers, BarChart2, RefreshCw,
  ChevronDown, ChevronUp, Wand2, MessageSquare
} from 'lucide-react';

const PLATFORMS = [
  { id: 'reels', label: 'Instagram Reels', duration: '15–90s' },
  { id: 'shorts', label: 'YouTube Shorts', duration: 'Under 60s' },
  { id: 'tiktok', label: 'TikTok', duration: '15s–3min' },
  { id: 'youtube', label: 'YouTube', duration: '5–20min' },
  { id: 'facebook', label: 'Facebook Reels', duration: '15–90s' },
];

const EXTERNAL_EDITORS = [
  { name: 'CapCut', desc: 'Free · Mobile & Desktop', url: 'https://www.capcut.com', badge: 'Popular' },
  { name: 'DaVinci Resolve', desc: 'Free tier · Professional', url: 'https://www.blackmagicdesign.com/products/davinciresolve', badge: 'Pro' },
  { name: 'iMovie', desc: 'Built-in on Mac & iPhone', url: 'https://www.apple.com/imovie/', badge: 'Apple' },
  { name: 'Adobe Premiere', desc: 'Industry standard', url: 'https://www.adobe.com/products/premiere.html', badge: null },
];

const COACH_PROMPTS = [
  'My hook feels flat — how do I fix the opening?',
  'What B-roll shots should I capture for this?',
  'How do I make this video more emotionally engaging?',
  'My pacing feels off — how should I structure the cuts?',
  'What transitions work best for this type of video?',
  'How do I add a strong call to action at the end?',
  'What text overlays or captions should I add?',
  'How do I make this video stop the scroll?',
];

export function VideoTab({ businesses = [], activeBusinessId, setActiveTab }) {
  const [step, setStep] = useState(0); // 0=plan, 1=coach, 2=finish
  const [platform, setPlatform] = useState(PLATFORMS[0]);
  const [concept, setConcept] = useState('');
  const [script, setScript] = useState(null); // { hook, outline, broll, cta, caption }
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState('');

  // Edit coaching state
  const [coachMessages, setCoachMessages] = useState([]);
  const [coachInput, setCoachInput] = useState('');
  const [coachLoading, setCoachLoading] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editDescSaved, setEditDescSaved] = useState(false);
  const coachBottomRef = useRef(null);

  const activeBiz = businesses.find(b => b?.id === activeBusinessId);
  const brandName = activeBiz?.name || 'Your brand';
  const brandType = activeBiz?.type || 'faith';
  const brandDesc = activeBiz?.description || '';

  useEffect(() => {
    coachBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [coachMessages]);

  // ── Phase 1: Generate the full video blueprint ──────────────────
  const generateBlueprint = async () => {
    if (!concept.trim() || generating) return;
    setGenerating(true);
    setScript(null);
    try {
      const prompt = `Create a complete video production blueprint for ${platform.label} (${platform.duration}) on this concept: "${concept}"

Return ONLY valid JSON in exactly this shape:
{
  "hook": "The exact 1–2 sentence opening line that stops the scroll. Start with the strongest possible tension, question, or statement.",
  "outline": ["Beat 1 — what you say/show", "Beat 2", "Beat 3", "Beat 4", "Beat 5"],
  "broll": ["B-roll shot 1 idea", "B-roll shot 2", "B-roll shot 3", "B-roll shot 4"],
  "cta": "The exact call to action to close the video",
  "caption": "Full social media caption with line breaks and hashtags ready to post",
  "thumbnail": "One-sentence description of the ideal thumbnail for this video",
  "retentionTip": "One specific tip to keep viewers watching past 30 seconds"
}`;

      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'chat',
          topic: prompt,
          brandName,
          brandType,
          brandDesc,
          chatHistory: [],
        }),
      });
      const data = await res.json();
      const raw = data.result || data.text || '';
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        setScript(JSON.parse(match[0]));
        setStep(1);
        setCoachMessages([{
          role: 'assistant',
          text: `Blueprint locked in. I know your concept — "${concept}" for ${platform.label}.\n\nDescribe your rough cut below (what footage you have, what feels off) and I'll tell you exactly how to make it better. Or use one of the quick prompts.`,
        }]);
      } else {
        // Fallback: treat raw text as script text
        setScript({ hook: '', outline: [], broll: [], cta: '', caption: raw, thumbnail: '', retentionTip: '' });
        setStep(1);
      }
    } catch {
      alert('Failed to generate. Check your connection and try again.');
    } finally {
      setGenerating(false);
    }
  };

  // ── Phase 2: AI Edit Coach ──────────────────────────────────────
  const sendToCoach = async (message) => {
    const text = (message || coachInput).trim();
    if (!text || coachLoading) return;
    setCoachInput('');
    const userMsg = { role: 'user', text };
    setCoachMessages(prev => [...prev, userMsg]);
    setCoachLoading(true);

    const context = editDescSaved && editDescription
      ? `\n\nCURRENT EDIT STATE: ${editDescription}`
      : '';

    const scriptContext = script
      ? `\n\nVIDEO BLUEPRINT:\nHook: ${script.hook}\nOutline: ${script.outline?.join(' → ')}\nCTA: ${script.cta}`
      : '';

    try {
      const history = coachMessages.slice(-8).map(m => ({ role: m.role, text: m.text }));
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'chat',
          topic: `You are an expert video editor and content strategist coaching a creator on their video edit. Be specific, practical, and direct. Give actionable advice they can apply in DaVinci Resolve or CapCut right now.${scriptContext}${context}\n\nCreator's question: ${text}`,
          brandName,
          brandType,
          brandDesc,
          chatHistory: [...history, userMsg],
        }),
      });
      const data = await res.json();
      setCoachMessages(prev => [...prev, { role: 'assistant', text: data.result || data.text || "Let me think on that — try rephrasing." }]);
    } catch {
      setCoachMessages(prev => [...prev, { role: 'assistant', text: 'Something went wrong. Try again.' }]);
    } finally {
      setCoachLoading(false);
    }
  };

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const STEPS = ['Plan & Script', 'Edit Coach', 'Publish'];

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto">

      {/* Stepper */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((label, i) => (
          <React.Fragment key={i}>
            <button
              onClick={() => step > i && setStep(i)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                step === i ? 'bg-violet-500 text-white'
                : step > i ? 'text-violet-500 hover:text-violet-700 cursor-pointer'
                : 'text-stone-400 cursor-default'
              }`}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 shrink-0 ${
                step === i ? 'border-white bg-white/20'
                : step > i ? 'border-violet-500 bg-violet-100 dark:bg-violet-900/30 text-violet-600'
                : 'border-stone-300 dark:border-stone-600'
              }`}>{i + 1}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <ChevronRight size={14} className={`mx-1 shrink-0 ${step > i ? 'text-violet-400' : 'text-stone-300 dark:text-stone-600'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ── STEP 0: Plan ─────────────────────────────────────────── */}
      {step === 0 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-black text-stone-800 dark:text-stone-100">Plan your video</h2>
            <p className="text-stone-500 dark:text-stone-400 mt-1 text-sm">AI builds your hook, script, B-roll list, caption — the full blueprint before you hit record.</p>
          </div>

          {/* Platform */}
          <div>
            <label className="block text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2">Platform</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(p => (
                <button key={p.id} onClick={() => setPlatform(p)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    platform.id === p.id
                      ? 'bg-violet-500 border-violet-500 text-white'
                      : 'border-stone-200 dark:border-stone-600 text-stone-600 dark:text-stone-400 hover:border-violet-300'
                  }`}>
                  {p.label}
                  <span className="ml-1.5 text-[10px] opacity-70">{p.duration}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Concept */}
          <div>
            <label className="block text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2">What's the video about?</label>
            <textarea
              value={concept}
              onChange={e => setConcept(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && e.metaKey && generateBlueprint()}
              placeholder={`Describe the concept, story, or message — e.g. "Why I stopped trying to be consistent and what I do instead" or "3 budget mistakes that keep people broke"`}
              rows={4}
              className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl px-4 py-3 text-sm text-stone-800 dark:text-stone-100 placeholder-stone-400 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            <p className="text-xs text-stone-400 mt-1">More detail = better script. Describe the story, pain point, or transformation.</p>
          </div>

          <button onClick={generateBlueprint} disabled={!concept.trim() || generating}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-sm hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg">
            {generating
              ? <><Loader2 size={18} className="animate-spin" /> Building your blueprint...</>
              : <><Wand2 size={18} /> Build Video Blueprint</>
            }
          </button>

          {/* What you get */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: '🎣', label: 'Hook', desc: 'Stop-the-scroll opener' },
              { icon: '📋', label: 'Script outline', desc: 'Beat-by-beat structure' },
              { icon: '🎥', label: 'B-roll list', desc: 'Shot ideas to capture' },
              { icon: '✍️', label: 'Caption', desc: 'Ready to post' },
            ].map(({ icon, label, desc }) => (
              <div key={label} className="flex flex-col items-center gap-1.5 p-4 bg-stone-50 dark:bg-stone-800/60 rounded-2xl text-center border border-stone-100 dark:border-stone-700/50">
                <span className="text-2xl">{icon}</span>
                <p className="text-xs font-bold text-stone-700 dark:text-stone-300">{label}</p>
                <p className="text-[10px] text-stone-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── STEP 1: Edit Coach + Script ───────────────────────────── */}
      {step === 1 && script && (
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-stone-800 dark:text-stone-100">Blueprint + Edit Coach</h2>
              <p className="text-stone-500 dark:text-stone-400 mt-1 text-sm">Your script is below. Edit in DaVinci or CapCut — ask the AI coach anything while you work.</p>
            </div>
            <button onClick={() => setStep(0)} className="shrink-0 text-xs text-stone-400 hover:text-violet-500 transition-colors mt-1">← Redo plan</button>
          </div>

          {/* Blueprint cards */}
          <BlueprintSection script={script} concept={concept} copy={copy} copied={copied} />

          {/* External editors */}
          <div>
            <p className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2">Open your editor</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {EXTERNAL_EDITORS.map(({ name, desc, url, badge }) => (
                <a key={name} href={url} target="_blank" rel="noopener noreferrer"
                  className="flex flex-col gap-1 p-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl hover:border-violet-300 dark:hover:border-violet-600 transition-colors group">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-stone-800 dark:text-stone-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">{name}</span>
                    {badge && <span className="text-[9px] font-bold px-1 py-0.5 bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 rounded-full">{badge}</span>}
                  </div>
                  <p className="text-[10px] text-stone-400">{desc}</p>
                </a>
              ))}
            </div>
          </div>

          {/* Edit description (optional context for coach) */}
          {!editDescSaved ? (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-2xl p-4">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-2">Give the AI coach context on your edit <span className="font-normal opacity-70">(optional but makes coaching way sharper)</span></p>
              <textarea
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                placeholder="Describe where you are in the edit — e.g. 'I have a 45s rough cut. The opening feels slow. I'm not sure how to handle the transition at 0:22 where I switch topics.'"
                rows={3}
                className="w-full bg-white dark:bg-stone-800 border border-amber-200 dark:border-amber-700/50 rounded-xl px-3 py-2.5 text-xs text-stone-800 dark:text-stone-100 placeholder-stone-400 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button onClick={() => setEditDescSaved(true)}
                className="mt-2 px-4 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-400 transition-colors">
                Set edit context
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-stone-400 dark:text-stone-500">
              <CheckCircle size={13} className="text-emerald-500" />
              <span>Edit context loaded — coach knows where you are</span>
              <button onClick={() => setEditDescSaved(false)} className="ml-auto text-stone-400 hover:text-violet-500 transition-colors">Edit</button>
            </div>
          )}

          {/* AI Coach chat */}
          <div className="border border-stone-200 dark:border-stone-700 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600">
              <MessageSquare size={16} className="text-white" />
              <p className="text-sm font-bold text-white">AI Edit Coach</p>
              <span className="ml-auto text-xs text-violet-200">Ask anything about your edit</span>
            </div>

            {/* Messages */}
            <div className="max-h-72 overflow-y-auto p-4 space-y-3 bg-stone-50 dark:bg-stone-900/40">
              {coachMessages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles size={12} className="text-white" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-violet-500 text-white rounded-tr-sm'
                      : 'bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 border border-stone-200 dark:border-stone-700 rounded-tl-sm'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {coachLoading && (
                <div className="flex gap-2 justify-start">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shrink-0">
                    <Sparkles size={12} className="text-white" />
                  </div>
                  <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={coachBottomRef} />
            </div>

            {/* Quick prompts */}
            <div className="px-3 py-2 bg-white dark:bg-stone-900 border-t border-stone-100 dark:border-stone-800 overflow-x-auto">
              <div className="flex gap-1.5 whitespace-nowrap">
                {COACH_PROMPTS.map(p => (
                  <button key={p} onClick={() => sendToCoach(p)}
                    className="shrink-0 px-2.5 py-1 rounded-full border border-stone-200 dark:border-stone-700 text-[11px] text-stone-600 dark:text-stone-400 hover:border-violet-300 dark:hover:border-violet-600 hover:text-violet-600 dark:hover:text-violet-400 transition-colors">
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Input */}
            <div className="flex gap-2 p-3 bg-white dark:bg-stone-900 border-t border-stone-100 dark:border-stone-800">
              <input
                value={coachInput}
                onChange={e => setCoachInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendToCoach()}
                placeholder="Ask the coach anything about your edit..."
                className="flex-1 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 text-stone-800 dark:text-stone-100 placeholder-stone-400"
              />
              <button onClick={() => sendToCoach()} disabled={!coachInput.trim() || coachLoading}
                className="px-4 py-2 rounded-xl bg-violet-500 text-white text-sm font-bold hover:bg-violet-600 disabled:opacity-40 transition-colors">
                {coachLoading ? <Loader2 size={16} className="animate-spin" /> : 'Ask'}
              </button>
            </div>
          </div>

          <button onClick={() => setStep(2)}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-sm hover:from-violet-500 hover:to-indigo-500 transition-all shadow-lg">
            Done editing — publish &amp; track <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* ── STEP 2: Publish & Track ───────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-black text-stone-800 dark:text-stone-100">Publish &amp; track it</h2>
            <p className="text-stone-500 dark:text-stone-400 mt-1 text-sm">Push it live through Social &amp; Podcast. Log performance in Analytics. Data tells you what to make next.</p>
          </div>

          {/* Caption quick copy */}
          {script?.caption && (
            <div className="bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Caption &amp; hashtags</p>
                <button onClick={() => copy(script.caption, 'caption-finish')}
                  className={`flex items-center gap-1 text-xs font-semibold transition-colors ${copied === 'caption-finish' ? 'text-emerald-500' : 'text-stone-400 hover:text-violet-500'}`}>
                  {copied === 'caption-finish' ? <><CheckCircle size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
                </button>
              </div>
              <p className="text-sm text-stone-700 dark:text-stone-300 whitespace-pre-wrap leading-relaxed line-clamp-4">{script.caption}</p>
            </div>
          )}

          <div className="space-y-3">
            <button onClick={() => setActiveTab('social')}
              className="w-full flex items-center gap-4 p-5 bg-white dark:bg-stone-800 border border-violet-200 dark:border-violet-800/50 rounded-2xl hover:border-violet-400 dark:hover:border-violet-600 transition-colors text-left group">
              <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
                <Share2 className="text-violet-500" size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-stone-800 dark:text-stone-100">Social &amp; Podcast</p>
                <p className="text-sm text-stone-500 dark:text-stone-400">Post caption, pick platforms, publish to Instagram / YouTube / TikTok</p>
              </div>
              <ArrowRight size={18} className="text-stone-300 group-hover:text-violet-500 transition-colors shrink-0" />
            </button>

            <button onClick={() => setActiveTab('analytics')}
              className="w-full flex items-center gap-4 p-5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl hover:border-violet-300 dark:hover:border-violet-600 transition-colors text-left group">
              <div className="w-12 h-12 rounded-xl bg-stone-100 dark:bg-stone-700 flex items-center justify-center shrink-0">
                <BarChart2 className="text-stone-500 dark:text-stone-400" size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-stone-800 dark:text-stone-100">Analytics</p>
                <p className="text-sm text-stone-500 dark:text-stone-400">Log views, saves, comments — see what's working and why</p>
              </div>
              <ArrowRight size={18} className="text-stone-300 group-hover:text-violet-500 transition-colors shrink-0" />
            </button>
          </div>

          <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800/40 rounded-2xl p-5">
            <p className="text-sm font-bold text-violet-700 dark:text-violet-400 mb-1">Content → Marketing → Sales</p>
            <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
              The video grabs attention. The caption and platform strategy nurtures that attention into trust. The CTA converts trust into action. Every post you track teaches you what moves people — that's how you become a genius at this.
            </p>
          </div>

          <button onClick={() => { setConcept(''); setScript(null); setStep(0); setCoachMessages([]); setEditDescription(''); setEditDescSaved(false); }}
            className="w-full py-3 rounded-2xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 text-sm font-semibold hover:border-violet-300 dark:hover:border-violet-700 transition-colors">
            Plan another video
          </button>
        </div>
      )}
    </div>
  );
}

// ── Blueprint Section component ────────────────────────────────────
function BlueprintSection({ script, concept, copy, copied }) {
  const [expanded, setExpanded] = useState(true);

  const fullScript = [
    script.hook && `HOOK\n${script.hook}`,
    script.outline?.length && `SCRIPT OUTLINE\n${script.outline.map((b, i) => `${i + 1}. ${b}`).join('\n')}`,
    script.broll?.length && `B-ROLL SHOTS\n${script.broll.map(b => `• ${b}`).join('\n')}`,
    script.cta && `CALL TO ACTION\n${script.cta}`,
    script.caption && `CAPTION\n${script.caption}`,
  ].filter(Boolean).join('\n\n');

  return (
    <div className="border border-stone-200 dark:border-stone-700 rounded-2xl overflow-hidden">
      <button onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-stone-50 dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700/50 transition-colors">
        <div className="flex items-center gap-2">
          <Clapperboard size={16} className="text-violet-500" />
          <span className="text-sm font-bold text-stone-800 dark:text-stone-100">Video Blueprint</span>
          <span className="text-xs text-stone-400">"{concept.slice(0, 40)}{concept.length > 40 ? '…' : ''}"</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={e => { e.stopPropagation(); copy(fullScript, 'blueprint'); }}
            className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${copied === 'blueprint' ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'text-stone-400 hover:text-violet-500 bg-stone-100 dark:bg-stone-700'}`}>
            {copied === 'blueprint' ? <><CheckCircle size={11} /> Copied</> : <><Copy size={11} /> Copy all</>}
          </button>
          {expanded ? <ChevronUp size={14} className="text-stone-400" /> : <ChevronDown size={14} className="text-stone-400" />}
        </div>
      </button>

      {expanded && (
        <div className="divide-y divide-stone-100 dark:divide-stone-800">
          {/* Hook */}
          {script.hook && (
            <BlueprintCard icon="🎣" label="Hook" copyKey="hook" text={script.hook} copy={copy} copied={copied} highlight />
          )}

          {/* Outline */}
          {script.outline?.length > 0 && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider flex items-center gap-1.5"><span>📋</span> Script Outline</p>
                <button onClick={() => copy(script.outline.map((b, i) => `${i + 1}. ${b}`).join('\n'), 'outline')}
                  className={`text-xs flex items-center gap-1 transition-colors ${copied === 'outline' ? 'text-emerald-500' : 'text-stone-400 hover:text-violet-500'}`}>
                  {copied === 'outline' ? <><CheckCircle size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                </button>
              </div>
              <ol className="space-y-1.5">
                {script.outline.map((beat, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-stone-700 dark:text-stone-300">
                    <span className="w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    {beat}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* B-roll */}
          {script.broll?.length > 0 && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider flex items-center gap-1.5"><span>🎥</span> B-Roll Shots</p>
                <button onClick={() => copy(script.broll.map(b => `• ${b}`).join('\n'), 'broll')}
                  className={`text-xs flex items-center gap-1 transition-colors ${copied === 'broll' ? 'text-emerald-500' : 'text-stone-400 hover:text-violet-500'}`}>
                  {copied === 'broll' ? <><CheckCircle size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {script.broll.map((shot, i) => (
                  <span key={i} className="px-2.5 py-1 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-600 dark:text-stone-400">{shot}</span>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          {script.cta && (
            <BlueprintCard icon="🎯" label="Call to Action" copyKey="cta" text={script.cta} copy={copy} copied={copied} />
          )}

          {/* Retention tip */}
          {script.retentionTip && (
            <div className="p-4 bg-amber-50/50 dark:bg-amber-900/10">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Lightbulb size={12} /> Retention tip
              </p>
              <p className="text-sm text-stone-700 dark:text-stone-300">{script.retentionTip}</p>
            </div>
          )}

          {/* Caption */}
          {script.caption && (
            <BlueprintCard icon="✍️" label="Caption + Hashtags" copyKey="caption" text={script.caption} copy={copy} copied={copied} />
          )}
        </div>
      )}
    </div>
  );
}

function BlueprintCard({ icon, label, copyKey, text, copy, copied, highlight }) {
  return (
    <div className={`p-4 ${highlight ? 'bg-violet-50/50 dark:bg-violet-900/10' : ''}`}>
      <div className="flex items-center justify-between mb-1.5">
        <p className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${highlight ? 'text-violet-600 dark:text-violet-400' : 'text-stone-500 dark:text-stone-400'}`}>
          <span>{icon}</span> {label}
        </p>
        <button onClick={() => copy(text, copyKey)}
          className={`text-xs flex items-center gap-1 transition-colors ${copied === copyKey ? 'text-emerald-500' : 'text-stone-400 hover:text-violet-500'}`}>
          {copied === copyKey ? <><CheckCircle size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
        </button>
      </div>
      <p className={`text-sm leading-relaxed whitespace-pre-wrap ${highlight ? 'font-semibold text-stone-800 dark:text-stone-100' : 'text-stone-700 dark:text-stone-300'}`}>{text}</p>
    </div>
  );
}
