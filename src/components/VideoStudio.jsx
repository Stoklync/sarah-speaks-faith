import React, { useState } from 'react';
import { Sparkles, Download, Loader2, RefreshCw, Video, Play } from 'lucide-react';
import { useStudio } from '../App';

const MODELS = [
  { id: 'kling',   label: '⚡ Kling 1.6',      desc: 'Sharpest & most realistic' },
  { id: 'luma',    label: '🎬 Luma Ray 2',      desc: 'Cinematic & smooth' },
  { id: 'minimax', label: '✨ MiniMax',          desc: 'Natural motion & detail' },
];

const RATIOS = [
  { id: '16:9', label: '🖥️ 16:9', desc: 'YouTube / Landscape' },
  { id: '9:16', label: '📱 9:16', desc: 'Reels / TikTok' },
  { id: '1:1',  label: '⬜ 1:1',  desc: 'Square feed' },
];

const DURATIONS = [
  { id: 5,  label: '5s', desc: 'Reel / Short' },
  { id: 10, label: '10s', desc: 'Longer clip' },
];

const PROMPTS = [
  'A woman walking through golden sunlight, slow motion, cinematic',
  'Product floating on water with ripples, luxury brand feel',
  'A podcast host speaking passionately, warm studio lighting',
  'Drone shot flying over lush green Jamaica mountains at sunrise',
  'Coffee being poured in slow motion, cafe ambiance, morning mood',
  'A group of friends laughing at a dinner table, natural light',
];

