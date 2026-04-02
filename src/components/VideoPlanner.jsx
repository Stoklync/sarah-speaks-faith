import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles, Film, Share2, Copy, CheckCircle, Loader2,
  ExternalLink, ChevronRight, ArrowRight, Mic, MicOff,
  Lightbulb, Clapperboard, Layers, BarChart2, RefreshCw,
  ChevronDown, ChevronUp, Wand2, MessageSquare,
  Upload, Play, Image, Music, Type, Eye, Zap, Star
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

// ── Frame extraction helper ─────────────────────────────────────────
function extractVideoFrames(file, count = 6) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const url = URL.createObjectURL(file);
    video.preload = 'auto';
    video.muted = true;
    video.crossOrigin = 'anonymous';
    video.src = url;
    video.onloadedmetadata = async () => {
      const W = 480;
      const H = Math.round(W * (video.videoHeight / video.videoWidth)) || 270;
      canvas.width = W;
      canvas.height = H;
      const duration = video.duration;
      const frames = [];
      for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0 : (i / (count - 1)) * duration;
        await new Promise(r => {
          video.onseeked = () => {
            ctx.drawImage(video, 0, 0, W, H);
            const data = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
            frames.push({ time: Math.round(t), data });
            r();
          };
          video.currentTime = t;
        });
      }
      URL.revokeObjectURL(url);
      resolve(frames);
    };
    video.onerror = reject;
    video.load();
  });
}

