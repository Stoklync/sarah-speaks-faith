import React, { useState } from 'react';
import { Sparkles, Loader2, Plus, Trash2, Check, ChevronDown } from 'lucide-react';
import { useStudio } from '../App';

const VOICES = ['Raw & Real', 'Inspirational', 'Educational', 'Bold', 'Conversational', 'Prophetic', 'Professional', 'Encouraging'];
const PLATFORMS = ['Instagram', 'YouTube', 'TikTok', 'Facebook', 'Pinterest', 'LinkedIn', 'Twitter/X', 'Podcast'];
const GOALS = ['Grow audience', 'Drive sales', 'Build community', 'Launch a product', 'Build email list', 'Get speaking gigs', 'Sell digital products', 'Brand awareness'];
const PILLARS_FAITH = ['Scripture & Devotion', 'Prayer', 'Faith & Doubt', 'Spiritual Growth', 'Women of the Bible', 'Worship', 'Evangelism', 'Community'];
const PILLARS_STEWARDSHIP = ['Budgeting', 'Debt Freedom', 'Investing', 'Biblical Giving', 'Financial Peace', 'Income Building', 'Contentment', 'Generosity'];
const PILLARS_BUSINESS = ['Education', 'Behind the Scenes', 'Social Proof', 'Product Features', 'Customer Stories', 'Tips & How-To', 'Brand Story', 'Promotions'];

const BRAND_COLORS = [
  // Purples & Pinks
  { label: 'Violet',      value: '#7c3aed' },
  { label: 'Purple',      value: '#9333ea' },
  { label: 'Indigo',      value: '#4f46e5' },
  { label: 'Fuchsia',     value: '#c026d3' },
  { label: 'Pink',        value: '#db2777' },
  { label: 'Rose',        value: '#e11d48' },
  // Reds & Oranges
  { label: 'Red',         value: '#dc2626' },
  { label: 'Orange',      value: '#ea580c' },
  { label: 'Amber',       value: '#d97706' },
  { label: 'Yellow',      value: '#ca8a04' },
  // Greens
  { label: 'Lime',        value: '#65a30d' },
  { label: 'Green',       value: '#16a34a' },
  { label: 'Emerald',     value: '#059669' },
  { label: 'Teal',        value: '#0d9488' },
  // Blues
  { label: 'Cyan',        value: '#0891b2' },
  { label: 'Sky',         value: '#0284c7' },
  { label: 'Blue',        value: '#2563eb' },
  { label: 'Navy',        value: '#1e3a5f' },
  // Neutrals & Darks
  { label: 'Slate',       value: '#475569' },
  { label: 'Stone',       value: '#78716c' },
  { label: 'Charcoal',    value: '#374151' },
  { label: 'Black',       value: '#111827' },
  { label: 'Gold',        value: '#b45309' },
  { label: 'Bronze',      value: '#92400e' },
  { label: 'Mauve',       value: '#9d174d' },
  { label: 'Sage',        value: '#4d7c5f' },
  { label: 'Dusty Rose',  value: '#be6f8c' },
  { label: 'Blush',       value: '#f9a8c9' },
  { label: 'Cream',       value: '#fef3c7' },
  { label: 'White',       value: '#f8fafc' },
];

const TABS = ['Identity', 'Voice & Audience', 'Platforms', 'Products'];

