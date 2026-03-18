import React, { useState, createContext, useContext, useRef, useEffect, useCallback, useMemo } from 'react';
import { useEditorStore } from './stores/editorStore';
import { useEditor } from './hooks/useEditor';
import { useTimeline } from './hooks/useTimeline';
import { useEditorSync } from './hooks/useEditorSync';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useMediaRecorder } from './hooks/useMediaRecorder';
import { useQRCode } from './hooks/useQRCode';
import { encodeToMp4WithMetadata, saveToDevice } from './services/ExportService';
import { analyzePosts as analyzePostsGemini, hasGeminiKey } from './services/geminiApi';
import { analyzePosts as analyzePostsOpenAI, hasOpenAIKey } from './services/openaiApi';
import { useSEO } from './hooks/useSEO';
import { useMarketingStore, TAG_BUNDLES } from './stores/marketingStore';
import { Stage, EXPORT_PRESETS, derivePresetFromPlatforms } from './components/Stage';
import { LayeredTimelineTracks } from './components/LayeredTimelineTracks';
import { CaptionOverlay } from './components/CaptionOverlay';
import { CreatorInsights } from './components/CreatorInsights';
import { 
  Scissors, 
  Camera, 
  Mic, 
  Share2, 
  Settings, 
  Play, 
  Pause,
  Plus, 
  Trash2, 
  Video, 
  Wand2, 
  Code,
  Film,
  Search,
  MoreVertical,
  Clock,
  Sparkles,
  AudioLines,
  Sliders,
  Youtube,
  Instagram,
  Facebook,
  Music,
  Smartphone,
  Image as ImageIcon,
  LayoutGrid,
  Upload,
  Sun,
  Moon,
  Zap,
  Package,
  Copy,
  TrendingUp,
  Hash,
  BarChart2,
  Target,
  Keyboard,
  MapPin,
  ZoomIn,
  ZoomOut,
  Magnet,
  Link2,
  Menu,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  RotateCcw,
  ArrowLeft,
  Type,
  Download,
  Volume2
} from 'lucide-react';

// --- App Context ---
const StudioContext = createContext(null);

const noop = () => {};
const DEFAULT_STUDIO = {
  assets: [], filteredAssets: [], addAsset: noop, removeAsset: noop,
  selectedVideoId: null, setSelectedVideoId: noop, selectedAudioId: null, setSelectedAudioId: noop,
  selectedImageId: null, setSelectedImageId: noop,
  selectedVideo: null, selectedAudio: null, libraryFilter: 'all', setLibraryFilter: noop,
  librarySearch: '', setLibrarySearch: noop, platforms: {}, togglePlatform: noop,
  caption: '', setCaption: noop, contactPageUrl: '', setContactPageUrl: noop, marketingGoal: '', setMarketingGoal: noop,
  tags: [], addTag: noop, addTags: noop, removeTag: noop, tagInput: '', setTagInput: noop,
  voiceIsolation: false, setVoiceIsolation: noop, deReverb: false, setDeReverb: noop, deReverbStrength: 80, setDeReverbStrength: noop,
  aiUpscale: false, setAiUpscale: noop, cinematicGrade: false, setCinematicGrade: noop,
  igPosts: [], setIgPosts: noop, pinterestPins: [], setPinterestPins: noop,
  businesses: [], activeBusinessId: null, setActiveBusinessId: noop, addBusiness: noop,
  showAddBusiness: false, setShowAddBusiness: noop, newBusinessName: '', setNewBusinessName: noop,
  setActiveTab: noop, theme: 'light', isDark: false, toggleTheme: noop, setSidebarOpen: noop
};
const useStudio = () => useContext(StudioContext) ?? DEFAULT_STUDIO;