async function imageFileToFrame(file) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const W = 480;
      const H = Math.round(W * img.naturalHeight / img.naturalWidth) || 270;
      canvas.width = W;
      canvas.height = H;
      ctx.drawImage(img, 0, 0, W, H);
      const data = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
      URL.revokeObjectURL(url);
      resolve({ time: 0, data });
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function VideoTab({ businesses = [], activeBusinessId, setActiveTab, initialMode }) {
  const [mainMode, setMainMode] = useState(initialMode || 'analyze'); // 'analyze' | 'plan'
  const [step, setStep] = useState(0); // 0=plan, 1=coach, 2=finish
  const [platform, setPlatform] = useState(PLATFORMS[0]);
  const [concept, setConcept] = useState('');
  const [script, setScript] = useState(null); // { hook, outline, broll, cta, caption }
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState('');

  // Analyze mode state
  const [analyzeFiles, setAnalyzeFiles] = useState([]);
  const [analyzePlatform, setAnalyzePlatform] = useState('Instagram Reels');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeStatus, setAnalyzeStatus] = useState('');
  const [analyzeResult, setAnalyzeResult] = useState(null);
  const [analyzeError, setAnalyzeError] = useState('');
  const fileInputRef = useRef(null);

  // Storage keys per business
  const bizKey = activeBusinessId || 'default';
  const STORE_ANALYSIS = `ssf_video_analysis_${bizKey}`;
  const STORE_BLUEPRINT = `ssf_video_blueprint_${bizKey}`;

  // Load saved data on mount / business switch
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE_ANALYSIS);
      if (saved) {
        const { result, platform: plat, fileName, savedAt } = JSON.parse(saved);
        setAnalyzeResult(result);
        if (plat) setAnalyzePlatform(plat);
        setSavedAnalysisMeta({ fileName, savedAt });
      } else {
        setAnalyzeResult(null);
        setSavedAnalysisMeta(null);
      }
    } catch {}
    try {
      const saved = localStorage.getItem(STORE_BLUEPRINT);
      if (saved) {
        const { script: s, concept: c, platform: p } = JSON.parse(saved);
        if (s) { setScript(s); setStep(1); }
        if (c) setConcept(c);
        if (p) { const found = PLATFORMS.find(pl => pl.id === p); if (found) setPlatform(found); }
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId]);

  const [savedAnalysisMeta, setSavedAnalysisMeta] = useState(null);

  // Edit coaching state
  const [coachMessages, setCoachMessages] = useState([]);
  const [coachInput, setCoachInput] = useState('');
  const [coachLoading, setCoachLoading] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editDescSaved, setEditDescSaved] = useState(false);
  const [capCutTips, setCapCutTips] = useState(null);
  const [capCutLoading, setCapCutLoading] = useState(false);
  const [showCapCutPanel, setShowCapCutPanel] = useState(false);
  const coachBottomRef = useRef(null);

  const activeBiz = businesses.find(b => b?.id === activeBusinessId);
  const brandName = activeBiz?.name || 'Your brand';
  const brandType = activeBiz?.type || 'faith';
  const brandDesc = activeBiz?.description || '';

  const handleAnalyzeFiles = (files) => {
    const arr = Array.from(files).filter(f =>
      f.type.startsWith('video/') || f.type.startsWith('image/')
    );
    if (arr.length) setAnalyzeFiles(arr);
  };

  const runAnalysis = async () => {
    if (!analyzeFiles.length) return;
    setAnalyzing(true);
    setAnalyzeError('');
    setAnalyzeResult(null);
    const isVideo = analyzeFiles[0].type.startsWith('video/');
    try {
      let frames = [];
      if (isVideo) {
        setAnalyzeStatus('Extracting frames from video...');
        frames = await extractVideoFrames(analyzeFiles[0], 6);
      } else {
        setAnalyzeStatus('Processing images...');
        for (const f of analyzeFiles.slice(0, 8)) {
          frames.push(await imageFileToFrame(f));
        }
      }
      setAnalyzeStatus('AI analyzing your content...');
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'video-analyze',
          frames,
          mediaType: isVideo ? 'video' : 'photo',
          platform: analyzePlatform,
          brandName,
          brandType,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Analysis failed');
      setAnalyzeResult(data);
      const meta = { fileName: analyzeFiles[0]?.name || 'file', savedAt: new Date().toISOString() };
      setSavedAnalysisMeta(meta);
      try {
        localStorage.setItem(STORE_ANALYSIS, JSON.stringify({
          result: data, platform: analyzePlatform, ...meta,
        }));
      } catch {}
    } catch (e) {
      setAnalyzeError(e.message);
    } finally {
      setAnalyzing(false);
      setAnalyzeStatus('');
    }
  };

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
        const parsed = JSON.parse(match[0]);
        setScript(parsed);
        setStep(1);
        try { localStorage.setItem(STORE_BLUEPRINT, JSON.stringify({ script: parsed, concept, platform: platform.id })); } catch {}
        setCoachMessages([{
          role: 'assistant',
          text: `Blueprint locked in. I know your concept — "${concept}" for ${platform.label}.\n\nDescribe your rough cut below (what footage you have, what feels off) and I'll tell you exactly how to make it better. Or use one of the quick prompts.`,
        }]);
      } else {
        // Fallback: treat raw text as script text
        const fallback = { hook: '', outline: [], broll: [], cta: '', caption: raw, thumbnail: '', retentionTip: '' };
        setScript(fallback);
        setStep(1);
        try { localStorage.setItem(STORE_BLUEPRINT, JSON.stringify({ script: fallback, concept, platform: platform.id })); } catch {}
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

  const getCapCutTips = async () => {
    if (!concept.trim() || capCutLoading) return;
    setCapCutLoading(true);
    setCapCutTips(null);
    setShowCapCutPanel(true);
    try {
      const outlineContext = script?.outline?.length
        ? `\n\nVIDEO OUTLINE (use these beats to estimate timestamps):\n${script.outline.map((b, i) => `Beat ${i + 1}: ${b}`).join('\n')}\nHook: ${script.hook || ''}`
        : '';
      const durationHint = platform.duration.includes('90') ? '~45-90 seconds' : platform.duration.includes('60') ? '~30-60 seconds' : platform.duration.includes('3min') ? '~60-180 seconds' : platform.duration;

      const prompt = `You are a professional CapCut video editor. Give highly specific, timestamp-based CapCut editing tips for this video.

Concept: "${concept}"
Platform: ${platform.label} (${durationHint})${outlineContext}

Return ONLY valid JSON — no markdown, no explanation:
{
  "transitions": [
    {"timestamp": "0:00–0:03", "transition": "exact CapCut transition name", "reason": "why here and what it achieves"},
    {"timestamp": "0:08–0:10", "transition": "exact CapCut transition name", "reason": "why here"},
    {"timestamp": "mid-video", "transition": "exact CapCut transition name", "reason": "why here"},
    {"timestamp": "final beat", "transition": "exact CapCut transition name", "reason": "closing impact"}
  ],
  "effects": [
    {"name": "exact CapCut effect name", "when": "specific timestamp or moment", "purpose": "what it does for this video"},
    {"name": "effect 2", "when": "timestamp", "purpose": "purpose"},
    {"name": "effect 3", "when": "timestamp", "purpose": "purpose"}
  ],
  "pacing": "Specific cut timing — e.g. 'Hold hook shot for 3s, then cut every 2-3s during explanation, slow to 4-5s cuts in the emotional moment at 0:40'",
  "textOverlays": [
    {"timestamp": "0:00", "text": "exact overlay text idea", "style": "CapCut text style + placement"},
    {"timestamp": "0:10", "text": "overlay text 2", "style": "style + placement"},
    {"timestamp": "end", "text": "CTA overlay", "style": "style + placement"}
  ],
  "music": {"mood": "specific mood", "genre": "genre in CapCut library", "beatSync": "exactly when to sync cuts to beats for this video"},
  "colorGrade": "Specific CapCut filter name + settings for the visual tone that fits this content",
  "photoTips": [
    {"timestamp": "timestamp or moment", "tip": "specific CapCut tip for photos/images — Ken Burns, zoom, pan, slideshow pacing, etc."},
    {"timestamp": "timestamp or moment", "tip": "photo tip 2"}
  ],
  "proTip": "One advanced CapCut trick (specific feature name) that will make this exact video stand out"
}`;

      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'chat',
          topic: prompt,
          brandName,
          brandType,
          chatHistory: [],
        }),
      });
      const data = await res.json();
      const raw = data.result || data.text || '';
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) setCapCutTips(JSON.parse(match[0]));
    } catch {}
    setCapCutLoading(false);
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

      {/* Top mode switcher — hidden when parent controls the mode */}
      <div className={`flex gap-2 mb-6 bg-stone-100 dark:bg-stone-800 p-1 rounded-2xl ${initialMode ? 'hidden' : ''}`}>
        <button onClick={() => setMainMode('analyze')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${mainMode === 'analyze' ? 'bg-white dark:bg-stone-700 text-violet-600 dark:text-violet-400 shadow-sm' : 'text-stone-500 dark:text-stone-400 hover:text-stone-700'}`}>
          <Eye size={16} /> Analyze
        </button>
        <button onClick={() => setMainMode('plan')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${mainMode === 'plan' ? 'bg-white dark:bg-stone-700 text-violet-600 dark:text-violet-400 shadow-sm' : 'text-stone-500 dark:text-stone-400 hover:text-stone-700'}`}>
          <Clapperboard size={16} /> Plan & Script
        </button>
      </div>

      {/* ── ANALYZE MODE ─────────────────────────────────────────────── */}
      {mainMode === 'analyze' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-black text-stone-800 dark:text-stone-100">AI Video & Photo Analyzer</h2>
            <p className="text-stone-500 dark:text-stone-400 mt-1 text-sm">Upload your video or photos. AI gives you a pro-level breakdown — timestamps, transitions, music, text overlays, tone, hooks. Everything to make it better.</p>
          </div>

          {/* Upload area */}
          <div
            onClick={() => !analyzing && fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleAnalyzeFiles(e.dataTransfer.files); }}
            className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-colors cursor-pointer ${
              analyzeFiles.length
                ? 'border-violet-400 bg-violet-50 dark:bg-violet-900/20'
                : 'border-stone-300 dark:border-stone-600 hover:border-violet-400 dark:hover:border-violet-600 bg-stone-50 dark:bg-stone-800/40'
            } ${analyzing ? 'cursor-not-allowed opacity-60' : ''}`}>
            <input ref={fileInputRef} type="file" multiple accept="video/*,image/*" className="hidden"
              onChange={e => handleAnalyzeFiles(e.target.files)} />
            {analyzeFiles.length === 0 ? (
              <div className="space-y-3">
                <div className="flex justify-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                    <Play className="text-violet-500" size={22} />
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center">
                    <Image className="text-rose-500" size={22} />
                  </div>
                </div>
                <p className="font-bold text-stone-700 dark:text-stone-300">Drop your video or photos here</p>
                <p className="text-sm text-stone-400">Video (MP4, MOV) or Photos (JPG, PNG) — up to 8 photos at once</p>
                <p className="text-xs text-stone-400">Click to browse files</p>
              </div>
            ) : (
              <div className="space-y-2">
                <CheckCircle size={28} className="text-violet-500 mx-auto" />
                <p className="font-bold text-violet-700 dark:text-violet-400">
                  {analyzeFiles.length === 1
                    ? analyzeFiles[0].name
                    : `${analyzeFiles.length} photos selected`}
                </p>
                <p className="text-sm text-stone-400">
                  {analyzeFiles[0].type.startsWith('video/') ? 'Video — 6 frames will be extracted' : `${analyzeFiles.length} photo(s) will be analyzed`}
                </p>
                {!analyzing && (
                  <button onClick={e => { e.stopPropagation(); setAnalyzeFiles([]); setAnalyzeResult(null); }}
                    className="text-xs text-stone-400 hover:text-rose-500 transition-colors">Remove</button>
                )}
              </div>
            )}
          </div>

          {/* Platform */}
          <div>
            <label className="block text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2">Which platform is this for?</label>
            <div className="flex flex-wrap gap-2">
              {['Instagram Reels', 'YouTube Shorts', 'TikTok', 'YouTube', 'Facebook', 'LinkedIn', 'Podcast Promo'].map(p => (
                <button key={p} onClick={() => setAnalyzePlatform(p)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    analyzePlatform === p
                      ? 'bg-violet-500 border-violet-500 text-white'
                      : 'border-stone-200 dark:border-stone-600 text-stone-600 dark:text-stone-400 hover:border-violet-300'
                  }`}>{p}</button>
              ))}
            </div>
          </div>

          {/* Analyze button */}
          {analyzeFiles.length > 0 && !analyzeResult && (
            <button onClick={runAnalysis} disabled={analyzing}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold hover:from-violet-500 hover:to-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-lg">
              {analyzing
                ? <><Loader2 size={20} className="animate-spin" /> {analyzeStatus || 'Analyzing...'}</>
                : <><Sparkles size={20} /> Analyze My {analyzeFiles[0]?.type.startsWith('video/') ? 'Video' : 'Photos'} — Pro Level</>
              }
            </button>
          )}

          {analyzeError && (
            <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-700 rounded-2xl p-4 text-sm text-rose-600 dark:text-rose-400">{analyzeError}</div>
          )}

          {/* ── Results ─────────────────────────────────────────────── */}
          {analyzeResult && (
            <div className="space-y-3">
              {savedAnalysisMeta && (
                <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/50 rounded-xl px-4 py-2.5">
                  <div className="text-xs text-emerald-700 dark:text-emerald-400">
                    <span className="font-bold">Saved analysis</span>{savedAnalysisMeta.fileName ? ` — ${savedAnalysisMeta.fileName}` : ''}{savedAnalysisMeta.savedAt ? ` · ${new Date(savedAnalysisMeta.savedAt).toLocaleDateString()}` : ''}
                  </div>
                  <button onClick={() => {
                    setAnalyzeResult(null); setAnalyzeFiles([]); setSavedAnalysisMeta(null);
                    try { localStorage.removeItem(STORE_ANALYSIS); } catch {}
                  }} className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:text-rose-500 font-semibold ml-3 transition-colors">Clear</button>
                </div>
              )}
              <AnalysisResults result={analyzeResult} onReset={() => {
                setAnalyzeResult(null); setAnalyzeFiles([]); setSavedAnalysisMeta(null);
                try { localStorage.removeItem(STORE_ANALYSIS); } catch {}
              }} />
            </div>
          )}

          {/* What you get */}
          {!analyzeResult && !analyzeFiles.length && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { icon: <Zap size={18} className="text-amber-500" />, label: 'Timestamp fixes', desc: 'Exactly where to cut or keep' },
                { icon: <Film size={18} className="text-violet-500" />, label: 'Transitions', desc: 'What to use and where' },
                { icon: <Music size={18} className="text-emerald-500" />, label: 'Music & mood', desc: 'Genre, BPM, exact sound style' },
                { icon: <Type size={18} className="text-rose-500" />, label: 'Text overlays', desc: 'Hooks, CTAs, what to write' },
                { icon: <Eye size={18} className="text-blue-500" />, label: 'Tone & color grade', desc: 'Exact grade to apply' },
                { icon: <Star size={18} className="text-orange-500" />, label: 'Retention hooks', desc: 'Keep them watching longer' },
              ].map(({ icon, label, desc }) => (
                <div key={label} className="flex flex-col gap-1.5 p-4 bg-stone-50 dark:bg-stone-800/60 rounded-2xl border border-stone-100 dark:border-stone-700/50">
                  <div className="flex items-center gap-2">{icon}<p className="text-xs font-bold text-stone-700 dark:text-stone-300">{label}</p></div>
                  <p className="text-[10px] text-stone-400">{desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── PLAN MODE ───────────────────────────────────────────────── */}
      {mainMode === 'plan' && (
      <div>
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
            <div className="flex flex-col items-end gap-1">
              <button onClick={() => setStep(0)} className="shrink-0 text-xs text-stone-400 hover:text-violet-500 transition-colors">← Redo plan</button>
              <button onClick={() => {
                setScript(null); setStep(0); setConcept('');
                try { localStorage.removeItem(STORE_BLUEPRINT); } catch {}
              }} className="shrink-0 text-[11px] text-stone-300 dark:text-stone-600 hover:text-rose-500 dark:hover:text-rose-400 transition-colors">Clear saved</button>
            </div>
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

          {/* CapCut Tips */}
          <div className="border border-stone-200 dark:border-stone-700 rounded-2xl overflow-hidden">
            <button
              onClick={() => { setShowCapCutPanel(v => !v); if (!capCutTips && !capCutLoading) getCapCutTips(); }}
              className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 transition-all">
              <div className="flex items-center gap-2">
                <span className="text-lg">✂️</span>
                <div className="text-left">
                  <p className="text-sm font-bold text-white">CapCut Editor Tips</p>
                  <p className="text-xs text-pink-100">AI-powered transitions, effects & pacing for your video</p>
                </div>
              </div>
              {capCutLoading
                ? <Loader2 size={16} className="text-white animate-spin" />
                : <ChevronDown size={16} className={`text-white transition-transform ${showCapCutPanel ? 'rotate-180' : ''}`} />
              }
            </button>

            {showCapCutPanel && (
              <div className="p-4 space-y-4 bg-pink-50/40 dark:bg-rose-900/10">
                {capCutLoading && (
                  <div className="flex items-center gap-2 py-4 justify-center text-stone-400 text-sm">
                    <Loader2 size={16} className="animate-spin text-pink-500" /> Generating CapCut tips for your video…
                  </div>
                )}
                {capCutTips && (
                  <>
                    {capCutTips.transitions?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-pink-600 dark:text-pink-400 uppercase tracking-wider mb-2">🔀 Transitions (with timestamps)</p>
                        {capCutTips.transitions.map((t, i) => (
                          <div key={i} className="mb-2 bg-white dark:bg-stone-800 border border-pink-100 dark:border-pink-900/40 rounded-xl px-3 py-2">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[10px] font-bold text-pink-500 bg-pink-50 dark:bg-pink-900/30 px-1.5 py-0.5 rounded-md">{t.timestamp || `Cut ${i+1}`}</span>
                              <span className="text-xs font-semibold text-stone-700 dark:text-stone-200">{t.transition || t}</span>
                            </div>
                            {t.reason && <p className="text-[11px] text-stone-400 leading-relaxed">{t.reason}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                    {capCutTips.effects?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-2">✨ Effects</p>
                        {capCutTips.effects.map((e, i) => (
                          <div key={i} className="mb-2 bg-white dark:bg-stone-800 border border-rose-100 dark:border-rose-900/40 rounded-xl px-3 py-2">
                            <div className="flex items-center gap-2 mb-0.5">
                              {(e.when || e.timestamp) && <span className="text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/30 px-1.5 py-0.5 rounded-md">{e.when || e.timestamp}</span>}
                              <span className="text-xs font-semibold text-stone-700 dark:text-stone-200">{e.name || e}</span>
                            </div>
                            {e.purpose && <p className="text-[11px] text-stone-400 leading-relaxed">{e.purpose}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                    {capCutTips.pacing && (
                      <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2.5">
                        <p className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-1">⏱ Pacing & Cut Timing</p>
                        <p className="text-xs text-stone-700 dark:text-stone-200 leading-relaxed">{capCutTips.pacing}</p>
                      </div>
                    )}
                    {capCutTips.textOverlays?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-2">💬 Text Overlays</p>
                        {capCutTips.textOverlays.map((t, i) => (
                          <div key={i} className="mb-2 bg-white dark:bg-stone-800 border border-violet-100 dark:border-violet-900/40 rounded-xl px-3 py-2">
                            <div className="flex items-center gap-2 mb-0.5">
                              {(t.timestamp || t.when) && <span className="text-[10px] font-bold text-violet-500 bg-violet-50 dark:bg-violet-900/30 px-1.5 py-0.5 rounded-md">{t.timestamp || t.when}</span>}
                              <span className="text-xs font-semibold text-stone-700 dark:text-stone-200">"{t.text || t}"</span>
                            </div>
                            {t.style && <p className="text-[11px] text-stone-400 leading-relaxed">{t.style}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                    {(capCutTips.music || capCutTips.musicMood) && (
                      <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2.5">
                        <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">🎵 Music & Beat Sync</p>
                        {capCutTips.music ? (
                          <>
                            <p className="text-xs text-stone-700 dark:text-stone-200 font-semibold">{capCutTips.music.mood} · {capCutTips.music.genre}</p>
                            {capCutTips.music.beatSync && <p className="text-[11px] text-stone-400 mt-0.5 leading-relaxed">{capCutTips.music.beatSync}</p>}
                          </>
                        ) : (
                          <p className="text-xs text-stone-700 dark:text-stone-200 leading-relaxed">{capCutTips.musicMood}</p>
                        )}
                      </div>
                    )}
                    {capCutTips.colorGrade && (
                      <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2.5">
                        <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">🎨 Visual Tone & Color Grade</p>
                        <p className="text-xs text-stone-700 dark:text-stone-200 leading-relaxed">{capCutTips.colorGrade}</p>
                      </div>
                    )}
                    {capCutTips.proTip && (
                      <div className="bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 border border-pink-200 dark:border-pink-800 rounded-xl px-3 py-2.5">
                        <p className="text-[10px] font-bold text-pink-600 dark:text-pink-400 uppercase tracking-wider mb-1">🚀 Pro Tip</p>
                        <p className="text-xs text-stone-700 dark:text-stone-200 leading-relaxed">{capCutTips.proTip}</p>
                      </div>
                    )}
                    <button onClick={getCapCutTips} className="text-xs text-pink-500 hover:text-pink-600 font-semibold flex items-center gap-1">
                      <RefreshCw size={11} /> Regenerate tips
                    </button>
                  </>
                )}
              </div>
            )}
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
      )}
    </div>
  );
}

// ── Analysis Results component ──────────────────────────────────────
function AnalysisResults({ result, onReset }) {
  const [copiedKey, setCopiedKey] = useState('');
  const copyText = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  const scoreColor = {
    A: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200',
    B: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 border-blue-200',
    C: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 border-amber-200',
    D: 'text-rose-600 bg-rose-50 dark:bg-rose-900/30 border-rose-200',
  }[result.overallScore] || 'text-stone-600 bg-stone-50 border-stone-200';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-4 p-5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl">
        <div className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center shrink-0 ${scoreColor}`}>
          <span className="text-3xl font-black">{result.overallScore}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">AI Analysis</p>
          <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">{result.summary}</p>
        </div>
      </div>

      {/* Top fix — most important */}
      {result.topFix && (
        <div className="flex items-start gap-3 p-4 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700/50 rounded-2xl">
          <Zap size={18} className="text-violet-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-violet-600 dark:text-violet-400 mb-1">Top Fix Right Now</p>
            <p className="text-sm text-stone-700 dark:text-stone-300">{result.topFix}</p>
          </div>
        </div>
      )}

      {/* Pacing */}
      {result.pacing && (
        <AnalysisCard icon={<Film size={16} className="text-violet-500" />} label="Pacing & Edit" badge={result.pacing.rating}>
          <p className="text-sm text-stone-600 dark:text-stone-400">{result.pacing.feedback}</p>
          {result.pacing.fix && <p className="text-sm font-semibold text-stone-800 dark:text-stone-200 mt-1">Fix: {result.pacing.fix}</p>}
        </AnalysisCard>
      )}

      {/* Timestamps */}
      {result.timestamps?.length > 0 && (
        <AnalysisCard icon={<Layers size={16} className="text-amber-500" />} label="Timestamp Issues">
          <div className="space-y-2">
            {result.timestamps.map((t, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="text-xs font-mono font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-lg shrink-0 mt-0.5">{t.time}</span>
                <div>
                  <p className="text-sm text-stone-600 dark:text-stone-400">{t.issue}</p>
                  {t.fix && <p className="text-xs font-semibold text-stone-700 dark:text-stone-300 mt-0.5">→ {t.fix}</p>}
                </div>
              </div>
            ))}
          </div>
        </AnalysisCard>
      )}

      {/* Photo feedback */}
      {result.photoFeedback?.length > 0 && (
        <AnalysisCard icon={<Image size={16} className="text-rose-500" />} label="Photo Feedback">
          <div className="space-y-2">
            {result.photoFeedback.map((p, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-900/30 px-2 py-0.5 rounded-lg shrink-0 mt-0.5">#{p.frame}</span>
                <div>
                  <p className="text-sm text-stone-600 dark:text-stone-400">{p.issue}</p>
                  {p.fix && <p className="text-xs font-semibold text-stone-700 dark:text-stone-300 mt-0.5">→ {p.fix}</p>}
                </div>
              </div>
            ))}
          </div>
        </AnalysisCard>
      )}

      {/* Transitions */}
      {result.transitions && (
        <AnalysisCard icon={<RefreshCw size={16} className="text-blue-500" />} label="Transitions">
          {result.transitions.current && <p className="text-sm text-stone-500 dark:text-stone-400 mb-1">Current: {result.transitions.current}</p>}
          <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">{result.transitions.suggestion}</p>
          {result.transitions.where && <p className="text-xs text-stone-400 mt-1">Where: {result.transitions.where}</p>}
        </AnalysisCard>
      )}

      {/* Music */}
      {result.music && (
        <AnalysisCard icon={<Music size={16} className="text-emerald-500" />} label="Music & Mood">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">{result.music.genre} · {result.music.tempo}</p>
            {result.music.mood && <p className="text-sm text-stone-500 dark:text-stone-400">{result.music.mood}</p>}
            {result.music.trackStyle && <p className="text-sm text-stone-600 dark:text-stone-400 italic">"{result.music.trackStyle}"</p>}
          </div>
        </AnalysisCard>
      )}

      {/* Hooks / Text overlays */}
      {(result.hooks?.length > 0 || result.textOverlays?.length > 0) && (
        <AnalysisCard icon={<Type size={16} className="text-rose-500" />} label="Text Overlays & Hooks"
          headerRight={
            result.hooks?.length > 0 && (
              <button onClick={() => copyText(result.hooks.join('\n'), 'hooks')}
                className={`text-xs flex items-center gap-1 transition-colors ${copiedKey === 'hooks' ? 'text-emerald-500' : 'text-stone-400 hover:text-violet-500'}`}>
                {copiedKey === 'hooks' ? <><CheckCircle size={11} /> Copied</> : <><Copy size={11} /> Copy hooks</>}
              </button>
            )
          }>
          {result.hooks?.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {result.hooks.map((h, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-xs text-violet-500 font-bold shrink-0 mt-0.5">{['Open', 'Mid', 'CTA'][i] || `${i + 1}`}</span>
                  <p className="text-sm text-stone-700 dark:text-stone-300">{h}</p>
                </div>
              ))}
            </div>
          )}
          {result.textOverlays?.length > 0 && (
            <div className="space-y-1.5 border-t border-stone-100 dark:border-stone-700 pt-3">
              <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Suggested overlays</p>
              {result.textOverlays.map((t, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-xs font-mono text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded shrink-0">{t.when}</span>
                  <div>
                    <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">"{t.text}"</p>
                    {t.placement && <p className="text-xs text-stone-400">{t.placement} · {t.style}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </AnalysisCard>
      )}

      {/* Tone & Color Grade */}
      {result.toneAndMood && (
        <AnalysisCard icon={<Eye size={16} className="text-indigo-500" />} label="Tone & Color Grade">
          {result.toneAndMood.current && <p className="text-sm text-stone-500 dark:text-stone-400 mb-1">Current: {result.toneAndMood.current}</p>}
          {result.toneAndMood.target && <p className="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1">Target: {result.toneAndMood.target}</p>}
          {result.toneAndMood.colorGrade && (
            <p className="text-sm text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 rounded-xl mt-1">{result.toneAndMood.colorGrade}</p>
          )}
          {result.toneAndMood.lightingNote && <p className="text-xs text-stone-400 mt-2">Next shoot: {result.toneAndMood.lightingNote}</p>}
        </AnalysisCard>
      )}

      {/* Audience Retention */}
      {result.audienceRetention && (
        <AnalysisCard icon={<Star size={16} className="text-orange-500" />} label="Audience Retention">
          {result.audienceRetention.dropOffRisk && (
            <p className="text-sm text-rose-600 dark:text-rose-400 mb-1">Drop-off risk: {result.audienceRetention.dropOffRisk}</p>
          )}
          {result.audienceRetention.retentionFix && (
            <p className="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1">{result.audienceRetention.retentionFix}</p>
          )}
          {result.audienceRetention.loopTip && (
            <p className="text-xs text-stone-500 dark:text-stone-400">Loop tip: {result.audienceRetention.loopTip}</p>
          )}
        </AnalysisCard>
      )}

      <button onClick={onReset}
        className="w-full py-3 rounded-2xl border border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 text-sm font-semibold hover:border-violet-300 transition-colors">
        Analyze another video or photo
      </button>
    </div>
  );
}

function AnalysisCard({ icon, label, badge, headerRight, children }) {
  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-stone-50 dark:bg-stone-800/80 border-b border-stone-100 dark:border-stone-700">
        {icon}
        <p className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">{label}</p>
        {badge && <span className="ml-1 text-xs font-bold px-2 py-0.5 bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 rounded-full">{badge}</span>}
        {headerRight && <div className="ml-auto">{headerRight}</div>}
      </div>
      <div className="px-4 py-3">{children}</div>
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
