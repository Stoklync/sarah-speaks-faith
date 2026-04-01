import React, { useState, useEffect } from 'react';
import {
  Search, Plus, Trash2, RefreshCw, Sparkles, Loader2,
  ExternalLink, ChevronDown, ChevronUp, TrendingUp,
  Users, Eye, ThumbsUp, Target, Zap, AlertCircle,
  Youtube, Instagram, Copy, CheckCircle, BookOpen
} from 'lucide-react';

const STORAGE_KEY = 'kreativelync-competitors';

function loadCompetitors() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveCompetitors(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
}

function fmt(n) {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

export function CompetitorIntel({ businesses = [], activeBusinessId }) {
  const [competitors, setCompetitors] = useState(loadCompetitors);
  const [adding, setAdding] = useState(false);
  const [addInput, setAddInput] = useState('');
  const [addPlatform, setAddPlatform] = useState('youtube');
  const [addNotes, setAddNotes] = useState('');
  const [fetching, setFetching] = useState(null); // competitor id being fetched
  const [analyzing, setAnalyzing] = useState(null); // competitor id being analyzed
  const [expanded, setExpanded] = useState(null);
  const [copied, setCopied] = useState('');
  const [activeTab, setActiveTab] = useState('competitors'); // competitors | insights

  const activeBiz = businesses.find(b => b?.id === activeBusinessId);
  const brandName = activeBiz?.name || 'Your brand';
  const brandType = activeBiz?.type || 'faith';
  const userKey = activeBusinessId || 'default';

  useEffect(() => { saveCompetitors(competitors); }, [competitors]);

  // ── Add competitor ──────────────────────────────────────────────
  const addCompetitor = () => {
    if (!addInput.trim()) return;
    const raw = addInput.trim();

    // Parse handle from URL or @handle
    let handle = raw;
    if (raw.includes('youtube.com/')) {
      const m = raw.match(/@([\w.-]+)/) || raw.match(/\/channel\/([\w-]+)/) || raw.match(/\/c\/([\w-]+)/);
      handle = m ? (raw.includes('/channel/') ? m[1] : '@' + m[1]) : raw;
    } else if (raw.includes('instagram.com/')) {
      const m = raw.match(/instagram\.com\/([\w.]+)/);
      handle = m ? m[1] : raw;
    } else if (!raw.startsWith('@') && addPlatform === 'youtube') {
      handle = '@' + raw.replace(/^@/, '');
    }

    const id = Date.now().toString();
    const newComp = {
      id,
      platform: addPlatform,
      handle,
      niche: addNotes.trim(),
      addedAt: new Date().toISOString().slice(0, 10),
      channelData: null,
      analysis: null,
      businessId: activeBusinessId,
    };

    setCompetitors(prev => [newComp, ...prev]);
    setAdding(false);
    setAddInput('');
    setAddNotes('');

    // Auto-fetch YouTube channels
    if (addPlatform === 'youtube') fetchYouTube(id, handle, [newComp]);
  };

  // ── Fetch YouTube data ──────────────────────────────────────────
  const fetchYouTube = async (id, handle, list = null) => {
    setFetching(id);
    try {
      const param = handle.startsWith('UC') ? `channelId=${handle}` : `handle=${encodeURIComponent(handle)}`;
      const res = await fetch(`/api/intel/competitor-youtube?${param}`, {
        headers: { 'X-User-Key': userKey },
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const source = list || competitors;
      setCompetitors(source.map(c =>
        c.id === id ? { ...c, channelData: data, fetchedAt: new Date().toISOString().slice(0, 10) } : c
      ));
      setExpanded(id);
    } catch (e) {
      setCompetitors(prev => prev.map(c =>
        c.id === id ? { ...c, fetchError: e.message } : c
      ));
    } finally {
      setFetching(null);
    }
  };

  // ── AI Analysis ─────────────────────────────────────────────────
  const analyzeCompetitor = async (comp) => {
    if (!comp.channelData && comp.platform === 'youtube') {
      await fetchYouTube(comp.id, comp.handle);
      return;
    }
    setAnalyzing(comp.id);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'competitor',
          topic: `Competitor analysis for ${comp.handle}`,
          brandName,
          brandType,
          competitor: comp.channelData || { channel: { name: comp.handle }, topVideos: [] },
        }),
      });
      const data = await res.json();
      setCompetitors(prev => prev.map(c =>
        c.id === comp.id ? { ...c, analysis: data, analyzedAt: new Date().toISOString().slice(0, 10) } : c
      ));
      setExpanded(comp.id);
    } catch (e) {
      alert('Analysis failed. Try again.');
    } finally {
      setAnalyzing(null);
    }
  };

  const removeCompetitor = (id) => {
    if (confirm('Remove this competitor?')) {
      setCompetitors(prev => prev.filter(c => c.id !== id));
      if (expanded === id) setExpanded(null);
    }
  };

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  // Filter to active brand
  const bizCompetitors = competitors.filter(c => !c.businessId || c.businessId === activeBusinessId);

  // Collect all analyses for the Insights tab
  const allAnalyses = bizCompetitors.filter(c => c.analysis);

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-black text-stone-800 dark:text-stone-100">Competitor Intelligence</h2>
          <p className="text-stone-500 dark:text-stone-400 text-sm mt-1">
            Study the creators in your space. Find their gaps. Build the strategy to beat them.
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500 text-white font-bold text-sm hover:bg-violet-600 transition-colors shadow-md"
        >
          <Plus size={16} /> Add Competitor
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-stone-100 dark:bg-stone-800 rounded-xl w-fit">
        {[['competitors', 'Competitors'], ['insights', 'Battle Plan']].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${activeTab === id ? 'bg-white dark:bg-stone-700 text-stone-800 dark:text-stone-100 shadow-sm' : 'text-stone-500 dark:text-stone-400 hover:text-stone-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Add form ─────────────────────────────────────────────── */}
      {adding && (
        <div className="bg-white dark:bg-stone-800 border border-violet-200 dark:border-violet-800/50 rounded-2xl p-5 space-y-4">
          <p className="font-bold text-stone-800 dark:text-stone-100">Add a competitor or creator to study</p>

          <div className="flex gap-2">
            {[['youtube', 'YouTube', '▶️'], ['instagram', 'Instagram', '📸']].map(([id, label, emoji]) => (
              <button key={id} onClick={() => setAddPlatform(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold border transition-colors ${addPlatform === id ? 'bg-violet-500 border-violet-500 text-white' : 'border-stone-200 dark:border-stone-600 text-stone-600 dark:text-stone-400'}`}>
                <span>{emoji}</span> {label}
              </button>
            ))}
          </div>

          <input
            value={addInput}
            onChange={e => setAddInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCompetitor()}
            placeholder={addPlatform === 'youtube'
              ? '@ChannelHandle or youtube.com/... URL'
              : '@instagramhandle or instagram.com/... URL'}
            className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 text-stone-800 dark:text-stone-100"
            autoFocus
          />

          <input
            value={addNotes}
            onChange={e => setAddNotes(e.target.value)}
            placeholder="Why are you tracking them? (optional — e.g. 'top faith creator on YouTube')"
            className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 text-stone-800 dark:text-stone-100"
          />

          <div className="flex gap-2">
            <button onClick={addCompetitor} disabled={!addInput.trim()}
              className="flex-1 py-2.5 rounded-xl bg-violet-500 text-white font-bold text-sm hover:bg-violet-600 disabled:opacity-50 transition-colors">
              Add & Analyze
            </button>
            <button onClick={() => { setAdding(false); setAddInput(''); setAddNotes(''); }}
              className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-600 text-stone-600 dark:text-stone-400 text-sm font-semibold hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Competitors Tab ──────────────────────────────────────── */}
      {activeTab === 'competitors' && (
        <div className="space-y-4">
          {bizCompetitors.length === 0 && !adding && (
            <div className="text-center py-16 border-2 border-dashed border-stone-200 dark:border-stone-700 rounded-2xl">
              <Target size={36} className="mx-auto text-stone-300 dark:text-stone-600 mb-3" />
              <p className="font-bold text-stone-500 dark:text-stone-400">No competitors tracked yet</p>
              <p className="text-sm text-stone-400 dark:text-stone-500 mt-1 mb-4">Add a YouTube channel or Instagram account to study</p>
              <button onClick={() => setAdding(true)}
                className="px-5 py-2.5 rounded-xl bg-violet-500 text-white font-bold text-sm hover:bg-violet-600 transition-colors">
                Add your first competitor
              </button>
            </div>
          )}

          {bizCompetitors.map(comp => (
            <CompetitorCard
              key={comp.id}
              comp={comp}
              expanded={expanded === comp.id}
              onToggle={() => setExpanded(expanded === comp.id ? null : comp.id)}
              onFetch={() => fetchYouTube(comp.id, comp.handle)}
              onAnalyze={() => analyzeCompetitor(comp)}
              onRemove={() => removeCompetitor(comp.id)}
              fetching={fetching === comp.id}
              analyzing={analyzing === comp.id}
              copy={copy}
              copied={copied}
              brandName={brandName}
            />
          ))}
        </div>
      )}

      {/* ── Battle Plan Tab ──────────────────────────────────────── */}
      {activeTab === 'insights' && (
        <div className="space-y-6">
          {allAnalyses.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-stone-200 dark:border-stone-700 rounded-2xl">
              <Sparkles size={36} className="mx-auto text-stone-300 dark:text-stone-600 mb-3" />
              <p className="font-bold text-stone-500 dark:text-stone-400">No analyses yet</p>
              <p className="text-sm text-stone-400 mt-1">Add competitors and run AI analysis to see your battle plan here</p>
            </div>
          ) : (
            allAnalyses.map(comp => (
              <BattlePlanCard key={comp.id} comp={comp} copy={copy} copied={copied} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Competitor Card ─────────────────────────────────────────────────
function CompetitorCard({ comp, expanded, onToggle, onFetch, onAnalyze, onRemove, fetching, analyzing, copy, copied, brandName }) {
  const ch = comp.channelData?.channel;
  const topVids = comp.channelData?.topVideos?.slice(0, 5) || [];

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-3 p-4">
        {ch?.thumbnail ? (
          <img src={ch.thumbnail} alt={ch.name} className="w-12 h-12 rounded-xl object-cover shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-stone-100 dark:bg-stone-700 flex items-center justify-center shrink-0">
            {comp.platform === 'youtube' ? <Youtube size={20} className="text-red-500" /> : <Instagram size={20} className="text-pink-500" />}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-stone-800 dark:text-stone-100 truncate">{ch?.name || comp.handle}</p>
            {comp.platform === 'youtube' && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full">YouTube</span>}
            {comp.platform === 'instagram' && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-full">Instagram</span>}
            {comp.analysis && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-full">Analyzed</span>}
          </div>
          <p className="text-xs text-stone-400 truncate">{comp.handle}{comp.niche ? ` · ${comp.niche}` : ''}</p>
        </div>

        {/* Stats row */}
        {ch && (
          <div className="hidden sm:flex items-center gap-4 text-right shrink-0">
            <div>
              <p className="text-sm font-bold text-stone-800 dark:text-stone-100">{fmt(ch.subscribers)}</p>
              <p className="text-[10px] text-stone-400">subs</p>
            </div>
            <div>
              <p className="text-sm font-bold text-stone-800 dark:text-stone-100">{fmt(ch.avgViewsTop12)}</p>
              <p className="text-[10px] text-stone-400">avg views</p>
            </div>
            <div>
              <p className="text-sm font-bold text-stone-800 dark:text-stone-100">{ch.postingFrequency?.split(' ')[0] || '—'}</p>
              <p className="text-[10px] text-stone-400">per week</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {comp.platform === 'youtube' && !comp.channelData && (
            <button onClick={onFetch} disabled={fetching}
              className="p-2 rounded-xl bg-stone-100 dark:bg-stone-700 text-stone-500 hover:text-violet-500 transition-colors disabled:opacity-50" title="Fetch data">
              {fetching ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            </button>
          )}
          {comp.platform === 'youtube' && comp.channelData && (
            <button onClick={onFetch} disabled={fetching}
              className="p-2 rounded-xl bg-stone-100 dark:bg-stone-700 text-stone-500 hover:text-violet-500 transition-colors disabled:opacity-50" title="Refresh data">
              {fetching ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            </button>
          )}
          <button onClick={onAnalyze} disabled={analyzing}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-violet-500 text-white text-xs font-bold hover:bg-violet-600 disabled:opacity-50 transition-colors">
            {analyzing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {comp.analysis ? 'Re-analyze' : 'Analyze'}
          </button>
          <button onClick={onToggle} className="p-2 rounded-xl bg-stone-100 dark:bg-stone-700 text-stone-500 transition-colors">
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          <button onClick={onRemove} className="p-2 rounded-xl text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Fetch error */}
      {comp.fetchError && (
        <div className="px-4 pb-3 flex items-center gap-2 text-xs text-red-500">
          <AlertCircle size={12} /> {comp.fetchError}
        </div>
      )}

      {/* Expanded: top videos */}
      {expanded && topVids.length > 0 && (
        <div className="border-t border-stone-100 dark:border-stone-700 p-4 space-y-3">
          <p className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Top Performing Videos</p>
          <div className="space-y-2">
            {topVids.map((v, i) => (
              <div key={v.id} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-stone-100 dark:bg-stone-700 text-[10px] font-bold text-stone-500 flex items-center justify-center shrink-0">{i + 1}</span>
                {v.thumbnail && <img src={v.thumbnail} alt="" className="w-16 h-10 rounded-lg object-cover shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-stone-700 dark:text-stone-300 truncate">{v.title}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] text-stone-400 flex items-center gap-1"><Eye size={10} /> {fmt(v.views)}</span>
                    <span className="text-[10px] text-stone-400 flex items-center gap-1"><ThumbsUp size={10} /> {fmt(v.likes)}</span>
                    <span className="text-[10px] text-stone-400">{v.publishedAt}</span>
                  </div>
                </div>
                <a href={v.url} target="_blank" rel="noopener noreferrer" className="text-stone-300 hover:text-violet-500 transition-colors shrink-0">
                  <ExternalLink size={13} />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expanded: analysis preview */}
      {expanded && comp.analysis && (
        <div className="border-t border-stone-100 dark:border-stone-700 p-4 space-y-3">
          <p className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">AI Analysis</p>
          {comp.analysis.theirStrategy && (
            <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">{comp.analysis.theirStrategy}</p>
          )}
          {comp.analysis.yourEdge && (
            <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800/40 rounded-xl p-3">
              <p className="text-xs font-bold text-violet-700 dark:text-violet-400 mb-1">Your edge against them</p>
              <p className="text-sm text-stone-700 dark:text-stone-300">{comp.analysis.yourEdge}</p>
            </div>
          )}
          <p className="text-xs text-stone-400">See full battle plan in the Battle Plan tab</p>
        </div>
      )}

      {/* Instagram manual input placeholder */}
      {expanded && comp.platform === 'instagram' && !comp.channelData && (
        <div className="border-t border-stone-100 dark:border-stone-700 p-4">
          <p className="text-xs text-stone-500 mb-2">Instagram doesn't allow automatic data pulls. Click Analyze — the AI will give strategy advice based on the handle and your brand context.</p>
        </div>
      )}
    </div>
  );
}

// ── Battle Plan Card ────────────────────────────────────────────────
function BattlePlanCard({ comp, copy, copied }) {
  const a = comp.analysis;
  const ch = comp.channelData?.channel;

  const fullPlan = [
    `COMPETITOR: ${ch?.name || comp.handle}`,
    a.theirStrategy && `\nTHEIR STRATEGY\n${a.theirStrategy}`,
    a.contentPatterns?.length && `\nCONTENT PATTERNS\n${a.contentPatterns.map(p => `• ${p}`).join('\n')}`,
    a.weaknesses?.length && `\nWEAKNESSES (YOUR OPPORTUNITY)\n${a.weaknesses.map(w => `• ${w}`).join('\n')}`,
    a.yourEdge && `\nYOUR EDGE\n${a.yourEdge}`,
    a.beatThemPlan?.length && `\nBEAT THEM PLAN\n${a.beatThemPlan.map((p, i) => `${i + 1}. ${p.action}\n   Why: ${p.why}`).join('\n')}`,
    a.stealThisIdea && `\nSTEAL THIS IDEA\n${a.stealThisIdea}`,
    a.positioningStatement && `\nYOUR POSITIONING\n${a.positioningStatement}`,
  ].filter(Boolean).join('\n');

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-stone-50 dark:bg-stone-900/40 border-b border-stone-100 dark:border-stone-700">
        <div className="flex items-center gap-3">
          {ch?.thumbnail && <img src={ch.thumbnail} alt="" className="w-8 h-8 rounded-lg object-cover" />}
          <div>
            <p className="font-bold text-stone-800 dark:text-stone-100 text-sm">{ch?.name || comp.handle}</p>
            <p className="text-[10px] text-stone-400">{comp.analyzedAt ? `Analyzed ${comp.analyzedAt}` : ''}</p>
          </div>
        </div>
        <button onClick={() => copy(fullPlan, `plan-${comp.id}`)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${copied === `plan-${comp.id}` ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700' : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-400 hover:text-violet-600'}`}>
          {copied === `plan-${comp.id}` ? <><CheckCircle size={12} /> Copied</> : <><Copy size={12} /> Copy plan</>}
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* Their strategy */}
        {a.theirStrategy && (
          <div>
            <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><BookOpen size={11} /> Their Strategy</p>
            <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">{a.theirStrategy}</p>
          </div>
        )}

        {/* Content patterns + weaknesses side by side */}
        <div className="grid sm:grid-cols-2 gap-4">
          {a.contentPatterns?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><TrendingUp size={11} /> What's Working for Them</p>
              <ul className="space-y-1.5">
                {a.contentPatterns.map((p, i) => (
                  <li key={i} className="text-sm text-stone-600 dark:text-stone-400 flex gap-2">
                    <span className="text-violet-400 shrink-0">•</span>{p}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {a.weaknesses?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Target size={11} /> Their Gaps (Your Opportunity)</p>
              <ul className="space-y-1.5">
                {a.weaknesses.map((w, i) => (
                  <li key={i} className="text-sm text-emerald-700 dark:text-emerald-400 flex gap-2">
                    <span className="shrink-0">→</span>{w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Your edge */}
        {a.yourEdge && (
          <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800/40 rounded-xl p-4">
            <p className="text-xs font-bold text-violet-700 dark:text-violet-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><Zap size={11} /> Your Competitive Edge</p>
            <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">{a.yourEdge}</p>
          </div>
        )}

        {/* Beat them plan */}
        {a.beatThemPlan?.length > 0 && (
          <div>
            <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Zap size={11} /> Beat Them — Action Plan</p>
            <div className="space-y-2.5">
              {a.beatThemPlan.map((step, i) => (
                <div key={i} className="flex gap-3 p-3 bg-stone-50 dark:bg-stone-900/40 rounded-xl border border-stone-100 dark:border-stone-700">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 mt-0.5 ${step.urgency === 'high' ? 'bg-red-100 dark:bg-red-900/30 text-red-600' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'}`}>{i + 1}</div>
                  <div>
                    <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">{step.action}</p>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{step.why}</p>
                  </div>
                  {step.urgency === 'high' && <span className="ml-auto text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full h-fit shrink-0">High priority</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Steal this idea */}
        {a.stealThisIdea && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl p-4">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1.5">Steal This Idea (reframe for your brand)</p>
            <p className="text-sm text-stone-700 dark:text-stone-300">{a.stealThisIdea}</p>
          </div>
        )}

        {/* Positioning */}
        {a.positioningStatement && (
          <div className="border-t border-stone-100 dark:border-stone-700 pt-4">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1.5">How to Position Against Them</p>
            <p className="text-sm font-semibold text-stone-800 dark:text-stone-100 italic">"{a.positioningStatement}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