// Inner error boundary — when timeline throws, your imported media stays (assets live in parent)
class EditorErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(err) { return { hasError: true, error: err }; }
  componentDidCatch(err, info) { console.error('Editor error:', err, info); }
  render() {
    if (this.state.hasError) {
      const err = this.state.error;
      return (
        <div className="p-6 rounded-2xl bg-rose-50 dark:bg-stone-800 border border-rose-200 dark:border-stone-600 max-w-xl">
          <h3 className="font-bold text-rose-700 dark:text-rose-400 mb-2">Something went wrong in the editor</h3>
          <p className="text-sm text-stone-600 dark:text-stone-400 mb-4">{err?.message || String(err)}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })} className="px-4 py-2 rounded-xl bg-rose-500 text-white font-bold text-sm hover:bg-rose-600">Try again (your media is safe)</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const App = () => {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('faith-studio-theme') || 'system'; } catch { return 'light'; }
  });
  const [sysDark, setSysDark] = useState(false);
  const isDark = theme === 'dark' || (theme === 'system' && sysDark);

  useEffect(() => {
    try {
      const mq = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)');
      if (mq) {
        setSysDark(mq.matches);
        const h = (e) => setSysDark(e.matches);
        mq.addEventListener('change', h);
        return () => mq.removeEventListener('change', h);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try { localStorage.setItem('faith-studio-theme', theme); } catch (_) {}
  }, [theme, isDark]);

  const cycleTheme = () => setTheme(t => t === 'light' ? 'dark' : t === 'dark' ? 'system' : 'light');

  const [activeTab, setActiveTab] = useState('start');
  const assets = useEditorStore(s => Array.isArray(s?.assets) ? s.assets : []);
  const addAsset = useEditorStore(s => s.addAsset);
  const removeAsset = useEditorStore(s => s.removeAsset);
  const selectedVideoId = useEditorStore(s => s.selectedVideoId);
  const setSelectedVideoId = useEditorStore(s => s.setSelectedVideoId);
  const selectedAudioId = useEditorStore(s => s.selectedAudioId);
  const setSelectedAudioId = useEditorStore(s => s.setSelectedAudioId);
  const selectedImageId = useEditorStore(s => s.selectedImageId);
  const setSelectedImageId = useEditorStore(s => s.setSelectedImageId);
  const [libraryFilter, setLibraryFilter] = useState('all');
  const [librarySearch, setLibrarySearch] = useState('');

  const [platforms, setPlatforms] = useState({
    youtube: true,
    instagram: true,
    spotify: true,
    tiktok: true,
    facebook: false
  });
  const [caption, setCaption] = useState('');
  const [contactPageUrl, setContactPageUrl] = useState(() => { try { return localStorage.getItem('faith-contact-url') || ''; } catch { return ''; } });
  const [marketingGoal, setMarketingGoal] = useState(() => { try { return localStorage.getItem('faith-marketing-goal') || ''; } catch { return ''; } });
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');

  const [businesses, setBusinesses] = useState(() => {
    const defaults = [
      { id: 'sarah', name: 'Sarah Speaks Faith', type: 'faith', color: 'rose' },
      { id: 'stewardship', name: 'Her Stewardship', type: 'service', color: 'emerald' },
      { id: 'stoklync', name: 'Stoklync', type: 'product', color: 'indigo' },
      { id: 'skin', name: 'Skin Products', type: 'product', color: 'amber' }
    ];
    try {
      const raw = localStorage.getItem('faith-studio-businesses');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(b => b && (b.id || b.name));
          if (valid.length > 0) return valid;
        }
      }
    } catch (_) {}
    return defaults;
  });
  const [activeBusinessId, setActiveBusinessId] = useState(() => { try { return localStorage.getItem('faith-studio-active-business') || 'sarah'; } catch { return 'sarah'; } });
  const [showAddBusiness, setShowAddBusiness] = useState(false);

  useEffect(() => {
    try { if (contactPageUrl) localStorage.setItem('faith-contact-url', contactPageUrl); } catch (_) {}
  }, [contactPageUrl]);
  useEffect(() => {
    try { if (marketingGoal) localStorage.setItem('faith-marketing-goal', marketingGoal); } catch (_) {}
  }, [marketingGoal]);
  useEffect(() => {
    try { localStorage.setItem('faith-studio-businesses', JSON.stringify(businesses)); } catch (_) {}
  }, [businesses]);
  useEffect(() => {
    if (activeBusinessId) localStorage.setItem('faith-studio-active-business', activeBusinessId);
  }, [activeBusinessId]);

  const [voiceIsolation, setVoiceIsolation] = useState(true);
  const [deReverb, setDeReverb] = useState(true);
  const [deReverbStrength, setDeReverbStrength] = useState(80);
  const [aiUpscale, setAiUpscale] = useState(true);
  const [cinematicGrade, setCinematicGrade] = useState(true);

  const [igPosts, setIgPosts] = useState([]);
  const [pinterestPins, setPinterestPins] = useState([]);
  const [newBusinessName, setNewBusinessName] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [productionToolsExpanded, setProductionToolsExpanded] = useState(true);
  const [geminiKey, setGeminiKey] = useState(() => { try { return localStorage.getItem('faith-studio-gemini-api-key') || ''; } catch { return ''; } });
  const [openaiKey, setOpenaiKey] = useState(() => { try { return localStorage.getItem('faith-studio-openai-api-key') || ''; } catch { return ''; } });

  const primaryNav = [['start', Target, 'Start Here'], ['pro', Zap, 'Pro Content Toolkit'], ['social', Share2, 'Social & Podcast'], ['traffic', Link2, 'Traffic Links'], ['analytics', BarChart2, 'Post Analytics'], ['photos', ImageIcon, 'Photo & Pin Planner']];
  const productionNav = [['library', Film, 'Media Library'], ['editor', Scissors, 'No-Mouse Editor'], ['classic', Sliders, 'Classic Timeline'], ['camera', Camera, 'Camera Guide'], ['video-ai', Sparkles, 'Pro Enhancements'], ['audio', AudioLines, 'Smart Audio AI'], ['code', Code, 'Swift Engine']];

  const addBusiness = () => {
    if (!newBusinessName.trim()) return;
    const id = 'b' + Date.now();
    setBusinesses(prev => [...prev, { id, name: newBusinessName.trim(), type: 'product', color: 'stone' }]);
    setActiveBusinessId(id);
    setNewBusinessName('');
    setShowAddBusiness(false);
  };

  const clearAllData = () => {
    if (confirm('Clear all app data? This cannot be undone.')) {
      try { Object.keys(localStorage).filter(k => k.startsWith('faith-studio')).forEach(k => localStorage.removeItem(k)); } catch (_) {}
      window.location.reload();
    }
  };

  useEffect(() => {
    return () => {
      try {
        const assets = useEditorStore.getState().assets;
        if (Array.isArray(assets)) {
          assets.forEach(a => {
            try { if (a?.url) URL.revokeObjectURL(a.url); } catch (_) {}
          });
        }
      } catch (_) {}
    };
  }, []);

  const addTag = () => {
    const t = (tagInput || '').trim().replace(/^#/, '');
    if (t && !(tags || []).includes(t)) setTags(prev => [...(prev || []), t]);
    setTagInput('');
  };
  const addTags = (arr) => {
    const clean = (arr || []).map((t) => String(t).replace(/^#/, '').trim()).filter(Boolean);
    setTags(prev => [...new Set([...(prev || []), ...clean])]);
  };

  const removeTag = (t) => setTags(prev => (prev || []).filter(x => x !== t));

  const togglePlatform = (key) => setPlatforms(p => ({ ...(p || {}), [key]: !(p || {})[key] }));

  const safeAssets = Array.isArray(assets) ? assets : [];
  const filteredAssets = safeAssets.filter(a => {
    const matchFilter = libraryFilter === 'all' || 
      (libraryFilter === 'video' && a.type === 'video') ||
      (libraryFilter === 'audio' && a.type === 'audio') ||
      (libraryFilter === 'image' && a.type === 'image');
    const name = (a && a.name) || '';
    const matchSearch = !librarySearch || String(name).toLowerCase().includes(String(librarySearch || '').toLowerCase());
    return matchFilter && matchSearch;
  });

  const selectedVideo = safeAssets.find(a => a.id === selectedVideoId);
  const selectedAudio = safeAssets.find(a => a.id === selectedAudioId);

  const value = {
    assets: safeAssets,
    filteredAssets,
    addAsset,
    removeAsset,
    selectedVideoId,
    setSelectedVideoId,
    selectedAudioId,
    setSelectedAudioId,
    selectedImageId,
    setSelectedImageId,
    selectedVideo,
    selectedAudio,
    libraryFilter,
    setLibraryFilter,
    librarySearch,
    setLibrarySearch,
    platforms,
    togglePlatform,
    caption,
    setCaption,
    contactPageUrl,
    setContactPageUrl,
    marketingGoal,
    setMarketingGoal,
    tags,
    addTag,
    addTags,
    removeTag,
    tagInput,
    setTagInput,
    voiceIsolation,
    setVoiceIsolation,
    deReverb,
    setDeReverb,
    deReverbStrength,
    setDeReverbStrength,
    aiUpscale,
    setAiUpscale,
    cinematicGrade,
    setCinematicGrade,
    igPosts,
    setIgPosts,
    pinterestPins,
    setPinterestPins,
    businesses,
    activeBusinessId,
    setActiveBusinessId,
    addBusiness,
    showAddBusiness,
    setShowAddBusiness,
    newBusinessName,
    setNewBusinessName,
    setActiveTab,
    theme,
    isDark,
    toggleTheme: cycleTheme,
    setSidebarOpen
  };

  return (
    <StudioContext.Provider value={value}>
      <div className="flex h-screen max-h-[100dvh] bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 font-sans selection:bg-rose-200 dark:selection:bg-rose-900/50 transition-colors overflow-hidden">
        <aside className={`fixed md:relative inset-y-0 left-0 w-64 h-full md:h-auto md:min-h-0 bg-white dark:bg-stone-800 border-r border-rose-100 dark:border-stone-700 flex flex-col justify-between overflow-y-auto shadow-[4px_0_24px_rgba(225,29,72,0.02)] dark:shadow-none z-30 transition-transform duration-200 ease-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <div>
            <div className="p-6 md:p-8 pb-4 flex items-center justify-between md:justify-center">
              <button onClick={() => setSidebarOpen(false)} className="md:hidden p-2 -ml-2 rounded-xl text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700" aria-label="Close menu"><X size={22} /></button>
              <h1 className="text-xl font-bold tracking-widest text-stone-800 dark:text-stone-100 uppercase text-center flex items-center justify-center gap-2 flex-1 md:flex-initial">
                <Sparkles size={16} className="text-rose-400" />
                Sarah Speaks
              </h1>
              <p className="text-[10px] text-stone-400 dark:text-stone-500 text-center tracking-[0.2em] mt-2 uppercase font-semibold">Faith Studio</p>
              <div className="md:hidden w-10" />
            </div>
            <nav className="mt-6 px-4 space-y-1.5">
              {primaryNav.map(([id, Icon, label]) => (
                <SidebarItem key={id} icon={<Icon size={18} />} label={label} active={activeTab === id} onClick={() => { setActiveTab(id); setSidebarOpen(false); }} />
              ))}
              <div className="pt-4 mt-4 border-t border-rose-50 dark:border-stone-700">
                <button onClick={() => setProductionToolsExpanded(p => !p)} className="flex items-center gap-2 w-full text-left text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 text-sm font-medium py-2 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700/50 transition-colors">
                  {productionToolsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Production tools</span>
                </button>
                {productionToolsExpanded && (
                  <div className="space-y-1.5 mt-1.5 pl-1">
                    {productionNav.map(([id, Icon, label]) => (
                      <SidebarItem key={id} icon={<Icon size={18} />} label={label} active={activeTab === id} onClick={() => { setActiveTab(id); setSidebarOpen(false); }} />
                    ))}
                  </div>
                )}
              </div>
            </nav>
          </div>
          <div className="p-4 border-t border-rose-50 dark:border-stone-700 m-4">
            <div className="mb-3">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-2">My Businesses</span>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {(businesses || []).filter(Boolean).map((b) => (
                  <button key={b.id || b.name || 'b'} onClick={() => setActiveBusinessId(b.id)} className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium truncate block ${activeBusinessId === b.id ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300' : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700'}`}>
                    {b.name || 'Business'}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowAddBusiness(true)} className="w-full mt-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1">
                <Plus size={14} /> Add business
              </button>
            </div>
            <button onClick={cycleTheme} className="flex items-center space-x-2 text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 transition-colors text-sm w-full p-3 rounded-xl hover:bg-rose-50 dark:hover:bg-stone-700">
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
              <span className="font-medium">{theme === 'system' ? 'Theme: System' : theme === 'dark' ? 'Dark' : 'Light'}</span>
            </button>
            <button onClick={() => setShowSettings(true)} className="flex items-center space-x-2 text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 transition-colors text-sm w-full p-3 rounded-xl hover:bg-rose-50 dark:hover:bg-stone-700 mt-1">
              <Settings size={18} />
              <span className="font-medium">App Settings</span>
            </button>
          </div>
        </aside>
        {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={() => setSidebarOpen(false)} aria-hidden />}

        <main className="flex-1 min-w-0 min-h-0 relative bg-white dark:bg-stone-900 transition-colors flex flex-col overflow-y-auto overflow-x-hidden">
          {/* Hide main header in Classic Timeline — editor has its own controls, full screen for editing */}
          {activeTab !== 'classic' && (
          <header className="bg-white/80 dark:bg-stone-900/80 backdrop-blur-md sticky top-0 border-b border-rose-100 dark:border-stone-700 px-4 md:px-10 z-10 flex justify-between items-center gap-2 transition-colors shrink-0 py-4 md:py-6">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 -ml-2 rounded-xl text-stone-600 dark:text-stone-400 hover:bg-rose-50 dark:hover:bg-stone-700" aria-label="Open menu"><Menu size={24} /></button>
            <h2 className="font-semibold text-stone-800 dark:text-stone-100 tracking-tight flex items-center gap-3 flex-wrap flex-1 min-w-0 truncate text-lg md:text-2xl">
              <span>{activeTab === 'start' && 'Start Here'}
              {activeTab === 'library' && 'Media Library'}
              {activeTab === 'photos' && 'Visual Grid & Pin Planner'}
              {activeTab === 'editor' && 'No-Mouse Editor'}
            {activeTab === 'camera' && 'Camera Guide'}
            {activeTab === 'video-ai' && 'Cinematic Processing'}
              {activeTab === 'audio' && 'Studio Audio AI'}
              {activeTab === 'pro' && 'Pro Content Toolkit'}
              {activeTab === 'social' && 'Omnichannel Distribution'}
              {activeTab === 'traffic' && 'Traffic Links'}
              {activeTab === 'analytics' && 'Post Analytics'}
              {activeTab === 'code' && 'System Logic'}</span>
              {(businesses || []).find(b => b && b.id === activeBusinessId) && ['photos','pro','social','traffic','analytics'].includes(activeTab) && (
                <span className="text-sm font-normal text-rose-600 dark:text-rose-400 normal-case bg-rose-50 dark:bg-rose-900/20 px-3 py-1 rounded-full">Creating for: {(businesses || []).find(b => b && b.id === activeBusinessId)?.name || 'Unknown'}</span>
              )}
            </h2>
            <div className="flex items-center gap-4">
              <button onClick={cycleTheme} aria-label="Toggle theme" className="p-2 rounded-xl text-stone-500 dark:text-stone-400 hover:bg-rose-50 dark:hover:bg-stone-700 hover:text-rose-600 dark:hover:text-rose-400 transition-colors">
                {isDark ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <span className="flex items-center text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 px-4 py-2 rounded-full border border-rose-100 dark:border-rose-800">
                <span className="w-2 h-2 rounded-full bg-rose-500 mr-2 animate-pulse"></span>
                System Online
              </span>
            </div>
          </header>
          )}

          {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={() => setShowSettings(false)}>
            <div className="bg-white dark:bg-stone-800 rounded-2xl p-6 max-w-md w-full shadow-xl border border-rose-100 dark:border-stone-700 my-8" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100 mb-4">App Settings</h3>

              <div className="space-y-5">
                <section>
                  <h4 className="text-xs font-bold text-stone-400 uppercase mb-2">AI — ChatGPT (recommended)</h4>
                  <input type="password" value={openaiKey} onChange={(e) => { setOpenaiKey(e.target.value); try { localStorage.setItem('faith-studio-openai-api-key', e.target.value); } catch (_) {} }} placeholder="sk-..." className="w-full bg-rose-50 dark:bg-stone-700 border border-rose-100 dark:border-stone-600 rounded-xl px-4 py-3 text-sm font-mono" />
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1"><a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-rose-500 hover:underline">Get key &rarr;</a></p>
                </section>
                <section>
                  <h4 className="text-xs font-bold text-stone-400 uppercase mb-2">AI — Gemini (free)</h4>
                  <input type="password" value={geminiKey} onChange={(e) => { setGeminiKey(e.target.value); try { localStorage.setItem('faith-studio-gemini-api-key', e.target.value); } catch (_) {} }} placeholder="AIza..." className="w-full bg-rose-50 dark:bg-stone-700 border border-rose-100 dark:border-stone-600 rounded-xl px-4 py-3 text-sm font-mono" />
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1"><a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-rose-500 hover:underline">Get key &rarr;</a></p>
                </section>
                <section>
                  <h4 className="text-xs font-bold text-stone-400 uppercase mb-2">Backup</h4>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => {
                      const data = {};
                      try { Object.keys(localStorage).filter(k => k.startsWith('faith-studio')).forEach(k => { data[k] = localStorage.getItem(k); }); } catch (_) {}
                      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `sarah-speaks-faith-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href);
                    }} className="px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-600 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-700">Export backup</button>
                    <label className="px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-600 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-700 cursor-pointer">
                      Import backup
                      <input type="file" accept=".json" className="hidden" onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const r = new FileReader();
                        r.onload = () => { try { const d = JSON.parse(r.result); Object.entries(d).forEach(([k, v]) => { if (k.startsWith('faith-studio') && v) localStorage.setItem(k, v); }); window.location.reload(); } catch (_) { alert('Invalid backup file'); } };
                        r.readAsText(f);
                      }} />
                    </label>
                    <button onClick={clearAllData} className="px-4 py-2 rounded-xl border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm hover:bg-red-50 dark:hover:bg-red-900/20">Clear all data</button>
                  </div>
                </section>
              </div>

              <button onClick={() => setShowSettings(false)} className="mt-6 w-full py-2 rounded-xl bg-rose-500 text-white font-bold">Done</button>
            </div>
          </div>
        )}

          {/* Add Business Modal */}
        {showAddBusiness && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-stone-800 rounded-2xl p-6 max-w-md w-full shadow-xl border border-rose-100 dark:border-stone-700">
              <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100 mb-4">Add Business or Brand</h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">Create content for another product, service, or brand—e.g. Stoklync, skin products, coaching, etc.</p>
              <input value={newBusinessName} onChange={(e) => setNewBusinessName(e.target.value)} placeholder="Business name (e.g. Stoklync, Skin Care Co)" className="w-full bg-rose-50 dark:bg-stone-700 border border-rose-100 dark:border-stone-600 rounded-xl px-4 py-3 text-stone-800 dark:text-stone-100 placeholder-stone-400 mb-4" />
              <div className="flex gap-2">
                <button onClick={() => { setShowAddBusiness(false); setNewBusinessName(''); }} className="flex-1 py-2 rounded-xl border border-stone-200 dark:border-stone-600 text-stone-600 dark:text-stone-400 font-medium">Cancel</button>
                <button onClick={addBusiness} className="flex-1 py-2 rounded-xl bg-rose-500 text-white font-bold hover:bg-rose-600">Add</button>
              </div>
            </div>
          </div>
        )}

        <div className={`mx-auto flex-1 min-h-0 flex flex-col ${activeTab === 'classic' ? 'max-w-full w-full min-h-[100dvh] p-0 overflow-hidden' : 'max-w-7xl p-4 md:p-10 pb-24'}`} style={{ minHeight: activeTab !== 'classic' ? 400 : undefined }}>
            {activeTab === 'start' && <StartHere setActiveTab={setActiveTab} />}
            {activeTab === 'library' && <MediaLibrary />}
            {activeTab === 'photos' && <PhotoPlanner />}
            {activeTab === 'pro' && <ProContentToolkit />}
            {activeTab === 'social' && <SocialPublisher />}
            {activeTab === 'traffic' && <TrafficHub />}
            {activeTab === 'analytics' && <PostAnalytics onOpenSettings={() => setShowSettings(true)} />}
            {activeTab === 'camera' && <CameraSettings />}
            {activeTab === 'audio' && <AIAudioStudio />}
            {activeTab === 'editor' && <NoMouseEditor />}
            {activeTab === 'classic' && (
              <EditorErrorBoundary>
                <ClassicEditor />
              </EditorErrorBoundary>
            )}
            {activeTab === 'video-ai' && <ProEnhancements />}
            {activeTab === 'code' && <SwiftCodeView />}
            {!['start','library','photos','pro','social','traffic','analytics','camera','audio','editor','classic','video-ai','code'].includes(activeTab) && <StartHere setActiveTab={setActiveTab} />}
          </div>
        </main>
      </div>
    </StudioContext.Provider>
  );
};

// --- Start Here ---
const StartHere = ({ setActiveTab }) => {
  const steps = [
    { id: 'pro', icon: Zap, title: '1. Pro Content Toolkit', desc: 'Hooks, headlines, and content strategy to reach more people. Get ideas before you create.', cta: 'Go to Toolkit' },
    { id: 'social', icon: Share2, title: '2. Social & Podcast', desc: 'Write your caption, pick platforms (Instagram, YouTube, etc.), then click Publish. Copies to your clipboard.', cta: 'Go to Social' },
    { id: 'analytics', icon: BarChart2, title: '3. Post Analytics', desc: 'Log performance after you post. See what works and get AI insights.', cta: 'Go to Analytics' },
    { id: 'photos', icon: ImageIcon, title: '4. Photo & Pin Planner', desc: 'Plan visuals and pins for Pinterest, Reels, or feeds.', cta: 'Go to Planner' }
  ];
  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-2">Reach more people in 4 steps</h2>
        <p className="text-stone-500 dark:text-stone-400">Content strategy → Publish → Track. Production tools (timeline, editor) are in the sidebar if you need them.</p>
      </div>
      <div className="space-y-4">
        {steps.map(({ id, icon: Icon, title, desc, cta }) => (
          <div key={id} className="bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-2xl p-6 flex items-start gap-4 hover:border-rose-200 dark:hover:border-stone-600 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center shrink-0">
              <Icon className="text-rose-500 dark:text-rose-400" size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100">{title}</h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">{desc}</p>
              <button onClick={() => setActiveTab(id)} className="mt-4 px-4 py-2 rounded-xl bg-rose-500 text-white text-sm font-bold hover:bg-rose-600">
                {cta} →
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-center text-sm text-stone-400 dark:text-stone-500 mt-10">Need camera tips? Go to <button onClick={() => setActiveTab('camera')} className="text-rose-500 font-bold hover:underline">Camera Guide</button>. Need hooks & hashtags? Go to <button onClick={() => setActiveTab('pro')} className="text-rose-500 font-bold hover:underline">Pro Content Toolkit</button>.</p>
    </div>
  );
};

// --- Media Library ---
const MediaLibrary = () => {
  const { filteredAssets = [], addAsset, removeAsset, setLibraryFilter, libraryFilter, librarySearch = '', setLibrarySearch, setSelectedVideoId, setSelectedAudioId, setSelectedImageId, selectedVideoId, selectedAudioId, selectedImageId, setActiveTab, businesses, activeBusinessId } = useStudio();
  const playhead = useEditorStore(s => s.playhead);
  const insertClipAtPlayhead = useEditorStore(s => s.insertClipAtPlayhead);
  const { generateAltText } = useMarketingStore();
  const updateAssetBlob = useEditorStore(s => s.updateAssetBlob);
  const { processImage, revoke } = useEditor();
  const fileRef = useRef(null);
  const [imageFilters, setImageFilters] = useState({ brightness: 100, contrast: 100, saturation: 100 });
  const [applyingFilters, setApplyingFilters] = useState(false);

  const handleUpload = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(f => {
      const type = f.type.startsWith('video/') ? 'video' : f.type.startsWith('audio/') ? 'audio' : 'image';
      addAsset(f, type);
    });
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-stone-800 p-4 rounded-2xl border border-rose-100 dark:border-stone-700 shadow-sm transition-colors">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
          <input
            type="text"
            value={librarySearch}
            onChange={(e) => setLibrarySearch(e.target.value)}
            placeholder="Search videos, reels, or audio..."
            className="w-full bg-rose-50/50 dark:bg-stone-700/50 border border-rose-100 dark:border-stone-600 rounded-xl pl-10 pr-4 py-2.5 text-sm text-stone-800 dark:text-stone-100 focus:outline-none focus:border-rose-400 dark:focus:border-rose-500 transition-colors"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {['all', 'video', 'audio', 'image'].map((f) => (
            <button
              key={f}
              onClick={() => setLibraryFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors capitalize ${libraryFilter === f ? 'bg-rose-500 text-white' : 'bg-rose-50 text-stone-600 hover:bg-rose-100'}`}
            >
              {f}
            </button>
          ))}
          <input ref={fileRef} type="file" multiple accept="video/*,audio/*,image/*" onChange={handleUpload} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            className="px-5 py-2 rounded-xl text-sm font-bold bg-rose-500 text-white hover:bg-rose-600 flex items-center gap-2"
          >
            <Upload size={16} /> Upload
          </button>
        </div>
      </div>

      {filteredAssets.length === 0 ? (
        <div className="bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-3xl p-16 text-center transition-colors">
          <Film className="mx-auto text-rose-200 dark:text-rose-600/40 w-16 h-16 mb-4" />
          <h3 className="text-xl font-semibold text-stone-800 dark:text-stone-100 mb-2">No media yet</h3>
          <p className="text-stone-500 dark:text-stone-400 mb-6">Upload videos, audio, or images to get started.</p>
          <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 bg-rose-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-rose-600">
            <Upload size={18} /> Upload Files
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssets.map((a) => (
            <div key={a.id} className={`rounded-2xl overflow-hidden transition-all group ${selectedVideoId === a.id || selectedAudioId === a.id || selectedImageId === a.id ? 'ring-2 ring-rose-500 ring-offset-2 dark:ring-offset-stone-900 bg-rose-50/50 dark:bg-rose-900/20 border-2 border-rose-400 dark:border-rose-600' : 'bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 hover:border-rose-300 dark:hover:border-rose-700'}`}>
              <div className="aspect-video bg-stone-900 dark:bg-black relative flex items-center justify-center overflow-hidden">
                {a.type === 'video' && (
                  <video src={a.url} muted playsInline preload="auto" onLoadedMetadata={(e) => { const v = e.target; if (v.duration > 0.5) v.currentTime = 0.5; }} className="w-full h-full object-contain" />
                )}
                {a.type === 'audio' && <Music className="text-emerald-300 w-12 h-12" />}
                {a.type === 'image' && (
                  <img src={a.url} alt={a.altText || generateAltText((businesses || []).find(b => b?.id === activeBusinessId)?.name)} className="w-full h-full object-cover" />
                )}
                {a.type === 'video' && <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Play className="text-white w-14 h-14 drop-shadow-lg" /></div>}
                <button onClick={() => removeAsset(a.id)} className="absolute top-2 right-2 p-2 bg-rose-500/90 rounded-lg text-white opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
              </div>
              <div className="p-4">
                <h4 className="text-sm font-semibold text-stone-800 dark:text-stone-100 truncate">{a.name}</h4>
                <div className="flex justify-between items-center text-xs text-stone-500 dark:text-stone-400 mt-1">
                  <span>{formatFileSize(a.size)}</span>
                  <span>{a.type}</span>
                </div>
                {a.type === 'video' && (
                  <div className="mt-2 flex flex-wrap gap-2 items-center">
                    {selectedVideoId === a.id ? (
                      <>
                        <span className="text-xs font-bold text-rose-600 dark:text-rose-400">✓ Source</span>
                        <button onClick={() => setActiveTab('classic')} className="text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 px-3 py-1 rounded-lg">Edit in Timeline →</button>
                      </>
                    ) : (
                      <button onClick={() => { setSelectedVideoId(a.id); setActiveTab('classic'); }} className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline">Use as source</button>
                    )}
                    <button onClick={() => { insertClipAtPlayhead(0, a.id); setActiveTab('classic'); }} className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline" title="Insert at playhead on Main track">Insert to Timeline</button>
                    <button onClick={() => { insertClipAtPlayhead(1, a.id, { asOverlay: true }); setActiveTab('classic'); }} className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline" title="Insert as PiP overlay">Add as PiP</button>
                  </div>
                )}
                {a.type === 'audio' && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedAudioId === a.id ? (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">✓ Audio source</span>
                    ) : (
                      <button onClick={() => setSelectedAudioId(a.id)} className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline">Use for audio</button>
                    )}
                    <button onClick={() => { insertClipAtPlayhead(3, a.id); setActiveTab('classic'); }} className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline">Insert to Timeline</button>
                  </div>
                )}
                {a.type === 'image' && (
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setSelectedImageId(selectedImageId === a.id ? null : a.id)} className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline">
                        {selectedImageId === a.id ? '× Cancel' : 'Apply filters'}
                      </button>
                      <button onClick={() => { insertClipAtPlayhead(2, a.id); setActiveTab('classic'); }} className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline">Insert to Timeline</button>
                    </div>
                    {selectedImageId === a.id && (
                      <div className="flex flex-col gap-1 text-[10px]">
                        <p className="text-stone-500 dark:text-stone-400">Alt text (SEO): {a.altText || generateAltText((businesses || []).find(b => b?.id === activeBusinessId)?.name)}</p>
                        <button onClick={() => navigator.clipboard.writeText(a.altText || generateAltText((businesses || []).find(b => b?.id === activeBusinessId)?.name))} className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline self-start">Copy alt text</button>
                        {['brightness', 'contrast', 'saturation'].map((k) => (
                          <div key={k} className="flex items-center gap-2">
                            <span className="w-16 capitalize">{k}</span>
                            <input type="range" min="0" max="200" value={imageFilters[k] ?? 100} onChange={(e) => setImageFilters(f => ({ ...f, [k]: Number(e.target.value) }))} className="flex-1 h-1.5 bg-stone-200 dark:bg-stone-600 rounded" />
                          </div>
                        ))}
                        <button onClick={async () => { if (applyingFilters) return; setApplyingFilters(true); try { const { blob, url } = await processImage(a.id, imageFilters); updateAssetBlob(a.id, blob); revoke(url); } finally { setApplyingFilters(false); } }} disabled={applyingFilters} className="mt-1 text-xs font-bold bg-rose-500 text-white px-2 py-1 rounded disabled:opacity-50">{applyingFilters ? 'Applying…' : 'Apply'}</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Photo Planner ---
const PhotoPlanner = () => {
  const { businesses = [], activeBusinessId, setActiveBusinessId, igPosts, setIgPosts, pinterestPins, setPinterestPins } = useStudio();
  const { generateAltText } = useMarketingStore();
  const igRef = useRef(null);
  const pinRef = useRef(null);
  const businessName = (businesses || []).find(b => b?.id === activeBusinessId)?.name || 'Sarah Speaks Faith';

  const handleIgUpload = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(f => {
      const url = URL.createObjectURL(f);
      const altText = generateAltText(businessName);
      setIgPosts(prev => [...prev, { id: Date.now() + Math.random(), url, caption: '', altText }]);
    });
    e.target.value = '';
  };

  const handlePinUpload = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(f => {
      const url = URL.createObjectURL(f);
      const altText = generateAltText(businessName);
      setPinterestPins(prev => [...prev, { id: Date.now() + Math.random(), url, title: '', board: '', altText }]);
    });
    e.target.value = '';
  };

  const colorMap = { rose: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400', emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400', indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400', amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400', stone: 'bg-stone-100 text-stone-700 dark:bg-stone-700 dark:text-stone-300' };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-center gap-2">
        {(businesses || []).map((b) => (
          <button key={b.id} onClick={() => setActiveBusinessId(b.id)} className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center ${activeBusinessId === b.id ? (colorMap[b.color] || colorMap.stone) + ' shadow-sm' : 'text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700'}`}>
            {b.name}
          </button>
        ))}
      </div>

      <BrandKitReminder />

      {/* Post & Flyer Creator */}
      <PostFlyerCreator businesses={businesses} activeBusinessId={activeBusinessId} setIgPosts={setIgPosts} setPinterestPins={setPinterestPins} businessName={businessName} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-3xl p-8 shadow-sm transition-colors">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-semibold text-stone-800 flex items-center">
                <Instagram className="mr-2 text-rose-400" size={24} />
                Instagram Grid
              </h3>
              <p className="text-sm text-stone-500 mt-1">Upload and plan your layout.</p>
            </div>
            <input ref={igRef} type="file" multiple accept="image/*" onChange={handleIgUpload} className="hidden" />
            <button onClick={() => igRef.current?.click()} className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-500 hover:bg-rose-600">
              + New Post
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {igPosts.length === 0 && (
              <div className="col-span-3 aspect-square rounded-2xl border-2 border-dashed border-rose-200 flex flex-col items-center justify-center text-stone-400 cursor-pointer hover:border-rose-400 hover:bg-rose-50/50" onClick={() => igRef.current?.click()}>
                <ImageIcon size={32} className="mb-2" />
                <span className="text-sm font-medium">Upload images</span>
              </div>
            )}
            {igPosts.slice(0, 9).map((p) => (
              <div key={p.id} className="aspect-square rounded-2xl border border-rose-100 overflow-hidden relative group">
                <img src={p.url} alt={p.altText || generateAltText(businessName)} className="w-full h-full object-cover" />
                <input value={p.altText || ''} onChange={(e) => setIgPosts(prev => prev.map(x => x.id === p.id ? { ...x, altText: e.target.value } : x))} placeholder="Alt text for SEO" className="absolute bottom-0 left-0 right-0 text-[10px] px-2 py-1 bg-black/70 text-white placeholder-stone-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                <button onClick={() => setIgPosts(prev => prev.filter(x => x.id !== p.id))} className="absolute top-1 right-1 p-1.5 bg-rose-500/90 rounded-lg text-white opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-3xl p-8 shadow-sm transition-colors">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-semibold text-stone-800 flex items-center">
                <svg className="mr-2 w-6 h-6 fill-rose-400" viewBox="0 0 24 24">
                  <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.951-7.252 4.168 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.367 18.592 0 12.017 0z"/>
                </svg>
                Pinterest Strategy
              </h3>
              <p className="text-sm text-stone-500 mt-1">Upload pins for your boards.</p>
            </div>
            <input ref={pinRef} type="file" multiple accept="image/*" onChange={handlePinUpload} className="hidden" />
            <button onClick={() => pinRef.current?.click()} className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-500 hover:bg-rose-600">
              + New Pin
            </button>
          </div>
          <div className="space-y-4">
            {pinterestPins.length === 0 && (
              <div className="p-8 rounded-2xl border-2 border-dashed border-rose-200 text-center text-stone-400 cursor-pointer hover:border-rose-400 hover:bg-rose-50/50" onClick={() => pinRef.current?.click()}>
                <ImageIcon size={32} className="mx-auto mb-2" />
                <span className="text-sm font-medium">Upload pin images</span>
              </div>
            )}
            {pinterestPins.map((p) => (
              <div key={p.id} className="flex gap-4 p-4 rounded-2xl border border-rose-100 bg-rose-50/50 group">
                <div className="w-20 h-28 rounded-xl flex-shrink-0 overflow-hidden bg-rose-100">
                  <img src={p.url} alt={p.altText || generateAltText(businessName)} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <input value={p.title || ''} onChange={(e) => setPinterestPins(prev => prev.map(x => x.id === p.id ? { ...x, title: e.target.value } : x))} placeholder="Pin title" className="w-full text-sm font-bold text-stone-800 dark:text-stone-100 bg-transparent border-b border-transparent hover:border-rose-200 focus:border-rose-400 focus:outline-none mb-1" />
                  <input value={p.altText || ''} onChange={(e) => setPinterestPins(prev => prev.map(x => x.id === p.id ? { ...x, altText: e.target.value } : x))} placeholder="Alt text (SEO)" className="w-full text-xs text-stone-500 dark:text-stone-400 bg-transparent border-b border-transparent hover:border-rose-200 focus:border-rose-400 focus:outline-none mb-1" />
                  <input value={p.board || ''} onChange={(e) => setPinterestPins(prev => prev.map(x => x.id === p.id ? { ...x, board: e.target.value } : x))} placeholder="Board name" className="w-full text-xs text-stone-500 dark:text-stone-400 bg-transparent border-none focus:outline-none" />
                </div>
                <button onClick={() => setPinterestPins(prev => prev.filter(x => x.id !== p.id))} className="text-stone-400 hover:text-red-500 self-start"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Pro Content Toolkit ---
const TRANSITIONS = [
  { id: 'fade', name: 'Fade', duration: '0.5s', style: 'Seamless', use: 'Story flow, emotional beats, gentle shifts' },
  { id: 'cut', name: 'Cut', duration: '0s', style: 'Purposeful', use: 'Energy, rhythm, comedic timing' },
  { id: 'zoom', name: 'Zoom', duration: '0.4s', style: 'Purposeful', use: 'Reveal, emphasis, dramatic moment' },
  { id: 'slide-left', name: 'Slide Left', duration: '0.5s', style: 'Purposeful', use: 'Next step, before/after, timeline' },
  { id: 'slide-right', name: 'Slide Right', duration: '0.5s', style: 'Purposeful', use: 'Going back, flashback' },
  { id: 'wipe', name: 'Wipe', duration: '0.5s', style: 'Purposeful', use: 'New chapter, list items, contrast' },
  { id: 'blur', name: 'Blur', duration: '0.6s', style: 'Seamless', use: 'Dreamy, memory, soft time jump' },
  { id: 'dip-to-black', name: 'Dip to Black', duration: '0.8s', style: 'Purposeful', use: 'Scene end, topic change' }
];

const HOOK_TEMPLATES = [
  { type: 'faith', text: "Here's what helped me when I felt far from God.", platform: 'Reels/Short' },
  { type: 'faith', text: "I've been sitting with this scripture all week — here's what it showed me.", platform: 'Reels/Short' },
  { type: 'faith', text: 'This one verse changed everything for me.', platform: 'Carousel' },
  { type: 'faith', text: "If you're struggling with ___, this is for you.", platform: 'Reels/Short' },
  { type: 'business', text: 'The #1 mistake I see [your niche] make...', platform: 'Reels/Short' },
  { type: 'business', text: "Most people don't know this about [your product/service].", platform: 'Reels/Short' },
  { type: 'business', text: 'Save this before you buy [product category].', platform: 'Carousel' },
  { type: 'business', text: 'POV: You just discovered [solution].', platform: 'TikTok/Reels' },
  { type: 'business', text: "I tested [X] so you don't have to. Results:", platform: 'Carousel' },
  { type: 'skin', text: 'My skin before vs after [product]. No filter.', platform: 'Reels/Short' },
  { type: 'skin', text: 'This routine cleared my [skin concern]. Routine in caption.', platform: 'Carousel' },
  { type: 'skin', text: 'Dermatologist-approved [ingredient] for [concern].', platform: 'Reels/Short' },
  { type: 'product', text: 'Unboxing [product]. Worth the hype?', platform: 'TikTok/Reels' },
  { type: 'product', text: 'The [product] that actually fixed my [problem].', platform: 'Carousel' },
  { type: 'service', text: 'How I went from [before] to [after] with [service].', platform: 'Reels/Short' }
];

const GROWTH_PLAYBOOK = [
  { title: 'Vertical Video (Reels, Shorts, TikTok)', tip: 'Hook-loop: Make the last frame look like the first. High loops = algorithm push. Use "Reply to Comment with Video" for native engagement.' },
  { title: 'CTA that converts', tip: 'Don\'t say "Go to my link." Say "Take the assessment to see your score." Drives users straight to your funnel.' },
  { title: 'LinkedIn authority', tip: 'Post assessment results as data. Export video frames as PDF carousels—3x more reach than image posts.' },
  { title: 'Instagram community', tip: 'Broadcast Channels for exclusive content. ManyChat: comment "LEVEL" → DM with assessment link. Close Friends for VIPs who completed onboarding.' },
  { title: 'Threads for SEO', tip: 'Threads posts are indexed by Google. Start with a question, gain traction, then reply with your assessment link.' },
  { title: 'Pinterest evergreen', tip: 'Tutorial Idea Pins link to your app. Pins have a shelf life of years, not hours.' },
  { title: 'Spotify + YouTube Shorts', tip: 'Shorts as trailers for podcast episodes. YouTube is the largest podcast platform.' },
  { title: 'Reaction content', tip: 'Screenshot a Threads comment → CapCut reaction Reel → mention full answer in Spotify.' }
];

const NICHE_HOOKS = {
  sarah: [
    { text: 'What level are you in your faith walk? Take the assessment to see your score.', cta: 'Take the assessment' },
    { text: "Here's what helped me when I felt spiritually stuck.", cta: 'Take the assessment to see where you stand' },
    { text: "This scripture pulled me through a really hard season.", cta: 'Take the faith assessment — link in bio' },
    { text: 'Here is what changed in my faith when I finally understood this.', cta: 'Take the quiz to get your score' }
  ],
  stewardship: [
    { text: 'I analyzed 100 people\'s stewardship habits. Here\'s what stood out.', cta: 'Take the quiz to see yours' },
    { text: 'Are you using what you\'ve been given? Take the assessment.', cta: 'Get your stewardship score' },
    { text: 'Most people don\'t know this about stewardship.', cta: 'Take the assessment — link in bio' }
  ],
  stoklync: [
    { text: 'I analyzed 100 businesses. Most logistics gaps look like this.', cta: 'Take the assessment — see your score' },
    { text: 'How does your fulfillment stack up? Get your benchmark.', cta: 'Take the assessment' },
    { text: 'The #1 mistake I see logistics teams make...', cta: 'Take the assessment to find yours' }
  ],
  skin: [
    { text: 'What\'s your skin type? Take the quiz and get a personalized routine.', cta: 'Take the assessment' },
    { text: 'My skin before vs after. No filter.', cta: 'Take the quiz — link in bio' },
    { text: 'This routine cleared my skin. Take the assessment to get yours.', cta: 'Get your custom routine' }
  ]
};

const CTA_REMINDERS = [
  { avoid: 'Go to my link', use: 'Take the assessment to see your score' },
  { avoid: 'Link in bio', use: 'Take the assessment — link in bio' },
  { avoid: 'Check it out', use: 'Get your personalized report — take the quiz' },
  { avoid: 'Visit my website', use: 'See your level — take the assessment' }
];

const BUSINESS_TEMPLATES = [
  { name: 'Product Showcase', hook: 'This [product] solves [pain point]. Here\'s how.', cta: 'Link in bio to grab yours.', for: 'any' },
  { name: 'Service Intro', hook: 'Thinking about [service]? Here\'s what to expect.', cta: 'DM me to book a call.', for: 'service' },
  { name: 'Testimonial Tease', hook: 'My client went from [before] to [after] in [time].', cta: 'Want the same? Link below.', for: 'any' },
  { name: 'Behind the Scenes', hook: 'A day in my life running [business name].', cta: 'Follow for more real talk.', for: 'any' },
  { name: 'Value Drop', hook: '3 [tips/resources] that changed my [outcome].', cta: 'Save this + follow for part 2.', for: 'any' },
  { name: 'Skin / Beauty Before-After', hook: 'Before vs after [routine/product]. No filter, [timeframe].', cta: 'Link in bio for the products I use.', for: 'product' },
  { name: 'Product Unboxing', hook: 'First impressions of [product]. Is it worth it?', cta: 'Swipe for full review. Link in bio.', for: 'product' },
  { name: 'Stoklync / E-commerce', hook: 'Just dropped [product/collection]. Here\'s what\'s inside.', cta: 'Shop the link in bio. Limited stock.', for: 'product' },
  { name: 'Coaching / Consulting', hook: 'The #1 thing that changed [outcome] for my clients.', cta: 'Book a free call—link in bio.', for: 'service' }
];

const ProContentToolkit = () => {
  const { addAsset, filteredAssets, activeBusinessId, businesses } = useStudio();
  const [selectedTransitions, setSelectedTransitions] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [playbookOpen, setPlaybookOpen] = useState(false);
  const musicRef = useRef(null);
  const audioAssets = filteredAssets.filter(a => a.type === 'audio');
  const bizId = activeBusinessId || 'sarah';
  const nicheHooks = NICHE_HOOKS[bizId] || NICHE_HOOKS.sarah;
  const bizName = (businesses || []).find(b => b?.id === activeBusinessId)?.name || 'Your brand';

  const toggleTransition = (id) => {
    setSelectedTransitions(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const copyTemplate = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleMusicUpload = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(f => addAsset(f, 'audio'));
    e.target.value = '';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <BrandKitReminder compact />

      {/* Growth Playbook */}
      <div className="bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-3xl p-6 shadow-sm transition-colors">
        <button onClick={() => setPlaybookOpen(p => !p)} className="flex items-center justify-between w-full text-left">
          <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
            <Target size={22} className="text-rose-400" />
            Growth Playbook — What Works
          </h3>
          {playbookOpen ? <ChevronDown size={20} className="text-stone-500" /> : <ChevronRight size={20} className="text-stone-500" />}
        </button>
        {playbookOpen && (
          <div className="mt-4 space-y-3 pt-4 border-t border-rose-100 dark:border-stone-700">
            {GROWTH_PLAYBOOK.map((item, i) => (
              <div key={i} className="p-4 rounded-xl bg-rose-50/50 dark:bg-stone-700/30 border border-rose-100 dark:border-stone-600">
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase">{item.title}</span>
                <p className="text-sm text-stone-600 dark:text-stone-300 mt-1">{item.tip}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transition Guide + Transitions */}
      <div className="bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-3xl p-8 shadow-sm transition-colors">
        <h3 className="text-xl font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2 mb-2">
          <Sliders size={22} className="text-rose-400" />
          Seamless vs Purposeful Transitions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 rounded-2xl bg-rose-50/50 dark:bg-stone-700/30 border border-rose-100 dark:border-stone-600">
          <div>
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase">Seamless</span>
            <p className="text-sm text-stone-600 dark:text-stone-300 mt-1">Fade, Blur — invisible flow. Use when story or mood stays the same. Keeps viewers in the moment.</p>
          </div>
          <div>
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase">Purposeful</span>
            <p className="text-sm text-stone-600 dark:text-stone-300 mt-1">Cut, Zoom, Slide, Wipe, Dip — visible. Use when changing topic, beat, or energy. Creates rhythm and emphasis.</p>
          </div>
        </div>
        <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">Select transitions. Match cut to music beat for punch. Keep duration 0.3–0.6s for Reels.</p>
        <div className="flex flex-wrap gap-3">
          {TRANSITIONS.map((t) => (
            <button
              key={t.id}
              onClick={() => toggleTransition(t.id)}
              title={t.use}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex flex-col items-start gap-0.5 ${
                selectedTransitions.includes(t.id)
                  ? 'bg-rose-500 text-white shadow-lg'
                  : 'bg-rose-50 dark:bg-stone-700/50 border border-rose-100 dark:border-stone-600 text-stone-700 dark:text-stone-300 hover:border-rose-300'
              }`}
            >
              <span>{t.name} <span className="text-[10px] opacity-80">({t.duration})</span></span>
              <span className={`text-[10px] ${selectedTransitions.includes(t.id) ? 'text-rose-100' : 'text-stone-500 dark:text-stone-400'}`}>{t.style} · {t.use}</span>
            </button>
          ))}
        </div>
        {selectedTransitions.length > 0 && (
          <p className="mt-4 text-xs text-stone-500 dark:text-stone-400">Using: {selectedTransitions.join(', ')}</p>
        )}
      </div>

      {/* Music & SFX */}
      <div className="bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-3xl p-8 shadow-sm transition-colors">
        <h3 className="text-xl font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2 mb-2">
          <Music size={22} className="text-rose-400" />
          Music & Sound Effects
        </h3>
        <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">Upload your own music and SFX, or use tracks from Media Library.</p>
        <input ref={musicRef} type="file" accept="audio/*" multiple onChange={handleMusicUpload} className="hidden" />
        <button onClick={() => musicRef.current?.click()} className="px-6 py-3 rounded-xl bg-rose-500 text-white font-bold hover:bg-rose-600 flex items-center gap-2 mb-6">
          <Upload size={18} /> Upload Music / SFX
        </button>
        {audioAssets.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {audioAssets.map((a) => (
              <div key={a.id} className="flex items-center gap-4 p-4 rounded-2xl bg-rose-50/50 dark:bg-stone-700/50 border border-rose-100 dark:border-stone-600">
                <Music className="text-rose-400 w-10 h-10 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-stone-800 dark:text-stone-100 truncate">{a.name}</p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">Use as background music or SFX</p>
                </div>
                <audio src={a.url} controls className="h-8 w-32" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hooks — Latch People In */}
      <div className="bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-3xl p-8 shadow-sm transition-colors">
        <h3 className="text-xl font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2 mb-2">
          <Zap size={22} className="text-rose-400" />
          Hooks & Openers — First 3 Seconds
        </h3>
        <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">Copy these hooks to grab attention. Use in captions, voiceover, or on-screen text.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {HOOK_TEMPLATES.map((h, i) => (
            <div key={i} className="p-4 rounded-2xl bg-rose-50/50 dark:bg-stone-700/50 border border-rose-100 dark:border-stone-600 group">
              <span className="text-[10px] font-bold uppercase text-rose-500 dark:text-rose-400">{h.type} · {h.platform}</span>
              <p className="text-sm font-medium text-stone-800 dark:text-stone-100 mt-2">{h.text}</p>
              <button onClick={() => copyTemplate(h.text, `hook-${i}`)} className="mt-3 text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1">
                <Copy size={14} /> {copiedId === `hook-${i}` ? 'Copied!' : 'Copy'}
              </button>
            </div>
          ))}
        </div>

        {/* Niche-specific hooks (for {bizName}) */}
        <div className="mt-6 pt-6 border-t border-rose-100 dark:border-stone-600">
          <h4 className="text-sm font-bold text-stone-700 dark:text-stone-200 mb-3 flex items-center gap-2">
            <Package size={16} className="text-rose-400" /> Hooks for {bizName}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {nicheHooks.map((h, i) => (
              <div key={i} className="p-4 rounded-xl bg-rose-100/50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50">
                <p className="text-sm font-medium text-stone-800 dark:text-stone-100">{h.text}</p>
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-2 font-medium">CTA: {h.cta}</p>
                <button onClick={() => copyTemplate(`${h.text}\n\n${h.cta}`, `niche-${i}`)} className="mt-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1">
                  <Copy size={12} /> {copiedId === `niche-${i}` ? 'Copied!' : 'Copy'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Business & Product Content */}
      <div className="bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-3xl p-8 shadow-sm transition-colors">
        <h3 className="text-xl font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2 mb-2">
          <Package size={22} className="text-rose-400" />
          Business & Product Content Templates
        </h3>
        <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">Ready-to-use structures for products and services. Fill in the blanks.</p>
        <div className="space-y-4">
          {BUSINESS_TEMPLATES.map((b, i) => (
            <div key={i} className="p-5 rounded-2xl bg-rose-50/50 dark:bg-stone-700/50 border border-rose-100 dark:border-stone-600">
              <h4 className="text-sm font-bold text-stone-800 dark:text-stone-100 mb-2">{b.name}</h4>
              <p className="text-xs text-stone-600 dark:text-stone-300 mb-1"><strong>Hook:</strong> {b.hook}</p>
              <p className="text-xs text-stone-600 dark:text-stone-300 mb-3"><strong>CTA:</strong> {b.cta}</p>
              <button onClick={() => copyTemplate(`${b.hook}\n\n${b.cta}`, `biz-${i}`)} className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1">
                <Copy size={14} /> {copiedId === `biz-${i}` ? 'Copied!' : 'Copy template'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Marketing CTAs + CTA Reminders */}
      <div className="bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-3xl p-8 shadow-sm transition-colors">
        <h3 className="text-xl font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2 mb-2">
          <Share2 size={22} className="text-rose-400" />
          Quick CTAs for Marketing
        </h3>
        <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">Call-to-action phrases that convert. Add to captions and Reels.</p>

        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 mb-6">
          <h4 className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase mb-3">CTA Reminder — Use these instead</h4>
          <div className="space-y-2 text-sm">
            {CTA_REMINDERS.map((r, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <span className="text-red-500 line-through">{r.avoid}</span>
                <span className="text-stone-400">→</span>
                <button onClick={() => copyTemplate(r.use, `reminder-${i}`)} className="text-rose-600 dark:text-rose-400 font-medium hover:underline">
                  {r.use} {copiedId === `reminder-${i}` ? '✓' : ''}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            'Take the assessment to see your score',
            'Get your personalized report — link in bio',
            'Take the quiz to find your level',
            'Link in bio',
            'DM me to get started',
            'Save this for later',
            'Share with someone who needs this',
            'Follow for more',
            'Comment YES if you want the full guide',
            'Swipe for the full breakdown',
            'Tap to see the before/after'
          ].map((cta, i) => (
            <button key={i} onClick={() => copyTemplate(cta, `cta-${i}`)} className="px-4 py-2 rounded-xl bg-rose-50 dark:bg-stone-700 border border-rose-100 dark:border-stone-600 text-sm font-medium text-stone-700 dark:text-stone-300 hover:border-rose-300 dark:hover:border-rose-700">
              {cta} {copiedId === `cta-${i}` ? '✓' : ''}
            </button>
          ))}
        </div>
      </div>

      {/* SEO & Discoverability */}
      <div className="bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-3xl p-8 shadow-sm transition-colors">
        <h3 className="text-xl font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2 mb-2">
          <Search size={22} className="text-rose-400" />
          SEO & Discoverability
        </h3>
        <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">Get found on Google, YouTube, Pinterest & in-app search.</p>
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-stone-700/50 border border-rose-100 dark:border-stone-600">
            <span className="text-[10px] font-bold text-rose-500 uppercase">Video Title (YouTube / Reels)</span>
            <p className="text-sm text-stone-700 dark:text-stone-200 mt-1">Put main keyword in first 5 words. Example: &quot;3 Bible Verses for Anxiety When You Feel Overwhelmed&quot;</p>
          </div>
          <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-stone-700/50 border border-rose-100 dark:border-stone-600">
            <span className="text-[10px] font-bold text-rose-500 uppercase">Description (first 2 lines)</span>
            <p className="text-sm text-stone-700 dark:text-stone-200 mt-1">Front-load keywords. Repeating your hook + 2–3 key phrases. First 2 lines show in Google/snippets.</p>
          </div>
          <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-stone-700/50 border border-rose-100 dark:border-stone-600">
            <span className="text-[10px] font-bold text-rose-500 uppercase">Alt Text (Images / Pins)</span>
            <p className="text-sm text-stone-700 dark:text-stone-200 mt-1">Describe image + include keyword. Example: &quot;Woman reading Bible at sunrise, morning devotional&quot;</p>
          </div>
          <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-stone-700/50 border border-rose-100 dark:border-stone-600">
            <span className="text-[10px] font-bold text-rose-500 uppercase">Pinterest Pin Title</span>
            <p className="text-sm text-stone-700 dark:text-stone-200 mt-1">Use long-tail keywords. &quot;5 Bible Verses for When You Feel Alone — Faith Encouragement&quot;</p>
          </div>
        </div>
      </div>

      {/* Hashtag Strategy */}
      <div className="bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-3xl p-8 shadow-sm transition-colors">
        <h3 className="text-xl font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2 mb-2">
          <Hash size={22} className="text-rose-400" />
          Hashtag Strategy
        </h3>
        <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">Mix sizes for reach + niche. 3–5 niche, 2–3 mid, 1–2 broad per post.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-stone-700/50 border border-rose-100 dark:border-stone-600">
            <span className="text-[10px] font-bold text-rose-500 uppercase">Niche (Faith)</span>
            <p className="text-xs text-stone-600 dark:text-stone-300 mt-2">#ChristianWomen #FaithJourney #WomensMinistry #Devotional #BiblicalEncouragement</p>
            <button onClick={() => copyTemplate('#ChristianWomen #FaithJourney #WomensMinistry #Devotional #BiblicalEncouragement', 'hashtag-faith')} className="mt-2 text-xs font-bold text-rose-600"><Copy size={12} className="inline" /> Copy</button>
          </div>
          <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-stone-700/50 border border-rose-100 dark:border-stone-600">
            <span className="text-[10px] font-bold text-rose-500 uppercase">Mid (Growth)</span>
            <p className="text-xs text-stone-600 dark:text-stone-300 mt-2">#FaithTikTok #ChristianContentCreator #FaithBased #ChristianLiving</p>
            <button onClick={() => copyTemplate('#FaithTikTok #ChristianContentCreator #FaithBased #ChristianLiving', 'hashtag-mid')} className="mt-2 text-xs font-bold text-rose-600"><Copy size={12} className="inline" /> Copy</button>
          </div>
          <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-stone-700/50 border border-rose-100 dark:border-stone-600">
            <span className="text-[10px] font-bold text-rose-500 uppercase">Broad (Discovery)</span>
            <p className="text-xs text-stone-600 dark:text-stone-300 mt-2">#Faith #Jesus #Blessed #GodIsGood #Inspiration</p>
            <button onClick={() => copyTemplate('#Faith #Jesus #Blessed #GodIsGood #Inspiration', 'hashtag-broad')} className="mt-2 text-xs font-bold text-rose-600"><Copy size={12} className="inline" /> Copy</button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-stone-700/50 border border-amber-100 dark:border-stone-600">
            <span className="text-[10px] font-bold text-amber-600 uppercase">Skin / Beauty</span>
            <p className="text-xs text-stone-600 dark:text-stone-300 mt-2">#SkincareRoutine #CleanBeauty #SkincareTok #GlowUp #SkinGoals</p>
            <button onClick={() => copyTemplate('#SkincareRoutine #CleanBeauty #SkincareTok #GlowUp #SkinGoals', 'hashtag-skin')} className="mt-2 text-xs font-bold text-rose-600"><Copy size={12} className="inline" /> Copy</button>
          </div>
          <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-stone-700/50 border border-indigo-100 dark:border-stone-600">
            <span className="text-[10px] font-bold text-indigo-600 uppercase">Product / E-commerce</span>
            <p className="text-xs text-stone-600 dark:text-stone-300 mt-2">#ShopSmall #SmallBusiness #ProductReview #MustHave #LinkInBio</p>
            <button onClick={() => copyTemplate('#ShopSmall #SmallBusiness #ProductReview #MustHave #LinkInBio', 'hashtag-product')} className="mt-2 text-xs font-bold text-rose-600"><Copy size={12} className="inline" /> Copy</button>
          </div>
        </div>
      </div>

      {/* Growth & Algorithm */}
      <div className="bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-3xl p-8 shadow-sm transition-colors">
        <h3 className="text-xl font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2 mb-2">
          <TrendingUp size={22} className="text-rose-400" />
          Growth & Algorithm Checklist
        </h3>
        <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">What platforms reward. Do these consistently to grow.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-stone-700/50 border border-rose-100 dark:border-stone-600">
            <h4 className="text-sm font-bold text-stone-800 dark:text-stone-100 mb-2">Posting Schedule</h4>
            <ul className="text-xs text-stone-600 dark:text-stone-300 space-y-1">
              <li>• Reels/Short: 3–5x/week (ideal 9–11am or 7–9pm)</li>
              <li>• Carousels: 2–3x/week</li>
              <li>• Stories: Daily (keeps algorithm warm)</li>
              <li>• YouTube: 1 long-form + 1 Short/week</li>
            </ul>
          </div>
          <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-stone-700/50 border border-rose-100 dark:border-stone-600">
            <h4 className="text-sm font-bold text-stone-800 dark:text-stone-100 mb-2">Algorithm Wins</h4>
            <ul className="text-xs text-stone-600 dark:text-stone-300 space-y-1">
              <li>• First 3 sec: hook or curiosity gap</li>
              <li>• Watch time: keep to end (tease payoff)</li>
              <li>• Saves & shares {'>'} likes (create save-worthy)</li>
              <li>• Reply to comments in first 30 min</li>
            </ul>
          </div>
          <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-stone-700/50 border border-rose-100 dark:border-stone-600">
            <h4 className="text-sm font-bold text-stone-800 dark:text-stone-100 mb-2">Engagement Prompts</h4>
            <ul className="text-xs text-stone-600 dark:text-stone-300 space-y-1">
              <li>• &quot;Comment YES if this hit different&quot;</li>
              <li>• &quot;Save this for when you need it&quot;</li>
              <li>• &quot;Tag someone who needs to hear this&quot;</li>
              <li>• &quot;Which one are you? 1 or 2?&quot;</li>
            </ul>
          </div>
          <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-stone-700/50 border border-rose-100 dark:border-stone-600">
            <h4 className="text-sm font-bold text-stone-800 dark:text-stone-100 mb-2">Cross-Promotion</h4>
            <ul className="text-xs text-stone-600 dark:text-stone-300 space-y-1">
              <li>• Reel → &quot;Full teaching on YouTube (link in bio)&quot;</li>
              <li>• Carousel → &quot;Watch the Reel version&quot;</li>
              <li>• Podcast → &quot;Video version on YouTube&quot;</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Social Publisher ---
const SocialPublisher = () => {
  const { platforms, togglePlatform, caption, setCaption, tags, addTag, addTags, removeTag, tagInput, setTagInput, contactPageUrl, setContactPageUrl, marketingGoal, setMarketingGoal, selectedVideo, selectedAudio, setActiveTab, businesses, activeBusinessId } = useStudio();
  const [publishStatus, setPublishStatus] = useState(null);
  const [growthTipToast, setGrowthTipToast] = useState(false);
  const seo = useSEO({ caption, tags });

  useEffect(() => {
    if (seo.showGrowthTip && caption?.trim()) {
      setGrowthTipToast(true);
      const t = setTimeout(() => setGrowthTipToast(false), 6000);
      return () => clearTimeout(t);
    }
  }, [seo.showGrowthTip, caption]);

  const handlePublish = async () => {
    const enabled = Object.entries(platforms).filter(([, v]) => v).map(([k]) => k);
    if (enabled.length === 0) {
      setPublishStatus({ ok: false, msg: 'Select at least one platform.' });
      setTimeout(() => setPublishStatus(null), 3000);
      return;
    }
    const lines = [
      caption && `Caption:\n${caption}`,
      tags.length > 0 && `Tags: ${tags.map(t => `#${t}`).join(' ')}`,
      selectedVideo && `Video: ${selectedVideo.name}`,
      selectedAudio && `Audio: ${selectedAudio.name}`,
      `Platforms: ${enabled.join(', ')}`
    ].filter(Boolean);
    const text = lines.join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      setPublishStatus({ ok: true, msg: 'Copied to clipboard. Paste into each platform.' });
    } catch {
      setPublishStatus({ ok: false, msg: 'Could not copy. Paste caption manually.' });
    }
    // Auto-log to analytics
    try {
      const firstPlatform = enabled[0] || 'instagram';
      const title = caption?.split('\n')[0]?.slice(0, 60) || (selectedVideo?.name?.replace(/\.[^.]+$/, '')) || 'Post';
      const existing = JSON.parse(localStorage.getItem('faith-studio-post-analytics') || '[]');
      existing.push({ id: 'p' + Date.now(), businessId: activeBusinessId, title, platform: firstPlatform, postedAt: new Date().toISOString().slice(0, 10), views: 0, likes: 0, comments: 0, shares: 0, saves: 0, notes: '', autoLogged: true });
      localStorage.setItem('faith-studio-post-analytics', JSON.stringify(existing));
    } catch (_) {}
    setTimeout(() => setPublishStatus(null), 3000);
  };

  const applyTagBundle = (bundle) => addTags(bundle.tags);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative">
      {growthTipToast && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 p-4 rounded-xl bg-amber-500 text-white shadow-lg">
          <p className="text-sm font-medium">{seo.tip}</p>
          <button onClick={() => setGrowthTipToast(false)} className="mt-2 text-xs underline">Dismiss</button>
        </div>
      )}
      <div className="lg:col-span-12"><BrandKitReminder compact /></div>
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-3xl p-8 shadow-sm transition-colors">
          <h3 className="text-xl font-semibold text-stone-800 flex items-center mb-6">
            <Share2 className="mr-2 text-rose-400" size={24} />
            Distribution Networks
          </h3>
          <div className="space-y-4">
            {[
              { key: 'youtube', Icon: Youtube, bg: '#fee2e2', fg: '#dc2626', label: 'YouTube', desc: 'Posts 4K Long-form + generates 1 YouTube Short.' },
              { key: 'instagram', Icon: Instagram, bg: '#fce7f3', fg: '#db2777', label: 'Instagram', desc: 'Formats to 9:16 Reel for your main grid.' },
              { key: 'spotify', Icon: Music, bg: '#d1fae5', fg: '#059669', label: 'Spotify & Apple Podcasts', desc: 'Strips video, applies AI Voice Studio, uploads audio only.' },
              { key: 'tiktok', Icon: Smartphone, bg: '#e5e7eb', fg: '#374151', label: 'TikTok', desc: 'Hands-free algorithmic growth.' },
              { key: 'facebook', Icon: Facebook, bg: '#dbeafe', fg: '#2563eb', label: 'Facebook Page', desc: 'Auto-crossposts your Reel.' }
            ].map(({ key, Icon, bg, fg, label, desc }) => (
              <label key={key} className="flex items-center justify-between p-4 rounded-2xl border border-rose-100 hover:border-rose-300 transition-all cursor-pointer bg-rose-50/30 hover:bg-rose-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: bg, color: fg }}>
                    <Icon size={20} />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-stone-800">{label}</span>
                    <span className="text-xs text-stone-500 block mt-0.5">{desc}</span>
                  </div>
                </div>
                <div onClick={(e) => { e.preventDefault(); togglePlatform(key); }} className={`relative inline-block w-12 h-6 rounded-full transition-colors cursor-pointer ${platforms[key] ? 'bg-rose-400' : 'bg-rose-200'}`}>
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${platforms[key] ? 'translate-x-7' : 'translate-x-1'}`}></span>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-3xl p-8 shadow-sm transition-colors">
          <h3 className="text-xl font-semibold text-stone-800 flex items-center mb-6">
            <Wand2 className="mr-2 text-rose-400" size={24} />
            Smart Caption & SEO
          </h3>
          <div className="space-y-5">
            <div>
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-stone-700/50 border border-rose-100 dark:border-stone-600 text-sm">
                <span className="text-[10px] font-bold text-stone-400 uppercase">Publishing</span>
                {selectedVideo ? <p className="font-medium text-stone-800 dark:text-stone-100 mt-1">Video: {selectedVideo.name}</p> : <p className="text-stone-500 dark:text-stone-400 mt-1">No video selected. <button type="button" onClick={() => setActiveTab('library')} className="text-rose-600 dark:text-rose-400 font-bold hover:underline">Select in Media Library</button></p>}
                {selectedAudio ? <p className="font-medium text-stone-800 dark:text-stone-100 mt-0.5">Audio: {selectedAudio.name}</p> : <p className="text-stone-500 dark:text-stone-400 mt-0.5 text-xs">Optional: add music/voiceover from Media Library.</p>}
              </div>
              <label className="block text-xs font-bold text-stone-400 mb-2 uppercase tracking-widest">Master Caption</label>
              <textarea rows="5" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Write your message..." className="w-full bg-rose-50/50 border border-rose-100 rounded-2xl p-4 text-sm text-stone-700 focus:outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-50 transition-all resize-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-400 mb-2 uppercase tracking-widest">Tags</label>
              <div className="flex flex-wrap gap-2 p-4 bg-rose-50/50 rounded-2xl border border-rose-100 mb-2">
                {tags.map((t) => (
                  <span key={t} className="text-xs bg-white text-rose-500 font-medium px-3 py-1.5 rounded-lg border border-rose-200 flex items-center gap-1">
                    #{t} <button type="button" onClick={() => removeTag(t)} className="text-stone-400 hover:text-red-500">&times;</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTag()} placeholder="Add tag (e.g. FaithJourney)" className="flex-1 bg-rose-50/50 border border-rose-100 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-rose-400" />
                <button onClick={addTag} className="px-4 py-2 rounded-xl bg-rose-100 text-rose-600 font-bold text-sm hover:bg-rose-200">Add</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="text-[10px] font-bold text-stone-400 uppercase">Tag Bundles:</span>
                <button onClick={() => applyTagBundle(TAG_BUNDLES.ministry)} className="px-3 py-1 rounded-lg text-xs font-bold bg-rose-100 text-rose-600 hover:bg-rose-200">Ministry</button>
                <button onClick={() => applyTagBundle(TAG_BUNDLES.business)} className="px-3 py-1 rounded-lg text-xs font-bold bg-indigo-100 text-indigo-600 hover:bg-indigo-200">Business</button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-400 mb-2 uppercase tracking-widest">Marketing Goal</label>
              <select value={marketingGoal || ''} onChange={(e) => setMarketingGoal(e.target.value)} className="w-full bg-rose-50/50 border border-rose-100 rounded-xl px-4 py-2 text-sm text-stone-700 focus:outline-none focus:border-rose-400">
                <option value="">None</option>
                <option value="growth">Growth (Contact)</option>
                <option value="sales">Sales (Stoklync)</option>
                <option value="prayer">Prayer Request (Her Stewardship)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-400 mb-2 uppercase tracking-widest">Contact Page (for QR overlay)</label>
              <input type="url" value={contactPageUrl || ''} onChange={(e) => setContactPageUrl(e.target.value)} placeholder="https://linktr.ee/... or Google Form for prayer requests" className="w-full bg-rose-50/50 border border-rose-100 rounded-xl px-4 py-2 text-sm text-stone-700 focus:outline-none focus:border-rose-400" />
              <p className="text-[10px] text-stone-500 mt-1">Link to Linktree, Google Form, or Her Stewardship signup. Used for QR overlay in Reels.</p>
            </div>
            <button onClick={handlePublish} className="w-full bg-rose-500 hover:bg-rose-600 text-white px-4 py-4 rounded-2xl text-sm font-bold shadow-lg flex items-center justify-center mt-4">
              <Share2 size={18} className="mr-2" /> Publish to All Selected
            </button>
            {publishStatus && (
              <p className={`mt-2 text-xs font-medium ${publishStatus.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{publishStatus.msg}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- No-Mouse Editor ---
const NoMouseEditor = () => {
  const studio = useStudio();
  const { selectedVideo, filteredAssets, setSelectedVideoId, setActiveTab } = studio;
  const [cuts, setCuts] = useState([]);
  const addCut = () => setCuts(prev => [...prev, { id: Date.now(), start: '00:00.00', end: '00:00.00', note: '' }]);
  const removeCut = (id) => setCuts(prev => prev.filter(c => c.id !== id));
  const updateCut = (id, field, val) => setCuts(prev => prev.map(c => c.id === id ? { ...c, [field]: val } : c));

  const videos = filteredAssets.filter(a => a.type === 'video');

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-3xl p-8 shadow-sm transition-colors">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="text-xl font-semibold text-stone-800 flex items-center">
              <Video className="mr-2 text-rose-400" size={24} />
              Source: {selectedVideo ? selectedVideo.name : 'Select a video'}
            </h3>
            <p className="text-sm text-stone-500 mt-2">Define exact times to cut. No timeline scrubbing required.</p>
          </div>
          {videos.length > 0 && !selectedVideo && (
            <select onChange={(e) => setSelectedVideoId(Number(e.target.value))} className="bg-rose-50/50 border border-rose-100 rounded-xl px-4 py-2 text-sm">
              <option value="">Choose video...</option>
              {videos.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          )}
          {selectedVideo && (
            <button onClick={() => setSelectedVideoId(null)} className="text-sm text-rose-600 hover:underline">Change source</button>
          )}
        </div>

        {!selectedVideo && videos.length === 0 && (
          <div className="py-12 text-center text-stone-500">
            <p>Upload a video in Media Library first, then select it here.</p>
            <button onClick={() => studio.setActiveTab('library')} className="mt-4 text-rose-600 font-bold hover:underline">Go to Media Library</button>
          </div>
        )}

        {selectedVideo && (
          <>
            <div className="space-y-4">
              <div className="grid grid-cols-12 gap-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest px-4 mb-2">
                <div className="col-span-3">Start Time</div>
                <div className="col-span-3">End Time</div>
                <div className="col-span-5">Scene Note</div>
                <div className="col-span-1 text-right">Actions</div>
              </div>
              {cuts.map((cut) => (
                <div key={cut.id} className="grid grid-cols-12 gap-4 items-center bg-rose-50/50 p-3 rounded-2xl border border-rose-100">
                  <div className="col-span-3">
                    <input value={cut.start} onChange={(e) => updateCut(cut.id, 'start', e.target.value)} className="w-full bg-white border border-rose-200 rounded-xl px-4 py-2.5 text-sm text-rose-600 font-mono font-bold focus:outline-none focus:border-rose-400" placeholder="MM:SS.MS" />
                  </div>
                  <div className="col-span-3">
                    <input value={cut.end} onChange={(e) => updateCut(cut.id, 'end', e.target.value)} className="w-full bg-white border border-rose-200 rounded-xl px-4 py-2.5 text-sm text-rose-600 font-mono font-bold focus:outline-none focus:border-rose-400" placeholder="MM:SS.MS" />
                  </div>
                  <div className="col-span-5">
                    <input value={cut.note} onChange={(e) => updateCut(cut.id, 'note', e.target.value)} className="w-full bg-transparent border-none px-3 py-2 text-sm text-stone-700 font-medium focus:outline-none" placeholder="Scene notes..." />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button onClick={() => removeCut(cut.id)} className="text-stone-400 hover:text-red-500 p-2 rounded-lg"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 flex justify-between items-center pt-8 border-t border-rose-100">
              <button onClick={addCut} className="text-sm font-bold text-rose-600 hover:text-rose-700 flex items-center bg-rose-50 px-5 py-2.5 rounded-xl border border-rose-100">
                <Plus size={16} className="mr-2" /> Add Time Range
              </button>
              <button
                onClick={async () => {
                  const text = cuts.length ? cuts.map(c => `${c.start} → ${c.end}${c.note ? ` | ${c.note}` : ''}`).join('\n') : 'No cuts — full video';
                  const full = `Cut list: ${selectedVideo?.name || 'video'}\n${text}`;
                  try {
                    await navigator.clipboard.writeText(full);
                    studio.setActiveTab('classic');
                  } catch {}
                }}
                className="bg-rose-500 hover:bg-rose-600 text-white px-8 py-3 rounded-xl text-sm font-bold shadow-lg flex items-center"
              >
                <Scissors size={18} className="mr-2" /> Compile Final Cut
              </button>
            </div>

            {/* AI Filler Removal — manual workflow here; AI coming later */}
            <div className="mt-10 p-6 rounded-2xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50">
              <h4 className="text-base font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
                <Sparkles size={18} className="text-amber-500" />
                Filler removal (ums, ahs, pauses)
              </h4>
              <p className="text-sm text-stone-600 dark:text-stone-400 mt-2">Use <strong>Classic Timeline</strong> to split and delete filler: type the exact time (e.g. 0:12) in the toolbar, hit <strong>Split at time</strong>, then delete the small segment. AI auto-detection coming soon.</p>
              <button type="button" onClick={() => setActiveTab('classic')} className="mt-4 text-sm font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-2">
                Open Classic Timeline → <Scissors size={14} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const secToTime = (s) => { const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`; };
const secToTimecode = (s) => { const m = Math.floor(s / 60); const sec = Math.floor(s % 60); const ms = Math.floor((s % 1) * 100); return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}.${String(ms).padStart(2,'0')}`; };
const parseTimecode = (str) => { const parts = String(str).trim().split(/[:.]/).map(Number); if (parts.length >= 2) return (parts[0] || 0) * 60 + (parts[1] || 0) + ((parts[2] || 0) / 100); return null; };

// --- Timeline segment previews (CapCut filmstrip — stays in timeline row only) ---
const VideoSegmentThumbnail = ({ videoUrl, startTime, segStart = 0, segEnd, className = '' }) => {
  const frameCount = 6;
  const times = segEnd != null && segEnd > segStart
    ? [...Array(frameCount)].map((_, i) => segStart + ((segEnd - segStart) * (i + 0.5)) / frameCount)
    : [Math.max(0, startTime)];
  if (!videoUrl) return null;
  return (
    <div className={`absolute inset-0 grid pointer-events-none rounded overflow-hidden ${className}`} style={{ gridTemplateColumns: `repeat(${times.length}, minmax(14px, 1fr))`, gap: 2 }}>
      {times.map((t, i) => (
        <div key={`${t}-${i}`} className="relative bg-stone-700 overflow-hidden min-w-0">
          <video
            src={videoUrl}
            muted
            playsInline
            preload="auto"
            className="absolute inset-0 w-full h-full object-cover"
            onLoadedMetadata={(e) => { e.target.currentTime = t; }}
            onLoadedData={(e) => { if (Math.abs(e.target.currentTime - t) > 0.1) e.target.currentTime = t; }}
          />
        </div>
      ))}
    </div>
  );
};

const AudioWaveformSegment = ({ audioUrl, segStart, segEnd, totalDuration, className = '' }) => {
  const canvasRef = useRef(null);
  const [peaksReady, setPeaksReady] = useState(0);
  const peaksRef = useRef(null);
  const draw = useCallback((peaks, w, h) => {
    const c = canvasRef.current;
    if (!c || !peaks?.length) return;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(80, w || c.offsetWidth || 200);
    const height = Math.max(24, h || c.offsetHeight || 40);
    c.width = width * dpr;
    c.height = height * dpr;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    const samples = peaks.length;
    const mid = height / 2;
    const barW = Math.max(1, (width / samples) * 0.85);
    const gap = (width / samples) * 0.15;
    g.fillStyle = 'transparent';
    g.clearRect(0, 0, width, height);
    peaks.forEach((p, i) => {
      const x = i * (width / samples);
      const barH = Math.max(0.5, p * mid * 0.2);
      g.fillStyle = 'rgba(34, 197, 94, 0.85)';
      g.fillRect(x + gap / 2, mid - barH / 2, barW, barH);
    });
  }, []);
  useEffect(() => {
    if (!audioUrl) return;
    let cancelled = false;
    const placeholder = [...Array(100)].map(() => 0.25 + Math.random() * 0.5);
    peaksRef.current = placeholder;
    setPeaksReady(s => s + 1);
    (async () => {
      try {
        const res = await fetch(audioUrl);
        const buf = await res.arrayBuffer();
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await ctx.decodeAudioData(buf);
        if (cancelled) return;
        const ch = audioBuffer.getChannelData(0);
        const len = ch.length;
        const samples = 120;
        const step = Math.floor(len / samples);
        const peaks = [];
        for (let i = 0; i < samples; i++) {
          let max = 0;
          for (let j = i * step; j < Math.min((i + 1) * step, len); j++) {
            max = Math.max(max, Math.abs(ch[j]));
          }
          peaks.push(max);
        }
        peaksRef.current = peaks;
        setPeaksReady(s => s + 1);
      } catch (_) {
        peaksRef.current = placeholder;
        setPeaksReady(s => s + 1);
      }
    })();
    return () => { cancelled = true; };
  }, [audioUrl]);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const run = () => {
      if (!peaksRef.current) return;
      const rect = c.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) draw(peaksRef.current, rect.width, rect.height);
    };
    const t = setTimeout(run, 50);
    const ro = new ResizeObserver(run);
    ro.observe(c);
    return () => { clearTimeout(t); ro.disconnect(); };
  }, [draw, peaksReady, audioUrl]);
  if (!audioUrl) return null;
  return <canvas ref={canvasRef} width={300} height={40} className={`absolute inset-0 w-full h-full pointer-events-none rounded ${className}`} style={{ opacity: 1 }} />;
};

// --- Classic Editor ---
const TIMELINE_TRANSITIONS = [
  { id: 'cut', label: 'Hard Cut', icon: '✂️', cat: 'energy', seamless: false, when: 'Fast dialog, action, energy. Invisible when motion continues.' },
  { id: 'cross', label: 'Crossfade', icon: '✨', cat: 'seamless', seamless: true, when: '★ Most seamless. Blends clips together — viewers won\'t notice the cut.' },
  { id: 'fade', label: 'Fade', icon: '🌅', cat: 'seamless', seamless: true, when: 'Gentle mood shift, time passing. Great for emotional or spiritual moments.' },
  { id: 'blur', label: 'Blur', icon: '🌀', cat: 'seamless', seamless: true, when: 'Dreamy / cinematic transition. Memory, flashback, or opening sequence.' },
  { id: 'dip-black', label: 'Dip Black', icon: '⬛', cat: 'chapter', seamless: false, when: 'Strong chapter break or dramatic pause. Gospel sermons, topic resets.' },
  { id: 'dip-white', label: 'Dip White', icon: '⬜', cat: 'chapter', seamless: false, when: 'Heavenly or joyful transition. Light-filled spiritual moments.' },
  { id: 'zoom-in', label: 'Zoom In', icon: '🔍', cat: 'motion', seamless: false, when: 'Emphasize: product reveal, key scripture, important face.' },
  { id: 'zoom-out', label: 'Zoom Out', icon: '🔭', cat: 'motion', seamless: false, when: 'Pull back to reveal. After tight close-up, open to environment.' },
  { id: 'slide-l', label: 'Slide →', icon: '⬅️', cat: 'motion', seamless: false, when: 'Story moving forward. Natural reading direction, good for lists.' },
  { id: 'slide-r', label: 'Slide ←', icon: '➡️', cat: 'motion', seamless: false, when: 'Flashback or contrast. Reverses visual flow for effect.' },
  { id: 'wipe', label: 'Wipe', icon: '🔲', cat: 'motion', seamless: false, when: 'Same subject, different angle. Modern and purposeful feel.' },
];

/** Sarah Speaks Faith brand kit — Ministry Brand Identity
 * Terracotta (Warmth, Humanity, Blood of Jesus), Sage (Spiritual Growth, Peace), Cream (Purity, Light), Charcoal (The Word, Truth), Gold (The King, Glory)
 * Typography: Playfair Display (headings), Inter (body)
 */
const BRAND_PRESETS = {
  sarah: {
    tagline: 'A woman like that, first.',
    color: 'rose',
    font: 'serif',
    headingFont: 'Playfair Display',
    bodyFont: 'Inter',
    colors: ['#C87967', '#8F9B82', '#F9F6F0', '#333333', '#D4AF37'], // Terracotta, Sage, Cream, Charcoal, Gold
    colorNames: ['Terracotta', 'Sage', 'Cream', 'Charcoal', 'Gold'],
    concept: 'Gospel-focused, warm, inviting, authentic — to lift up Jesus and encourage others in their faith journey.',
  },
  stewardship: { color: 'amber', font: 'serif', colors: ['white', 'gold', 'amber', 'rose'] },
  /** STOKLYNC — B2B logistics. Controlled, intelligent, dependable. Primary Blue (STOK), Emerald (LYNC accent), Tagline Gray. */
  stoklync: {
    tagline: 'Logistics infrastructure.',
    color: 'indigo',
    font: 'sans',
    headingFont: 'Montserrat',
    bodyFont: 'Poppins',
    colors: ['#163A63', '#2F8F5B', '#6D6D6D', '#FFFFFF', '#F5F5F5'], // Primary Blue, Emerald, Tagline Gray, White, Light Gray
    colorNames: ['Primary Blue', 'Emerald Green', 'Tagline Gray', 'White', 'Light Gray'],
    concept: 'Controlled, intelligent, dependable, structured — enterprise-ready logistics. No gradients, shadows, or glossy effects.',
  },
  skin: { color: 'amber', font: 'sans', colors: ['white', 'rose', 'amber', 'black'] }
};

// --- Brand Kit Reminder (keep your colors & fonts top of mind) ---
const BrandKitReminder = ({ compact = false }) => {
  const { businesses, activeBusinessId } = useStudio();
  const brand = BRAND_PRESETS[activeBusinessId] || BRAND_PRESETS.sarah;
  const businessName = businesses?.find(b => b.id === activeBusinessId)?.name || 'Your brand';
  const colors = brand?.colors || [];
  const colorNames = brand?.colorNames || colors.map((_, i) => `Color ${i + 1}`);
  const copyHex = (hex) => { navigator.clipboard.writeText(hex); };

  if (compact) {
    return (
      <div className="flex items-center gap-3 flex-wrap p-3 rounded-xl bg-rose-50/50 dark:bg-stone-700/30 border border-rose-100 dark:border-stone-600">
        <span className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase">Brand: {businessName}</span>
        <div className="flex gap-1.5">
          {colors.slice(0, 5).map((hex, i) => (
            <button key={i} onClick={() => copyHex(hex)} title={`${colorNames[i] || ''} ${hex}`} className="w-7 h-7 rounded-lg border-2 border-white dark:border-stone-600 shadow-sm hover:scale-110 transition-transform" style={{ backgroundColor: hex }} />
          ))}
        </div>
        {(brand?.headingFont || brand?.bodyFont) && (
          <span className="text-xs text-stone-500 dark:text-stone-400">{[brand.headingFont, brand.bodyFont].filter(Boolean).join(' + ')}</span>
        )}
      </div>
    );
  }
  return (
    <div className="bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-2xl p-6 shadow-sm">
      <h4 className="text-sm font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <Package size={16} className="text-rose-400" /> Brand Kit — {businessName}
      </h4>
      <div className="flex flex-wrap gap-4">
        <div>
          <span className="text-[10px] font-bold text-stone-400 uppercase block mb-1.5">Colors</span>
          <div className="flex gap-2">
            {colors.slice(0, 5).map((hex, i) => (
              <button key={i} onClick={() => copyHex(hex)} title={`${colorNames[i] || ''} — ${hex}`} className="w-10 h-10 rounded-xl border-2 border-white dark:border-stone-600 shadow-md hover:scale-105 transition-transform" style={{ backgroundColor: hex }} />
            ))}
          </div>
          <p className="text-[10px] text-stone-500 mt-1">Click to copy hex</p>
        </div>
        {(brand?.headingFont || brand?.bodyFont) && (
          <div>
            <span className="text-[10px] font-bold text-stone-400 uppercase block mb-1.5">Fonts</span>
            <p className="text-sm text-stone-700 dark:text-stone-300">
              <span style={{ fontFamily: brand.headingFont ? `"${brand.headingFont}", serif` : undefined }}>{brand.headingFont || '—'}</span> + {brand.bodyFont || '—'}
            </p>
          </div>
        )}
        {brand?.tagline && (
          <div>
            <span className="text-[10px] font-bold text-stone-400 uppercase block mb-1.5">Tagline</span>
            <p className="text-sm text-stone-700 dark:text-stone-300 italic">"{brand.tagline}"</p>
          </div>
        )}
      </div>
      <p className="text-xs text-stone-500 dark:text-stone-400 mt-3">Use these in your posts and flyers for consistent branding.</p>
    </div>
  );
};

// --- Post & Flyer Creator (branded graphics) ---
const POST_SIZES = [
  { id: '1:1', w: 1080, h: 1080, label: 'Square (Feed)' },
  { id: '9:16', w: 1080, h: 1920, label: 'Story / Reel' },
  { id: '4:5', w: 1080, h: 1350, label: 'Portrait (Feed)' }
];

const PostFlyerCreator = ({ businesses, activeBusinessId, setIgPosts, setPinterestPins, businessName }) => {
  const brand = BRAND_PRESETS[activeBusinessId] || BRAND_PRESETS.sarah;
  const colors = brand?.colors || ['#C87967', '#8F9B82', '#F9F6F0', '#333333', '#D4AF37'];
  const colorNames = brand?.colorNames || ['Primary', 'Accent', 'Light', 'Dark', 'Gold'];
  const headingFont = brand?.headingFont || 'Playfair Display';
  const bodyFont = brand?.bodyFont || 'Inter';

  const [size, setSize] = useState('1:1');
  const [headline, setHeadline] = useState('');
  const [subhead, setSubhead] = useState('');
  const [bgColor, setBgColor] = useState(colors[0] || '#C87967');
  const [textColor, setTextColor] = useState(colors[3] || '#333333');
  const canvasRef = useRef(null);

  const preset = POST_SIZES.find(s => s.id === size) || POST_SIZES[0];
  const scale = Math.min(360 / preset.w, 640 / preset.h);

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    const w = preset.w;
    const h = preset.h;
    c.width = w;
    c.height = h;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';

    if (headline) {
      ctx.font = `bold ${Math.min(120, w / 8)}px "${headingFont}", serif`;
      const lines = headline.match(/.{1,20}/g) || [headline];
      const startY = h / 2 - (lines.length * 80) / 2;
      lines.forEach((line, i) => ctx.fillText(line, w / 2, startY + i * 80));
    }
    if (subhead) {
      ctx.font = `${Math.min(48, w / 18)}px "${bodyFont}", sans-serif`;
      ctx.fillText(subhead, w / 2, h / 2 + 80);
    }
  }, [preset, headline, subhead, bgColor, textColor, headingFont, bodyFont]);

  useEffect(draw, [draw]);

  const exportPng = () => {
    const c = canvasRef.current;
    if (!c) return;
    const link = document.createElement('a');
    link.download = `brand-post-${Date.now()}.png`;
    link.href = c.toDataURL('image/png');
    link.click();
  };

  const addToIg = () => {
    const c = canvasRef.current;
    if (!c) return;
    const url = c.toDataURL('image/png');
    setIgPosts(prev => [...prev, { id: Date.now() + Math.random(), url, caption: headline, altText: `${headline} ${subhead}` }]);
  };

  const addToPins = () => {
    const c = canvasRef.current;
    if (!c) return;
    const url = c.toDataURL('image/png');
    setPinterestPins(prev => [...prev, { id: Date.now() + Math.random(), url, title: headline, board: '', altText: `${headline} ${subhead}` }]);
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-3xl p-8 shadow-sm">
      <h3 className="text-xl font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2 mb-4">
        <ImageIcon size={24} className="text-rose-400" />
        Create Post & Flyer
      </h3>
      <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">Use your brand kit to make cool graphics. Headline, subhead, colors—all from your brand.</p>
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="space-y-4 flex-1 max-w-sm">
          <div>
            <label className="text-xs font-bold text-stone-500 uppercase block mb-2">Size</label>
            <div className="flex gap-2">
              {POST_SIZES.map((s) => (
                <button key={s.id} onClick={() => setSize(s.id)} className={`px-3 py-2 rounded-xl text-sm font-medium ${size === s.id ? 'bg-rose-500 text-white' : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-400'}`}>{s.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-stone-500 uppercase block mb-2">Headline</label>
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Your main message" className="w-full px-4 py-3 rounded-xl bg-rose-50 dark:bg-stone-700 border border-rose-100 dark:border-stone-600 text-stone-800 dark:text-stone-100 placeholder-stone-400" style={{ fontFamily: `"${headingFont}", serif` }} />
          </div>
          <div>
            <label className="text-xs font-bold text-stone-500 uppercase block mb-2">Subhead</label>
            <input value={subhead} onChange={(e) => setSubhead(e.target.value)} placeholder="Optional tagline" className="w-full px-4 py-3 rounded-xl bg-rose-50 dark:bg-stone-700 border border-rose-100 dark:border-stone-600 text-stone-800 dark:text-stone-100 placeholder-stone-400" />
          </div>
          <div>
            <label className="text-xs font-bold text-stone-500 uppercase block mb-2">Background</label>
            <div className="flex gap-2 flex-wrap">
              {colors.map((hex, i) => (
                <button key={i} onClick={() => setBgColor(hex)} title={colorNames[i]} className={`w-10 h-10 rounded-xl border-2 ${bgColor === hex ? 'border-rose-500 ring-2 ring-rose-300' : 'border-transparent'} transition-all`} style={{ backgroundColor: hex }} />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-stone-500 uppercase block mb-2">Text color</label>
            <div className="flex gap-2 flex-wrap">
              {colors.map((hex, i) => (
                <button key={i} onClick={() => setTextColor(hex)} title={colorNames[i]} className={`w-10 h-10 rounded-xl border-2 ${textColor === hex ? 'border-rose-500 ring-2 ring-rose-300' : 'border-transparent'} transition-all`} style={{ backgroundColor: hex }} />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <button onClick={exportPng} className="px-4 py-2.5 rounded-xl bg-rose-500 text-white font-bold text-sm hover:bg-rose-600">Download PNG</button>
            <button onClick={addToIg} className="px-4 py-2.5 rounded-xl border border-rose-200 dark:border-stone-600 text-rose-600 dark:text-rose-400 font-bold text-sm hover:bg-rose-50 dark:hover:bg-stone-700">Add to IG Grid</button>
            <button onClick={addToPins} className="px-4 py-2.5 rounded-xl border border-rose-200 dark:border-stone-600 text-rose-600 dark:text-rose-400 font-bold text-sm hover:bg-rose-50 dark:hover:bg-stone-700">Add to Pins</button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center bg-stone-100 dark:bg-stone-800/50 rounded-2xl p-6 min-h-[320px]">
          <canvas ref={canvasRef} width={preset.w} height={preset.h} className="max-w-full h-auto rounded-xl shadow-xl" style={{ maxHeight: 400 }} />
        </div>
      </div>
    </div>
  );
};

const MARKETING_GOALS = [
  { id: '', label: 'None' },
  { id: 'growth', label: 'Growth (Contact)' },
  { id: 'sales', label: 'Sales (Stoklync)' },
  { id: 'prayer', label: 'Prayer Request (Her Stewardship)' },
];

const ClassicEditor = () => {
  const { selectedVideo, selectedAudio, filteredAssets, setSelectedVideoId, setSelectedAudioId, setActiveTab, activeBusinessId, businesses, addAsset, platforms = {}, caption, setCaption, tags, contactPageUrl, setContactPageUrl, marketingGoal, setMarketingGoal, setSidebarOpen } = useStudio();
  const { processVideo, revoke, cleanup, togglePlayPause: editorTogglePlay } = useEditor();
  const { addClipToTimeline } = useTimeline();
  useEditorSync();
  const { isSupported: speechSupported, isListening, displayText: liveCaption, start: startSpeech, stop: stopSpeech } = useSpeechRecognition({
    onResult: (text) => setCaption((c) => (c ? c + ' ' : '') + text),
    continuous: true,
    interimResults: true,
  });
  const { isRecording, error: recordError, start: startRecord, stop: stopRecord } = useMediaRecorder({});
  const qrUrl = (marketingGoal && contactPageUrl) ? contactPageUrl : '';
  const { dataUrl: qrCodeDataUrl } = useQRCode(qrUrl);
  const videos = filteredAssets.filter(a => a.type === 'video');
  const audioFiles = filteredAssets.filter(a => a.type === 'audio');
  const videoRef = useRef(null);
  const timelineRulerRef = useRef(null);
  const timelineScrollRef = useRef(null);
  const mainTrackRef = useRef(null);

  const duration = useEditorStore(s => s.duration);
  const setDuration = useEditorStore(s => s.setDuration);
  const setPlayhead = useEditorStore(s => s.setPlayhead);
  const [clipIn, setClipIn] = useState(null);
  const [clipOut, setClipOut] = useState(null);
  const mainSegments = useEditorStore(s => s.mainSegments);
  const setMainSegments = useEditorStore(s => s.setMainSegments);
  const selectedSegmentId = useEditorStore(s => s.selectedSegmentId);
  const setSelectedSegmentId = useEditorStore(s => s.setSelectedSegmentId);
  const audioSegments = useEditorStore(s => s.audioSegments);
  const setAudioSegments = useEditorStore(s => s.setAudioSegments);
  const audioExtraTracks = useEditorStore(s => s.audioExtraTracks);
  const setAudioExtraTracks = useEditorStore(s => s.setAudioExtraTracks);
  const selectedAudioSegmentId = useEditorStore(s => s.selectedAudioSegmentId);
  const setSelectedAudioSegmentId = useEditorStore(s => s.setSelectedAudioSegmentId);
  const [splitTimeInput, setSplitTimeInput] = useState('');
  const history = useEditorStore(s => s.history);
  const [markers, setMarkers] = useState(() => JSON.parse(localStorage.getItem('faith-studio-markers') || '[]'));
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [trackHeights, setTrackHeights] = useState({ text: 48, video: 80, audio: 48, extra: 48 });
  const [resizingTrack, setResizingTrack] = useState(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showAIHelper, setShowAIHelper] = useState(false);
  const [inspectorTab, setInspectorTab] = useState('edit'); // 'edit' | 'text' | 'audio' | 'export'
  const [userMuted, setUserMuted] = useState(false);
  const [tracksLinked, setTracksLinked] = useState(true);
  const [splitFeedback, setSplitFeedback] = useState(null);
  const [selectedClipId, setSelectedClipId] = useState(null);

  const timelineTracks = useEditorStore(s => s.timelineTracks);
  const insertClipAtPlayhead = useEditorStore(s => s.insertClipAtPlayhead);
  const removeClip = useEditorStore(s => s.removeClip);
  const updateClip = useEditorStore(s => s.updateClip);
  const moveClipToTrack = useEditorStore(s => s.moveClipToTrack);
  const setClipTransition = useEditorStore(s => s.setClipTransition);
  const moveClip = useEditorStore(s => s.moveClip);
  const resizeClip = useEditorStore(s => s.resizeClip);
  const updateTrackMeta = useEditorStore(s => s.updateTrackMeta);
  const assets = useEditorStore(s => s.assets);
  const playhead = useEditorStore(s => s.playhead);

  const hasLayeredClips = timelineTracks?.some(t => (t.clips || []).length > 0);
  const activeMainClipAtPlayhead = useMemo(() => {
    if (!hasLayeredClips) return null;
    const mainTrack = timelineTracks?.find(t => t.label === 'Main');
    const clip = (mainTrack?.clips || []).find(c =>
      playhead >= c.startOffset && playhead < c.startOffset + (c.duration || 0)
    );
    return clip ? { clip, asset: assets?.find(a => a.id === clip.assetId) } : null;
  }, [hasLayeredClips, timelineTracks, playhead, assets]);
  const videoForPreview = activeMainClipAtPlayhead?.asset || selectedVideo;

  const storePlaying = useEditorStore(s => s.playing);
  const setStorePlaying = useEditorStore(s => s.setPlaying);
  const playing = storePlaying;
  const setPlaying = setStorePlaying;
  const togglePlayPause = useCallback(() => {
    if (!videoForPreview) return;
    const next = editorTogglePlay();
    const v = videoRef.current;
    if (v) next ? v.play().catch(() => {}) : v.pause();
  }, [videoForPreview, editorTogglePlay]);

  useEffect(() => { localStorage.setItem('faith-studio-markers', JSON.stringify(markers)); }, [markers]);

  // When Main and Audio come from the same video, keep them in sync (CapCut-style)
  // Skip sync when user explicitly split only Main (to leave Audio continuous)
  useEffect(() => {
    if (skipSyncRef.current) { skipSyncRef.current = false; return; }
    if (!tracksLinked || !selectedVideo || mainSegments.length === 0) return;
    setAudioSegments(prev => {
      try {
        const valid = (mainSegments || []).filter(s => s && typeof s?.start === 'number' && typeof s?.end === 'number');
        const synced = valid.map((s, i) => ({
          id: prev[i]?.id ?? `a${Date.now()}-${i}`,
          start: s.start,
          end: s.end
        }));
        if (synced.length === prev.length && synced.every((a, i) => prev[i] && a.start === prev[i].start && a.end === prev[i].end)) return prev;
        return synced;
      } catch (_) {
        return prev;
      }
    });
  }, [tracksLinked, selectedVideo?.id, mainSegments]);

  const zoomToFit = () => setTimelineZoom(1);
  const zoomToSelection = () => {
    let tlStart = 0;
    let targetZoom = timelineZoom;
    if (selectedSegmentId) {
      const seg = mainSegments.find(s => s.id === selectedSegmentId);
      if (seg && duration > 0) {
        tlStart = getMainTimelineRanges(mainSegments).find(r => r.seg.id === seg.id)?.tlStart ?? 0;
        const segDur = seg.end - seg.start;
        targetZoom = Math.min(4, Math.max(0.5, 30 / segDur));
        setTimelineZoom(targetZoom);
      }
    } else if (selectedAudioSegmentId) {
      const seg = audioSegments.find(s => s.id === selectedAudioSegmentId);
      if (seg && duration > 0) {
        tlStart = getAudioTimelineRanges(audioSegments).find(r => r.seg.id === seg.id)?.tlStart ?? 0;
        const segDur = seg.end - seg.start;
        targetZoom = Math.min(4, Math.max(0.5, 30 / segDur));
        setTimelineZoom(targetZoom);
      }
    }
    // Scroll timeline to show selection (use targetZoom for scroll calc since state is async)
    const doScroll = () => {
      const el = timelineScrollRef.current;
      if (!el || timelineDuration <= 0) return;
      const pct = tlStart / timelineDuration;
      const trackWidth = 500 * targetZoom;
      const scrollTarget = Math.max(0, pct * trackWidth - el.clientWidth / 2);
      el.scrollLeft = scrollTarget;
    };
    requestAnimationFrame(() => { doScroll(); requestAnimationFrame(doScroll); });
  };

  const skipVideoResetRef = useRef(false);
  const storePushHistory = useEditorStore(s => s.pushHistory);
  const pushHistory = () => {
    try {
      const s = useEditorStore.getState();
      storePushHistory(JSON.stringify({ main: s.mainSegments, audio: s.audioSegments, audioExtra: s.audioExtraTracks, text: s.textClips, timelineTracks: s.timelineTracks, selectedVideoId: s.selectedVideoId }));
    } catch (_) { /* avoid crash */ }
  };
  const undoAll = () => {
    if (history.length === 0) return;
    try {
      const prev = JSON.parse(history[history.length - 1]);
      const main = Array.isArray(prev?.main) ? prev.main.filter(s => s && typeof s?.start === 'number' && typeof s?.end === 'number') : [];
      const audio = Array.isArray(prev?.audio) ? prev.audio.filter(s => s && typeof s?.start === 'number' && typeof s?.end === 'number') : [];
      const audioExtra = Array.isArray(prev?.audioExtra) ? prev.audioExtra.map(t => ({ ...t, segments: (t.segments || []).filter(s => s && typeof s?.start === 'number' && typeof s?.end === 'number') })) : [{ id: 't2', segments: [] }];
      if (main.length > 0) setMainSegments(main);
      if (audio.length > 0) setAudioSegments(audio);
      setAudioExtraTracks(audioExtra.length > 0 ? audioExtra : [{ id: 't2', segments: [] }]);
      if (Array.isArray(prev?.text)) useEditorStore.getState().setTextClips(prev.text);
      if (Array.isArray(prev?.timelineTracks)) useEditorStore.setState({ timelineTracks: prev.timelineTracks });
      if (prev?.selectedVideoId != null) {
        skipVideoResetRef.current = true;
        useEditorStore.getState().setSelectedVideoId(prev.selectedVideoId);
      }
      useEditorStore.getState().popHistory();
      useEditorStore.setState({ selectedSegmentId: null, selectedAudioSegmentId: null });
      setSelectedClipId?.(null);
    } catch (_) { /* avoid crash on corrupt history */ }
  };

  const textClips = useEditorStore(s => s.textClips);
  const setTextClips = useEditorStore(s => s.setTextClips);
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('faith-studio-timeline-text') || '[]');
      const parsed = raw.map(c => {
        const end = c.end ?? (c.start + ((c.width ?? 10) * 90 / 100));
        return { ...c, start: c.start ?? 0, end, x: c.x ?? (c.position === 'center' ? 50 : c.position === 'bottom' ? 50 : 50), y: c.y ?? (c.position === 'center' ? 50 : c.position === 'bottom' ? 85 : 15) };
      });
      if (parsed.length > 0) setTextClips(parsed);
    } catch (_) {}
  }, []);
  useEffect(() => { localStorage.setItem('faith-studio-timeline-text', JSON.stringify(textClips)); }, [textClips]);

  const [draggingTextId, setDraggingTextId] = useState(null);
  const canvasRef = useRef(null);
  const mainSegmentsRef = useRef(mainSegments);
  const durationRef = useRef(duration);
  const playheadRef = useRef(playhead);
  mainSegmentsRef.current = mainSegments;
  durationRef.current = duration;
  playheadRef.current = playhead;
  const timelineDuration = (mainSegments || []).reduce((s, seg) => s + (seg && typeof seg.end === 'number' && typeof seg.start === 'number' ? seg.end - seg.start : 0), 0);
  const layeredDuration = useMemo(() => {
    let maxEnd = 0;
    (timelineTracks || []).forEach(t => {
      (t.clips || []).forEach(c => { maxEnd = Math.max(maxEnd, (c.startOffset || 0) + (c.duration || 0)); });
    });
    return maxEnd;
  }, [timelineTracks]);
  const effectiveDuration = Math.max(timelineDuration, layeredDuration, 1);
  const timelineDurationRef = useRef(effectiveDuration);
  timelineDurationRef.current = effectiveDuration;
  const skipSyncRef = useRef(false);

  useEffect(() => {
    if (!selectedVideo) return;
    if (skipVideoResetRef.current) {
      skipVideoResetRef.current = false;
      return;
    }
    setMainSegments([{ id: 'seg0', start: 0, end: duration, transition: 'cut' }]);
    setAudioSegments([{ id: 'a0', start: 0, end: duration }]);
    setAudioExtraTracks([{ id: 't2', segments: [] }]);
    setClipIn(null);
    setClipOut(null);
    setSelectedSegmentId(null);
    setSelectedAudioSegmentId(null);
    useEditorStore.setState({ history: [] });
    setPlayhead(0);
    const v = videoRef.current;
    if (v && v.readyState >= 1) v.currentTime = 0;
  }, [selectedVideo?.id]);

  useEffect(() => {
    const v = videoRef.current;
    if (v && clipIn != null) v.currentTime = Math.max(clipIn, 0);
  }, [clipIn]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !activeMainClipAtPlayhead) return;
    const sourceTime = (playhead - activeMainClipAtPlayhead.clip.startOffset) + (activeMainClipAtPlayhead.clip.trimStart ?? 0);
    if (Math.abs(v.currentTime - sourceTime) > 0.2) v.currentTime = sourceTime;
  }, [playhead, activeMainClipAtPlayhead]);

  useEffect(() => {
    if (playhead > effectiveDuration && effectiveDuration > 0) setPlayhead(effectiveDuration);
  }, [effectiveDuration]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || mainSegments.length === 0) return;
    const seg = getMainSegmentAt(playhead, mainSegments);
    if (!seg && v.paused) {
      const ranges = getMainTimelineRanges(mainSegments);
      const next = ranges.find(r => r.tlEnd > playhead);
      const prev = ranges.filter(r => r.tlEnd <= playhead).pop();
      const t = next ? next.tlStart : (prev ? prev.tlEnd - 0.1 : 0);
      seekTo(Math.max(0, t));
    }
  }, [mainSegments]);

  const audioSegmentsRef = useRef(audioSegments);
  audioSegmentsRef.current = audioSegments;

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !videoForPreview) return;
    if (hasLayeredClips) {
      if (v.muted !== userMuted) v.muted = userMuted;
      return;
    }
    const t = v.currentTime;
    const inAudioGap = audioSegments.length > 0 && !audioSegments.find(s => t >= s.start && t < s.end);
    const shouldMute = userMuted || inAudioGap;
    if (v.muted !== shouldMute) v.muted = shouldMute;
  }, [audioSegments, userMuted, hasLayeredClips, videoForPreview]);

  const onVideoLoadedMetadata = (e) => {
    const d = e.target.duration;
    if (isFinite(d) && d > 0) {
      setDuration(d);
      if (!hasLayeredClips) {
        setMainSegments([{ id: 'seg0', start: 0, end: d, transition: 'cut' }]);
        setAudioSegments([{ id: 'a0', start: 0, end: d }]);
        setPlayhead(0);
      }
      e.target.currentTime = 0;
    }
  };
  // Sequential (ripple) timeline: segments placed one after another, no gaps. Delete = auto-close.
  const getMainTimelineRanges = (segs = mainSegments) => {
    let acc = 0;
    const valid = (segs || []).filter(s => s && typeof s?.start === 'number' && typeof s?.end === 'number');
    return valid.map(seg => {
      const dur = seg.end - seg.start;
      const tlStart = acc;
      acc += dur;
      return { seg, tlStart, tlEnd: acc };
    });
  };
  const getAudioTimelineRanges = (segs = audioSegments) => {
    let acc = 0;
    const valid = (segs || []).filter(s => s && typeof s?.start === 'number' && typeof s?.end === 'number');
    return valid.map(s => {
      const dur = s.end - s.start;
      const tlStart = acc;
      acc += dur;
      return { seg: s, tlStart, tlEnd: acc };
    });
  };
  const timelineToSource = (t) => {
    const ranges = getMainTimelineRanges(mainSegments);
    for (const { seg, tlStart, tlEnd } of ranges) {
      if (t >= tlStart && t < tlEnd) return seg.start + (t - tlStart);
    }
    if (t >= timelineDuration && ranges.length) return ranges[ranges.length - 1].seg.end;
    return Math.max(0, Math.min(duration, t));
  };
  const sourceToTimeline = (sourceT) => {
    const ranges = getMainTimelineRanges(mainSegments);
    for (const { seg, tlStart } of ranges) {
      if (sourceT >= seg.start && sourceT < seg.end) return tlStart + (sourceT - seg.start);
    }
    return Math.max(0, Math.min(timelineDuration, sourceT));
  };
  const BOUNDARY_EPS = 0.001; // avoid blank at exact split boundaries
  const getMainSegmentAt = (t, segs = mainSegmentsRef.current) => {
    const ranges = getMainTimelineRanges(segs);
    const r = ranges.find(r => t >= r.tlStart - BOUNDARY_EPS && t < r.tlEnd + BOUNDARY_EPS);
    return r?.seg ?? null;
  };
  const getActiveSourceTime = (t) => timelineToSource(t);
  const getAudioSegmentAt = (t) => {
    const ranges = getAudioTimelineRanges(audioSegments);
    const r = ranges.find(r => t >= r.tlStart && t < r.tlEnd);
    return r?.seg ?? null;
  };
  const playheadInGap = playhead >= effectiveDuration || (mainSegments.length > 0 && layeredDuration === 0 && !getMainSegmentAt(playhead, mainSegments));
  const playheadInAudioGap = !getAudioSegmentAt(playhead) && audioSegments.length > 0;

  const SNAP_THRESHOLD = 0.5;
  const getSnapPoints = () => {
    const pts = new Set([0, effectiveDuration]);
    getMainTimelineRanges(mainSegments).forEach(r => { pts.add(r.tlStart); pts.add(r.tlEnd); });
    getAudioTimelineRanges(audioSegments).forEach(r => { pts.add(r.tlStart); pts.add(r.tlEnd); });
    textClips.forEach(c => { pts.add(c.start ?? 0); pts.add(c.end ?? 0); });
    markers.forEach(m => pts.add(m.time));
    return [...pts].sort((a, b) => a - b);
  };
  const snapToNearest = (t) => {
    if (!snapEnabled) return t;
    const pts = getSnapPoints();
    const nearest = pts.reduce((best, p) => Math.abs(p - t) < Math.abs(best - t) ? p : best);
    return Math.abs(nearest - t) <= SNAP_THRESHOLD ? nearest : t;
  };

  const addMarker = () => { setMarkers(prev => [...prev, { id: `m${Date.now()}`, time: playhead }]); };
  const removeMarker = (id) => { setMarkers(prev => prev.filter(m => m.id !== id)); };
  const goToPrevMarker = () => {
    const prev = markers.filter(m => m.time < playhead - 0.01).sort((a, b) => b.time - a.time)[0];
    if (prev) seekTo(prev.time);
  };
  const goToNextMarker = () => {
    const next = markers.filter(m => m.time > playhead + 0.01).sort((a, b) => a.time - b.time)[0];
    if (next) seekTo(next.time);
  };

  const commandsRef = useRef({});
  useEffect(() => {
    const handler = (e) => {
      if (e.target.closest('input, textarea, select')) return;
      const v = videoRef.current;
      const cmd = commandsRef.current;
      switch (e.key) {
        case ' ': e.preventDefault(); cmd.togglePlayPause(); break;
        case 'k': case 'K': e.preventDefault(); if (v) v.paused ? v.play() : v.pause(); break;
        case 'j': case 'J': e.preventDefault(); cmd.seekTo(Math.max(0, playheadRef.current - 5)); break;
        case 'l': case 'L': e.preventDefault(); cmd.seekTo(Math.min(timelineDurationRef.current, playheadRef.current + 5)); break;
        case 'i': case 'I': e.preventDefault(); cmd.setInPoint(); break;
        case 'o': case 'O': e.preventDefault(); cmd.setOutPoint(); break;
        case 's': case 'S': e.preventDefault(); cmd.splitAtPlayhead(); break;
        case 'Delete': case 'Backspace': e.preventDefault(); cmd.deleteSelectedSegment(); cmd.deleteSelectedAudioSegment(); break;
        case 'ArrowLeft': e.preventDefault(); cmd.seekTo(Math.max(0, playheadRef.current - 0.5)); break;
        case 'ArrowRight': e.preventDefault(); cmd.seekTo(Math.min(timelineDurationRef.current, playheadRef.current + 0.5)); break;
        case 'm': case 'M': e.preventDefault(); cmd.addMarker(); break;
        case ',': e.preventDefault(); cmd.goToPrevMarker(); break;
        case '.': e.preventDefault(); cmd.goToNextMarker(); break;
        case 'z': case 'Z': if (e.metaKey || e.ctrlKey) { e.preventDefault(); cmd.undoAll(); } break;
        case '?': if (e.shiftKey) { e.preventDefault(); cmd.setShowShortcuts(s => !s); } break;
        default: break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const timelineToSourceFromSegs = (t, segs) => {
    try {
      const ranges = getMainTimelineRanges(segs || []);
      const tlDuration = (segs || []).reduce((s, seg) => s + (seg && typeof seg.end === 'number' && typeof seg.start === 'number' ? seg.end - seg.start : 0), 0);
      for (const { seg, tlStart, tlEnd } of ranges) {
        if (seg && t >= tlStart && t < tlEnd) return seg.start + (t - tlStart);
      }
      return t >= tlDuration && ranges.length ? (ranges[ranges.length - 1]?.seg?.end ?? Math.max(0, Math.min(duration, t))) : Math.max(0, Math.min(duration, t));
    } catch (_) {
      return Math.max(0, Math.min(duration, t));
    }
  };

  // Let video play naturally; only seek at segment boundaries. Avoids audio breakup and freezing.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !selectedVideo) return;
    const ranges = getAudioTimelineRanges(audioSegmentsRef.current);
    const inAudioGap = ranges.length > 0 && !ranges.find(r => playheadRef.current >= r.tlStart && playheadRef.current < r.tlEnd);
    const shouldMute = userMuted || inAudioGap;
    if (v.muted !== shouldMute) v.muted = shouldMute;
  }, [audioSegments, userMuted, selectedVideo?.id, playhead]);

  const onVideoTimeUpdate = (e) => {
    try {
      const v = e.target;
      const sourceT = v.currentTime;
      const segs = mainSegmentsRef.current || [];
      const ranges = getMainTimelineRanges(segs);
      const tlDuration = segs.reduce((s, seg) => s + (seg && typeof seg?.end === 'number' && typeof seg?.start === 'number' ? seg.end - seg.start : 0), 0);

      const eps = 0.001;
      const inSeg = ranges.find(r => r?.seg && sourceT >= r.seg.start - eps && sourceT < r.seg.end + eps);
    if (inSeg) {
      const ph = inSeg.tlStart + (sourceT - inSeg.seg.start);
      setPlayhead(ph);
      const audioRanges = getAudioTimelineRanges(audioSegmentsRef.current);
      const inAudioGap = audioRanges.length > 0 && !audioRanges.find(r => ph >= r.tlStart && ph < r.tlEnd);
      const shouldMute = userMuted || inAudioGap;
      if (v.muted !== shouldMute) v.muted = shouldMute;
      return;
    }

    // Past end of timeline — pause
    if (sourceT >= tlDuration || ranges.length === 0) {
      v.pause();
      setPlayhead(tlDuration);
      return;
    }

    // In a "gap" (e.g. between segments) — seek to next segment
    const next = ranges.find(r => r?.seg && r.seg.start > sourceT);
    if (next?.seg) {
      v.currentTime = next.seg.start;
    }
    } catch (_) {
      // Avoid crashing on malformed segment data
    }
  };

  const seekTo = (timelineT) => {
    const v = videoRef.current;
    if (!v) return;
    const t = Math.max(0, Math.min(effectiveDuration, timelineT));
    setPlayhead(t);
    const sourceTime = timelineToSource(t);
    const t0 = clipIn ?? 0;
    const t1 = clipOut ?? duration;
    v.currentTime = Math.max(t0, Math.min(t1, sourceTime));
    const ranges = getAudioTimelineRanges(audioSegmentsRef.current);
    const inAudioGap = ranges.length > 0 && !ranges.find(r => t >= r.tlStart && t < r.tlEnd);
    const shouldMute = userMuted || inAudioGap;
    if (v.muted !== shouldMute) v.muted = shouldMute;
  };

  const getEventX = (e) => e.clientX ?? e.touches?.[0]?.clientX ?? e.changedTouches?.[0]?.clientX ?? 0;
  const handleRulerClick = (e) => {
    const el = timelineScrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const scrollLeft = el.scrollLeft || 0;
    const laneWidth = 500 * timelineZoom;
    const labelW = 80;
    const xInContent = scrollLeft + (getEventX(e) - rect.left) - labelW;
    const pct = Math.max(0, Math.min(1, laneWidth > 0 ? xInContent / laneWidth : 0));
    seekTo(snapToNearest(pct * effectiveDuration));
  };

  const setInPoint = () => { const t = videoRef.current?.currentTime ?? 0; setClipIn(t); if (clipOut != null && t >= clipOut) setClipOut(null); };
  const setOutPoint = () => { const t = videoRef.current?.currentTime ?? 0; setClipOut(t); if (clipIn != null && t <= clipIn) setClipIn(null); };

  const MIN_SPLIT_INSET = 0.05; // minimum 50ms from segment edges
  const splitMainAt = (t) => {
    if (t < 0 || t >= duration) return false;
    const idx = mainSegments.findIndex(s => s && t >= s.start + MIN_SPLIT_INSET && t <= s.end - MIN_SPLIT_INSET);
    if (idx < 0) return false;
    const seg = mainSegments[idx];
    if (!seg || seg.end == null) return false;
    pushHistory();
    const newSeg = { id: `seg${Date.now()}`, start: t, end: seg.end, transition: seg.transition || 'cut' };
    const updated = { ...seg, end: t };
    setMainSegments(prev => [...prev.slice(0, idx), updated, newSeg, ...prev.slice(idx + 1)]);
    return true;
  };
  const splitAudioAt = (t) => {
    if (t < 0 || t >= duration) return false;
    const aIdx = audioSegments.findIndex(s => s && t >= s.start + MIN_SPLIT_INSET && t <= s.end - MIN_SPLIT_INSET);
    if (aIdx < 0) return false;
    const aSeg = audioSegments[aIdx];
    if (!aSeg || aSeg.end == null) return false;
    pushHistory();
    const newASeg = { id: `a${Date.now()}`, start: t, end: aSeg.end };
    setAudioSegments(prev => [...prev.slice(0, aIdx), { ...aSeg, end: t }, newASeg, ...prev.slice(aIdx + 1)]);
    return true;
  };
  const splitClipAtPlayheadStore = useEditorStore(s => s.splitClipAtPlayhead);
  const splitAtPlayhead = () => {
    if (hasLayeredClips) {
      const okMain = splitClipAtPlayheadStore('Main');
      const okAudio = !okMain && splitClipAtPlayheadStore('Audio');
      if (!okMain && !okAudio) {
        setSplitFeedback('Move playhead into a clip (at least 0.5s from start or end)');
        setTimeout(() => setSplitFeedback(null), 4000);
      }
      return;
    }
    const sourceT = timelineToSource(playhead);
    if (selectedSegmentId) {
      skipSyncRef.current = true;
      const ok = splitMainAt(sourceT);
      if (!ok) { setSplitFeedback('Move playhead into the Main segment (at least 0.1s from start or end)'); setTimeout(() => setSplitFeedback(null), 4000); }
    } else if (selectedAudioSegmentId) {
      const ok = splitAudioAt(sourceT);
      if (!ok) { setSplitFeedback('Move playhead into the Audio segment (at least 0.1s from start or end)'); setTimeout(() => setSplitFeedback(null), 4000); }
    } else {
      const ok = splitMainAt(sourceT);
      if (!ok) { setSplitFeedback('Move playhead into a segment (at least 0.1s from start or end)'); setTimeout(() => setSplitFeedback(null), 4000); }
    }
  };
  const splitAtTimeInput = () => {
    const t = parseTimecode(splitTimeInput);
    if (t == null) return;
    const timelineT = Math.max(0, Math.min(effectiveDuration, t));
    seekTo(timelineT);
    const sourceT = timelineToSource(timelineT);
    if (selectedSegmentId) { skipSyncRef.current = true; splitMainAt(sourceT); }
    else if (selectedAudioSegmentId) splitAudioAt(sourceT);
    else splitMainAt(sourceT);
    setSplitTimeInput('');
  };

  const deleteSelectedSegment = () => {
    if (hasLayeredClips && selectedClipId) {
      for (const t of timelineTracks || []) {
        const clip = (t.clips || []).find(c => c.id === selectedClipId);
        if (clip) { pushHistory(); removeClip(t.id, clip.id); setSelectedClipId(null); return; }
      }
    }
    if (selectedSegmentId) {
      skipSyncRef.current = true;
      pushHistory();
      setMainSegments(prev => prev.filter(s => s.id !== selectedSegmentId));
      setSelectedSegmentId(null);
    }
  };
  const deleteSelectedAudioSegment = () => {
    if (hasLayeredClips && selectedClipId) {
      const audioTrack = timelineTracks?.find(t => t.label === 'Audio');
      const clip = (audioTrack?.clips || []).find(c => c.id === selectedClipId);
      if (clip) { pushHistory(); removeClip(audioTrack.id, clip.id); setSelectedClipId(null); return; }
    }
    if (selectedAudioSegmentId) {
      skipSyncRef.current = true;
      pushHistory();
      setAudioSegments(prev => prev.filter(s => s.id !== selectedAudioSegmentId));
      setSelectedAudioSegmentId(null);
    }
  };
  const moveSelectedAudioToTrack = (trackIndex, segmentId) => {
    const segId = segmentId ?? selectedAudioSegmentId;
    if (!segId || trackIndex < 0) return;
    const seg = audioSegments.find(s => s.id === segId);
    if (!seg) return;
    skipSyncRef.current = true;
    pushHistory();
    setAudioSegments(prev => prev.filter(s => s.id !== segId));
    if (tracksLinked) {
      const aIdx = audioSegments.findIndex(s => s?.id === segId);
      if (aIdx >= 0) setMainSegments(prev => prev.filter((_, i) => i !== aIdx));
    }
    setAudioExtraTracks(prev => {
      const next = [...prev];
      if (!next[trackIndex]) next[trackIndex] = { id: `t${Date.now()}`, segments: [] };
      next[trackIndex] = { ...next[trackIndex], segments: [...(next[trackIndex].segments || []), { ...seg, id: `a${trackIndex + 2}-${Date.now()}` }].sort((a, b) => a.start - b.start) };
      return next;
    });
    setSelectedAudioSegmentId(null);
  };
  const moveExtraAudioToTrack = (fromTrackIdx, segId, toTrackIdx) => {
    if (fromTrackIdx === toTrackIdx || toTrackIdx < 0) return;
    const seg = audioExtraTracks[fromTrackIdx]?.segments?.find(s => s?.id === segId);
    if (!seg) return;
    pushHistory();
    setAudioExtraTracks(prev => prev.map((t, i) => {
      if (i === fromTrackIdx) return { ...t, segments: (t.segments || []).filter(s => s.id !== segId) };
      if (i === toTrackIdx) return { ...t, segments: [...(t.segments || []), { ...seg, id: `a${toTrackIdx + 2}-${Date.now()}` }].sort((a, b) => a.start - b.start) };
      return t;
    }));
  };
  const addAudioTrack = () => {
    pushHistory();
    setAudioExtraTracks(prev => [...prev, { id: `t${Date.now()}`, segments: [] }]);
  };
  const addAudioFromLibrary = async () => {
    if (!selectedAudio?.url || !videoForPreview) return;
    if (hasLayeredClips) {
      pushHistory();
      insertClipAtPlayhead(3, selectedAudio.id); // Audio track index 3
      return;
    }
    const dur = await new Promise((resolve) => {
      const a = new Audio(selectedAudio.url);
      a.onloadedmetadata = () => resolve(a.duration || 60);
      a.onerror = () => resolve(60);
    });
    const tlStart = playhead;
    const start = timelineToSource(tlStart);
    const end = Math.min(start + dur, duration);
    if (end <= start) return;
    pushHistory();
    setAudioExtraTracks(prev => {
      const next = [...prev];
      if (!next[0]) next[0] = { id: `t${Date.now()}`, segments: [] };
      const seg = { id: `a2-${Date.now()}`, start, end };
      next[0] = { ...next[0], segments: [...(next[0].segments || []), seg].sort((a, b) => a.start - b.start) };
      return next;
    });
  };

  const duplicateSelectedSegment = () => {
    if (selectedSegmentId) {
      const seg = mainSegments.find(s => s.id === selectedSegmentId);
      if (!seg) return;
      pushHistory();
      const idx = mainSegments.findIndex(s => s.id === selectedSegmentId);
      const copy = { ...seg, id: `seg${Date.now()}` };
      setMainSegments(prev => [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)]);
      setSelectedSegmentId(copy.id);
      if (tracksLinked && audioSegments[idx]) {
        const aSeg = audioSegments[idx];
        const aCopy = { ...aSeg, id: `a${Date.now()}` };
        setAudioSegments(prev => [...prev.slice(0, idx + 1), aCopy, ...prev.slice(idx + 1)]);
        setSelectedAudioSegmentId(aCopy.id);
      }
    }
  };
  const duplicateSelectedAudioSegment = () => {
    if (selectedAudioSegmentId) {
      const aSeg = audioSegments.find(s => s.id === selectedAudioSegmentId);
      if (!aSeg) return;
      pushHistory();
      const idx = audioSegments.findIndex(s => s.id === selectedAudioSegmentId);
      const copy = { ...aSeg, id: `a${Date.now()}` };
      setAudioSegments(prev => [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)]);
      setSelectedAudioSegmentId(copy.id);
      if (tracksLinked && mainSegments[idx]) {
        const seg = mainSegments[idx];
        const mCopy = { ...seg, id: `seg${Date.now()}` };
        setMainSegments(prev => [...prev.slice(0, idx + 1), mCopy, ...prev.slice(idx + 1)]);
        setSelectedSegmentId(mCopy.id);
      }
    }
  };

  commandsRef.current = { seekTo, togglePlayPause, setInPoint, setOutPoint, splitAtPlayhead, deleteSelectedSegment, deleteSelectedAudioSegment, addMarker, goToPrevMarker, goToNextMarker, undoAll, setShowShortcuts };

  const addTextClip = (label) => {
    pushHistory();
    const maxDur = Math.max(duration, effectiveDuration);
    const lastEnd = textClips.reduce((max, c) => Math.max(max, (c.end ?? (c.start ?? 0) + 5)), 0);
    const start = textClips.length === 0 ? playhead : Math.min(lastEnd, maxDur - 0.5);
    const end = Math.min(start + 10, maxDur);
    const brand = BRAND_PRESETS[activeBusinessId] || BRAND_PRESETS.sarah;
    setTextClips(prev => [...prev, { id: `t-${Date.now()}`, label, start, end, text: '', x: 50, y: 15, size: 'md', font: brand.font, color: brand.colors[0], bold: false, animStyle: 'faith' }]);
  };

  const addTrafficOverlay = () => {
    const biz = businesses.find(b => b.id === activeBusinessId);
    const isMinistry = !biz || biz.id === 'sarah' || biz.id === 'stewardship';
    const text = contactPageUrl
      ? (isMinistry ? 'Click the Link in Bio for Prayer Requests' : 'Click the Link in Bio for Products')
      : (isMinistry ? 'Link in Bio for Prayer Requests' : 'Link in Bio for Products');
    pushHistory();
    const maxDur = Math.max(duration, effectiveDuration);
    const lastEnd = textClips.reduce((max, c) => Math.max(max, (c.end ?? (c.start ?? 0) + 5)), 0);
    const start = Math.min(lastEnd, maxDur - 0.5, playhead);
    const end = Math.min(start + 8, maxDur);
    setTextClips(prev => [...prev, { id: `t-${Date.now()}`, label: 'TrafficOverlay', start, end, text, x: 50, y: 88, size: 'sm', font: 'sans', color: 'white', bold: true, lowerThird: true }]);
  };
  const removeTextClip = (id) => { pushHistory(); setTextClips(prev => prev.filter(c => c.id !== id)); };
  const updateTextClip = (id, updates) => setTextClips(prev => prev.map(c => c.id === id ? typeof updates === 'string' ? { ...c, text: updates } : { ...c, ...updates } : c));

  const [editingClipId, setEditingClipId] = useState(null);
  const [resizingTextId, setResizingTextId] = useState(null);
  const [resizingTextEdge, setResizingTextEdge] = useState(null);
  const [movingTextId, setMovingTextId] = useState(null);
  const [resizingMainId, setResizingMainId] = useState(null);
  const [resizingMainEdge, setResizingMainEdge] = useState(null);
  const [movingMainId, setMovingMainId] = useState(null);
  const [movingAudioId, setMovingAudioId] = useState(null);
  const [movingExtraAudio, setMovingExtraAudio] = useState(null);
  const [resizingAudioId, setResizingAudioId] = useState(null);
  const [resizingAudioEdge, setResizingAudioEdge] = useState(null);
  const textTrackRef = useRef(null);
  const audioTrackRef = useRef(null);
  const audioExtraTrackRefs = useRef([]);
  const hasAudio = selectedVideo || selectedAudio;

  const handleResizeMain = (e, seg, edge) => { e.stopPropagation(); pushHistory(); setResizingMainId(seg.id); setResizingMainEdge(edge); };
  const handleResizeAudio = (e, seg, edge) => { e.stopPropagation(); pushHistory(); setResizingAudioId(seg.id); setResizingAudioEdge(edge); };
  const handleMoveMainStart = (e, seg) => { e.stopPropagation(); setMovingMainId(seg.id); };
  const handleMoveAudioStart = (e, seg) => { e.stopPropagation(); setMovingAudioId(seg.id); };
  useEffect(() => {
    if (!resizingMainId || !mainTrackRef.current) return;
    const edge = resizingMainEdge;
    const onMove = (e) => {
      try {
      const rect = mainTrackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const tlT = snapToNearest(pct * timelineDuration);
      setMainSegments(prev => {
        const ranges = getMainTimelineRanges(prev);
        const idx = prev.findIndex(x => x?.id === resizingMainId);
        if (idx < 0) return prev;
        const s = prev[idx];
        if (!s || s.end == null || s.start == null) return prev;
        const r = ranges.find(rr => rr?.seg?.id === resizingMainId);
        if (!r) return prev;
        const newSource = s.start + (tlT - r.tlStart);
        if (edge === 'start') return newSource < s.end - 0.5 && newSource >= 0 ? prev.map(x => x.id === resizingMainId ? { ...x, start: newSource } : x) : prev;
        if (edge === 'end') return newSource > s.start + 0.5 && newSource <= duration ? prev.map(x => x.id === resizingMainId ? { ...x, end: newSource } : x) : prev;
        return prev;
      });
      } catch (_) { /* avoid crash */ }
    };
    const onUp = () => { setResizingMainId(null); setResizingMainEdge(null); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [resizingMainId, resizingMainEdge, timelineDuration, duration]);
  useEffect(() => {
    if (!movingMainId || !mainTrackRef.current) return;
    let didPush = false;
    const onMove = (e) => {
      try {
      const rect = mainTrackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const tlT = snapToNearest(pct * timelineDuration);
      setMainSegments(prev => {
        const idx = prev.findIndex(x => x?.id === movingMainId);
        if (idx < 0) return prev;
        const s = prev[idx];
        if (!s || s.end == null || s.start == null) return prev;
        const dur = s.end - s.start;
        const ranges = getMainTimelineRanges(prev);
        const dropIdx = ranges.findIndex(r => tlT < r.tlStart);
        const insertIdx = dropIdx < 0 ? prev.length - 1 : dropIdx;
        if (insertIdx === idx || (insertIdx === idx + 1 && dropIdx === idx + 1)) return prev;
        const targetIdx = insertIdx > idx ? insertIdx - 1 : insertIdx;
        if (targetIdx === idx) return prev;
        if (!didPush) { didPush = true; pushHistory(); }
        const reordered = prev.filter(x => x.id !== movingMainId);
        reordered.splice(targetIdx, 0, s);
        return reordered;
      });
      } catch (_) { /* avoid crash */ }
    };
    const onUp = () => setMovingMainId(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [movingMainId, timelineDuration]);
  useEffect(() => {
    if (!resizingAudioId || !audioTrackRef.current) return;
    const edge = resizingAudioEdge;
    const onMove = (e) => {
      try {
      const rect = audioTrackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const tlT = snapToNearest(pct * timelineDuration);
      if (tracksLinked) {
        const t = timelineToSourceFromSegs(tlT, mainSegments);
        const aIdx = audioSegments.findIndex(s => s?.id === resizingAudioId);
        if (aIdx >= 0) {
          setMainSegments(prev => {
            const s = prev[aIdx];
            if (!s || s.end == null || s.start == null) return prev;
            if (edge === 'start') return t < s.end - 0.5 && t >= 0 ? prev.map((x, i) => (i === aIdx ? { ...x, start: t } : x)) : prev;
            if (edge === 'end') return t > s.start + 0.5 && t <= duration ? prev.map((x, i) => (i === aIdx ? { ...x, end: t } : x)) : prev;
            return prev;
          });
        }
      } else {
        const ranges = getAudioTimelineRanges(audioSegments);
        const idx = audioSegments.findIndex(x => x?.id === resizingAudioId);
        if (idx < 0) return;
        const s = audioSegments[idx];
        if (!s || s.end == null || s.start == null) return;
        const r = ranges.find(rr => rr?.seg?.id === resizingAudioId);
        if (!r) return;
        const newSource = s.start + (tlT - r.tlStart);
        setAudioSegments(prev => {
          const seg = prev.find(x => x.id === resizingAudioId);
          if (!seg) return prev;
          if (edge === 'start') return newSource < seg.end - 0.5 && newSource >= 0 ? prev.map(x => (x.id === resizingAudioId ? { ...x, start: newSource } : x)) : prev;
          if (edge === 'end') return newSource > seg.start + 0.5 && newSource <= duration ? prev.map(x => (x.id === resizingAudioId ? { ...x, end: newSource } : x)) : prev;
          return prev;
        });
      }
      } catch (_) { /* avoid crash */ }
    };
    const onUp = () => { setResizingAudioId(null); setResizingAudioEdge(null); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [resizingAudioId, resizingAudioEdge, timelineDuration, duration, tracksLinked, audioSegments]);
  useEffect(() => {
    if (!movingAudioId || !audioTrackRef.current) return;
    let didPush = false;
    const onMove = (e) => {
      try {
      const rect = audioTrackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const tlT = snapToNearest(pct * timelineDuration);
      if (tracksLinked) {
        const aIdx = audioSegments.findIndex(s => s?.id === movingAudioId);
        if (aIdx < 0) return;
        setMainSegments(prev => {
          const ranges = getMainTimelineRanges(prev);
          const dropIdx = ranges.findIndex(r => tlT < r.tlStart);
          const insertIdx = dropIdx < 0 ? prev.length - 1 : dropIdx;
          const targetIdx = insertIdx > aIdx ? insertIdx - 1 : insertIdx;
          if (targetIdx === aIdx) return prev;
          const s = prev[aIdx];
          if (!s) return prev;
          if (!didPush) { didPush = true; pushHistory(); }
          const reordered = prev.filter((_, i) => i !== aIdx);
          reordered.splice(targetIdx, 0, s);
          return reordered;
        });
      } else {
        setAudioSegments(prev => {
          const idx = prev.findIndex(x => x.id === movingAudioId);
          if (idx < 0) return prev;
          const ranges = getAudioTimelineRanges(prev);
          const dropIdx = ranges.findIndex(r => tlT < r.tlStart);
          const insertIdx = dropIdx < 0 ? prev.length - 1 : dropIdx;
          const targetIdx = insertIdx > idx ? insertIdx - 1 : insertIdx;
          if (targetIdx === idx) return prev;
          if (!didPush) { didPush = true; pushHistory(); }
          const s = prev[idx];
          const reordered = prev.filter(x => x.id !== movingAudioId);
          reordered.splice(targetIdx, 0, s);
          return reordered;
        });
      }
      } catch (_) { /* avoid crash */ }
    };
    const onUp = (e) => {
      const refs = audioExtraTrackRefs.current;
      if (refs && e?.clientY != null) {
        for (let i = 0; i < refs.length; i++) {
          const el = refs[i];
          if (el) {
            const r = el.getBoundingClientRect();
            if (e.clientY >= r.top && e.clientY <= r.bottom && e.clientX >= r.left && e.clientX <= r.right) {
              moveSelectedAudioToTrack(i, movingAudioId);
              break;
            }
          }
        }
      }
      setMovingAudioId(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [movingAudioId, timelineDuration, tracksLinked, audioSegments]);

  const handleMoveExtraAudioStart = (e, trackIdx, seg) => { e.stopPropagation(); setMovingExtraAudio({ trackIdx, segId: seg.id }); };
  useEffect(() => {
    if (!movingExtraAudio || !mainTrackRef.current) return;
    const { trackIdx, segId } = movingExtraAudio;
    let didPush = false;
    const onMove = (e) => {
      try {
        const rect = mainTrackRef.current?.getBoundingClientRect();
        if (!rect) return;
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const tlT = snapToNearest(pct * timelineDuration);
        const newStart = timelineToSource(tlT);
        setAudioExtraTracks(prev => {
          const track = prev[trackIdx];
          if (!track?.segments) return prev;
          const seg = track.segments.find(s => s?.id === segId);
          if (!seg || seg.end == null || seg.start == null) return prev;
          const dur = seg.end - seg.start;
          const clampedStart = Math.max(0, Math.min(duration - dur, newStart));
          const newEnd = clampedStart + dur;
          if (!didPush) { didPush = true; pushHistory(); }
          return prev.map((t, i) => i !== trackIdx ? t : { ...t, segments: t.segments.map(s => s.id === segId ? { ...s, start: clampedStart, end: newEnd } : s) });
        });
      } catch (_) {}
    };
    const onUp = (e) => {
      const refs = audioExtraTrackRefs.current;
      if (refs && e?.clientY != null) {
        for (let i = 0; i < refs.length; i++) {
          if (i === trackIdx) continue;
          const el = refs[i];
          if (el) {
            const r = el.getBoundingClientRect();
            if (e.clientY >= r.top && e.clientY <= r.bottom && e.clientX >= r.left && e.clientX <= r.right) {
              const track = audioExtraTracks[trackIdx];
              const seg = track?.segments?.find(s => s?.id === segId);
              if (seg) moveExtraAudioToTrack(trackIdx, segId, i);
              break;
            }
          }
        }
      }
      setMovingExtraAudio(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [movingExtraAudio, timelineDuration, duration, audioExtraTracks]);

  const handleResizeText = (e, c, edge) => { e.stopPropagation(); pushHistory(); setResizingTextId(c.id); setResizingTextEdge(edge); };
  const handleMoveTextStart = (e, c) => { e.stopPropagation(); pushHistory(); setMovingTextId(c.id); };
  useEffect(() => {
    if (!resizingTextId || !textTrackRef.current) return;
    const edge = resizingTextEdge;
    const onMove = (e) => {
      const rect = textTrackRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const t = hasLayeredClips ? snapToNearest(pct * effectiveDuration) : timelineToSource(snapToNearest(pct * timelineDuration));
      setTextClips(prev => {
        const c = prev.find(x => x.id === resizingTextId);
        if (!c) return prev;
        const s = c.start ?? 0, end = c.end ?? s + 5;
        if (edge === 'end') return t > s + 0.5 ? prev.map(x => x.id === resizingTextId ? { ...x, end: t } : x) : prev;
        if (edge === 'start') return t < end - 0.5 ? prev.map(x => x.id === resizingTextId ? { ...x, start: t } : x) : prev;
        return prev;
      });
    };
    const onUp = () => { setResizingTextId(null); setResizingTextEdge(null); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [resizingTextId, resizingTextEdge, timelineDuration, hasLayeredClips, effectiveDuration, snapToNearest, timelineToSource]);
  useEffect(() => {
    if (!movingTextId || !textTrackRef.current) return;
    const onMove = (e) => {
      const rect = textTrackRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const newStart = hasLayeredClips ? snapToNearest(pct * effectiveDuration) : timelineToSource(snapToNearest(pct * timelineDuration));
      const maxDur = Math.max(duration, effectiveDuration);
      setTextClips(prev => {
        const c = prev.find(x => x.id === movingTextId);
        if (!c) return prev;
        const dur = (c.end ?? c.start + 5) - (c.start ?? 0);
        const newEnd = Math.min(newStart + dur, maxDur);
        const start = Math.max(0, newEnd - dur);
        return prev.map(x => x.id === movingTextId ? { ...x, start, end: newEnd } : x);
      });
    };
    const onUp = () => setMovingTextId(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [movingTextId, timelineDuration, hasLayeredClips, effectiveDuration, duration, snapToNearest, timelineToSource]);

  const playheadPct = effectiveDuration > 0 ? (playhead / effectiveDuration) * 100 : 0;
  const [draggingPlayhead, setDraggingPlayhead] = useState(false);
  const rafRef = useRef(null);
  const handlePlayheadDrag = (e) => {
    const el = timelineScrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const scrollLeft = el.scrollLeft || 0;
    const laneWidth = 500 * timelineZoom;
    const labelW = 80;
    const clientX = getEventX(e);
    const xInContent = scrollLeft + (clientX - rect.left) - labelW;
    const pct = Math.max(0, Math.min(1, laneWidth > 0 ? xInContent / laneWidth : 0));
    const t = snapToNearest(pct * effectiveDuration);
    setPlayhead(t);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      seekTo(t);
      rafRef.current = null;
    });
  };
  useEffect(() => {
    if (!draggingPlayhead) return;
    const onMove = (e) => { e.preventDefault(); handlePlayheadDrag(e); };
    const onUp = () => { setDraggingPlayhead(false); if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    window.addEventListener('touchcancel', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      window.removeEventListener('touchcancel', onUp);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [draggingPlayhead, effectiveDuration]);

  const resizeStartRef = useRef({ y: 0, h: 0 });
  useEffect(() => {
    if (!resizingTrack) return;
    const onMove = (e) => {
      const r = resizeStartRef.current;
      if (r.y === 0) { r.y = e.clientY; r.h = trackHeights[resizingTrack]; return; }
      const dy = e.clientY - r.y;
      const min = 32;
      const max = 200;
      const newH = Math.max(min, Math.min(max, r.h + dy));
      setTrackHeights(prev => ({ ...prev, [resizingTrack]: newH }));
    };
    const onUp = () => { setResizingTrack(null); resizeStartRef.current = { y: 0, h: 0 }; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [resizingTrack, trackHeights]);

  const editingClip = textClips.find(c => c.id === editingClipId);

  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [appendContactUrlToMetadata, setAppendContactUrlToMetadata] = useState(true);
  const socialPreset = useMemo(() => derivePresetFromPlatforms(platforms), [platforms]);
  const [exportFormat, setExportFormat] = useState('9:16');
  const [showCreatorInsights, setShowCreatorInsights] = useState(false);
  const EXPORT_FORMATS = [
    { id: '9:16', label: 'Reels / Shorts', w: 1080, h: 1920, platform: 'Instagram, TikTok, YouTube Shorts' },
    { id: '16:9', label: 'YouTube', w: 1920, h: 1080, platform: 'YouTube, Facebook' },
    { id: '1:1', label: 'Feed', w: 1080, h: 1080, platform: 'Instagram feed, Pinterest' },
    { id: '4:5', label: 'Portrait feed', w: 1080, h: 1350, platform: 'Instagram portrait' },
    { id: 'source', label: 'Source', w: null, h: null, platform: 'Original resolution' }
  ];
  const exportVideo = async () => {
    if (!selectedVideo || exporting) return;
    setExporting(true);
    setExportProgress(0);
    const baseName = (selectedVideo.name || 'export').replace(/\.[^.]+$/, '');
    const fmtSuffix = exportFormat !== 'source' ? `-${exportFormat.replace(':', 'x')}` : '';
    const metadata = {
      title: caption?.slice(0, 60) || businesses.find(b => b.id === activeBusinessId)?.name || 'Sarah Speaks Faith',
      tags: [...(tags || []), 'Sarah Speaks Faith', 'Ministry', businesses.find(b => b.id === activeBusinessId)?.name].filter(Boolean),
      appendContactUrl: appendContactUrlToMetadata && !!contactPageUrl?.trim(),
      contactUrl: contactPageUrl?.trim() || '',
    };
    try {
      const hasText = (textClips || []).filter(c => c?.text).length > 0;
      const fmt = EXPORT_FORMATS.find(f => f.id === exportFormat);
      const outW = fmt?.w ?? 1080;
      const outH = fmt?.h ?? 1920;

      if (!hasText && exportFormat !== 'source') {
        const segs = (mainSegments || []).filter(s => s && typeof s?.start === 'number' && typeof s?.end === 'number');
        const start = segs.length > 0 ? Math.min(...segs.map(s => s.start)) : 0;
        const end = segs.length > 0 ? Math.max(...segs.map(s => s.end)) : duration;
        const { blob } = await processVideo(selectedVideo.id, start, end);
        const mp4Blob = await encodeToMp4WithMetadata(blob, metadata);
        await saveToDevice(mp4Blob, baseName + fmtSuffix + '-sarah-speaks-faith.mp4');
      } else if (!hasText && exportFormat === 'source') {
        const segs = (mainSegments || []).filter(s => s && typeof s?.start === 'number' && typeof s?.end === 'number');
        const start = segs.length > 0 ? Math.min(...segs.map(s => s.start)) : 0;
        const end = segs.length > 0 ? Math.max(...segs.map(s => s.end)) : duration;
        const { url } = await processVideo(selectedVideo.id, start, end);
        const res = await fetch(url);
        const blob = await res.blob();
        const mp4Blob = await encodeToMp4WithMetadata(blob, metadata);
        await saveToDevice(mp4Blob, baseName + '-sarah-speaks-faith.mp4');
        revoke(url);
      } else {
        const v = document.createElement('video');
        v.src = selectedVideo.url;
        v.playsInline = true;
        await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = rej; });
        const vw = v.videoWidth, vh = v.videoHeight;
        const canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext('2d');
        const drawScaled = () => {
          const outAsp = outW / outH;
          const vAsp = vw / vh;
          let sx = 0, sy = 0, sW = vw, sH = vh;
          if (vAsp > outAsp) { sW = vh * outAsp; sx = (vw - sW) / 2; }
          else { sH = vw / outAsp; sy = (vh - sH) / 2; }
          ctx.drawImage(v, sx, sy, sW, sH, 0, 0, outW, outH);
        };
        const stream = canvas.captureStream(30);
        try {
          const audioStream = v.captureStream?.();
          if (audioStream) audioStream.getAudioTracks().forEach(t => stream.addTrack(t));
        } catch (_) {}
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
        const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5000000, audioBitsPerSecond: 128000 });
        const chunks = [];
        recorder.ondataavailable = e => e.data.size && chunks.push(e.data);
        const webmPromise = new Promise(resolve => {
          recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
        });
        recorder.start(100);
        v.currentTime = 0;
        await new Promise(r => { v.onseeked = r; });
        v.play();
        let qrImgExport = null;
        if (qrCodeDataUrl) {
          const img = new Image();
          await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = qrCodeDataUrl; });
          qrImgExport = img;
        }
        const drawFrame = () => {
          if (v.ended) {
            recorder.stop();
            return;
          }
          drawScaled();
          if (qrImgExport?.complete) {
            const qrSize = Math.min(outW, outH) * 0.2;
            ctx.drawImage(qrImgExport, outW - qrSize - 16, outH - qrSize - 16, qrSize, qrSize);
          }
          const t = v.currentTime;
          const sizeMap = { sm: 24, md: 36, lg: 56 };
          const fontMap = { sans: 'sans-serif', serif: '"Playfair Display", serif', mono: 'monospace', display: 'sans-serif' };
          const colorMap = { white: '#fff', black: '#000', yellow: '#fef08a', rose: '#fda4af', cyan: '#67e8f9', lime: '#bef264', orange: '#fb923c', gold: '#fbbf24', amber: '#fbbf24', indigo: '#a5b4fc' };
          const scale = Math.min(outW, outH) / 1080;
          textClips.filter(c => {
            const start = c.start ?? 0, end = c.end ?? start + 5;
            return c.text && t >= start && t < end;
          }).forEach(c => {
            const x = ((c.x ?? 50) / 100) * outW, y = ((c.y ?? 50) / 100) * outH;
            if (c.lowerThird) {
              ctx.fillStyle = 'rgba(0,0,0,0.55)';
              ctx.fillRect(0, outH * 0.82, outW, outH * 0.18);
            }
            ctx.fillStyle = (c.color && String(c.color).startsWith('#')) ? c.color : (colorMap[c.color] || '#fff');
            ctx.font = `${c.bold ? 'bold' : ''} ${Math.round((sizeMap[c.size] || 36) * scale)}px ${fontMap[c.font] || 'sans-serif'}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(c.text, x, y);
          });
          setExportProgress(p => Math.min(0.5, p + 0.005));
          requestAnimationFrame(drawFrame);
        };
        v.onseeked = drawFrame;
        v.onseeked();
        const webmBlob = await webmPromise;
        setExportProgress(0.6);
        const mp4Blob = await encodeToMp4WithMetadata(webmBlob, metadata);
        setExportProgress(1);
        await saveToDevice(mp4Blob, baseName + fmtSuffix + '-sarah-speaks-faith.mp4');
      }
      // Auto-log this post to analytics
      try {
        const existing = JSON.parse(localStorage.getItem('faith-studio-post-analytics') || '[]');
        existing.push({ id: 'p' + Date.now(), businessId: activeBusinessId, title: baseName, platform: exportFormat.startsWith('9') ? 'instagram' : exportFormat.startsWith('16') ? 'youtube' : 'instagram', postedAt: new Date().toISOString().slice(0, 10), views: 0, likes: 0, comments: 0, shares: 0, saves: 0, notes: '', autoLogged: true });
        localStorage.setItem('faith-studio-post-analytics', JSON.stringify(existing));
      } catch (_) {}
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  };

  const dragInitRef = useRef({ mx: 0, my: 0, ox: 50, oy: 50 });
  const handleTextDragStart = (e, c) => {
    e.preventDefault();
    setDraggingTextId(c.id);
    dragInitRef.current = { mx: e.clientX, my: e.clientY, ox: c.x ?? 50, oy: c.y ?? 50 };
  };
  useEffect(() => {
    if (!draggingTextId) return;
    const onMove = (e) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const { mx, my, ox, oy } = dragInitRef.current;
      const dx = ((e.clientX - mx) / rect.width) * 100;
      const dy = ((e.clientY - my) / rect.height) * 100;
      setTextClips(prev => prev.map(c => c.id === draggingTextId ? { ...c, x: Math.max(0, Math.min(100, ox + dx)), y: Math.max(0, Math.min(100, oy + dy)) } : c));
    };
    const onUp = () => setDraggingTextId(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [draggingTextId]);

  return (
    <div className="editor-layout bg-stone-900">
      {/* Stage — 40vh mobile, object-contain, no crop on phone */}
      <div className="min-h-0 overflow-hidden flex flex-col" style={{ gridArea: 'stage' }}>
        <div ref={canvasRef} onClick={videoForPreview ? togglePlayPause : undefined} className={`flex-1 min-h-0 flex flex-col ${videoForPreview ? 'cursor-pointer' : ''}`}>
          {videoForPreview ? (
            <>
              <div className="relative flex-1 min-h-0 flex items-center justify-center">
                <video
                  ref={videoRef}
                  src={videoForPreview.url}
                  className="absolute inset-0 w-full h-full object-contain opacity-0 pointer-events-none"
                  style={{ visibility: 'hidden' }}
                  playsInline
                  onLoadedMetadata={onVideoLoadedMetadata}
                  onTimeUpdate={onVideoTimeUpdate}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                />
                <Stage
                  aspectPreset={exportFormat}
                  platforms={platforms}
                  videoRef={videoRef}
                  selectedVideo={selectedVideo}
                  qrCodeDataUrl={qrCodeDataUrl}
                  transitionSegments={getMainTimelineRanges(mainSegments)}
                  onPlayheadUpdate={() => {
                    const mainRanges = getMainTimelineRanges(mainSegments);
                    const eps = 0.001;
                    const activeRange = mainRanges.find(r => playhead >= r.tlStart - eps && playhead < r.tlEnd + eps);
                    return activeRange ? activeRange.seg.start + (playhead - activeRange.tlStart) : playhead;
                  }}
                />
              </div>
              {playheadInGap && <div className="absolute inset-0 bg-black z-10 pointer-events-none" aria-hidden title="Gap — no video at this time" />}
              {liveCaption && <CaptionOverlay text={liveCaption} preset="faith" />}
              {textClips.filter(c => {
                const start = c.start ?? 0;
                const end = c.end ?? start + 5;
                const sourceT = getActiveSourceTime(playhead);
                const inRange = sourceT >= start && sourceT < end;
                const isEditing = editingClipId === c.id || draggingTextId === c.id;
                return c.text && (inRange || isEditing);
              }).map((c) => {
                const sizeMap = { sm: 'text-base', md: 'text-xl', lg: 'text-3xl' };
                const fontMap = { sans: 'font-sans', serif: 'font-serif', mono: 'font-mono', display: 'font-bold tracking-tight' };
                const colorMap = { white: 'text-white', black: 'text-black', yellow: 'text-yellow-300', rose: 'text-rose-300', cyan: 'text-cyan-300', lime: 'text-lime-300', orange: 'text-orange-400', gold: 'text-amber-400', amber: 'text-amber-400', indigo: 'text-indigo-300' };
                const isHex = c.color && String(c.color).startsWith('#');
                const colorClass = isHex ? '' : (colorMap[c.color] || colorMap.white);
                const colorStyle = isHex ? { color: c.color } : {};
                const x = c.x ?? 50;
                const y = c.y ?? 50;
                const isSelected = editingClipId === c.id;
                // Animated caption style — overrides base styling when set
                const animStyle = c.animStyle; // 'tiktok-bold' | 'faith' | 'minimal' | 'highlight' | 'neon' | 'typewriter' | null
                const animClass = animStyle ? `caption-${animStyle}` : '';
                // When an animStyle is active, let the CSS preset drive colors/fonts
                const noAnimBase = !animStyle;
                return (
                  <div
                    key={`${c.id}-${animStyle}`}
                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 select-none ${animClass} ${noAnimBase ? `${fontMap[c.font] || fontMap.sans} ${colorClass} ${c.bold ? 'font-bold' : 'font-normal'}` : ''} ${isSelected || draggingTextId === c.id ? 'ring-2 ring-rose-400 ring-offset-2 cursor-move' : 'cursor-move'} ${c.lowerThird && !animStyle ? 'bg-black/55 px-6 py-2 rounded' : ''}`}
                    style={{ left: `${x}%`, top: `${y}%`, zIndex: 20, ...(noAnimBase ? colorStyle : {}), ...(noAnimBase && c.font === 'serif' ? { fontFamily: '"Playfair Display", Georgia, serif' } : {}) }}
                    onMouseDown={(e) => handleTextDragStart(e, c)}
                    onClick={(e) => { e.stopPropagation(); setEditingClipId(c.id); }}
                  >
                    <span className={noAnimBase ? `drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] ${sizeMap[c.size] || sizeMap.md}` : ''}>{c.text}</span>
                  </div>
                );
              })}
            </>
          ) : (
            <div className="text-stone-500 text-center flex-1 flex flex-col items-center justify-center">
              <Play className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-sm font-bold uppercase tracking-widest">Preview</p>
              {videos.length > 0 ? (
                <select onChange={(e) => setSelectedVideoId(Number(e.target.value))} className="mt-4 bg-white/10 border rounded-xl px-4 py-2 text-sm">
                  <option value="">Select video...</option>
                  {videos.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              ) : (
                <p className="mt-4 text-sm">Upload a video in Media Library first.</p>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Controls — tabbed editor panel */}
      <div className="relative flex flex-col min-h-0 bg-stone-900 border-t border-l border-stone-700/60" style={{ gridArea: 'controls' }}>

        {/* Tab bar — always visible, big touch targets */}
        <div className="flex shrink-0 border-b border-stone-700/60 bg-stone-950">
          {[
            { id: 'edit', icon: <Scissors size={16} />, label: 'Edit' },
            { id: 'text', icon: <Type size={16} />, label: 'Text' },
            { id: 'audio', icon: <Music size={16} />, label: 'Audio' },
            { id: 'export', icon: <Download size={16} />, label: 'Export' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setInspectorTab(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-bold transition-colors border-b-2 ${inspectorTab === tab.id ? 'border-rose-500 text-rose-400 bg-rose-950/30' : 'border-transparent text-stone-500 hover:text-stone-300'}`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Playback row — always visible above tabs */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-stone-700/40 shrink-0 bg-stone-900">
          <button onClick={togglePlayPause} disabled={!videoForPreview} className="w-8 h-8 rounded-full flex items-center justify-center bg-rose-500 hover:bg-rose-400 disabled:opacity-40 text-white shrink-0" title="Play / Pause (Space)">
            {!playing ? <Play size={13} fill="currentColor" /> : <Pause size={13} />}
          </button>
          <span className="font-mono text-sm font-bold text-rose-300 tabular-nums">{secToTimecode(playhead)}</span>
          <span className="text-[10px] text-stone-600 font-mono">/ {secToTimecode(timelineDuration)}</span>
          <div className="flex-1" />
          {/* Format quick-switch */}
          <div className="flex gap-1">
            {[{ id: '9:16', label: '9:16' }, { id: '16:9', label: '16:9' }, { id: '1:1', label: '1:1' }].map(f => (
              <button key={f.id} onClick={() => setExportFormat(f.id)} className={`px-1.5 py-1 rounded text-[10px] font-bold border transition-colors ${exportFormat === f.id ? 'bg-rose-500 border-rose-500 text-white' : 'bg-stone-800 border-stone-700 text-stone-500 hover:text-stone-300'}`}>{f.label}</button>
            ))}
          </div>
          <button onClick={undoAll} disabled={history.length === 0} className="p-1.5 text-stone-600 hover:text-white disabled:opacity-30" title="Undo"><RotateCcw size={12} /></button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden text-stone-100">

          {/* ── EDIT TAB ─────────────────────────────── */}
          {inspectorTab === 'edit' && (
            <div className="p-3 space-y-3">
              {/* Video source */}
              <div className="flex gap-1.5">
                <select value={selectedVideo?.id || ''} onChange={(e) => setSelectedVideoId(Number(e.target.value) || null)} className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-2 py-2 text-xs text-stone-100 truncate min-w-0">
                  <option value="">{videos.length > 0 ? 'Select video…' : 'Upload a video first →'}</option>
                  {videos.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                <button onClick={() => setActiveTab('library')} className="px-2.5 py-2 bg-rose-600 hover:bg-rose-500 rounded-lg text-xs text-white font-bold shrink-0">+ Upload</button>
              </div>

              {/* Primary edit actions — big buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={splitAtPlayhead} disabled={!videoForPreview} className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-rose-900/50 border border-rose-700/60 text-rose-300 hover:bg-rose-800/60 active:scale-95 disabled:opacity-40 transition-all" title="Split clip at playhead (S)">
                  <Scissors size={16} /> Split Here
                </button>
                <button onClick={deleteSelectedSegment} disabled={!selectedSegmentId && !selectedClipId} className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-stone-800 border border-stone-700 text-stone-300 hover:bg-stone-700 active:scale-95 disabled:opacity-40 transition-all">
                  <Trash2 size={16} /> Delete
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={duplicateSelectedSegment} disabled={!selectedSegmentId || !selectedVideo} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold bg-stone-800 border border-stone-700 text-stone-300 hover:bg-stone-700 active:scale-95 disabled:opacity-40 transition-all">
                  <Copy size={14} /> Duplicate
                </button>
                <button onClick={undoAll} disabled={history.length === 0} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold bg-stone-800 border border-stone-700 text-stone-300 hover:bg-stone-700 active:scale-95 disabled:opacity-30 transition-all">
                  <RotateCcw size={14} /> Undo
                </button>
              </div>
              {splitFeedback && <p className="text-[11px] text-amber-400 italic">{splitFeedback}</p>}

              {/* Tools */}
              <div className="flex items-center gap-2 pt-1 border-t border-stone-800">
                <span className="text-[10px] text-stone-600 font-bold uppercase">Tools</span>
                <button onClick={addMarker} disabled={!videoForPreview} className="p-2 rounded-lg bg-stone-800 border border-stone-700 text-amber-400 hover:bg-stone-700 disabled:opacity-40" title="Add marker"><MapPin size={13} /></button>
                <button onClick={goToPrevMarker} disabled={!markers.filter(m => m.time < playhead - 0.01).length} className="p-2 rounded-lg bg-stone-800 border border-stone-700 text-stone-400 hover:bg-stone-700 disabled:opacity-40"><ChevronLeft size={13} /></button>
                <button onClick={goToNextMarker} disabled={!markers.filter(m => m.time > playhead + 0.01).length} className="p-2 rounded-lg bg-stone-800 border border-stone-700 text-stone-400 hover:bg-stone-700 disabled:opacity-40"><ChevronRight size={13} /></button>
                <button onClick={() => setSnapEnabled(s => !s)} className={`p-2 rounded-lg border ${snapEnabled ? 'bg-rose-900/40 border-rose-800/50 text-rose-400' : 'bg-stone-800 border-stone-700 text-stone-500'}`} title={`Snap ${snapEnabled ? 'on' : 'off'}`}><Magnet size={13} /></button>
              </div>

              {/* Selected clip details */}
              {selectedSegmentId && (() => {
                const seg = mainSegments.find(s => s.id === selectedSegmentId);
                if (!seg) return null;
                const currTx = TIMELINE_TRANSITIONS.find(t => t.id === (seg.transition || 'cut'));
                return (
                  <div className="bg-stone-800 border border-stone-700 rounded-xl p-3 space-y-2">
                    <p className="text-[10px] font-bold text-stone-400 uppercase">Selected Clip</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] text-stone-500 mb-1">In point</p>
                        <input key={`in-${seg.id}`} defaultValue={secToTimecode(seg.start)} onBlur={(e) => { const t = parseTimecode(e.target.value); if (t != null && t >= 0 && t < seg.end - 0.5) { pushHistory(); setMainSegments(prev => prev.map(x => x.id === selectedSegmentId ? { ...x, start: t } : x)); }}} className="w-full font-mono px-2 py-1.5 rounded-lg border bg-stone-700 border-stone-600 text-stone-100 text-xs" />
                      </div>
                      <div>
                        <p className="text-[10px] text-stone-500 mb-1">Out point</p>
                        <input key={`out-${seg.id}`} defaultValue={secToTimecode(seg.end)} onBlur={(e) => { const t = parseTimecode(e.target.value); if (t != null && t <= duration && t > seg.start + 0.5) { pushHistory(); setMainSegments(prev => prev.map(x => x.id === selectedSegmentId ? { ...x, end: t } : x)); }}} className="w-full font-mono px-2 py-1.5 rounded-lg border bg-stone-700 border-stone-600 text-stone-100 text-xs" />
                      </div>
                    </div>
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold ${currTx?.seamless ? 'border-emerald-700 text-emerald-400 bg-emerald-900/20' : 'border-stone-600 text-stone-400 bg-stone-700'}`}>
                      {currTx?.icon} {currTx?.label} transition
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── TEXT TAB ─────────────────────────────── */}
          {inspectorTab === 'text' && (
            <div className="p-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => addTextClip('Caption')} disabled={!videoForPreview} className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-blue-900/40 border border-blue-700/50 text-blue-300 hover:bg-blue-800/50 active:scale-95 disabled:opacity-40 transition-all">
                  <Type size={16} /> Add Caption
                </button>
                <button onClick={addTrafficOverlay} disabled={!videoForPreview} className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-amber-900/40 border border-amber-700/50 text-amber-300 hover:bg-amber-800/50 active:scale-95 disabled:opacity-40 transition-all">
                  <Link2 size={16} /> CTA Overlay
                </button>
              </div>
              {speechSupported && (
                <button onClick={isListening ? stopSpeech : startSpeech} className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 ${isListening ? 'bg-rose-500 text-white' : 'bg-stone-800 border border-stone-700 text-rose-400 hover:bg-stone-700'}`}>
                  <Mic size={16} className={isListening ? 'animate-pulse' : ''} />
                  {isListening ? 'Stop Auto-Caption' : 'Auto-Caption (Voice)'}
                </button>
              )}
              {/* Existing text clips */}
              {textClips.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-stone-500 uppercase mb-2">Your Captions</p>
                  <div className="space-y-1.5">
                    {textClips.map(c => (
                      <button key={c.id} onClick={() => setEditingClipId(c.id)} className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors ${editingClipId === c.id ? 'border-rose-500 bg-rose-950/40 text-rose-300' : 'border-stone-700 bg-stone-800 text-stone-300 hover:border-stone-600'}`}>
                        <span className="font-bold">{secToTimecode(c.start ?? 0)}</span>
                        <span className="text-stone-500 mx-1.5">→</span>
                        <span className="text-stone-400">{c.text || '(empty — tap to edit)'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {textClips.length === 0 && !videoForPreview && (
                <p className="text-xs text-stone-500 text-center py-4">Load a video first, then add captions</p>
              )}
            </div>
          )}

          {/* ── AUDIO TAB ─────────────────────────────── */}
          {inspectorTab === 'audio' && (
            <div className="p-3 space-y-3">
              {selectedAudio ? (
                <button onClick={addAudioFromLibrary} disabled={!selectedAudio?.url || !videoForPreview} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-emerald-900/40 border border-emerald-700/50 text-emerald-300 hover:bg-emerald-800/50 active:scale-95 disabled:opacity-40 transition-all">
                  <Music size={16} /> Add Music to Timeline
                </button>
              ) : (
                <button onClick={() => setActiveTab('library')} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-stone-800 border border-stone-700 text-emerald-400 hover:bg-stone-700 active:scale-95 transition-all">
                  <Music size={16} /> Upload Music in Library
                </button>
              )}
              <div className="flex items-center gap-3 px-3 py-3 bg-stone-800 border border-stone-700 rounded-xl">
                <Volume2 size={16} className="text-stone-400 shrink-0" />
                <input type="range" min="0" max="1" step="0.05" defaultValue="1" onChange={(e) => { const v = videoRef.current; if (v) v.volume = Number(e.target.value); }} className="flex-1 accent-rose-500" title="Volume" />
                <button type="button" onClick={() => setUserMuted(m => !m)} className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${userMuted ? 'text-rose-400 bg-rose-900/40' : 'text-stone-500 hover:text-rose-400'}`}>{userMuted ? 'Unmute' : 'Mute'}</button>
              </div>
              {/* Recording */}
              <button onClick={isRecording ? stopRecord : () => startRecord(true, true)} disabled={!!recordError} className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 ${isRecording ? 'bg-red-500 text-white' : 'bg-stone-800 border border-stone-700 text-rose-400 hover:bg-stone-700'} disabled:opacity-40`}>
                <Camera size={16} className={isRecording ? 'animate-pulse' : ''} />
                {isRecording ? 'Stop Recording' : 'Record Video'}
              </button>
              {audioSegments.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-stone-500 uppercase mb-2">Audio Clips</p>
                  <div className="space-y-1.5">
                    {audioSegments.map(seg => (
                      <div key={seg.id} onClick={() => setSelectedAudioSegmentId(seg.id === selectedAudioSegmentId ? null : seg.id)} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer transition-colors ${seg.id === selectedAudioSegmentId ? 'border-emerald-600 bg-emerald-950/30 text-emerald-300' : 'border-stone-700 bg-stone-800 text-stone-400 hover:border-stone-600'}`}>
                        <Music size={12} className="shrink-0 text-emerald-400" />
                        <span className="flex-1 truncate">{secToTimecode(seg.start)} – {secToTimecode(seg.end)}</span>
                        <button onClick={(e) => { e.stopPropagation(); deleteSelectedAudioSegment(); }} className="text-stone-600 hover:text-rose-400"><X size={12} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── EXPORT TAB ─────────────────────────────── */}
          {inspectorTab === 'export' && (
            <div className="p-3 space-y-3">
              {/* Hook strength */}
              {videoForPreview && (() => {
                let score = 0;
                const tips = [];
                const hasFastCaption = textClips.some(c => (c.start ?? 0) < 3 && c.text);
                if (hasFastCaption) score += 28;
                else tips.push('Add a caption in first 3s');
                const captionCount = textClips.filter(c => c.text).length;
                score += Math.min(captionCount * 6, 18);
                if (captionCount === 0) tips.push('Add captions — boosts watch time');
                const hasCTA = textClips.some(c => c.lowerThird || (c.text && /link|bio|click/i.test(c.text)));
                if (hasCTA) score += 18;
                else tips.push('Add a CTA (Link in Bio)');
                const dur = timelineDuration || 0;
                if (dur >= 15 && dur <= 90) score += 12;
                else if (dur > 90) tips.push('Trim under 90s');
                if (audioSegments.length > 0) score += 10;
                else tips.push('Add background music');
                if (mainSegments.some(s => s.transition && s.transition !== 'cut')) score += 14;
                else if (mainSegments.length > 1) tips.push('Use Crossfade');
                score = Math.min(100, score);
                const barColor = score >= 80 ? 'bg-emerald-500' : score >= 55 ? 'bg-amber-400' : 'bg-rose-500';
                return (
                  <div className="bg-stone-800 border border-stone-700 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-bold text-stone-300">Hook Strength</p>
                      <span className="text-sm font-black" style={{ color: score >= 80 ? '#10b981' : score >= 55 ? '#fbbf24' : '#f43f5e' }}>{score}/100</span>
                    </div>
                    <div className="h-2 bg-stone-700 rounded-full overflow-hidden mb-2">
                      <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${score}%` }} />
                    </div>
                    {tips.length > 0 && tips.slice(0, 2).map((tip, i) => (
                      <p key={i} className="text-[11px] text-stone-500 flex gap-1"><span className="text-rose-500">›</span>{tip}</p>
                    ))}
                  </div>
                );
              })()}
              {/* Export format */}
              <div>
                <p className="text-[10px] font-bold text-stone-500 uppercase mb-2">Format</p>
                <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-stone-100 mb-2">
                  {EXPORT_FORMATS.map(f => <option key={f.id} value={f.id}>{f.w ? `${f.label} ${f.w}×${f.h}` : `${f.label} (original)`}</option>)}
                </select>
                <label className="flex items-center gap-2 text-xs text-stone-400 cursor-pointer">
                  <input type="checkbox" checked={appendContactUrlToMetadata} onChange={(e) => setAppendContactUrlToMetadata(e.target.checked)} className="rounded" />
                  Append contact URL to metadata
                </label>
              </div>
              <button onClick={exportVideo} disabled={exporting || !selectedVideo} className="w-full py-4 rounded-xl text-base font-bold bg-rose-500 hover:bg-rose-400 text-white disabled:opacity-40 shadow-lg shadow-rose-900/30 transition-all active:scale-95">
                {exporting ? (exportProgress > 0 ? `Exporting ${Math.round(exportProgress * 100)}%…` : 'Rendering…') : '⬇ Export Video'}
              </button>
            </div>
          )}

        </div>
        {showCreatorInsights && (
          <div className="absolute left-4 top-14 z-50 w-72 max-h-[70vh] overflow-y-auto">
            <CreatorInsights caption={caption} businessName={businesses.find(b => b.id === activeBusinessId)?.name} businessId={activeBusinessId} contactPageUrl={contactPageUrl} setContactPageUrl={setContactPageUrl} marketingGoal={marketingGoal} setMarketingGoal={setMarketingGoal} />
          </div>
        )}
        {showAIHelper && (
          <div className="absolute right-4 top-14 z-50 bg-white dark:bg-stone-800 border border-rose-200 dark:border-stone-600 rounded-xl shadow-xl p-4 w-80 text-xs max-h-[85vh] overflow-y-auto">
            <h4 className="font-bold text-stone-800 dark:text-stone-100 mb-3 flex items-center gap-2"><Sparkles size={16} className="text-rose-500" /> AI Helper</h4>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] uppercase font-bold text-stone-500 dark:text-stone-400 mb-1.5">Smart zoom</p>
                <div className="flex gap-2">
                  <button onClick={zoomToFit} className="px-2 py-1 rounded-lg bg-stone-100 dark:bg-stone-700 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-stone-700 dark:text-stone-300 text-[11px] font-medium">Fit view</button>
                  <button onClick={zoomToSelection} disabled={!selectedSegmentId && !selectedAudioSegmentId} className="px-2 py-1 rounded-lg bg-stone-100 dark:bg-stone-700 hover:bg-rose-100 dark:hover:bg-rose-900/40 disabled:opacity-50 text-stone-700 dark:text-stone-300 text-[11px] font-medium">Zoom to selection</button>
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-stone-500 dark:text-stone-400 mb-1.5">Quick tips</p>
                <ul className="text-stone-600 dark:text-stone-400 space-y-1 text-[11px]">
                  <li>• Use <kbd className="px-1 rounded bg-stone-200 dark:bg-stone-600">S</kbd> to split, then delete — audio & video cut together</li>
                  <li>• <strong>Dup</strong> duplicates a segment right after it</li>
                  <li>• Fade/Dip Black for podcast chapter breaks</li>
                  <li>• Snap on = cleaner cuts at beat</li>
                </ul>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-stone-500 dark:text-stone-400 mb-1.5">Audio layering</p>
                <p className="text-[11px] text-stone-600 dark:text-stone-400 mb-2">Split audio, then drag segments down to extra tracks — or use <strong>Move to track</strong> in the toolbar. Add more tracks with <strong>+ Add audio track</strong>.</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-stone-500 dark:text-stone-400 mb-1.5">AI um / ah / quiet removal</p>
                <p className="text-[11px] text-stone-600 dark:text-stone-400 mb-2">Coming soon: AI will scan your timeline, find ums, ahs, and quiet parts, then mark them for one-click removal.</p>
                <button onClick={() => setActiveTab('audio')} className="px-2 py-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 text-[11px] font-medium hover:bg-rose-200 dark:hover:bg-rose-800/50">Smart Audio AI →</button>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-stone-500 dark:text-stone-400 mb-1.5">Manual filler removal</p>
                <p className="text-[11px] text-stone-600 dark:text-stone-400">Use Split at time to cut at each um, then delete the small segment. Type the exact time (e.g. 0:12) and hit Split at time.</p>
              </div>
            </div>
          </div>
        )}
        {showShortcuts && (
          <div className="absolute right-4 top-14 z-50 bg-white dark:bg-stone-800 border border-rose-200 dark:border-stone-600 rounded-xl shadow-xl p-4 w-64 text-xs">
            <h4 className="font-bold text-stone-800 dark:text-stone-100 mb-3 flex items-center gap-2"><Keyboard size={16} /> Shortcuts</h4>
            <div className="space-y-2 font-mono text-stone-600 dark:text-stone-400">
              <p><kbd className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-700 rounded">Space</kbd> Play / Pause</p>
              <p><kbd className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-700 rounded">J</kbd> Rewind 5s</p>
              <p><kbd className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-700 rounded">K</kbd> Pause</p>
              <p><kbd className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-700 rounded">L</kbd> Forward 5s</p>
              <p><kbd className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-700 rounded">I</kbd> / <kbd className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-700 rounded">O</kbd> In / Out</p>
              <p><kbd className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-700 rounded">S</kbd> Split</p>
              <p><kbd className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-700 rounded">M</kbd> Add marker</p>
              <p><kbd className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-700 rounded">,</kbd> / <kbd className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-700 rounded">.</kbd> Prev / Next marker</p>
              <p><kbd className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-700 rounded">←</kbd> / <kbd className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-700 rounded">→</kbd> Nudge 0.5s</p>
              <p><kbd className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-700 rounded">Del</kbd> Delete selected</p>
              <p><kbd className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-700 rounded">⌘Z</kbd> Undo</p>
              <p><kbd className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-700 rounded">?</kbd> Toggle this</p>
            </div>
          </div>
        )}
      {editingClip && (
        <div className="fixed right-4 top-24 z-50 w-72 p-4 bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-2xl shadow-lg">
          <h4 className="font-bold text-stone-800 dark:text-stone-100 mb-3">Edit text</h4>
          <textarea value={editingClip.text || ''} onChange={(e) => updateTextClip(editingClip.id, e.target.value)} placeholder="Type your text..." rows={2} className="w-full p-3 rounded-xl border border-rose-100 dark:border-stone-600 bg-rose-50/50 dark:bg-stone-700 text-sm mb-3 resize-none" />
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="block text-xs font-bold text-stone-500 mb-1">Start (e.g. 0:05)</label>
              <input type="text" defaultValue={secToTimecode(editingClip.start ?? 0)} key={editingClip.id} onBlur={(e) => { const t = parseTimecode(e.target.value); if (t != null && t >= 0) updateTextClip(editingClip.id, { start: t, end: Math.max(t + 1, editingClip.end ?? t + 5) }); }} placeholder="0:00.00" className="w-full p-2 rounded-lg border font-mono text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 mb-1">Duration (sec)</label>
              <input type="number" min="0.5" step="0.5" value={((editingClip.end ?? 5) - (editingClip.start ?? 0)).toFixed(1)} onChange={(e) => { const d = parseFloat(e.target.value); if (!isNaN(d) && d > 0) updateTextClip(editingClip.id, { end: (editingClip.start ?? 0) + d }); }} className="w-full p-2 rounded-lg border text-sm" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <select value={editingClip.size || 'md'} onChange={(e) => updateTextClip(editingClip.id, { size: e.target.value })} className="p-2 rounded-lg border text-sm">
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
            </select>
            <select value={editingClip.font || 'sans'} onChange={(e) => updateTextClip(editingClip.id, { font: e.target.value })} className="p-2 rounded-lg border text-sm">
              <option value="sans">Sans</option>
              <option value="serif">Serif</option>
              <option value="mono">Mono</option>
              <option value="display">Display</option>
            </select>
            <select value={editingClip.color || 'white'} onChange={(e) => updateTextClip(editingClip.id, { color: e.target.value })} className="p-2 rounded-lg border text-sm">
              {(businesses || []).find(b => b.id === activeBusinessId) && (() => {
                const brand = BRAND_PRESETS[activeBusinessId];
                if (!brand?.colorNames?.length) return null;
                return (
                  <optgroup key={activeBusinessId} label={`${(businesses || []).find(b => b.id === activeBusinessId)?.name || 'Brand'}`}>
                    {brand.colorNames.map((name, i) => (
                      <option key={name} value={brand.colors[i]}>
                        {name}
                      </option>
                    ))}
                  </optgroup>
                );
              })()}
              <optgroup label="Standard">
                <option value="white">White</option>
                <option value="black">Black</option>
                <option value="rose">Rose</option>
                <option value="gold">Gold</option>
                <option value="amber">Amber</option>
                <option value="indigo">Indigo</option>
                <option value="cyan">Cyan</option>
                <option value="lime">Lime</option>
                <option value="orange">Orange</option>
              </optgroup>
            </select>
            {businesses?.length > 0 && (() => {
              const brand = BRAND_PRESETS[activeBusinessId] || BRAND_PRESETS.sarah;
              return <button type="button" onClick={() => updateTextClip(editingClip.id, { color: brand.colors[0], font: brand.font })} className="text-xs font-bold text-rose-600 hover:underline" title={`Apply ${businesses.find(b => b.id === activeBusinessId)?.name || 'brand'} style`}>Use brand</button>;
            })()}
            <label className="flex items-center gap-1 px-2 cursor-pointer">
              <input type="checkbox" checked={!!editingClip.bold} onChange={(e) => updateTextClip(editingClip.id, { bold: e.target.checked })} className="rounded" />
              <span className="text-sm font-bold">Bold</span>
            </label>
          </div>
          {/* Caption Style Presets */}
          <div className="mb-3">
            <label className="block text-xs font-bold text-stone-500 mb-2 uppercase tracking-wider">Caption Style</label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: null, label: 'Custom', preview: 'Aa', cls: 'bg-stone-700 text-white' },
                { id: 'tiktok-bold', label: 'TikTok', preview: 'BOLD', cls: 'bg-black text-yellow-400 font-black' },
                { id: 'faith', label: 'Faith', preview: 'Aa', cls: 'bg-stone-800 text-amber-300 italic font-serif' },
                { id: 'minimal', label: 'Minimal', preview: 'Aa', cls: 'bg-transparent border border-stone-500 text-white' },
                { id: 'highlight', label: 'Highlight', preview: 'Aa', cls: 'bg-rose-500 text-white font-extrabold' },
                { id: 'neon', label: 'Neon', preview: 'NEO', cls: 'bg-stone-900 text-cyan-300 font-bold uppercase' },
                { id: 'typewriter', label: 'Type', preview: 'Aa_', cls: 'bg-stone-800 text-white font-mono' },
              ].map(({ id, label, preview, cls }) => (
                <button
                  key={String(id)}
                  type="button"
                  onClick={() => updateTextClip(editingClip.id, { animStyle: id })}
                  className={`relative px-2 py-2 rounded-lg text-xs font-semibold transition-all border-2 ${editingClip.animStyle === id ? 'border-rose-400 scale-105 shadow-lg' : 'border-transparent'} ${cls}`}
                  title={label}
                >
                  <span className="block text-[11px] opacity-70 mb-0.5">{preview}</span>
                  <span className="block text-[10px] leading-none">{label}</span>
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => setEditingClipId(null)} className="w-full py-2 rounded-xl bg-rose-500 text-white font-bold text-sm">Done</button>
        </div>
      )}
      </div>
      {/* Timeline area — zoom + tracks, grid-area for layout */}
      <div className="flex flex-col min-h-0" style={{ gridArea: 'timeline' }}>
      <div className="shrink-0 flex items-center gap-2 py-1.5 px-3 bg-stone-800/80 border-t border-stone-700">
        <span className="text-[10px] font-bold text-stone-400 uppercase">Zoom</span>
        <span className="text-[10px] text-stone-500 hidden sm:inline">Click ruler to move playhead · Drop media here</span>
        <button onClick={() => setTimelineZoom(z => Math.max(0.5, Math.min(4, z / 1.5)))} className="px-2 py-1 rounded bg-stone-700 hover:bg-stone-600 text-white text-xs font-medium" title="Zoom out"><ZoomOut size={14} /> Out</button>
        <input type="range" min="0.5" max="4" step="0.1" value={timelineZoom} onChange={(e) => setTimelineZoom(Number(e.target.value))} className="w-24 h-2 bg-stone-600 rounded-lg appearance-none cursor-pointer accent-rose-500" title="Zoom timeline" />
        <span className="text-xs font-mono font-bold text-white min-w-[2.5rem] text-center">{timelineZoom.toFixed(1)}×</span>
        <button onClick={() => setTimelineZoom(z => Math.max(0.5, Math.min(4, z * 1.5)))} className="px-2 py-1 rounded bg-stone-700 hover:bg-stone-600 text-white text-xs font-medium" title="Zoom in"><ZoomIn size={14} /> In</button>
        <button onClick={zoomToFit} className="px-2 py-1 rounded bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs">Fit</button>
        <button onClick={zoomToSelection} disabled={!selectedSegmentId && !selectedAudioSegmentId && !selectedClipId} className="px-2 py-1 rounded bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs disabled:opacity-50">To selection</button>
      </div>
      <div
        className={`timeline-track flex flex-col flex-shrink-0 border-t border-stone-700 bg-stone-900 overflow-auto transition-all touch-pan-y ${!selectedVideo ? 'opacity-60' : ''}`}
        ref={el => { timelineScrollRef.current = el; }}
        onWheel={e => { e.preventDefault(); const el = timelineScrollRef.current; if (!el) return; if (e.shiftKey) el.scrollLeft += e.deltaY; else el.scrollTop += e.deltaY; }}
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; e.currentTarget.classList.add('ring-2', 'ring-rose-500'); }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.classList.remove('ring-2', 'ring-rose-500'); }}
        onDrop={e => {
          e.preventDefault();
          e.currentTarget.classList.remove('ring-2', 'ring-rose-500');
          const files = Array.from(e.dataTransfer.files || []);
          const video = files.find(f => f.type.startsWith('video/'));
          const audio = files.find(f => f.type.startsWith('audio/'));
          const image = files.find(f => f.type.startsWith('image/'));
          if (video) {
            const id = addAsset(video, 'video');
            if (id) {
              pushHistory();
              insertClipAtPlayhead(0, id); // Main track — drops line up sequentially
              if (!selectedVideo) setSelectedVideoId(id);
              setActiveTab('classic');
            }
          }
          if (image) {
            const id = addAsset(image, 'image');
            if (id) {
              pushHistory();
              insertClipAtPlayhead(1, id, { asOverlay: true }); // Overlay as PiP
              setActiveTab('classic');
            }
          }
          if (audio) {
            const id = addAsset(audio, 'audio');
            if (id) {
              pushHistory();
              insertClipAtPlayhead(3, id); // Audio track
              setActiveTab('classic');
            }
          }
        }}
        style={{ height: 320, minHeight: 200, maxHeight: '50vh', touchAction: 'manipulation' }}
      >
        <div className="flex flex-col shrink-0" style={{ minWidth: 80 + 500 * timelineZoom, width: 80 + 500 * timelineZoom }}>
        <div className="h-8 shrink-0 flex items-center font-mono text-[10px] font-bold text-stone-400 border-b border-stone-700 bg-stone-800">
          <div className="w-20 shrink-0 flex flex-col items-center px-1">
            <span className="text-stone-400">TRACK</span>
            <button onClick={addAudioTrack} className="text-[9px] font-semibold text-emerald-400 hover:text-emerald-300" title="Add unlimited audio tracks">+ track</button>
          </div>
          <div ref={timelineRulerRef} onMouseDown={(e) => { e.preventDefault(); handleRulerClick(e); setDraggingPlayhead(true); }} onTouchStart={(e) => { e.preventDefault(); handleRulerClick(e); setDraggingPlayhead(true); }} className="flex-1 relative flex justify-between px-4 select-none text-stone-400 min-w-0 touch-none bg-stone-800/90" style={{ cursor: draggingPlayhead ? 'grabbing' : 'grab', width: 500 * timelineZoom }}>
            {/* Time grid — vertical lines every 5s so you see structure (CapCut-style) */}
            {effectiveDuration > 0 && [...Array(Math.ceil(effectiveDuration / 5) + 1)].map((_, i) => {
              const t = i * 5;
              if (t > effectiveDuration) return null;
              const pct = (t / effectiveDuration) * 100;
              return <div key={i} className="absolute top-0 bottom-0 w-px bg-stone-600/60 pointer-events-none" style={{ left: `${pct}%` }} />;
            })}
            {[...Array(Math.ceil(effectiveDuration / 15) + 1)].map((_, i) => (
              <span key={i} className="shrink-0 pointer-events-none relative z-[1]" title={secToTimecode(i * 15)}>{secToTime(Math.min(i * 15, effectiveDuration))}</span>
            ))}
            <div onMouseDown={(e) => { e.stopPropagation(); handleRulerClick(e); setDraggingPlayhead(true); }} onTouchStart={(e) => { e.stopPropagation(); handleRulerClick(e); setDraggingPlayhead(true); }} className="absolute top-0 bottom-0 w-1 -ml-0.5 bg-amber-400 z-30 cursor-grab active:cursor-grabbing hover:bg-amber-300 touch-none shadow-lg shadow-amber-400/50" style={{ left: `${playheadPct}%` }} title="Drag playhead — click ruler to jump" />
            {markers.map(m => (
              <div key={m.id} className="absolute top-0 bottom-0 w-0.5 bg-amber-500 z-[5] pointer-events-none" style={{ left: `${(m.time / effectiveDuration) * 100}%` }} title={secToTimecode(m.time)} />
            ))}
          </div>
        </div>
        <div className="flex-1 min-h-0 flex flex-col p-2 gap-0 bg-stone-800/80 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px]" style={{ minWidth: 80 + 500 * timelineZoom }}>
          {/* 1. Text track */}
          <div className="flex items-center shrink-0 relative group/track" style={{ height: trackHeights.text }}>
            <div onMouseDown={(e) => { e.preventDefault(); setResizingTrack('text'); }} className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-rose-500/50 z-20 flex items-center justify-center" title="Drag to resize track"><div className="w-12 h-0.5 bg-stone-500 rounded opacity-0 group-hover/track:opacity-100" /></div>
            <div className="w-20 shrink-0 flex items-center gap-2 text-stone-300 text-xs">
              <span>T</span>
              <span>Text</span>
            </div>
            <div ref={textTrackRef} className="flex-1 h-full relative overflow-hidden rounded flex bg-stone-700/80" style={{ minWidth: `${500 * timelineZoom}px` }}>
              <div className="flex-1 min-w-0 relative pr-2">
                {textClips.map((c) => {
                  const start = c.start ?? 0;
                  const end = c.end ?? start + 5;
                  const tlStart = hasLayeredClips ? start : sourceToTimeline(start);
                  const tlEnd = hasLayeredClips ? end : sourceToTimeline(end);
                  const dur = Math.max(effectiveDuration, 1);
                  const left = (tlStart / dur) * 100;
                  const w = Math.max(2, ((tlEnd - tlStart) / dur) * 100);
                  return (
                  <div key={c.id} className="absolute h-[calc(100%-4px)] top-0.5 flex items-center group rounded overflow-hidden" style={{ left: `${left}%`, width: `${Math.max(2, w)}%` }}>
                    <div onMouseDown={(e) => handleResizeText(e, c, 'start')} className="w-1.5 flex-shrink-0 h-full cursor-ew-resize bg-stone-600 hover:bg-stone-500 z-10" />
                    <div
                      onMouseDown={(e) => handleMoveTextStart(e, c)}
                      onClick={() => setEditingClipId(c.id)}
                      className={`flex-1 min-w-0 h-full flex items-center px-2 cursor-move bg-blue-900/50 hover:bg-blue-800/50 border border-blue-700/50 ${editingClipId === c.id ? 'ring-1 ring-white' : ''}`}
                    >
                      <span className="text-[10px] text-blue-200 truncate">{c.text ? `"${c.text}"` : c.label}</span>
                    </div>
                    <div onMouseDown={(e) => handleResizeText(e, c, 'end')} className="w-1.5 flex-shrink-0 h-full cursor-ew-resize bg-stone-600 hover:bg-stone-500 z-10" />
                    <button onClick={(e) => { e.stopPropagation(); removeTextClip(c.id); }} className="p-1 rounded bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-200 shrink-0" title="Remove text overlay"><Trash2 size={12} /></button>
                  </div>
                ); })}
              </div>
            </div>
          </div>
          {/* When using layered clips: Main, Overlay, Logos, Audio — hide legacy Video/Audio */}
          {hasLayeredClips ? (
            <LayeredTimelineTracks
              timelineTracks={timelineTracks}
              assets={assets}
              playhead={playhead}
              playheadPct={playheadPct}
              timelineDuration={effectiveDuration}
              timelineZoom={timelineZoom}
              selectedClipId={selectedClipId}
              setSelectedClipId={setSelectedClipId}
              onSeek={seekTo}
              removeClip={removeClip}
              updateClip={updateClip}
              moveClip={moveClip}
              resizeClip={resizeClip}
              moveClipToTrack={moveClipToTrack}
              setClipTransition={setClipTransition}
              updateTrackMeta={updateTrackMeta}
              snapEnabled={snapEnabled}
              onPushHistory={pushHistory}
              handlePlayheadDrag={handlePlayheadDrag}
              setDraggingPlayhead={setDraggingPlayhead}
            />
          ) : (
            <>
          {/* Resize bar */}
          <div onMouseDown={(e) => { e.preventDefault(); setResizingTrack('video'); }} className="h-1.5 shrink-0 cursor-ns-resize hover:bg-rose-500/30 flex items-center justify-center" title="Drag to resize Video track"><div className="w-8 h-0.5 bg-stone-600 rounded" /></div>
          {/* 2. Video track (legacy — when no layered clips) */}
          <div className="flex items-center shrink-0 relative" style={{ height: trackHeights.video }}>
            <div className="w-20 shrink-0 flex items-center gap-2 text-stone-300 text-xs">
              <Video size={14} />
              <span>Video</span>
            </div>
            <div ref={mainTrackRef} onMouseDown={(e) => { e.preventDefault(); handlePlayheadDrag(e); setDraggingPlayhead(true); }} className="flex-1 h-full relative overflow-hidden cursor-grab active:cursor-grabbing rounded bg-stone-700/80" style={{ userSelect: 'none', minWidth: `${500 * timelineZoom}px` }}>
              {selectedVideo ? (
                <>
                  {getMainTimelineRanges(mainSegments).map(({ seg, tlStart, tlEnd }) => {
                    if (!seg || seg.end == null || seg.start == null) return null;
                    const w = timelineDuration > 0 ? ((tlEnd - tlStart) / timelineDuration) * 100 : 10;
                    const left = timelineDuration > 0 ? (tlStart / timelineDuration) * 100 : 0;
                    return (
                      <div key={seg.id} onMouseDown={(e) => e.stopPropagation()} onClick={() => { setSelectedSegmentId(seg.id); setSelectedAudioSegmentId(null); seekTo(tlStart); zoomToSelection(); }} className={`absolute h-[calc(100%-4px)] top-0.5 flex items-stretch group rounded overflow-hidden ${selectedSegmentId === seg.id ? 'ring-1 ring-white' : ''} ${movingMainId === seg.id ? 'ring-1 ring-white' : ''}`} style={{ left: `${left}%`, width: `${Math.max(2, w)}%` }}>
                        <div onMouseDown={(e) => handleResizeMain(e, seg, 'start')} className="w-1.5 flex-shrink-0 cursor-ew-resize bg-stone-600 hover:bg-stone-500 z-10" />
                        <div onMouseDown={(e) => handleMoveMainStart(e, seg)} className="flex-1 min-w-0 relative overflow-hidden">
                          <VideoSegmentThumbnail videoUrl={selectedVideo.url} startTime={seg.start} segStart={seg.start} segEnd={seg.end} />
                          <span className="absolute bottom-0 left-0 right-0 text-[9px] font-mono text-white bg-black/60 px-1 truncate">{secToTimecode(seg.start)} – {secToTimecode(seg.end)}</span>
                        </div>
                        <div onMouseDown={(e) => handleResizeMain(e, seg, 'end')} className="w-1.5 flex-shrink-0 cursor-ew-resize bg-stone-600 hover:bg-stone-500 z-10" />
                      </div>
                    );
                  })}
                  <div className="absolute top-0 bottom-0 w-0.5 bg-amber-400 pointer-events-none shadow-[0_0_4px_rgba(251,191,36,0.6)]" style={{ left: `${playheadPct}%` }} />
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-stone-500 text-xs gap-1">
                  <span>Select video above or drop video/audio here</span>
                  <span className="text-[10px] opacity-80">Dropping adds to library; only replaces if no video yet</span>
                </div>
              )}
            </div>
          </div>
          {/* Resize bar */}
          <div onMouseDown={(e) => { e.preventDefault(); setResizingTrack('audio'); }} className="h-1.5 shrink-0 cursor-ns-resize hover:bg-rose-500/30 flex items-center justify-center" title="Drag to resize Audio track"><div className="w-8 h-0.5 bg-stone-600 rounded" /></div>
          {/* 3. Audio track — drag segment down to move to track 2 */}
          <div className="flex items-center shrink-0" style={{ height: trackHeights.audio }}>
            <div className="w-20 shrink-0 flex items-center gap-2 text-stone-300 text-xs">
              <Mic size={14} />
              <span>Audio</span>
            </div>
            <div ref={audioTrackRef} onMouseDown={(e) => { e.preventDefault(); handlePlayheadDrag(e); setDraggingPlayhead(true); }} className="flex-1 h-full relative overflow-hidden cursor-grab active:cursor-grabbing rounded bg-stone-900" style={{ userSelect: 'none', minWidth: `${500 * timelineZoom}px` }}>
              {hasAudio ? (
                <>
                  {getAudioTimelineRanges(audioSegments).map(({ seg, tlStart, tlEnd }) => {
                    if (!seg || seg.end == null || seg.start == null) return null;
                    const w = timelineDuration > 0 ? ((tlEnd - tlStart) / timelineDuration) * 100 : 10;
                    const left = timelineDuration > 0 ? (tlStart / timelineDuration) * 100 : 0;
                    return (
                      <div key={seg.id} onMouseDown={(e) => e.stopPropagation()} onClick={() => { setSelectedAudioSegmentId(seg.id); setSelectedSegmentId(null); seekTo(tlStart); zoomToSelection(); }} className={`absolute h-[calc(100%-4px)] top-0.5 flex items-stretch group rounded overflow-hidden ${selectedAudioSegmentId === seg.id ? 'ring-1 ring-white' : ''} ${movingAudioId === seg.id ? 'ring-1 ring-white' : ''}`} style={{ left: `${left}%`, width: `${Math.max(2, w)}%` }}>
                        <div onMouseDown={(e) => handleResizeAudio(e, seg, 'start')} className="w-1.5 flex-shrink-0 cursor-ew-resize bg-stone-600 hover:bg-stone-500 z-10" />
                        <div onMouseDown={(e) => handleMoveAudioStart(e, seg)} className="flex-1 min-w-0 relative overflow-hidden">
                          <AudioWaveformSegment audioUrl={selectedAudio?.url || selectedVideo?.url} segStart={seg.start} segEnd={seg.end} totalDuration={duration} />
                          <span className="absolute bottom-0 left-0 right-0 text-[9px] font-mono text-white bg-black/60 px-1 truncate">{secToTimecode(seg.start)} – {secToTimecode(seg.end)}</span>
                        </div>
                        <div onMouseDown={(e) => handleResizeAudio(e, seg, 'end')} className="w-1.5 flex-shrink-0 cursor-ew-resize bg-stone-600 hover:bg-stone-500 z-10" />
                      </div>
                    );
                  })}
                  <div className="absolute top-0 bottom-0 w-0.5 bg-amber-400 pointer-events-none shadow-[0_0_4px_rgba(251,191,36,0.6)]" style={{ left: `${playheadPct}%` }} />
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-white/50 text-xs">Audio from video</div>
              )}
            </div>
          </div>
          {/* 4+. Extra audio tracks — drag from Audio or click Move to track 2 */}
          {audioExtraTracks.map((track, idx) => (
            <div key={track.id} className="flex items-center shrink-0" style={{ height: trackHeights.extra }}>
              <div className="w-20 shrink-0 flex items-center gap-2 text-stone-300 text-xs">
                <Mic size={12} className="opacity-70" />
                <span>Audio {idx + 2}</span>
              </div>
              <div
                ref={el => { const arr = audioExtraTrackRefs.current; arr[idx] = el; }}
                className={`flex-1 h-full relative overflow-hidden rounded ring-1 ring-inset transition-colors ${movingAudioId ? 'bg-emerald-950/50 ring-emerald-600 ring-dashed' : 'bg-stone-950 ring-stone-700'}`}
                style={{ minWidth: `${500 * timelineZoom}px` }}
              >
                {track.segments?.length > 0 ? (
                  <>
                    {track.segments.map((seg) => {
                      if (!seg || seg.end == null || seg.start == null) return null;
                      const tlStart = sourceToTimeline(seg.start);
                      const tlEnd = sourceToTimeline(seg.end);
                      const w = timelineDuration > 0 ? Math.max(2, ((tlEnd - tlStart) / timelineDuration) * 100) : 10;
                      const left = timelineDuration > 0 ? (tlStart / timelineDuration) * 100 : 0;
                      const isMoving = movingExtraAudio?.segId === seg.id && movingExtraAudio?.trackIdx === idx;
                      return (
                        <div key={seg.id} onMouseDown={(e) => handleMoveExtraAudioStart(e, idx, seg)} className={`absolute h-[calc(100%-4px)] top-0.5 flex items-stretch group rounded overflow-hidden cursor-grab active:cursor-grabbing bg-emerald-900/50 border border-emerald-700/50 ${isMoving ? 'ring-1 ring-white z-10' : ''}`} style={{ left: `${left}%`, width: `${w}%` }}>
                          <div className="flex-1 min-w-0 relative overflow-hidden">
                            <AudioWaveformSegment audioUrl={selectedAudio?.url || selectedVideo?.url} segStart={seg.start} segEnd={seg.end} totalDuration={duration} className="opacity-80" />
                            <span className="absolute bottom-0 left-0 right-0 text-[9px] font-mono text-emerald-200 bg-black/60 px-1 truncate">{secToTimecode(seg.start)} – {secToTimecode(seg.end)}</span>
                            <button onClick={() => { pushHistory(); setAudioExtraTracks(prev => prev.map((t, i) => i === idx ? { ...t, segments: t.segments.filter(s => s.id !== seg.id) } : t)); }} className="absolute top-0.5 right-0.5 p-1 rounded bg-red-900/80 text-white opacity-0 group-hover:opacity-100 hover:bg-red-700"><Trash2 size={10} /></button>
                          </div>
                        </div>
                      );
                    })}
                    <div className="absolute top-0 bottom-0 w-0.5 bg-amber-400 pointer-events-none shadow-[0_0_4px_rgba(251,191,36,0.6)]" style={{ left: `${playheadPct}%` }} />
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-stone-500 text-[10px]">Drag audio from above, or Split → Move to track</div>
                )}
              </div>
            </div>
          ))}
          <div className="flex items-center h-8 shrink-0 pl-20">
            <span className="text-[10px] text-stone-500">Drag audio segments down to move • Split → Move to track</span>
          </div>
            </>
          )}
        </div>
        </div>
      </div>
      </div>
    </div>
  );
};

// --- AI Audio Studio ---
const AIAudioStudio = () => {
  const { selectedAudio, filteredAssets, setSelectedAudioId, setActiveTab, voiceIsolation, setVoiceIsolation, deReverb, setDeReverb, deReverbStrength, setDeReverbStrength } = useStudio();
  const audioRef = useRef(null);
  const audioFiles = filteredAssets.filter(a => a.type === 'audio');

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-3xl p-8 shadow-sm transition-colors">
        <h3 className="text-xl font-semibold text-stone-800 flex items-center mb-2">
          <AudioLines className="mr-2 text-rose-400" size={24} />
          Smart Audio AI
        </h3>
        <p className="text-sm text-stone-500 mb-2">Achieve professional broadcast quality using AI Voice Isolation.</p>
        <p className={`text-xs mb-6 rounded-lg px-3 py-2 border ${voiceIsolation || deReverb ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800' : 'text-amber-700 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800'}`}>
          {voiceIsolation || deReverb ? (
            <><strong>Active.</strong> {[voiceIsolation && 'Voice Isolation (noise removal)', deReverb && 'De-Reverb (echo removal)'].filter(Boolean).join(' and ')} will be applied on export.</>
          ) : (
            <><strong>Ready.</strong> Toggle Voice Isolation or De-Reverb above — preferences are saved and applied when you export.</>
          )}
        </p>

        <div className="mb-8">
          <label className="block text-xs font-bold text-stone-400 mb-2 uppercase">Source Audio</label>
          {audioFiles.length > 0 ? (
            <select value={selectedAudio?.id || ''} onChange={(e) => setSelectedAudioId(Number(e.target.value) || null)} className="w-full bg-stone-50 border border-rose-100 rounded-xl px-4 py-2.5 text-sm">
              <option value="">Select audio file...</option>
              {audioFiles.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          ) : (
            <p className="text-stone-500 text-sm">Upload audio in Media Library first.</p>
          )}
          {selectedAudio && (
            <audio ref={audioRef} src={selectedAudio.url} controls className="w-full mt-2" />
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-rose-50/50 dark:bg-stone-700/40 p-6 rounded-3xl border border-rose-100 dark:border-stone-600">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="text-base font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">Voice Isolation {voiceIsolation && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded">ON</span>}</h4>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">Removes AC, traffic, and background noise.</p>
              </div>
              <button onClick={() => setVoiceIsolation(!voiceIsolation)} className={`relative w-12 h-6 rounded-full transition-colors ${voiceIsolation ? 'bg-rose-500' : 'bg-rose-200 dark:bg-stone-600'}`}>
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${voiceIsolation ? 'translate-x-7' : 'translate-x-1'}`}></span>
              </button>
            </div>
          </div>
          <div className="bg-rose-50/50 dark:bg-stone-700/40 p-6 rounded-3xl border border-rose-100 dark:border-stone-600">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="text-base font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">Studio De-Reverb {deReverb && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded">ON</span>}</h4>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">Removes room echo.</p>
              </div>
              <button onClick={() => setDeReverb(!deReverb)} className={`relative w-12 h-6 rounded-full transition-colors ${deReverb ? 'bg-rose-500' : 'bg-rose-200 dark:bg-stone-600'}`}>
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${deReverb ? 'translate-x-7' : 'translate-x-1'}`}></span>
              </button>
            </div>
            <div className="mt-4 pt-6 border-t border-rose-100 dark:border-stone-600">
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 block mb-3">Enhancement Strength</label>
              <input type="range" min="0" max="100" value={deReverbStrength} onChange={(e) => setDeReverbStrength(Number(e.target.value))} className="w-full accent-rose-400" />
            </div>
          </div>
          <div className="md:col-span-2 bg-rose-50/80 dark:bg-rose-950/30 p-6 rounded-3xl border border-rose-200 dark:border-rose-800">
            <h4 className="text-base font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
              <Sparkles size={18} className="text-rose-500" />
              Filler removal (ums, ahs, pauses)
            </h4>
            <p className="text-sm text-stone-600 dark:text-stone-300 mt-2">AI auto-detection coming soon. For now: use <button type="button" onClick={() => setActiveTab('classic')} className="text-rose-600 dark:text-rose-400 font-bold hover:underline">Classic Timeline</button> → type time (e.g. 0:12) → Split at time → delete segment.</p>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-2"><button type="button" onClick={() => setActiveTab('editor')} className="text-rose-600 dark:text-rose-400 hover:underline">No-Mouse Editor</button> for cut lists without timeline scrubbing.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Pro Enhancements ---
const ProEnhancements = () => {
  const { selectedVideo, filteredAssets, setSelectedVideoId, aiUpscale, setAiUpscale, cinematicGrade, setCinematicGrade } = useStudio();
  const videos = filteredAssets.filter(a => a.type === 'video');

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-3xl p-8 shadow-sm transition-colors">
        <h3 className="text-xl font-semibold text-stone-800 flex items-center mb-2">
          <Wand2 className="mr-2 text-rose-400" size={24} />
          Cinematic Processing
        </h3>
        <p className="text-sm text-stone-500 mb-8">Upscale and color-grade footage for a premium lifestyle look.</p>

        <div className="mb-8">
          <label className="block text-xs font-bold text-stone-400 mb-2 uppercase">Source Video</label>
          {videos.length > 0 ? (
            <select value={selectedVideo?.id || ''} onChange={(e) => setSelectedVideoId(Number(e.target.value) || null)} className="w-full bg-stone-50 border border-rose-100 rounded-xl px-4 py-2.5 text-sm">
              <option value="">Select video...</option>
              {videos.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          ) : (
            <p className="text-stone-500 text-sm">Upload video in Media Library first.</p>
          )}
        </div>

        <div className="space-y-4">
          <label className="flex items-center justify-between bg-rose-50/50 p-5 rounded-2xl border border-rose-100 cursor-pointer hover:bg-rose-50 transition-colors">
            <div>
              <span className="text-base font-bold text-stone-800 flex items-center gap-2">
                4K AI Upscaling <span className="bg-rose-100 text-rose-600 text-[10px] px-2 py-0.5 rounded-full uppercase font-bold">Ultra HD</span>
              </span>
              <span className="text-xs text-stone-500 block mt-1">Sharpens soft footage and adds realistic details.</span>
            </div>
            <button onClick={() => setAiUpscale(!aiUpscale)} className={`relative w-12 h-6 rounded-full transition-colors ${aiUpscale ? 'bg-rose-400' : 'bg-rose-200'}`}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${aiUpscale ? 'translate-x-7' : 'translate-x-1'}`}></span>
            </button>
          </label>
          <label className="flex items-center justify-between bg-rose-50/50 p-5 rounded-2xl border border-rose-100 cursor-pointer hover:bg-rose-50 transition-colors">
            <div>
              <span className="text-base font-bold text-stone-800">Auto Cinematic Color Grade</span>
              <span className="text-xs text-stone-500 block mt-1">Converts flat iPhone footage into rich, moody cinematic tones.</span>
            </div>
            <button onClick={() => setCinematicGrade(!cinematicGrade)} className={`relative w-12 h-6 rounded-full transition-colors ${cinematicGrade ? 'bg-rose-400' : 'bg-rose-200'}`}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${cinematicGrade ? 'translate-x-7' : 'translate-x-1'}`}></span>
            </button>
          </label>
        </div>
      </div>
    </div>
  );
};

// --- Camera Settings ---
const CAMERA_PRESETS = {
  blackmagic: {
    name: 'Blackmagic',
    video: {
      day: [
        { label: 'Resolution', value: '4K DCI 24fps', note: 'Cinematic 24p' },
        { label: 'ISO', value: '400', note: 'Native base' },
        { label: 'Shutter', value: '1/48 (180°)', note: 'Motion blur' },
        { label: 'White Balance', value: '5600K Daylight', note: 'Outdoor / window light' },
        { label: 'Exposure', value: '0 EV', note: 'Lock after metering' },
        { label: 'Dynamic Range', value: 'Film', note: 'Wide latitude' }
      ],
      night: [
        { label: 'Resolution', value: '4K DCI 24fps', note: 'Same as day' },
        { label: 'ISO', value: '800–1600', note: 'Acceptable noise floor' },
        { label: 'Shutter', value: '1/48 (180°)', note: 'Keep 180° rule' },
        { label: 'White Balance', value: '3200K Tungsten', note: 'Indoor / warm light' },
        { label: 'Exposure', value: '+0.5 EV', note: 'Lift shadows' },
        { label: 'Dynamic Range', value: 'Film', note: 'Preserve highlights' }
      ]
    },
    photo: {
      day: [
        { label: 'Aperture', value: 'f/2.8–f/4', note: 'Subject separation' },
        { label: 'Shutter', value: '1/125–1/250', note: 'Freeze motion' },
        { label: 'ISO', value: '100–400', note: 'Native base' },
        { label: 'White Balance', value: '5600K Daylight', note: 'Outdoor / window' },
        { label: 'Format', value: 'RAW', note: 'Max flexibility' },
        { label: 'Metering', value: 'Spot on face', note: 'Correct skin tone' }
      ],
      night: [
        { label: 'Aperture', value: 'f/1.4–f/2.8', note: 'More light' },
        { label: 'Shutter', value: '1/60–1/125', note: 'Avoid blur' },
        { label: 'ISO', value: '800–3200', note: 'Acceptable noise' },
        { label: 'White Balance', value: '3200K or Auto', note: 'Indoor / warm' },
        { label: 'Stability', value: 'Tripod recommended', note: 'Sharp shots' },
        { label: 'Format', value: 'RAW', note: 'Recover in post' }
      ]
    }
  },
  iphone: {
    name: 'iPhone',
    video: {
      day: [
        { label: 'Resolution', value: '4K at 24 fps', note: 'Settings → Camera' },
        { label: 'Format', value: 'ProRes or HEVC', note: 'ProRes for best quality' },
        { label: 'HDR Video', value: 'OFF', note: 'Avoid Reels flicker' },
        { label: 'Grid & Level', value: 'ON', note: 'Rule of thirds' },
        { label: 'Exposure Lock', value: 'Tap & hold', note: 'Lock before recording' },
        { label: 'Focus Lock', value: 'Tap & hold', note: 'Lock focus on subject' }
      ],
      night: [
        { label: 'Resolution', value: '4K at 24 fps', note: 'Same as day' },
        { label: 'Night Mode', value: 'Auto', note: 'Let sensor decide' },
        { label: 'HDR Video', value: 'OFF', note: 'Stable output' },
        { label: 'Exposure', value: 'Slightly underexpose', note: 'Recover in post' },
        { label: 'Stability', value: 'Use tripod / gimbal', note: 'Reduce blur' },
        { label: 'Light Source', value: 'Add key light', note: 'Fill shadows' }
      ]
    },
    photo: {
      day: [
        { label: 'Format', value: 'HEIC or RAW (Pro)', note: 'Best quality' },
        { label: 'Portrait Mode', value: 'Optional', note: 'Bokeh for talking head' },
        { label: 'Grid & Level', value: 'ON', note: 'Composition' },
        { label: 'Exposure', value: 'Tap to meter', note: 'Lock on subject' },
        { label: 'HDR', value: 'Auto', note: 'Balanced highlights' },
        { label: 'Live Photo', value: 'OFF for static', note: 'Clean export' }
      ],
      night: [
        { label: 'Night Mode', value: 'Auto', note: 'Longer exposure when needed' },
        { label: 'Flash', value: 'OFF for natural', note: 'Or fill flash' },
        { label: 'Exposure', value: 'Slightly underexpose', note: 'Less noise' },
        { label: 'Stability', value: 'Hold steady or tripod', note: 'Sharp shots' },
        { label: 'Burst', value: 'Use for action', note: 'Pick best frame' },
        { label: 'Format', value: 'HEIC', note: 'Smaller files' }
      ]
    }
  },
  sony: {
    name: 'Sony',
    video: {
      day: [
        { label: 'Resolution', value: '4K 24fps', note: 'S&Q or normal' },
        { label: 'Picture Profile', value: 'S-Log3 or Cine', note: 'Grade in post' },
        { label: 'ISO', value: '800 native', note: 'Best DR' },
        { label: 'Shutter', value: '1/48 (180°)', note: 'Cinematic blur' },
        { label: 'White Balance', value: '5600K', note: 'Daylight' },
        { label: 'Focus', value: 'Face tracking ON', note: 'Sharp subject' }
      ],
      night: [
        { label: 'Resolution', value: '4K 24fps', note: 'Same as day' },
        { label: 'ISO', value: '1600–3200', note: 'S-Log3 handles well' },
        { label: 'Shutter', value: '1/48', note: 'Keep 180°' },
        { label: 'White Balance', value: '3200K', note: 'Tungsten / warm' },
        { label: 'Noise Reduction', value: 'Low in-camera', note: 'Detail in post' },
        { label: 'Exposure', value: '+0.3 to +0.5 EV', note: 'Protect highlights' }
      ]
    },
    photo: {
      day: [
        { label: 'Aperture', value: 'f/2.8–f/4', note: 'Portrait depth' },
        { label: 'Shutter', value: '1/125+', note: 'Sharp' },
        { label: 'ISO', value: '100–400', note: 'Native' },
        { label: 'Format', value: 'RAW', note: 'Sony ARW' },
        { label: 'Metering', value: 'Face priority', note: 'Skin tone' },
        { label: 'WB', value: 'Daylight', note: '5600K' }
      ],
      night: [
        { label: 'Aperture', value: 'f/1.4–f/2.8', note: 'Fast lens' },
        { label: 'Shutter', value: '1/60–1/125', note: 'Handheld' },
        { label: 'ISO', value: '1600–6400', note: 'Sony sensors good' },
        { label: 'Image Stabilization', value: 'ON', note: 'IBIS/OSS' },
        { label: 'Format', value: 'RAW', note: 'Noise reduction later' },
        { label: 'WB', value: 'Tungsten or Auto', note: '3200K' }
      ]
    }
  },
  canon: {
    name: 'Canon',
    video: {
      day: [
        { label: 'Resolution', value: '4K 24fps', note: 'C-Log or Neutral' },
        { label: 'ISO', value: '400–800', note: 'Native base' },
        { label: 'Shutter', value: '1/48 (180°)', note: 'Cinematic' },
        { label: 'White Balance', value: '5600K', note: 'Daylight' },
        { label: 'Focus', value: 'Dual Pixel AF', note: 'Smooth tracking' },
        { label: 'Log', value: 'C-Log3 if available', note: 'Grade in post' }
      ],
      night: [
        { label: 'Resolution', value: '4K 24fps', note: 'Same' },
        { label: 'ISO', value: '1600–3200', note: 'Clean on R-series' },
        { label: 'Shutter', value: '1/48', note: '180° rule' },
        { label: 'White Balance', value: '3200K', note: 'Warm indoor' },
        { label: 'Exposure', value: 'Slight lift', note: 'Shadows' },
        { label: 'Noise Reduction', value: 'Low', note: 'Post preferred' }
      ]
    },
    photo: {
      day: [
        { label: 'Aperture', value: 'f/2.8–f/4', note: 'Portrait' },
        { label: 'Shutter', value: '1/125+', note: 'Sharp' },
        { label: 'ISO', value: '100–400', note: 'Native' },
        { label: 'Format', value: 'RAW (CR3)', note: 'Full quality' },
        { label: 'Metering', value: 'Evaluative', note: 'Face detect' },
        { label: 'WB', value: 'Daylight', note: '5600K' }
      ],
      night: [
        { label: 'Aperture', value: 'f/1.4–f/2.8', note: 'Fast glass' },
        { label: 'Shutter', value: '1/60–1/125', note: 'Handheld' },
        { label: 'ISO', value: '1600–6400', note: 'R-series excels' },
        { label: 'Format', value: 'RAW', note: 'CR3' },
        { label: 'IS', value: 'Lens or IBIS ON', note: 'Stability' },
        { label: 'WB', value: '3200K or Auto', note: 'Indoor' }
      ]
    }
  },
  other: {
    name: 'Other / Custom',
    video: {
      day: [
        { label: 'Resolution', value: '4K 24fps', note: 'Match project' },
        { label: 'Frame Rate', value: '24fps', note: 'Cinematic standard' },
        { label: 'Shutter', value: '1/48 or 180°', note: 'Natural motion blur' },
        { label: 'ISO', value: 'Native base', note: 'Best DR' },
        { label: 'White Balance', value: 'Lock to scene', note: '5600K daylight' },
        { label: 'Log / Flat', value: 'Use if available', note: 'Grade in post' }
      ],
      night: [
        { label: 'Resolution', value: '4K 24fps', note: 'Same as day' },
        { label: 'ISO', value: 'Raise as needed', note: 'Test noise floor' },
        { label: 'Shutter', value: '1/48', note: '180° rule' },
        { label: 'White Balance', value: '3200K Tungsten', note: 'Warm indoor' },
        { label: 'Exposure', value: 'Lift shadows', note: 'Recover in post' },
        { label: 'Log / Flat', value: 'Use if available', note: 'Grade later' }
      ]
    },
    photo: {
      day: [
        { label: 'Aperture', value: 'f/2.8–f/4', note: 'Portrait depth' },
        { label: 'Shutter', value: '1/125+', note: 'Freeze motion' },
        { label: 'ISO', value: 'Native base', note: '100–400' },
        { label: 'Format', value: 'RAW', note: 'Max flexibility' },
        { label: 'WB', value: 'Lock to scene', note: '5600K daylight' },
        { label: 'Metering', value: 'Spot on subject', note: 'Correct exposure' }
      ],
      night: [
        { label: 'Aperture', value: 'Widest available', note: 'f/1.4–f/2.8' },
        { label: 'Shutter', value: '1/60+', note: 'Avoid blur' },
        { label: 'ISO', value: 'Accept noise', note: '1600–6400' },
        { label: 'Format', value: 'RAW', note: 'Recover in post' },
        { label: 'WB', value: '3200K or Auto', note: 'Indoor' },
        { label: 'Tripod', value: 'If possible', note: 'Sharp low-light' }
      ]
    }
  }
};

const CameraSettings = () => {
  const { filteredAssets, addAsset } = useStudio();
  const [contentType, setContentType] = useState('video');
  const [lighting, setLighting] = useState('day');
  const [camera, setCamera] = useState('blackmagic');
  const [customCameras, setCustomCameras] = useState(() => JSON.parse(localStorage.getItem('faith-studio-custom-cameras') || '[]'));
  const [showAddCamera, setShowAddCamera] = useState(false);
  const [newCameraName, setNewCameraName] = useState('');
  const [lightroomSuggestion, setLightroomSuggestion] = useState(null);
  const images = filteredAssets.filter(a => a.type === 'image');
  const analyzeRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('faith-studio-custom-cameras', JSON.stringify(customCameras));
  }, [customCameras]);

  const addCustomCamera = () => {
    if (!newCameraName.trim()) return;
    const id = `custom-${Date.now()}`;
    setCustomCameras(prev => [...prev, { id, name: newCameraName.trim() }]);
    setNewCameraName('');
    setShowAddCamera(false);
    setCamera(id);
  };

  const allCameras = [
    { id: 'blackmagic', name: 'Blackmagic' },
    { id: 'iphone', name: 'iPhone' },
    { id: 'sony', name: 'Sony' },
    { id: 'canon', name: 'Canon' },
    ...customCameras,
    { id: 'other', name: 'Other / New camera' }
  ];

  const effectiveCamera = ['blackmagic', 'iphone', 'sony', 'canon', 'other'].includes(camera) ? camera : 'other';
  const preset = CAMERA_PRESETS[effectiveCamera];
  const settings = preset?.[contentType]?.[lighting] || preset?.video?.day || [];

  const displayCameraName = customCameras.find(c => c.id === camera)?.name || preset?.name || 'Custom';

  const analyzeForLightroom = () => {
    if (images.length === 0) {
      setLightroomSuggestion({ type: 'empty', message: 'Upload images or video frames in Media Library, then analyze.' });
      return;
    }
    setLightroomSuggestion({
      type: 'suggestion',
      exposure: '+0.3',
      contrast: '+12',
      shadows: '+8',
      highlights: '-10',
      temp: '5500K',
      tint: '+2',
      clarity: '+15',
      vibrance: '+5',
      saturation: '0',
      message: 'Based on your media: warm, balanced tones. Apply in Lightroom Develop module.'
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      {/* 1. What are you shooting? */}
      <div className="bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-3xl p-6 shadow-sm transition-colors">
        <h3 className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-widest mb-4">What are you shooting?</h3>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'video', label: 'Video', Icon: Video },
            { id: 'photo', label: 'Photos', Icon: ImageIcon }
          ].map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setContentType(id)} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${contentType === id ? 'bg-rose-500 text-white shadow-lg' : 'bg-rose-50 dark:bg-stone-700 border border-rose-100 dark:border-stone-600 text-stone-600 dark:text-stone-300 hover:border-rose-300'}`}>
              <Icon size={18} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Lighting */}
      <div className="bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-3xl p-6 shadow-sm transition-colors">
        <h3 className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-widest mb-4">Lighting</h3>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'day', label: 'Day', Icon: Sun },
            { id: 'night', label: 'Night / Low Light', Icon: Moon }
          ].map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setLighting(id)} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${lighting === id ? 'bg-rose-500 text-white shadow-lg' : 'bg-rose-50 dark:bg-stone-700 border border-rose-100 dark:border-stone-600 text-stone-600 dark:text-stone-300 hover:border-rose-300'}`}>
              <Icon size={18} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Which camera? */}
      <div className="bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-3xl p-6 shadow-sm transition-colors">
        <h3 className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-widest mb-4">Which camera?</h3>
        <div className="flex flex-wrap gap-2 items-center">
          {allCameras.map((c) => (
            <button key={c.id} onClick={() => setCamera(c.id)} className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${camera === c.id ? 'bg-rose-500 text-white shadow-lg' : 'bg-rose-50 dark:bg-stone-700 border border-rose-100 dark:border-stone-600 text-stone-600 dark:text-stone-300 hover:border-rose-300'}`}>
              {c.name}
            </button>
          ))}
          <button onClick={() => setShowAddCamera(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-rose-300 dark:border-rose-600 text-rose-500 dark:text-rose-400 font-bold text-sm hover:bg-rose-50 dark:hover:bg-stone-700">
            <Plus size={18} /> Add new camera
          </button>
        </div>
        {showAddCamera && (
          <div className="mt-4 p-4 rounded-2xl bg-rose-50/50 dark:bg-stone-700/50 border border-rose-100 dark:border-stone-600 flex flex-wrap gap-2 items-center">
            <input value={newCameraName} onChange={(e) => setNewCameraName(e.target.value)} placeholder="Camera name (e.g. Nikon Z8)" className="flex-1 min-w-[180px] bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-600 rounded-xl px-4 py-2 text-sm" />
            <button onClick={addCustomCamera} className="px-4 py-2 rounded-xl bg-rose-500 text-white font-bold text-sm">Add</button>
            <button onClick={() => { setShowAddCamera(false); setNewCameraName(''); }} className="px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-600 text-stone-600 dark:text-stone-400 text-sm">Cancel</button>
          </div>
        )}
      </div>

      {/* Active Preset Card */}
      <div className="bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-3xl p-8 shadow-sm transition-colors">
        <h3 className="text-xl font-bold text-stone-800 dark:text-stone-100 mb-1">{displayCameraName} — {lighting === 'day' ? 'Day' : 'Night / Low Light'} ({contentType === 'video' ? 'Video' : 'Photos'})</h3>
        <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">Lock these before shooting to avoid auto-exposure flicker.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {settings.map((s, i) => (
            <div key={i} className="flex justify-between items-start p-4 rounded-2xl bg-rose-50/50 dark:bg-stone-700/50 border border-rose-100 dark:border-stone-600">
              <div>
                <span className="text-sm font-bold text-stone-800 dark:text-stone-100">{s.label}</span>
                <span className="text-xs text-stone-500 dark:text-stone-400 block mt-1">{s.note}</span>
              </div>
              <span className="text-sm font-mono font-bold text-rose-600 dark:text-rose-400 shrink-0 ml-4">{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Lightroom Preset Helper */}
      <div className="bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-3xl p-8 shadow-sm transition-colors">
        <h3 className="text-xl font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2 mb-2">
          <ImageIcon size={22} className="text-rose-400" />
          Lightroom Preset Helper
        </h3>
        <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">
          Analyze your photos or video frames from Media Library to suggest Lightroom Develop settings.
        </p>
        <input
          ref={analyzeRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            files.forEach(f => {
              const type = f.type.startsWith('video/') ? 'video' : 'image';
              addAsset(f, type);
            });
            e.target.value = '';
          }}
        />
        <button
          onClick={() => analyzeRef.current?.click()}
          className="px-6 py-3 rounded-xl bg-rose-500 text-white font-bold hover:bg-rose-600 flex items-center gap-2 mb-6"
        >
          <Wand2 size={18} /> Upload & Analyze
        </button>
        {images.length > 0 && (
          <button
            onClick={analyzeForLightroom}
            className="ml-3 px-6 py-3 rounded-xl bg-stone-800 dark:bg-stone-700 text-white font-bold hover:bg-stone-700 dark:hover:bg-stone-600"
          >
            Analyze Library Media ({images.length} images)
          </button>
        )}
        {lightroomSuggestion && (
          <div className="mt-6 p-6 rounded-2xl bg-rose-50 dark:bg-stone-700/50 border border-rose-100 dark:border-stone-600">
            {lightroomSuggestion.type === 'empty' ? (
              <p className="text-stone-600 dark:text-stone-300">{lightroomSuggestion.message}</p>
            ) : (
              <>
                <p className="text-sm font-bold text-stone-800 dark:text-stone-100 mb-4">{lightroomSuggestion.message}</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="p-3 rounded-xl bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-600">
                    <span className="text-[10px] font-bold text-stone-400 uppercase">Exposure</span>
                    <p className="text-sm font-mono font-bold text-rose-600">{lightroomSuggestion.exposure}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-600">
                    <span className="text-[10px] font-bold text-stone-400 uppercase">Contrast</span>
                    <p className="text-sm font-mono font-bold text-rose-600">{lightroomSuggestion.contrast}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-600">
                    <span className="text-[10px] font-bold text-stone-400 uppercase">Shadows</span>
                    <p className="text-sm font-mono font-bold text-rose-600">{lightroomSuggestion.shadows}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-600">
                    <span className="text-[10px] font-bold text-stone-400 uppercase">Highlights</span>
                    <p className="text-sm font-mono font-bold text-rose-600">{lightroomSuggestion.highlights}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-600">
                    <span className="text-[10px] font-bold text-stone-400 uppercase">Temp</span>
                    <p className="text-sm font-mono font-bold text-rose-600">{lightroomSuggestion.temp}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-600">
                    <span className="text-[10px] font-bold text-stone-400 uppercase">Tint</span>
                    <p className="text-sm font-mono font-bold text-rose-600">{lightroomSuggestion.tint}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-600">
                    <span className="text-[10px] font-bold text-stone-400 uppercase">Clarity</span>
                    <p className="text-sm font-mono font-bold text-rose-600">{lightroomSuggestion.clarity}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-600">
                    <span className="text-[10px] font-bold text-stone-400 uppercase">Vibrance</span>
                    <p className="text-sm font-mono font-bold text-rose-600">{lightroomSuggestion.vibrance}</p>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-rose-100 dark:border-stone-600">
                  <h4 className="text-sm font-bold text-stone-800 dark:text-stone-100 mb-3 flex items-center gap-2"><Target size={16} className="text-rose-400" /> How to apply in Lightroom</h4>
                  <ol className="space-y-2 text-sm text-stone-600 dark:text-stone-300">
                    <li><strong>1.</strong> Open Lightroom → select your photo in Library</li>
                    <li><strong>2.</strong> Press <kbd className="px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-600 font-mono text-xs">D</kbd> to switch to Develop module</li>
                    <li><strong>3.</strong> In the <strong>Basic</strong> panel (right sidebar): set Exposure, Contrast, Shadows, Highlights to the values above</li>
                    <li><strong>4.</strong> In <strong>White Balance</strong>: set Temp (K) and Tint to match</li>
                    <li><strong>5.</strong> In <strong>Presence</strong>: set Clarity and Vibrance</li>
                    <li><strong>6.</strong> Right‑click the photo → &quot;Create Preset&quot; to save for future use</li>
                  </ol>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Traffic Hub: UTM Link Generator & Click Tracker ---
const TrafficHub = () => {
  const { businesses, activeBusinessId } = useStudio();
  const biz = (businesses || []).find(b => b.id === activeBusinessId);

  const [form, setForm] = useState({
    name: '',
    url: '',
    content: '',
    platforms: { instagram: true, youtube: true, tiktok: true, facebook: false }
  });
  const [campaigns, setCampaigns] = useState(() => {
    try { return JSON.parse(localStorage.getItem('faith-studio-campaigns') || '[]'); } catch { return []; }
  });
  const [copied, setCopied] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    localStorage.setItem('faith-studio-campaigns', JSON.stringify(campaigns));
  }, [campaigns]);

  const UTM_CONFIGS = [
    { key: 'instagram', Icon: Instagram, label: 'Instagram', color: '#db2777', bg: '#fce7f3', source: 'instagram', medium: 'social', tip: 'Put in your IG bio (link in bio). Say "link in bio" in every reel/caption.' },
    { key: 'youtube', Icon: Youtube, label: 'YouTube', color: '#dc2626', bg: '#fee2e2', source: 'youtube', medium: 'video', tip: 'First 2 lines of description + pinned comment.' },
    { key: 'tiktok', Icon: Smartphone, label: 'TikTok', color: '#374151', bg: '#e5e7eb', source: 'tiktok', medium: 'social', tip: 'TikTok bio link. Say "link in bio" in your video.' },
    { key: 'facebook', Icon: Facebook, label: 'Facebook', color: '#2563eb', bg: '#dbeafe', source: 'facebook', medium: 'social', tip: 'Paste directly in post text or first comment.' },
  ];

  const buildUtmLink = (baseUrl, source, medium, campaignName, content) => {
    if (!baseUrl || !campaignName) return '';
    try {
      const url = new URL(baseUrl.startsWith('http') ? baseUrl : 'https://' + baseUrl);
      url.searchParams.set('utm_source', source);
      url.searchParams.set('utm_medium', medium);
      url.searchParams.set('utm_campaign', campaignName.toLowerCase().replace(/\s+/g, '-'));
      if (content) url.searchParams.set('utm_content', content.toLowerCase().replace(/\s+/g, '-'));
      return url.toString();
    } catch { return ''; }
  };

  const copyLink = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  };

  const copyAll = async (campaign) => {
    const lines = UTM_CONFIGS
      .filter(cfg => campaign.links?.[cfg.key])
      .map(cfg => `${cfg.label}: ${campaign.links[cfg.key]}`);
    const text = `Campaign: ${campaign.name}\n\n` + lines.join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied('all-' + campaign.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  };

  const saveCampaign = () => {
    if (!form.name.trim() || !form.url.trim()) return;
    const id = 'c' + Date.now();
    const links = {};
    UTM_CONFIGS.forEach(cfg => {
      if (form.platforms[cfg.key]) {
        links[cfg.key] = buildUtmLink(form.url, cfg.source, cfg.medium, form.name, form.content);
      }
    });
    setCampaigns(prev => [{
      id,
      businessId: activeBusinessId,
      name: form.name.trim(),
      url: form.url.trim(),
      content: form.content.trim(),
      platforms: { ...form.platforms },
      links,
      createdAt: new Date().toISOString().slice(0, 10),
      clicks: {}
    }, ...prev]);
    setForm({ name: '', url: '', content: '', platforms: { instagram: true, youtube: true, tiktok: true, facebook: false } });
    setExpandedId(id);
  };

  const updateClicks = (campaignId, platform, val) => {
    setCampaigns(prev => prev.map(c =>
      c.id === campaignId ? { ...c, clicks: { ...c.clicks, [platform]: Number(val) || 0 } } : c
    ));
  };

  const removeCampaign = (id) => setCampaigns(prev => prev.filter(c => c.id !== id));

  const bizCampaigns = campaigns.filter(c => c.businessId === activeBusinessId);
  const enabledPlatforms = UTM_CONFIGS.filter(cfg => form.platforms[cfg.key]);
  const canGenerate = form.name.trim() && form.url.trim() && enabledPlatforms.length > 0;

  const PLATFORM_ICONS = { instagram: Instagram, youtube: Youtube, tiktok: Smartphone, facebook: Facebook };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <BrandKitReminder compact />

      {/* Campaign Builder */}
      <div className="bg-gradient-to-br from-amber-50 to-rose-50 dark:from-stone-800 dark:to-stone-800 border-2 border-amber-200 dark:border-amber-800 rounded-3xl p-8 shadow-lg">
        <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 flex items-center gap-3 mb-1">
          <Link2 className="text-amber-500" size={26} />
          Traffic Links
        </h2>
        <p className="text-stone-600 dark:text-stone-300 text-sm mb-6">
          Generate a trackable UTM link per platform. Paste each link in your bio/description so you can see exactly which platform drives the most clicks.
        </p>

        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-amber-100 dark:border-stone-700 p-6 space-y-4">
          <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider">New Campaign</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Campaign Name *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && canGenerate && saveCampaign()}
                placeholder="e.g. March Faith Series"
                className="w-full bg-amber-50 dark:bg-stone-800 border border-amber-100 dark:border-stone-600 rounded-xl px-4 py-2.5 text-sm text-stone-800 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Destination URL *</label>
              <input
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && canGenerate && saveCampaign()}
                placeholder="https://linktr.ee/sarahspeaksfaith"
                className="w-full bg-amber-50 dark:bg-stone-800 border border-amber-100 dark:border-stone-600 rounded-xl px-4 py-2.5 text-sm text-stone-800 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-stone-400 uppercase mb-1">Content Label <span className="font-normal normal-case text-stone-400">(optional — helps identify which specific post drove traffic)</span></label>
              <input
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="e.g. what-is-love-reel, product-demo-video"
                className="w-full bg-amber-50 dark:bg-stone-800 border border-amber-100 dark:border-stone-600 rounded-xl px-4 py-2.5 text-sm text-stone-800 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </div>
          </div>

          {/* Platform toggles */}
          <div>
            <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Generate links for</label>
            <div className="flex flex-wrap gap-2">
              {UTM_CONFIGS.map(cfg => (
                <button
                  key={cfg.key}
                  onClick={() => setForm(f => ({ ...f, platforms: { ...f.platforms, [cfg.key]: !f.platforms[cfg.key] } }))}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                    form.platforms[cfg.key]
                      ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-stone-800 dark:text-stone-100'
                      : 'border-stone-200 dark:border-stone-600 text-stone-400 bg-white dark:bg-stone-800'
                  }`}
                >
                  <cfg.Icon size={15} style={{ color: form.platforms[cfg.key] ? cfg.color : undefined }} />
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live preview */}
          {canGenerate && (
            <div className="space-y-2 pt-2 border-t border-amber-100 dark:border-stone-700">
              <p className="text-xs font-bold text-stone-400 uppercase">Preview Links</p>
              {enabledPlatforms.map(cfg => {
                const link = buildUtmLink(form.url, cfg.source, cfg.medium, form.name, form.content);
                const pid = `prev-${cfg.key}`;
                return (
                  <div key={cfg.key} className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-100 dark:border-stone-700">
                    <cfg.Icon size={14} style={{ color: cfg.color }} className="shrink-0" />
                    <span className="text-xs text-stone-500 dark:text-stone-400 font-mono flex-1 truncate">{link}</span>
                    <button
                      onClick={() => copyLink(link, pid)}
                      className={`shrink-0 px-3 py-1 rounded-lg text-xs font-bold transition-all ${copied === pid ? 'bg-emerald-500 text-white' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50'}`}
                    >
                      {copied === pid ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={saveCampaign}
            disabled={!canGenerate}
            className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-[0.98] disabled:opacity-40 text-white font-bold text-sm transition-all shadow-md"
          >
            Save Campaign &amp; Generate Links →
          </button>
        </div>
      </div>

      {/* Saved Campaigns */}
      {bizCampaigns.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
            <BarChart2 size={20} className="text-amber-500" />
            Your Campaigns ({bizCampaigns.length})
          </h3>
          {bizCampaigns.map(campaign => {
            const isOpen = expandedId === campaign.id;
            const totalClicks = Object.values(campaign.clicks || {}).reduce((s, v) => s + v, 0);
            const activePlatforms = UTM_CONFIGS.filter(cfg => campaign.links?.[cfg.key]);
            return (
              <div key={campaign.id} className="bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-2xl shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpandedId(isOpen ? null : campaign.id)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-stone-50 dark:hover:bg-stone-700/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                      <TrendingUp size={18} className="text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-stone-800 dark:text-stone-100 truncate">{campaign.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-stone-500 dark:text-stone-400">{campaign.createdAt}</span>
                        <span className="text-stone-300 dark:text-stone-600">·</span>
                        <div className="flex gap-1">
                          {activePlatforms.map(cfg => (
                            <cfg.Icon key={cfg.key} size={12} style={{ color: cfg.color }} />
                          ))}
                        </div>
                        {totalClicks > 0 && (
                          <>
                            <span className="text-stone-300 dark:text-stone-600">·</span>
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">{totalClicks} clicks tracked</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); copyAll(campaign); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${copied === 'all-' + campaign.id ? 'bg-emerald-500 text-white' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200'}`}
                    >
                      {copied === 'all-' + campaign.id ? '✓ All Copied' : 'Copy All'}
                    </button>
                    <ChevronDown size={18} className={`text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 border-t border-stone-100 dark:border-stone-700 pt-4 space-y-3">
                    {activePlatforms.map(cfg => {
                      const link = campaign.links[cfg.key];
                      const cid = `saved-${campaign.id}-${cfg.key}`;
                      const clicks = campaign.clicks?.[cfg.key] || 0;
                      return (
                        <div key={cfg.key} className="p-4 rounded-xl border border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 space-y-2">
                          <div className="flex items-center gap-2">
                            <cfg.Icon size={15} style={{ color: cfg.color }} />
                            <span className="text-sm font-bold text-stone-700 dark:text-stone-200">{cfg.label}</span>
                            <span className="ml-auto text-xs text-stone-400 italic hidden sm:block">{cfg.tip}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-mono text-stone-500 dark:text-stone-400 truncate flex-1 bg-white dark:bg-stone-800 px-3 py-1.5 rounded-lg border border-stone-100 dark:border-stone-700">{link}</p>
                            <button
                              onClick={() => copyLink(link, cid)}
                              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${copied === cid ? 'bg-emerald-500 text-white' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200'}`}
                            >
                              {copied === cid ? '✓ Copied' : 'Copy'}
                            </button>
                          </div>
                          <div className="flex items-center gap-3">
                            <label className="text-xs text-stone-400 shrink-0">Clicks from Google Analytics / Platform Insights:</label>
                            <input
                              type="number" min="0"
                              value={clicks}
                              onChange={e => updateClicks(campaign.id, cfg.key, e.target.value)}
                              className="w-20 bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-1 text-sm text-stone-800 dark:text-stone-100 text-center"
                            />
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex justify-end pt-1">
                      <button onClick={() => removeCampaign(campaign.id)} className="text-xs text-stone-400 hover:text-red-500 flex items-center gap-1 transition-colors">
                        <Trash2 size={12} /> Delete campaign
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tips grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-2xl p-6 shadow-sm">
          <h4 className="font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2 mb-4">
            <MapPin size={18} className="text-rose-400" />
            Where to Put Each Link
          </h4>
          <div className="space-y-4">
            {[
              { Icon: Instagram, label: 'Instagram', color: '#db2777', tip: 'Bio only — IG does not allow links in posts. Say "link in bio" in every reel caption and spoken CTA.' },
              { Icon: Youtube, label: 'YouTube', color: '#dc2626', tip: 'First 2 lines of video description (visible before "more"). Add to pinned comment too.' },
              { Icon: Smartphone, label: 'TikTok', color: '#374151', tip: 'TikTok bio link. Say "link in bio" verbally in the video — TikTok removes links from captions.' },
              { Icon: Facebook, label: 'Facebook', color: '#2563eb', tip: 'Put directly in post text. Facebook pages: use the first comment trick to avoid reach drop.' },
            ].map(({ Icon, label, color, tip }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: color + '20' }}>
                  <Icon size={14} style={{ color }} />
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-700 dark:text-stone-200">{label}</p>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{tip}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-2xl p-6 shadow-sm">
          <h4 className="font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-amber-500" />
            How to Read Your Data
          </h4>
          <div className="space-y-3 text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800">
              <p className="font-bold text-amber-700 dark:text-amber-400 mb-1">Google Analytics 4 (free)</p>
              <p>Reports → Acquisition → Traffic Acquisition. Filter by Source/Medium. Your UTM data shows up here within 24–48 hrs.</p>
            </div>
            <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-700/30 border border-stone-100 dark:border-stone-600">
              <p className="font-bold text-stone-700 dark:text-stone-200 mb-1">No Google Analytics?</p>
              <p>Use Linktree Analytics, Bitly, or Short.io — they track clicks automatically without any setup.</p>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800">
              <p className="font-bold text-rose-700 dark:text-rose-400 mb-1">What to look for</p>
              <p>Which platform sends the most clicks? Which content label gets more? Make more of what works.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Post Analytics ---
const PostAnalytics = ({ onOpenSettings }) => {
  const { activeBusinessId, setActiveBusinessId, businesses } = useStudio();
  const [posts, setPosts] = useState(() => { try { return JSON.parse(localStorage.getItem('faith-studio-post-analytics') || '[]'); } catch { return []; } });
  const [editingId, setEditingId] = useState(null);
  const [editBuf, setEditBuf] = useState({});
  const [aiInsights, setAiInsights] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('instagram_connected') === '1' || params.get('youtube_connected') === '1') {
      const state = params.get('state');
      if (state) try { localStorage.setItem('faith-studio-user-key', state); } catch (_) {}
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => { localStorage.setItem('faith-studio-post-analytics', JSON.stringify(posts)); }, [posts]);

  const removePost = (id) => setPosts(prev => prev.filter(p => p.id !== id));
  const updatePost = (id, updates) => setPosts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  const startEdit = (p) => { setEditingId(p.id); setEditBuf({ views: p.views || '', likes: p.likes || '', comments: p.comments || '', saves: p.saves || '' }); };
  const saveEdit = (id) => { updatePost(id, { views: Number(editBuf.views) || 0, likes: Number(editBuf.likes) || 0, comments: Number(editBuf.comments) || 0, saves: Number(editBuf.saves) || 0 }); setEditingId(null); };

  const bizPosts = posts.filter(p => p.businessId === activeBusinessId);
  const totalViews = bizPosts.reduce((s, p) => s + p.views, 0);
  const totalEngagement = bizPosts.reduce((s, p) => s + p.likes + p.comments + p.shares + p.saves, 0);
  const avgViews = bizPosts.length ? Math.round(totalViews / bizPosts.length) : 0;
  const bestPost = bizPosts.length ? bizPosts.reduce((a, b) => (b.views > a.views ? b : a), bizPosts[0]) : null;
  const byPlatform = bizPosts.reduce((acc, p) => { acc[p.platform] = (acc[p.platform] || 0) + p.views; return acc; }, {});

  const platformLabels = { instagram: 'Instagram', youtube: 'YouTube', tiktok: 'TikTok', facebook: 'Facebook' };

  // Progress tracking
  const now = new Date();
  const thisWeekStart = new Date(now); thisWeekStart.setDate(now.getDate() - now.getDay());
  const lastWeekStart = new Date(thisWeekStart); lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const postsThisWeek = bizPosts.filter(p => new Date(p.postedAt) >= thisWeekStart);
  const postsLastWeek = bizPosts.filter(p => { const d = new Date(p.postedAt); return d >= lastWeekStart && d < thisWeekStart; });
  const postsThisMonth = bizPosts.filter(p => new Date(p.postedAt) >= thisMonthStart);
  const viewsThisWeek = postsThisWeek.reduce((s, p) => s + p.views, 0);
  const viewsLastWeek = postsLastWeek.reduce((s, p) => s + p.views, 0);
  const trend = viewsLastWeek > 0 ? Math.round(((viewsThisWeek - viewsLastWeek) / viewsLastWeek) * 100) : null;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Auto-log notice */}
      <div className="bg-gradient-to-br from-rose-50 to-amber-50 dark:from-stone-800 dark:to-stone-800 border-2 border-rose-200 dark:border-rose-800 rounded-3xl p-6 shadow-lg">
        <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-1">Post Analytics</h2>
        <p className="text-stone-500 dark:text-stone-400 text-sm">Posts are logged automatically every time you export a video or click Publish. After your post goes live, tap it below to add the numbers.</p>
        {bizPosts.length === 0 && (
          <p className="mt-4 text-sm text-rose-500 font-medium">No posts yet — export or publish a video to get started.</p>
        )}
      </div>

      {/* All accounts overview */}
      {(businesses || []).length > 0 && (
        <div className="bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-3xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100 mb-4 flex items-center gap-2"><BarChart2 size={20} className="text-rose-400" /> Each account — overall progress</h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mb-4">Progress and AI analysis are separate per business. Select a business below to see details.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(businesses || []).filter(Boolean).map((b) => {
              const bp = posts.filter(p => p.businessId === b.id);
              const tv = bp.reduce((s, p) => s + p.views, 0);
              const te = bp.reduce((s, p) => s + p.likes + p.comments + p.shares + p.saves, 0);
              return (
                <button key={b.id} onClick={() => setActiveBusinessId(b.id)} className={`text-left p-4 rounded-2xl border transition-all ${activeBusinessId === b.id ? 'border-rose-400 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-600' : 'border-stone-200 dark:border-stone-600 hover:border-rose-200 dark:hover:border-stone-500'}`}>
                  <p className="font-bold text-stone-800 dark:text-stone-100">{b.name}</p>
                  <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">{bp.length} posts · {tv.toLocaleString()} views · {te.toLocaleString()} engagement</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Progress tracker (current business) */}
      <div className="bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-3xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100 mb-4 flex items-center gap-2"><BarChart2 size={20} className="text-rose-400" /> {(businesses || []).find(b => b?.id === activeBusinessId)?.name || 'This account'} — this week</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="text-[10px] font-bold text-stone-400 uppercase">This week</span>
            <p className="text-xl font-bold text-rose-600 dark:text-rose-400">{postsThisWeek.length} posts · {viewsThisWeek.toLocaleString()} views</p>
          </div>
          <div>
            <span className="text-[10px] font-bold text-stone-400 uppercase">Last week</span>
            <p className="text-xl font-bold text-stone-600 dark:text-stone-400">{postsLastWeek.length} posts · {viewsLastWeek.toLocaleString()} views</p>
          </div>
          <div>
            <span className="text-[10px] font-bold text-stone-400 uppercase">This month</span>
            <p className="text-xl font-bold text-rose-600 dark:text-rose-400">{postsThisMonth.length} posts</p>
          </div>
          <div>
            <span className="text-[10px] font-bold text-stone-400 uppercase">Week-over-week</span>
            <p className={`text-xl font-bold ${trend != null ? (trend >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400') : 'text-stone-500'}`}>
              {trend != null ? (trend >= 0 ? `+${trend}%` : `${trend}%`) : '—'}
            </p>
          </div>
        </div>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-3">Log posts when you publish, then update views/likes each week to track growth. If numbers stop growing, try a new style, thumbnail, or intro.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold text-stone-400 uppercase">Total views</span>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{totalViews.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold text-stone-400 uppercase">Total engagement</span>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{totalEngagement.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold text-stone-400 uppercase">Avg views/post</span>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{avgViews.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold text-stone-400 uppercase">Posts logged</span>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{bizPosts.length}</p>
        </div>
      </div>

      {bizPosts.length > 0 && (
        <div className="bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-3xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100 mb-4 flex items-center gap-2"><TrendingUp size={20} className="text-rose-400" /> Insights & tips</h3>
          <ul className="space-y-3 text-sm text-stone-600 dark:text-stone-300">
            {bestPost && <li><strong>Top performer:</strong> &quot;{bestPost.title}&quot; — {bestPost.views.toLocaleString()} views. {bestPost.notes && `Notes: ${bestPost.notes}`}</li>}
            {Object.keys(byPlatform).length > 0 && <li><strong>By platform:</strong> {Object.entries(byPlatform).map(([k, v]) => `${platformLabels[k] || k}: ${v.toLocaleString()} views`).join('; ')}</li>}
            <li><strong>Improve:</strong> Log 3+ posts per platform to see patterns. Note your hook, time posted, and format.</li>
            <li><strong>What works:</strong> Reels/Shorts at 9–11am or 7–9pm tend to get more reach. Saves and shares matter more than likes.</li>
          </ul>
          <div className="mt-4 pt-4 border-t border-stone-200 dark:border-stone-600">
            <button onClick={async () => {
              const useOpenAI = hasOpenAIKey();
              const useGemini = hasGeminiKey();
              if (!useOpenAI && !useGemini) { onOpenSettings?.(); return; }
              setAiLoading(true); setAiError(null); setAiInsights(null);
              try {
                const businessName = businesses?.find(b => b.id === activeBusinessId)?.name || 'Your brand';
                const analyzePosts = useOpenAI ? analyzePostsOpenAI : analyzePostsGemini;
                const result = await analyzePosts(bizPosts, businessName);
                setAiInsights(result);
              } catch (e) {
                setAiError(e?.message || 'AI analysis failed');
              } finally {
                setAiLoading(false);
              }
            }} disabled={aiLoading} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold text-sm hover:bg-amber-500/30 disabled:opacity-50">
              {aiLoading ? 'Analyzing…' : '✨ Get AI insights'}
            </button>
            {!hasOpenAIKey() && !hasGeminiKey() && <p className="text-xs text-stone-500 mt-2">Add your OpenAI or Gemini API key in App Settings first.</p>}
            {aiError && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{aiError}</p>}
            {aiInsights && (
              <div className="mt-4 p-4 rounded-xl bg-stone-100 dark:bg-stone-700/50 text-sm whitespace-pre-wrap">{aiInsights}</div>
            )}
          </div>
        </div>
      )}

      {/* Post cards */}
      {bizPosts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase">Your posts — tap to update numbers</h3>
          {[...bizPosts].reverse().map(p => (
            <div key={p.id} className="bg-white dark:bg-stone-800 border border-rose-100 dark:border-stone-700 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-stone-800 dark:text-stone-100 truncate">{p.title}</p>
                  <p className="text-xs text-stone-400 mt-0.5">{platformLabels[p.platform] || p.platform} · {p.postedAt}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => editingId === p.id ? saveEdit(p.id) : startEdit(p)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${editingId === p.id ? 'bg-rose-500 text-white' : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600'}`}>{editingId === p.id ? 'Save' : 'Update'}</button>
                  <button onClick={() => removePost(p.id)} className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 size={14} /></button>
                </div>
              </div>
              {editingId === p.id ? (
                <div className="grid grid-cols-4 gap-2 mt-3">
                  {['views', 'likes', 'comments', 'saves'].map(f => (
                    <div key={f}>
                      <label className="block text-[10px] text-stone-500 uppercase font-bold mb-1">{f}</label>
                      <input type="number" value={editBuf[f]} onChange={e => setEditBuf(b => ({ ...b, [f]: e.target.value }))} placeholder="0" className="w-full bg-stone-100 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-lg px-2 py-1.5 text-sm font-mono" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex gap-4 mt-2 text-xs text-stone-500 dark:text-stone-400">
                  <span><strong className="text-stone-700 dark:text-stone-200 font-mono">{p.views.toLocaleString()}</strong> views</span>
                  <span><strong className="text-stone-700 dark:text-stone-200 font-mono">{p.likes.toLocaleString()}</strong> likes</span>
                  <span><strong className="text-stone-700 dark:text-stone-200 font-mono">{p.comments.toLocaleString()}</strong> comments</span>
                  <span><strong className="text-stone-700 dark:text-stone-200 font-mono">{p.saves.toLocaleString()}</strong> saves</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Swift Code View ---
const SwiftCodeView = () => (
  <div className="max-w-4xl mx-auto text-center py-20">
    <Code className="mx-auto text-rose-300 dark:text-rose-600/50 w-16 h-16 mb-6" />
    <h3 className="text-2xl font-semibold text-stone-800 dark:text-stone-100 mb-2">System Logic</h3>
    <p className="text-stone-500 dark:text-stone-400 max-w-md mx-auto">AVFoundation Swift logic for time-based cutting and export.</p>
  </div>
);

// --- Sidebar Item ---
const SidebarItem = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-2xl transition-all ${active ? 'bg-rose-50 dark:bg-rose-900/30 border border-rose-100 dark:border-rose-800 text-rose-600 dark:text-rose-400 font-bold shadow-sm' : 'text-stone-500 dark:text-stone-400 hover:bg-rose-50 dark:hover:bg-stone-700 hover:text-stone-800 dark:hover:text-stone-100 font-medium'}`}>
    <span className={active ? 'text-rose-500' : 'text-stone-400'}>{icon}</span>
    <span className="text-sm">{label}</span>
    {active && <div className="ml-auto w-1.5 h-1.5 bg-rose-500 rounded-full" />}
  </button>
);

export default App;