export function VideoStudio() {
  const { businesses, activeBusinessId } = useStudio();
  const activeBiz = (businesses || []).find(b => b?.id === activeBusinessId);
  const bizName = activeBiz?.name || 'Your Brand';
  const bizType = activeBiz?.type || 'faith';

  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('kling');
  const [ratio, setRatio] = useState('9:16');
  const [duration, setDuration] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const [gallery, setGallery] = useState(() => {
    try { return JSON.parse(localStorage.getItem('kreativelync-video-gallery') || '[]'); } catch { return []; }
  });

  const saveGallery = (items) => {
    setGallery(items);
    try { localStorage.setItem('kreativelync-video-gallery', JSON.stringify(items.slice(0, 10))); } catch {}
  };

  const enhancePrompt = async () => {
    if (!prompt.trim() && !bizName) return;
    setAiLoading(true);
    try {
      const r = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'chat',
          brandName: bizName,
          brandType: bizType,
          chatHistory: [{
            role: 'user',
            text: `Write a detailed AI video generation prompt for ${bizName} (${bizType} brand). ${prompt ? `Based on: "${prompt}". ` : ''}Aspect ratio: ${ratio}. Make it cinematic, vivid, with camera movement descriptions. Reply with ONLY the prompt, nothing else. Max 40 words.`
          }]
        })
      });
      const data = await r.json();
      const reply = (data.reply || '').replace(/^["']|["']$/g, '').trim();
      if (reply) setPrompt(reply);
    } catch {}
    setAiLoading(false);
  };

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaType: 'video', prompt, model, ratio, duration }),
      });
      const data = await r.json();
      if (!r.ok || data.error) throw new Error(data.error || 'Generation failed');
      const newItem = { url: data.url, prompt, model, ratio, duration, brandId: activeBusinessId, createdAt: Date.now() };
      saveGallery([newItem, ...gallery]);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const download = async (url, index) => {
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = `kreativelync-video-${index + 1}.mp4`;
      a.target = '_blank';
      a.click();
    } catch {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-stone-800 dark:to-stone-800 border-2 border-violet-200 dark:border-violet-800 rounded-3xl p-6">
        <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-1">🎬 AI Video Studio</h2>
        <p className="text-stone-500 dark:text-stone-400 text-sm">Generate cinematic videos, Reels, and short clips in seconds. Powered by Kling, Luma & MiniMax.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT — controls */}
        <div className="lg:col-span-2 space-y-5">

          {/* Prompt */}
          <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Describe your video</p>
              <button onClick={enhancePrompt} disabled={aiLoading}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-xs font-bold hover:bg-violet-200 disabled:opacity-50">
                {aiLoading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                {aiLoading ? 'Writing...' : 'AI Enhance'}
              </button>
            </div>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={4}
              placeholder="Describe the video you want to generate..."
              className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-3 py-2.5 text-sm text-stone-800 dark:text-stone-100 resize-none"
            />
            <div>
              <p className="text-[10px] text-stone-400 font-bold uppercase mb-2">Quick ideas</p>
              <div className="flex flex-wrap gap-1.5">
                {PROMPTS.slice(0, 4).map((p, i) => (
                  <button key={i} onClick={() => setPrompt(p)}
                    className="text-[11px] px-2 py-1 rounded-lg bg-stone-50 dark:bg-stone-700 text-stone-500 dark:text-stone-400 hover:bg-violet-50 hover:text-violet-600 border border-stone-200 dark:border-stone-600 text-left">
                    {p.slice(0, 30)}...
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Model */}
          <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-5">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">AI Model</p>
            <div className="space-y-2">
              {MODELS.map(m => (
                <button key={m.id} onClick={() => setModel(m.id)}
                  className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all flex items-center justify-between ${model === m.id ? 'bg-violet-500 text-white shadow' : 'bg-stone-50 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-violet-50 dark:hover:bg-stone-600'}`}>
                  <span>{m.label}</span>
                  <span className={`text-[10px] ${model === m.id ? 'text-violet-100' : 'text-stone-400'}`}>{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Ratio + Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-4">
              <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Format</p>
              <div className="space-y-2">
                {RATIOS.map(r => (
                  <button key={r.id} onClick={() => setRatio(r.id)}
                    className={`w-full px-2.5 py-2 rounded-xl text-xs font-semibold text-left transition-all ${ratio === r.id ? 'bg-violet-500 text-white shadow' : 'bg-stone-50 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-violet-50 dark:hover:bg-stone-600'}`}>
                    <span className="block">{r.label}</span>
                    <span className={`text-[10px] ${ratio === r.id ? 'text-violet-100' : 'text-stone-400'}`}>{r.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-4">
              <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Length</p>
              <div className="space-y-2">
                {DURATIONS.map(d => (
                  <button key={d.id} onClick={() => setDuration(d.id)}
                    className={`w-full px-2.5 py-2 rounded-xl text-xs font-semibold text-left transition-all ${duration === d.id ? 'bg-violet-500 text-white shadow' : 'bg-stone-50 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-violet-50 dark:hover:bg-stone-600'}`}>
                    <span className="block text-sm">{d.label}</span>
                    <span className={`text-[10px] ${duration === d.id ? 'text-violet-100' : 'text-stone-400'}`}>{d.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-3">{error}</p>}

          <button onClick={generate} disabled={loading || !prompt.trim()}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-bold text-lg flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 transition-opacity shadow-lg shadow-violet-200 dark:shadow-none">
            {loading ? <><Loader2 size={20} className="animate-spin" /> Generating… (up to 2 min)</> : <><Video size={20} /> Generate Video</>}
          </button>
        </div>

        {/* RIGHT — gallery */}
        <div className="lg:col-span-3 space-y-4">
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Generated Videos</p>
          {gallery.length === 0 && !loading && (
            <div className="border-2 border-dashed border-violet-200 dark:border-stone-700 rounded-2xl p-12 text-center">
              <Video size={40} className="mx-auto mb-3 text-violet-300" />
              <p className="text-stone-400 text-sm">Your generated videos will appear here</p>
              <p className="text-stone-300 dark:text-stone-600 text-xs mt-1">Takes 30 seconds – 2 minutes per video</p>
            </div>
          )}
          {loading && (
            <div className="border-2 border-violet-200 dark:border-stone-700 rounded-2xl p-12 text-center">
              <Loader2 size={40} className="mx-auto mb-3 text-violet-400 animate-spin" />
              <p className="text-violet-500 font-medium text-sm">Creating your video…</p>
              <p className="text-stone-400 text-xs mt-1">This takes 30 seconds – 2 minutes. Hang tight!</p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {gallery.map((item, i) => (
              <div key={i} className="group relative rounded-2xl overflow-hidden border border-stone-100 dark:border-stone-700 bg-stone-900">
                <video src={item.url} className="w-full aspect-video object-cover" controls playsInline />
                <div className="p-3 bg-white dark:bg-stone-800">
                  <p className="text-xs text-stone-500 dark:text-stone-400 truncate">{item.prompt}</p>
                  <div className="flex gap-2 mt-1.5 items-center justify-between">
                    <div className="flex gap-1.5">
                      <span className="text-[10px] px-2 py-0.5 bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 rounded-lg">{MODELS.find(m => m.id === item.model)?.label || item.model}</span>
                      <span className="text-[10px] px-2 py-0.5 bg-stone-100 dark:bg-stone-700 text-stone-500 rounded-lg">{item.ratio}</span>
                      <span className="text-[10px] px-2 py-0.5 bg-stone-100 dark:bg-stone-700 text-stone-500 rounded-lg">{item.duration}s</span>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => download(item.url, i)}
                        className="p-1.5 rounded-lg bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-violet-500 hover:text-white transition-colors">
                        <Download size={13} />
                      </button>
                      <button onClick={() => setPrompt(item.prompt)}
                        className="p-1.5 rounded-lg bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-violet-500 hover:text-white transition-colors">
                        <RefreshCw size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