export function BrandKit() {
  const { businesses, activeBusinessId, setBusinesses } = useStudio();
  const brand = (businesses || []).find(b => b?.id === activeBusinessId);
  const [tab, setTab] = useState('Identity');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [aiLoading, setAiLoading] = useState('');

  if (!brand) return (
    <div className="flex items-center justify-center h-64 text-stone-400">
      Select a brand from the sidebar to edit its Brand Kit.
    </div>
  );

  const update = (field, value) => {
    setBusinesses(prev => prev.map(b => b.id === brand.id ? { ...b, [field]: value } : b));
    setSaved(false);
  };

  const toggleArray = (field, value) => {
    const current = brand[field] || [];
    const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
    update(field, next);
  };

  const save = () => {
    setSaving(true);
    setTimeout(() => { setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500); }, 400);
  };

  const suggestPillars = () => {
    if (brand.type === 'faith') return PILLARS_FAITH;
    if (brand.type === 'stewardship') return PILLARS_STEWARDSHIP;
    return PILLARS_BUSINESS;
  };

  const aiGenerate = async (field, prompt) => {
    setAiLoading(field);
    try {
      const r = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'chat',
          topic: prompt,
          brandName: brand.name,
          brandType: brand.type,
          brandDesc: brand.description || '',
          chatHistory: [{ role: 'user', text: prompt }],
        }),
      });
      const data = await r.json();
      if (data.reply) update(field, data.reply.trim());
    } catch {}
    setAiLoading('');
  };

  const colorValue = brand.brandColor || (brand.type === 'faith' ? '#7c3aed' : brand.type === 'stewardship' ? '#059669' : '#4f46e5');

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-stone-800 dark:to-stone-800 border-2 border-violet-200 dark:border-violet-800 rounded-3xl p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg"
            style={{ background: colorValue }}>
            {brand.name[0]}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100">{brand.name}</h2>
            <p className="text-stone-400 text-sm capitalize">{brand.type === 'stewardship' ? 'Faith & Finance' : brand.type} brand</p>
          </div>
        </div>
        <button onClick={save} disabled={saving}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${saved ? 'bg-emerald-500 text-white' : 'bg-violet-500 text-white hover:bg-violet-600'} disabled:opacity-50`}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
          {saved ? 'Saved!' : 'Save Brand Kit'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-100 dark:bg-stone-800 rounded-2xl p-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${tab === t ? 'bg-white dark:bg-stone-700 text-violet-600 dark:text-violet-400 shadow' : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── IDENTITY ── */}
      {tab === 'Identity' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-5 space-y-4">
            <div>
              <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-1.5">Brand Name</label>
              <input value={brand.name} onChange={e => update('name', e.target.value)}
                className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-4 py-3 text-sm font-semibold" />
            </div>

            <div>
              <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-1.5">Tagline</label>
              <div className="flex gap-2">
                <input value={brand.tagline || ''} onChange={e => update('tagline', e.target.value)}
                  placeholder="e.g. Walking in faith, one day at a time"
                  className="flex-1 bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-4 py-3 text-sm" />
                <button onClick={() => aiGenerate('tagline', `Write a short punchy tagline (under 8 words) for ${brand.name} (${brand.type} brand). ${brand.description || ''} Reply with ONLY the tagline, no quotes, no explanation.`)}
                  disabled={aiLoading === 'tagline'}
                  className="px-3 py-2 rounded-xl bg-violet-100 dark:bg-violet-900/30 text-violet-600 hover:bg-violet-200 disabled:opacity-50">
                  {aiLoading === 'tagline' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-1.5">Brand Description</label>
              <div className="space-y-2">
                <textarea value={brand.description || ''} onChange={e => update('description', e.target.value)}
                  rows={4} placeholder="What does this brand do? Who does it serve? What makes it different?"
                  className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-4 py-3 text-sm resize-none" />
                <button onClick={() => aiGenerate('description', `Write a 2-3 sentence brand description for ${brand.name} (${brand.type} brand). ${brand.tagline ? `Tagline: "${brand.tagline}".` : ''} Make it specific, compelling, and authentic. Reply with ONLY the description.`)}
                  disabled={aiLoading === 'description'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-100 dark:bg-violet-900/30 text-violet-600 text-xs font-bold hover:bg-violet-200 disabled:opacity-50">
                  {aiLoading === 'description' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  AI Write Description
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-1.5">Website</label>
              <input value={brand.website || ''} onChange={e => update('website', e.target.value)}
                placeholder="https://yoursite.com"
                className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-4 py-3 text-sm" />
            </div>

            {(brand.type === 'faith' || brand.type === 'stewardship') && (
              <div>
                <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-1.5">Podcast / Show Name</label>
                <input value={brand.podcastName || ''} onChange={e => update('podcastName', e.target.value)}
                  placeholder="e.g. Her Stewardship"
                  className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-4 py-3 text-sm" />
              </div>
            )}
          </div>

          {/* Brand color */}
          <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-5">
            <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-3">Brand Color</label>

            {/* Colour swatches */}
            <div className="flex gap-2 flex-wrap mb-4">
              {BRAND_COLORS.map(c => (
                <button key={c.value} onClick={() => update('brandColor', c.value)} title={c.label}
                  className={`w-8 h-8 rounded-lg transition-all border-2 ${colorValue === c.value ? 'border-stone-700 dark:border-white scale-110 shadow-md' : 'border-transparent hover:scale-105 hover:border-stone-300'}`}
                  style={{ background: c.value }} />
              ))}
            </div>

            {/* Custom colour row: native picker + hex input */}
            <div className="flex items-center gap-3">
              {/* Native colour wheel */}
              <div className="relative">
                <input
                  type="color"
                  value={colorValue}
                  onChange={e => update('brandColor', e.target.value)}
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                  title="Open colour picker"
                />
                <div
                  className="w-10 h-10 rounded-xl border-2 border-stone-200 dark:border-stone-600 cursor-pointer shadow-sm flex items-center justify-center"
                  style={{ background: colorValue }}
                  title="Open colour picker"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/>
                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.47-1.125-.29-.289-.47-.688-.47-1.125a1.648 1.648 0 0 1 1.648-1.648h1.94c3.148 0 5.704-2.557 5.704-5.705C22 6.257 17.523 2 12 2z"/>
                  </svg>
                </div>
              </div>

              {/* Hex text input */}
              <div className="flex items-center gap-1 flex-1 bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-3 py-2">
                <span className="text-stone-400 text-sm font-mono">#</span>
                <input
                  type="text"
                  value={(colorValue || '#7c3aed').replace('#', '')}
                  onChange={e => {
                    const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
                    e.target.value = v;
                    if (v.length === 6) update('brandColor', '#' + v);
                  }}
                  onBlur={e => {
                    const v = e.target.value.trim();
                    if (v.length === 3 || v.length === 6) update('brandColor', '#' + v);
                  }}
                  maxLength={6}
                  placeholder="7c3aed"
                  className="flex-1 bg-transparent text-stone-700 dark:text-stone-200 text-sm font-mono focus:outline-none uppercase"
                />
              </div>

              {/* Live preview swatch */}
              <div
                className="w-10 h-10 rounded-xl border border-stone-200 dark:border-stone-600 shadow-sm shrink-0"
                style={{ background: colorValue }}
                title="Current brand colour"
              />
            </div>
            <p className="text-[11px] text-stone-400 mt-2">Click the circle to open the colour wheel, or type any hex code directly.</p>
          </div>
        </div>
      )}

      {/* ── VOICE & AUDIENCE ── */}
      {tab === 'Voice & Audience' && (
        <div className="space-y-4">
          {/* Brand voice */}
          <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-5">
            <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-3">Brand Voice</label>
            <p className="text-xs text-stone-400 mb-3">How does your content sound? The AI will match this tone in every caption, script, and suggestion.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {VOICES.map(v => (
                <button key={v} onClick={() => update('brandVoice', v)}
                  className={`px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${brand.brandVoice === v ? 'bg-violet-500 text-white shadow' : 'bg-stone-50 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-violet-50'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Target audience */}
          <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-5">
            <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-1.5">Target Audience</label>
            <div className="flex gap-2">
              <textarea value={brand.targetAudience || ''} onChange={e => update('targetAudience', e.target.value)}
                rows={2} placeholder="Who exactly are you talking to? Be specific — age, struggles, desires, situation."
                className="flex-1 bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-4 py-3 text-sm resize-none" />
              <button onClick={() => aiGenerate('targetAudience', `Describe the ideal target audience for ${brand.name} (${brand.type} brand). ${brand.description || ''} Be specific — who they are, their struggles, what they're searching for. 2 sentences max. Reply with ONLY the audience description.`)}
                disabled={aiLoading === 'targetAudience'}
                className="px-3 rounded-xl bg-violet-100 dark:bg-violet-900/30 text-violet-600 hover:bg-violet-200 disabled:opacity-50 self-start mt-0">
                {aiLoading === 'targetAudience' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              </button>
            </div>
          </div>

          {/* Content pillars */}
          <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-5">
            <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-1.5">Content Pillars</label>
            <p className="text-xs text-stone-400 mb-3">The core topics your content always comes back to. AI uses these for every idea it generates.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {suggestPillars().map(p => (
                <button key={p} onClick={() => toggleArray('contentPillars', p)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left ${(brand.contentPillars || []).includes(p) ? 'bg-violet-500 text-white shadow' : 'bg-stone-50 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-violet-50'}`}>
                  {p}
                </button>
              ))}
            </div>
            <input placeholder="Add a custom pillar and press Enter…"
              onKeyDown={e => { if (e.key === 'Enter' && e.target.value.trim()) { toggleArray('contentPillars', e.target.value.trim()); e.target.value = ''; } }}
              className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-4 py-2.5 text-sm" />
            {(brand.contentPillars || []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(brand.contentPillars || []).map(p => (
                  <span key={p} className="flex items-center gap-1 px-2.5 py-1 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-lg text-xs font-semibold">
                    {p}
                    <button onClick={() => toggleArray('contentPillars', p)} className="text-violet-400 hover:text-violet-600">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Content goals */}
          <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-5">
            <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-3">Content Goals</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {GOALS.map(g => (
                <button key={g} onClick={() => toggleArray('contentGoals', g)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${(brand.contentGoals || []).includes(g) ? 'bg-violet-500 text-white shadow' : 'bg-stone-50 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-violet-50'}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── PLATFORMS ── */}
      {tab === 'Platforms' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-5">
            <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-3">Active Platforms</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PLATFORMS.map(p => (
                <button key={p} onClick={() => toggleArray('activePlatforms', p)}
                  className={`px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${(brand.activePlatforms || []).includes(p) ? 'bg-violet-500 text-white shadow' : 'bg-stone-50 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-violet-50'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {(brand.activePlatforms || []).length > 0 && (
            <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-5 space-y-3">
              <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block">Social Handles</label>
              {(brand.activePlatforms || []).map(p => (
                <div key={p} className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-stone-500 w-28 shrink-0">{p}</span>
                  <input
                    value={(brand.socialHandles || {})[p] || ''}
                    onChange={e => update('socialHandles', { ...(brand.socialHandles || {}), [p]: e.target.value })}
                    placeholder={`@handle or URL`}
                    className="flex-1 bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-3 py-2 text-sm" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── PRODUCTS ── */}
      {tab === 'Products' && (
        <div className="space-y-4">
          <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-2xl p-4 text-sm text-violet-700 dark:text-violet-300">
            <p className="font-bold mb-1">💡 Why this matters</p>
            <p className="text-xs">The AI uses your products and prices in every caption, script, and content idea — so it writes copy that actually sells, not just content that looks nice.</p>
          </div>

          {(brand.products || []).map((product, i) => (
            <div key={i} className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Product / Service {i + 1}</span>
                <button onClick={() => update('products', (brand.products || []).filter((_, pi) => pi !== i))}
                  className="text-stone-400 hover:text-red-500 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-stone-400 font-bold uppercase block mb-1">Name</label>
                  <input value={product.name || ''} onChange={e => { const p = [...(brand.products||[])]; p[i] = {...p[i], name: e.target.value}; update('products', p); }}
                    placeholder="e.g. Faith Journal"
                    className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] text-stone-400 font-bold uppercase block mb-1">Price</label>
                  <input value={product.price || ''} onChange={e => { const p = [...(brand.products||[])]; p[i] = {...p[i], price: e.target.value}; update('products', p); }}
                    placeholder="e.g. $27"
                    className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-stone-400 font-bold uppercase block mb-1">Description</label>
                <input value={product.description || ''} onChange={e => { const p = [...(brand.products||[])]; p[i] = {...p[i], description: e.target.value}; update('products', p); }}
                  placeholder="What is it? Who is it for? What problem does it solve?"
                  className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-[10px] text-stone-400 font-bold uppercase block mb-1">Link</label>
                <input value={product.link || ''} onChange={e => { const p = [...(brand.products||[])]; p[i] = {...p[i], link: e.target.value}; update('products', p); }}
                  placeholder="https://gumroad.com/..."
                  className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-3 py-2 text-sm" />
              </div>
            </div>
          ))}

          <button onClick={() => update('products', [...(brand.products || []), { name: '', price: '', description: '', link: '' }])}
            className="w-full py-3 rounded-2xl border-2 border-dashed border-violet-200 dark:border-stone-700 text-violet-500 text-sm font-bold hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/10 transition-colors flex items-center justify-center gap-2">
            <Plus size={16} /> Add Product / Service
          </button>
        </div>
      )}

      {/* Save bar */}
      <div className="sticky bottom-0 pb-4 pt-2">
        <button onClick={save} disabled={saving}
          className={`w-full py-3.5 rounded-2xl font-bold text-base transition-all shadow-lg ${saved ? 'bg-emerald-500 text-white shadow-emerald-200' : 'bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-violet-200 dark:shadow-none hover:opacity-90'} disabled:opacity-50`}>
          {saving ? 'Saving…' : saved ? '✓ Brand Kit Saved!' : 'Save Brand Kit'}
        </button>
      </div>
    </div>
  );
}
