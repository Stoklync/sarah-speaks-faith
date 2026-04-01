import React, { useState } from 'react';
import { Sparkles, Download, Loader2, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { useStudio } from '../App';

const STYLES = [
  { id: 'photorealistic', label: '📷 Photorealistic', desc: 'Real photos' },
  { id: 'cinematic',      label: '🎬 Cinematic',      desc: 'Movie quality' },
  { id: '3d',             label: '✨ 3D Render',       desc: 'Modern 3D' },
  { id: 'artistic',       label: '🎨 Artistic',        desc: 'Digital art' },
  { id: 'minimal',        label: '⬜ Minimal',          desc: 'Clean & simple' },
  { id: 'none',           label: '🔮 No Style',        desc: 'Pure prompt' },
];

const RATIOS = [
  { id: '1:1',  label: '⬜ Square',    desc: 'Feed post' },
  { id: '9:16', label: '📱 Portrait',  desc: 'Reel / Story' },
  { id: '16:9', label: '🖥️ Landscape', desc: 'YouTube' },
  { id: '4:5',  label: '📄 4:5',       desc: 'Portrait feed' },
];

const PROMPTS = [
  'A woman praying peacefully in golden hour light, faith and hope',
  'A stunning event venue decorated with flowers and warm lights',
  'A modern office desk with coffee and laptop, productive morning',
  'A vibrant Jamaica market scene with tropical colors',
  'A group of women laughing together at a brunch, joyful community',
  'A cinematic shot of mountains at sunrise, spiritual and majestic',
  'A product flat lay on marble with flowers and natural light',
  'A podcast studio setup with microphone and warm lighting',
];

export function ImageStudio() {
  const { businesses, activeBusinessId } = useStudio();
  const activeBiz = (businesses || []).find(b => b?.id === activeBusinessId);
  const bizName = activeBiz?.name || 'Your Brand';
  const bizType = activeBiz?.type || 'faith';

  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('photorealistic');
  const [ratio, setRatio] = useState('1:1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const [gallery, setGallery] = useState(() => {
    try { return JSON.parse(localStorage.getItem('kreativelync-image-gallery') || '[]'); } catch { return []; }
  });

  const saveGallery = (items) => {
    setGallery(items);
    try { localStorage.setItem('kreativelync-image-gallery', JSON.stringify(items.slice(0, 20))); } catch {}
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
            text: `Write a detailed AI image generation prompt for ${bizName} (${bizType} brand). ${prompt ? `Based on this idea: "${prompt}". ` : ''}Style: ${style}. Make it vivid, specific, and optimized for image generation. Reply with ONLY the prompt text, nothing else. Max 50 words.`
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
        body: JSON.stringify({ prompt, style, ratio }),
      });
      const data = await r.json();
      if (!r.ok || data.error) throw new Error(data.error || 'Generation failed');
      const newItem = { url: data.url, prompt, style, ratio, brandId: activeBusinessId, createdAt: Date.now() };
      saveGallery([newItem, ...gallery]);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const download = async (url, index) => {
    try {
      const r = await fetch(url);
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `kreativelync-image-${index + 1}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-stone-800 dark:to-stone-800 border-2 border-violet-200 dark:border-violet-800 rounded-3xl p-6">
        <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-1">🖼️ AI Image Studio</h2>
        <p className="text-stone-500 dark:text-stone-400 text-sm">Generate photorealistic images, 3D renders, event visuals & more. Powered by Flux.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT — controls */}
        <div className="lg:col-span-2 space-y-5">

          {/* Prompt */}
          <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Describe your image</p>
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
              placeholder="Describe what you want to generate..."
              className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-3 py-2.5 text-sm text-stone-800 dark:text-stone-100 resize-none"
            />
            {/* Quick prompts */}
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

          {/* Style */}
          <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-5">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Style</p>
            <div className="grid grid-cols-2 gap-2">
              {STYLES.map(s => (
                <button key={s.id} onClick={() => setStyle(s.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all ${style === s.id ? 'bg-violet-500 text-white shadow' : 'bg-stone-50 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-violet-50 dark:hover:bg-stone-600'}`}>
                  <span className="block">{s.label}</span>
                  <span className={`text-[10px] ${style === s.id ? 'text-violet-100' : 'text-stone-400'}`}>{s.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Ratio */}
          <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-5">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Size</p>
            <div className="grid grid-cols-2 gap-2">
              {RATIOS.map(r => (
                <button key={r.id} onClick={() => setRatio(r.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all ${ratio === r.id ? 'bg-violet-500 text-white shadow' : 'bg-stone-50 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-violet-50 dark:hover:bg-stone-600'}`}>
                  <span className="block">{r.label}</span>
                  <span className={`text-[10px] ${ratio === r.id ? 'text-violet-100' : 'text-stone-400'}`}>{r.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Generate */}
          {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-3">{error}</p>}
          <button onClick={generate} disabled={loading || !prompt.trim()}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-bold text-lg flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 transition-opacity shadow-lg shadow-violet-200 dark:shadow-none">
            {loading ? <><Loader2 size={20} className="animate-spin" /> Generating…</> : <><Sparkles size={20} /> Generate Image</>}
          </button>
        </div>

        {/* RIGHT — gallery */}
        <div className="lg:col-span-3 space-y-4">
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Generated Images</p>
          {gallery.length === 0 && !loading && (
            <div className="border-2 border-dashed border-violet-200 dark:border-stone-700 rounded-2xl p-12 text-center">
              <ImageIcon size={40} className="mx-auto mb-3 text-violet-300" />
              <p className="text-stone-400 text-sm">Your generated images will appear here</p>
            </div>
          )}
          {loading && (
            <div className="border-2 border-violet-200 dark:border-stone-700 rounded-2xl p-12 text-center animate-pulse">
              <Loader2 size={40} className="mx-auto mb-3 text-violet-400 animate-spin" />
              <p className="text-violet-500 font-medium text-sm">Creating your image…</p>
              <p className="text-stone-400 text-xs mt-1">Usually takes 5–15 seconds</p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {gallery.map((item, i) => (
              <div key={i} className="group relative rounded-2xl overflow-hidden border border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-800">
                <img src={item.url} alt={item.prompt} className="w-full object-cover aspect-square" loading="lazy" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <button onClick={() => download(item.url, i)}
                    className="p-2.5 rounded-xl bg-white text-stone-800 hover:bg-violet-500 hover:text-white transition-colors">
                    <Download size={16} />
                  </button>
                  <button onClick={() => setPrompt(item.prompt)}
                    className="p-2.5 rounded-xl bg-white text-stone-800 hover:bg-violet-500 hover:text-white transition-colors">
                    <RefreshCw size={16} />
                  </button>
                </div>
                <div className="p-3">
                  <p className="text-xs text-stone-500 dark:text-stone-400 truncate">{item.prompt}</p>
                  <div className="flex gap-2 mt-1">
                    <span className="text-[10px] px-2 py-0.5 bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 rounded-lg">{item.style}</span>
                    <span className="text-[10px] px-2 py-0.5 bg-stone-100 dark:bg-stone-700 text-stone-500 rounded-lg">{item.ratio}</span>
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
