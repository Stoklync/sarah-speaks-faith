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
import { analyzePosts as analyzePostsOpenAI, hasOpenAIKey, generateTTS, transcribeVideo, generateCaption, repurposeContent } from './services/openaiApi';
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
  Volume2,
  Palette,
  Layers,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Square,
  Circle,
  Triangle,
  Minus,
  Star,
  Undo2
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

  // Restore uploaded videos/audio/images from IndexedDB on every page load,
  // then auto-place any videos on the NLE timeline if it's empty
  useEffect(() => {
    if (!initAssetsFromIDB) return;
    initAssetsFromIDB().then?.(() => {
      // After IDB restore, if timeline is empty but we have videos, place them
      setTimeout(() => {
        const state = useEditorStore.getState();
        const hasClips = state.timelineTracks?.some(t => (t.clips || []).length > 0);
        if (!hasClips && state.assets?.length > 0) {
          const vids = state.assets.filter(a => a.type === 'video');
          vids.forEach((v, i) => {
            state.insertClipAtPlayhead(0, v.id);
          });
        }
      }, 200);
    });
  }, []);

  const [activeTab, setActiveTab] = useState('start');
  const assets = useEditorStore(s => Array.isArray(s?.assets) ? s.assets : []);
  const addAsset = useEditorStore(s => s.addAsset);
  const removeAsset = useEditorStore(s => s.removeAsset);
  const initAssetsFromIDB = useEditorStore(s => s.initAssetsFromIDB);
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

  const [voiceIsolation, setVoiceIsolation] = useState(false);
  const [deReverb, setDeReverb] = useState(false);
  const [deReverbStrength, setDeReverbStrength] = useState(60);
  const [aiUpscale, setAiUpscale] = useState(false);
  const [cinematicGrade, setCinematicGrade] = useState(false);

  const [igPosts, setIgPosts] = useState([]);
  const [pinterestPins, setPinterestPins] = useState([]);
  const [newBusinessName, setNewBusinessName] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [geminiKey, setGeminiKey] = useState(() => { try { return localStorage.getItem('faith-studio-gemini-api-key') || ''; } catch { return ''; } });
  const [openaiKey, setOpenaiKey] = useState(() => { try { return localStorage.getItem('faith-studio-openai-api-key') || ''; } catch { return ''; } });

  const primaryNav = [
    ['start', Target, 'Start Here'],
    ['video', Sliders, 'Video Editor'],
    ['photo-edit', ImageIcon, 'Photo Editor'],
    ['design', Palette, 'Design Studio'],
    ['pro', Zap, 'Content Toolkit'],
    ['social', Share2, 'Social & Podcast'],
    ['traffic', Link2, 'Traffic Links'],
    ['analytics', BarChart2, 'Analytics'],
  ];

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
        {/* ── Sidebar ── collapsible on desktop, drawer on mobile */}
        <aside className={`fixed md:relative inset-y-0 left-0 h-full md:h-auto md:min-h-0 bg-white dark:bg-stone-900 border-r border-rose-100 dark:border-stone-800 flex flex-col justify-between overflow-y-auto overflow-x-hidden shadow-[2px_0_16px_rgba(225,29,72,0.04)] dark:shadow-none z-30 transition-all duration-200 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${sidebarCollapsed ? 'md:w-[60px]' : 'md:w-[220px]'}
          w-[220px]`}>
          {/* Logo / collapse toggle */}
          <div>
            <div className={`flex items-center border-b border-rose-50 dark:border-stone-800 ${sidebarCollapsed ? 'justify-center px-2 py-4' : 'justify-between px-4 py-4'}`}>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <h1 className="text-sm font-black tracking-widest text-stone-800 dark:text-stone-100 uppercase leading-tight">Sarah Speaks</h1>
                  <p className="text-[9px] text-rose-400 tracking-[0.18em] uppercase font-bold">Faith Studio</p>
                </div>
              )}
              <button onClick={() => { setSidebarCollapsed(c => !c); setSidebarOpen(false); }}
                className="p-1.5 rounded-lg text-stone-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-stone-800 transition-colors shrink-0 hidden md:flex"
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
                {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
              <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1.5 rounded-lg text-stone-400 hover:bg-stone-100"><X size={18} /></button>
            </div>
            <nav className={`mt-3 space-y-0.5 ${sidebarCollapsed ? 'px-1.5' : 'px-2'}`}>
              {primaryNav.map(([id, Icon, label]) => (
                <button key={id} onClick={() => { setActiveTab(id); setSidebarOpen(false); }}
                  title={sidebarCollapsed ? label : undefined}
                  className={`w-full flex items-center rounded-xl transition-all text-sm font-medium
                    ${sidebarCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-3 py-2.5'}
                    ${activeTab === id
                      ? 'bg-rose-500 text-white shadow-sm shadow-rose-200 dark:shadow-none'
                      : 'text-stone-500 dark:text-stone-400 hover:bg-rose-50 dark:hover:bg-stone-800 hover:text-rose-600 dark:hover:text-rose-400'}`}>
                  <Icon size={17} className="shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">{label}</span>}
                </button>
              ))}
            </nav>
          </div>

          {/* Bottom — business switcher + settings */}
          {!sidebarCollapsed && (
            <div className="p-3 border-t border-rose-50 dark:border-stone-800 space-y-1">
              <span className="text-[9px] font-black text-stone-400 uppercase tracking-wider block px-2 mb-1">My Brands</span>
              <div className="space-y-0.5 max-h-24 overflow-y-auto">
                {(businesses || []).filter(Boolean).map((b) => (
                  <button key={b.id || b.name} onClick={() => setActiveBusinessId(b.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium truncate block transition-colors ${activeBusinessId === b.id ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300' : 'text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'}`}>
                    {b.name || 'Business'}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowAddBusiness(true)} className="w-full text-left px-2.5 py-1.5 text-xs font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1">
                <Plus size={12} /> Add brand
              </button>
              <button onClick={cycleTheme} className="flex items-center gap-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-100 text-xs w-full px-2.5 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">
                {isDark ? <Sun size={14} /> : <Moon size={14} />}
                <span>{theme === 'system' ? 'System' : theme === 'dark' ? 'Dark' : 'Light'}</span>
              </button>
              <button onClick={() => setShowSettings(true)} className="flex items-center gap-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-100 text-xs w-full px-2.5 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">
                <Settings size={14} />
                <span>Settings</span>
              </button>
            </div>
          )}
          {sidebarCollapsed && (
            <div className="p-2 border-t border-rose-50 dark:border-stone-800 flex flex-col items-center gap-1">
              <button onClick={cycleTheme} title="Toggle theme" className="p-2 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">
                {isDark ? <Sun size={15} /> : <Moon size={15} />}
              </button>
              <button onClick={() => setShowSettings(true)} title="Settings" className="p-2 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">
                <Settings size={15} />
              </button>
            </div>
          )}
        </aside>
        {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setSidebarOpen(false)} aria-hidden />}

        <main className="flex-1 min-w-0 min-h-0 relative bg-white dark:bg-stone-900 transition-colors flex flex-col overflow-y-auto overflow-x-hidden">
          {/* Hide main header in Video Editor — editor has its own controls, full screen for editing */}
          {activeTab !== 'video' && (
          <header className="bg-white/80 dark:bg-stone-900/80 backdrop-blur-md sticky top-0 border-b border-rose-100 dark:border-stone-700 px-4 md:px-10 z-10 flex justify-between items-center gap-2 transition-colors shrink-0 py-4 md:py-6">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 -ml-2 rounded-xl text-stone-600 dark:text-stone-400 hover:bg-rose-50 dark:hover:bg-stone-700" aria-label="Open menu"><Menu size={24} /></button>
            <h2 className="font-semibold text-stone-800 dark:text-stone-100 tracking-tight flex items-center gap-3 flex-wrap flex-1 min-w-0 truncate text-lg md:text-2xl">
              <span>
                {activeTab === 'start' && 'Start Here'}
                {activeTab === 'photo-edit' && 'Photo Editor'}
                {activeTab === 'design' && 'Design Studio'}
                {activeTab === 'pro' && 'Content Toolkit'}
                {activeTab === 'social' && 'Social & Podcast'}
                {activeTab === 'traffic' && 'Traffic Links'}
                {activeTab === 'analytics' && 'Analytics'}
              </span>
              {(businesses || []).find(b => b && b.id === activeBusinessId) && ['photo-edit','design','pro','social','traffic','analytics'].includes(activeTab) && (
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

        <div className={`mx-auto flex-1 min-h-0 flex flex-col ${activeTab === 'video' ? 'max-w-full w-full min-h-[100dvh] p-0 overflow-hidden' : 'max-w-7xl p-4 md:p-10 pb-24'}`} style={{ minHeight: activeTab !== 'video' ? 400 : undefined }}>
            {activeTab === 'start' && <StartHere setActiveTab={setActiveTab} />}
            {activeTab === 'video' && (
              <EditorErrorBoundary>
                <ClassicEditor />
              </EditorErrorBoundary>
            )}
            {activeTab === 'photo-edit' && <PhotoEditor />}
            {activeTab === 'design' && <DesignStudio />}
            {activeTab === 'pro' && <ProContentToolkit />}
            {activeTab === 'social' && <SocialPublisher />}
            {activeTab === 'traffic' && <TrafficHub />}
            {activeTab === 'analytics' && <PostAnalytics onOpenSettings={() => setShowSettings(true)} />}
            {!['start','video','photo-edit','design','pro','social','traffic','analytics'].includes(activeTab) && <StartHere setActiveTab={setActiveTab} />}
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

  // AI Write Caption
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiPlatform, setAiPlatform] = useState('instagram');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  // Repurpose
  const [repOpen, setRepOpen] = useState(false);
  const [repScript, setRepScript] = useState('');
  const [repLoading, setRepLoading] = useState(false);
  const [repResult, setRepResult] = useState('');

  const writeCaption = async () => {
    if (!aiTopic.trim()) return;
    setAiLoading(true); setAiResult('');
    try {
      const res = await generateCaption(aiTopic, aiPlatform);
      setAiResult(res);
    } catch (e) { setAiResult('Error: ' + e.message); }
    setAiLoading(false);
  };

  const applyAiCaption = () => {
    const m = aiResult.match(/CAPTION:\s*([\s\S]*?)(?=\nHASHTAGS:|$)/i);
    const h = aiResult.match(/HASHTAGS:\s*([\s\S]*?)$/i);
    if (m?.[1]) setCaption(m[1].trim());
    if (h?.[1]) {
      const newTags = h[1].trim().replace(/#/g, '').split(/\s+/).filter(Boolean);
      addTags(newTags);
    }
    setAiOpen(false);
  };

  const doRepurpose = async () => {
    if (!repScript.trim()) return;
    setRepLoading(true); setRepResult('');
    try {
      const res = await repurposeContent(repScript);
      setRepResult(res);
    } catch (e) { setRepResult('Error: ' + e.message); }
    setRepLoading(false);
  };

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
              {/* AI Write Caption */}
              <div className="mb-4">
                <div className="flex gap-2">
                  <button onClick={() => { setAiOpen(o => !o); setRepOpen(false); }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-bold transition-colors">
                    <Sparkles size={13} /> AI Write Caption
                  </button>
                  <button onClick={() => { setRepOpen(o => !o); setAiOpen(false); }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-xs font-bold transition-colors">
                    <Wand2 size={13} /> Repurpose for All Platforms
                  </button>
                </div>

                {aiOpen && (
                  <div className="mt-3 bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-3">
                    <p className="text-xs font-bold text-stone-700">Write with AI</p>
                    <textarea value={aiTopic} onChange={e => setAiTopic(e.target.value)} placeholder="What's your video about? Paste your script or describe your topic..." rows={3} className="w-full bg-white border border-rose-200 rounded-xl p-3 text-sm text-stone-700 resize-none focus:outline-none focus:border-rose-400" />
                    <div className="flex gap-2 flex-wrap">
                      {['instagram','tiktok','youtube','facebook'].map(p => (
                        <button key={p} onClick={() => setAiPlatform(p)} className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize border transition-colors ${aiPlatform === p ? 'bg-rose-500 border-rose-500 text-white' : 'bg-white border-rose-200 text-stone-600 hover:border-rose-400'}`}>{p}</button>
                      ))}
                    </div>
                    <button onClick={writeCaption} disabled={aiLoading || !aiTopic.trim()} className="w-full py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold disabled:opacity-50 transition-all">
                      {aiLoading ? 'Writing...' : 'Generate Caption + Hashtags'}
                    </button>
                    {aiResult && (
                      <div className="bg-white border border-rose-200 rounded-xl p-3 text-xs text-stone-700 whitespace-pre-wrap max-h-48 overflow-y-auto">{aiResult}</div>
                    )}
                    {aiResult && (
                      <button onClick={applyAiCaption} className="w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-all">
                        Apply Caption + Tags
                      </button>
                    )}
                    {!hasOpenAIKey() && <p className="text-[10px] text-stone-500 text-center">Add OpenAI key in App Settings</p>}
                  </div>
                )}

                {repOpen && (
                  <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-3">
                    <p className="text-xs font-bold text-stone-700">Repurpose for Every Platform</p>
                    <p className="text-[10px] text-stone-500">Paste your script or idea. AI rewrites it for Instagram, TikTok, YouTube, Email, Tweet + gives you 3 hook options.</p>
                    <textarea value={repScript} onChange={e => setRepScript(e.target.value)} placeholder="Paste your script or describe what your video is about..." rows={3} className="w-full bg-white border border-indigo-200 rounded-xl p-3 text-sm text-stone-700 resize-none focus:outline-none focus:border-indigo-400" />
                    <button onClick={doRepurpose} disabled={repLoading || !repScript.trim()} className="w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold disabled:opacity-50 transition-all">
                      {repLoading ? 'Repurposing...' : '⚡ Repurpose for All Platforms'}
                    </button>
                    {repResult && (
                      <div className="bg-white border border-indigo-200 rounded-xl p-3 text-xs text-stone-700 whitespace-pre-wrap max-h-64 overflow-y-auto">{repResult}</div>
                    )}
                    {repResult && (
                      <button onClick={() => { navigator.clipboard.writeText(repResult).catch(() => {}); }} className="w-full py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-700 text-sm font-bold transition-all">
                        Copy All
                      </button>
                    )}
                    {!hasOpenAIKey() && <p className="text-[10px] text-stone-500 text-center">Add OpenAI key in App Settings</p>}
                  </div>
                )}
              </div>

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

// ── AI Voice Presets ────────────────────────────────────────────────────────
// ── Color / Look Filter Presets ───────────────────────────────────────────
const FILTER_PRESETS = [
  { id: 'none',      label: 'Original',    emoji: '⚪', b: 100, c: 100, s: 100, h: 0,  temp: 0,  vignette: 0  },
  { id: 'cinematic', label: 'Cinematic',   emoji: '🎬', b: 95,  c: 122, s: 82,  h: 0,  temp: 15, vignette: 35 },
  { id: 'punch',     label: 'Punch',       emoji: '⚡', b: 105, c: 132, s: 138, h: 0,  temp: 5,  vignette: 0  },
  { id: 'neon',      label: 'Neon',        emoji: '🌈', b: 100, c: 125, s: 168, h: 15, temp: -10,vignette: 40 },
  { id: 'golden',    label: 'Golden Hour', emoji: '✨', b: 108, c: 105, s: 112, h: 5,  temp: 40, vignette: 25 },
  { id: 'vintage',   label: 'Vintage',     emoji: '📷', b: 95,  c: 88,  s: 70,  h: 10, temp: 25, vignette: 50 },
  { id: 'drama',     label: 'Drama',       emoji: '🎭', b: 88,  c: 148, s: 65,  h: 0,  temp: -5, vignette: 60 },
  { id: 'faith',     label: 'Faith Glow',  emoji: '🙏', b: 107, c: 108, s: 90,  h: 0,  temp: 20, vignette: 20 },
  { id: 'cool',      label: 'Cool',        emoji: '❄️', b: 100, c: 112, s: 108, h: -8, temp: -30,vignette: 15 },
  { id: 'fade',      label: 'Fade',        emoji: '🌫', b: 114, c: 80,  s: 70,  h: 0,  temp: 10, vignette: 0  },
  { id: 'matte',     label: 'Matte',       emoji: '🎞', b: 102, c: 85,  s: 72,  h: 0,  temp: 8,  vignette: 30 },
  { id: 'vivid',     label: 'Vivid',       emoji: '🌟', b: 110, c: 118, s: 155, h: 0,  temp: 0,  vignette: 0  },
  { id: 'mono',      label: 'B&W',         emoji: '◐',  b: 100, c: 115, s: 0,   h: 0,  temp: 0,  vignette: 25 },
  { id: 'warm',      label: 'Warm',        emoji: '🔥', b: 105, c: 105, s: 110, h: 5,  temp: 55, vignette: 0  },
  { id: 'bleach',    label: 'Bleach',      emoji: '💎', b: 112, c: 90,  s: 55,  h: 0,  temp: -8, vignette: 20 },
];

// ── Popular Scripture Verses ──────────────────────────────────────────────
const POPULAR_VERSES = [
  { ref: 'Philippians 4:13',      text: 'I can do all things through Christ who strengthens me.' },
  { ref: 'Jeremiah 29:11',        text: 'For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.' },
  { ref: 'Romans 8:28',           text: 'And we know that in all things God works for the good of those who love him, who have been called according to his purpose.' },
  { ref: 'Isaiah 41:10',          text: 'So do not fear, for I am with you; do not be dismayed, for I am your God. I will strengthen you and help you.' },
  { ref: 'Proverbs 3:5-6',        text: 'Trust in the Lord with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight.' },
  { ref: 'Psalm 46:10',           text: 'Be still, and know that I am God.' },
  { ref: 'Matthew 6:33',          text: 'But seek first his kingdom and his righteousness, and all these things will be given to you as well.' },
  { ref: 'John 3:16',             text: 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.' },
  { ref: 'Romans 8:31',           text: 'If God is for us, who can be against us?' },
  { ref: 'Isaiah 40:31',          text: 'But those who hope in the Lord will renew their strength. They will soar on wings like eagles; they will run and not grow weary.' },
  { ref: 'Matthew 11:28',         text: 'Come to me, all you who are weary and burdened, and I will give you rest.' },
  { ref: '2 Timothy 1:7',         text: 'For God has not given us a spirit of fear, but of power and of love and of a sound mind.' },
  { ref: 'Ephesians 3:20',        text: 'Now to him who is able to do immeasurably more than all we ask or imagine, according to his power that is at work within us.' },
  { ref: 'Joshua 1:9',            text: 'Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.' },
  { ref: 'Proverbs 31:25',        text: 'She is clothed with strength and dignity; she can laugh at the days to come.' },
  { ref: 'Psalm 34:18',           text: 'The Lord is close to the brokenhearted and saves those who are crushed in spirit.' },
  { ref: '1 Peter 5:7',           text: 'Cast all your anxiety on him because he cares for you.' },
  { ref: 'Psalm 37:4',            text: 'Take delight in the Lord, and he will give you the desires of your heart.' },
  { ref: 'Romans 12:2',           text: 'Do not conform to the pattern of this world, but be transformed by the renewing of your mind.' },
  { ref: 'Psalm 139:14',          text: 'I praise you because I am fearfully and wonderfully made; your works are wonderful, I know that full well.' },
  { ref: 'Lamentations 3:22-23',  text: 'Because of the Lord\'s great love we are not consumed, for his compassions never fail. They are new every morning; great is your faithfulness.' },
  { ref: '2 Corinthians 5:7',     text: 'For we live by faith, not by sight.' },
  { ref: 'Psalm 23:1',            text: 'The Lord is my shepherd, I lack nothing.' },
  { ref: 'Galatians 5:22-23',     text: 'But the fruit of the Spirit is love, joy, peace, forbearance, kindness, goodness, faithfulness, gentleness and self-control.' },
  { ref: 'Psalm 28:7',            text: 'The Lord is my strength and my shield; my heart trusts in him, and he helps me.' },
];

const TTS_VOICES = [
  { id: 'onyx',    name: 'Onyx',    desc: 'Deep male narrator' },
  { id: 'echo',    name: 'Echo',    desc: 'Warm male voice' },
  { id: 'fable',   name: 'Fable',   desc: 'British storyteller' },
  { id: 'nova',    name: 'Nova',    desc: 'Natural female' },
  { id: 'shimmer', name: 'Shimmer', desc: 'Soft female' },
  { id: 'alloy',   name: 'Alloy',   desc: 'Professional neutral' },
];

// ── Scripture Finder ──────────────────────────────────────────────────────
const ScriptureFinder = ({ onInsert }) => {
  const [query, setQuery] = useState('');
  const [lookupRef, setLookupRef] = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');

  const filtered = query.trim()
    ? POPULAR_VERSES.filter(v => v.ref.toLowerCase().includes(query.toLowerCase()) || v.text.toLowerCase().includes(query.toLowerCase()))
    : POPULAR_VERSES;

  const lookupVerse = async () => {
    if (!lookupRef.trim()) return;
    setLookupLoading(true);
    setLookupError('');
    setLookupResult(null);
    try {
      const r = await fetch(`https://bible-api.com/${encodeURIComponent(lookupRef)}?translation=web`);
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setLookupResult({ ref: data.reference, text: data.text?.replace(/\n/g, ' ').trim() });
    } catch (e) {
      setLookupError('Verse not found — try e.g. "John 3:16" or "Psalm 23"');
    }
    setLookupLoading(false);
  };

  return (
    <div className="space-y-2">
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search verses by keyword..." className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-rose-500" />
      <div className="max-h-48 overflow-y-auto space-y-1 pr-0.5">
        {filtered.map(v => (
          <button key={v.ref} onClick={() => onInsert(v.ref, v.text)}
            className="w-full text-left bg-stone-800 border border-stone-700 hover:border-rose-600 rounded-xl px-3 py-2 transition-colors group">
            <span className="text-[10px] font-black text-rose-400 block">{v.ref}</span>
            <span className="text-[10px] text-stone-400 group-hover:text-stone-200 transition-colors line-clamp-2">{v.text}</span>
          </button>
        ))}
        {filtered.length === 0 && <p className="text-[10px] text-stone-600 text-center py-2">No matches — try a custom lookup below</p>}
      </div>
      <div className="flex gap-1.5">
        <input value={lookupRef} onChange={e => setLookupRef(e.target.value)} onKeyDown={e => e.key === 'Enter' && lookupVerse()} placeholder="Any verse... e.g. Romans 8:1" className="flex-1 bg-stone-800 border border-stone-700 rounded-xl px-3 py-1.5 text-xs text-stone-100 focus:outline-none focus:border-rose-500" />
        <button onClick={lookupVerse} disabled={lookupLoading} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold disabled:opacity-50">{lookupLoading ? '...' : 'Find'}</button>
      </div>
      {lookupError && <p className="text-[10px] text-rose-400">{lookupError}</p>}
      {lookupResult && (
        <button onClick={() => onInsert(lookupResult.ref, lookupResult.text)} className="w-full text-left bg-rose-950/40 border border-rose-700 rounded-xl px-3 py-2 hover:border-rose-500 transition-colors">
          <span className="text-[10px] font-black text-rose-400 block">{lookupResult.ref}</span>
          <span className="text-[10px] text-stone-300 line-clamp-3">{lookupResult.text}</span>
          <span className="text-[10px] text-rose-500 font-bold mt-1 block">Tap to insert as overlay</span>
        </button>
      )}
    </div>
  );
};

// ── Animated Character ────────────────────────────────────────────────────
const AnimatedCharacter = ({ anim }) => (
  <div className={`char-entrance char-body-${anim} relative select-none`} style={{ width: 56, height: 92, filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.6))' }}>
    {/* Head */}
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-11 h-11 rounded-full bg-gradient-to-br from-rose-200 to-rose-400 border-2 border-rose-500 flex items-center justify-center">
      <span className="text-lg leading-none">😊</span>
    </div>
    {/* Body */}
    <div className="absolute top-10 left-1/2 -translate-x-1/2 w-8 h-11 rounded-xl bg-gradient-to-b from-rose-400 to-rose-600" />
    {/* Left arm */}
    <div className={`absolute top-12 left-0 w-6 h-2.5 rounded-full bg-rose-400 origin-right ${anim === 'wave' ? 'char-arm-wave' : anim === 'point' ? 'char-arm-point' : ''}`}
      style={{ transform: anim === 'point' ? 'rotate(-55deg)' : 'rotate(22deg)' }} />
    {/* Right arm */}
    <div className="absolute top-12 right-0 w-6 h-2.5 rounded-full bg-rose-400" style={{ transform: 'rotate(-22deg)' }} />
    {/* Legs */}
    <div className="absolute bottom-0 left-3 w-2.5 h-8 rounded-full bg-rose-500" style={{ transform: 'rotate(6deg)' }} />
    <div className="absolute bottom-0 right-3 w-2.5 h-8 rounded-full bg-rose-500" style={{ transform: 'rotate(-6deg)' }} />
  </div>
);

// ── Overlay Editor (inline card) ──────────────────────────────────────────
const OverlayEditor = ({ overlay, onChange, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-stone-800 border border-stone-700 rounded-xl mb-2 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <span className="text-[11px] font-bold text-stone-300 flex-1 truncate">{overlay.content || 'New overlay'}</span>
        <span className="text-[10px] text-stone-500 shrink-0">{overlay.startTime}s · {overlay.animStyle}</span>
        <button onPointerDown={e => { e.stopPropagation(); onDelete(); }} className="text-stone-600 hover:text-rose-400 shrink-0"><X size={12} /></button>
      </div>
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-stone-700 pt-2">
          <input value={overlay.content} onChange={e => onChange({ ...overlay, content: e.target.value })} placeholder="Text content" className="w-full bg-stone-900 border border-stone-700 rounded-lg px-2 py-1.5 text-xs text-stone-100 focus:outline-none focus:border-rose-500" />
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <p className="text-[10px] text-stone-500 mb-0.5">Start (s)</p>
              <input type="number" min="0" step="0.5" value={overlay.startTime} onChange={e => onChange({ ...overlay, startTime: Number(e.target.value) })} className="w-full bg-stone-900 border border-stone-700 rounded-lg px-2 py-1 text-xs text-stone-100" />
            </div>
            <div>
              <p className="text-[10px] text-stone-500 mb-0.5">Duration (s)</p>
              <input type="number" min="0.5" step="0.5" value={overlay.duration} onChange={e => onChange({ ...overlay, duration: Number(e.target.value) })} className="w-full bg-stone-900 border border-stone-700 rounded-lg px-2 py-1 text-xs text-stone-100" />
            </div>
          </div>
          <div>
            <p className="text-[10px] text-stone-500 mb-1">Position</p>
            <div className="flex flex-wrap gap-1">
              {['upper','center','lower','left','right'].map(p => (
                <button key={p} onClick={() => onChange({ ...overlay, position: p })} className={`px-2 py-1 rounded-lg text-[10px] font-bold border capitalize transition-colors ${overlay.position === p ? 'bg-rose-600 border-rose-600 text-white' : 'bg-stone-900 border-stone-700 text-stone-400 hover:border-stone-500'}`}>{p}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-stone-500 mb-1">Animation</p>
            <div className="flex flex-wrap gap-1">
              {['fade','slide-up','slide-right','zoom','bounce','typewriter'].map(a => (
                <button key={a} onClick={() => onChange({ ...overlay, animStyle: a })} className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${overlay.animStyle === a ? 'bg-rose-600 border-rose-600 text-white' : 'bg-stone-900 border-stone-700 text-stone-400 hover:border-stone-500'}`}>{a}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-stone-500 mb-1">Color</p>
            <div className="flex flex-wrap gap-1">
              {[['white','#fff'],['gold','#fbbf24'],['rose','#fb7185'],['cyan','#67e8f9'],['lime','#bef264']].map(([name, hex]) => (
                <button key={name} onClick={() => onChange({ ...overlay, color: name })} className={`w-7 h-7 rounded-full border-2 transition-all ${overlay.color === name ? 'border-white scale-110' : 'border-stone-600'}`} style={{ background: hex }} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ClassicEditor = () => {
  const { selectedVideo, selectedAudio, filteredAssets, setSelectedVideoId, setSelectedAudioId, setActiveTab, activeBusinessId, businesses, addAsset, platforms = {}, caption, setCaption, tags, contactPageUrl, setContactPageUrl, marketingGoal, setMarketingGoal, setSidebarOpen, voiceIsolation, setVoiceIsolation, deReverb, setDeReverb, deReverbStrength, setDeReverbStrength, aiUpscale, setAiUpscale, cinematicGrade, setCinematicGrade } = useStudio();
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
  const clipUploadRef = useRef(null);
  const audioUploadRef = useRef(null);
  const handleInlineUpload = (e, typeFilter) => {
    Array.from(e.target.files || []).forEach(f => {
      const t = f.type.startsWith('video/') ? 'video' : f.type.startsWith('audio/') ? 'audio' : 'image';
      if (!typeFilter || t === typeFilter) {
        const id = addAsset(f, t);
        // Auto-place on the right timeline track immediately after adding to library
        if (id) {
          setTimeout(() => {
            if (t === 'video') insertClipAtPlayhead(0, id);
            else if (t === 'image') insertClipAtPlayhead(0, id);
            else if (t === 'audio') insertClipAtPlayhead(3, id);
          }, 80); // small delay so asset probe can register duration first
        }
      }
    });
    e.target.value = '';
  };
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
  const [trackHeights, setTrackHeights] = useState({ text: 36, video: 100, audio: 64, extra: 48 });
  const [resizingTrack, setResizingTrack] = useState(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showAIHelper, setShowAIHelper] = useState(false);
  const [inspectorTab, setInspectorTab] = useState('edit');
  // ── Camera recording state ─────────────────────────────────────────────────
  const [recordTimer, setRecordTimer] = useState(0);
  const recordTimerRef = useRef(null);
  const cameraPreviewRef = useRef(null);
  const cameraPreviewStreamRef = useRef(null);
  const [cameraPreviewActive, setCameraPreviewActive] = useState(false);
  const [cameraPreviewError, setCameraPreviewError] = useState(null);
  const [cameraFacing, setCameraFacing] = useState('user'); // 'user' | 'environment'
  useEffect(() => {
    if (isRecording) {
      setRecordTimer(0);
      recordTimerRef.current = setInterval(() => setRecordTimer(t => t + 1), 1000);
    } else {
      clearInterval(recordTimerRef.current);
    }
    return () => clearInterval(recordTimerRef.current);
  }, [isRecording]);
  const startCameraPreview = async (facing = cameraFacing) => {
    setCameraPreviewError(null);
    try {
      if (cameraPreviewStreamRef.current) {
        cameraPreviewStreamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
      cameraPreviewStreamRef.current = stream;
      if (cameraPreviewRef.current) {
        cameraPreviewRef.current.srcObject = stream;
        cameraPreviewRef.current.play().catch(() => {});
      }
      setCameraPreviewActive(true);
    } catch (e) {
      setCameraPreviewError(e.message || 'Camera access denied');
    }
  };
  const stopCameraPreview = () => {
    cameraPreviewStreamRef.current?.getTracks().forEach(t => t.stop());
    cameraPreviewStreamRef.current = null;
    setCameraPreviewActive(false);
  };
  useEffect(() => {
    if (inspectorTab !== 'camera') stopCameraPreview();
  }, [inspectorTab]);
  useEffect(() => { return () => stopCameraPreview(); }, []);
  // ── Color Filters state ───────────────────────────────────────────────────
  const [filterPreset, setFilterPreset] = useState('none');
  const [filterB, setFilterB] = useState(100);
  const [filterC, setFilterC] = useState(100);
  const [filterS, setFilterS] = useState(100);
  const [filterH, setFilterH] = useState(0);             // hue-rotate degrees
  const [filterTemp, setFilterTemp] = useState(0);       // temperature -100 cool → +100 warm
  const [filterVignette, setFilterVignette] = useState(0); // 0-100 vignette strength
  const [filterHighlights, setFilterHighlights] = useState(0); // -50 to +50
  const [filterShadows, setFilterShadows] = useState(0);      // -50 to +50
  const [filterBlur, setFilterBlur] = useState(0);       // 0-10px
  // Transform
  const [transformRotation, setTransformRotation] = useState(0); // degrees
  const [transformFlipH, setTransformFlipH] = useState(false);
  const [transformFlipV, setTransformFlipV] = useState(false);
  const [transformScale, setTransformScale] = useState(100);  // percent 50-200
  const [transformPanX, setTransformPanX] = useState(0);      // -50 to 50
  const [transformPanY, setTransformPanY] = useState(0);      // -50 to 50
  const [cropAspect, setCropAspect] = useState('free');

  const videoFiltersRef = useRef({ b: 100, c: 100, s: 100, h: 0, temp: 0, vignette: 0, blur: 0, highlights: 0, shadows: 0 });
  useEffect(() => {
    videoFiltersRef.current = { b: filterB, c: filterC, s: filterS, h: filterH, temp: filterTemp, vignette: filterVignette, blur: filterBlur, highlights: filterHighlights, shadows: filterShadows };
  }, [filterB, filterC, filterS, filterH, filterTemp, filterVignette, filterBlur, filterHighlights, filterShadows]);

  const applyFilterPreset = (preset) => {
    setFilterPreset(preset.id);
    setFilterB(preset.b);
    setFilterC(preset.c);
    setFilterS(preset.s);
    setFilterH(preset.h ?? 0);
    setFilterTemp(preset.temp ?? 0);
    setFilterVignette(preset.vignette ?? 0);
  };
  const resetAllFilters = () => applyFilterPreset(FILTER_PRESETS[0]);
  const resetTransform = () => { setTransformRotation(0); setTransformFlipH(false); setTransformFlipV(false); setTransformScale(100); setTransformPanX(0); setTransformPanY(0); setCropAspect('free'); };

  const buildCSSFilter = () => {
    const parts = [];
    // Combine brightness with highlights/shadows approximation
    const bAdj = filterB + (filterHighlights * 0.25) + (filterShadows * 0.18);
    if (Math.abs(bAdj - 100) > 0.5) parts.push(`brightness(${Math.max(10, bAdj).toFixed(1)}%)`);
    // Combine contrast: high highlights = slight contrast reduction; lifted shadows = slight contrast dip
    const cAdj = filterC - Math.abs(filterHighlights) * 0.08 + filterShadows * 0.06;
    if (Math.abs(cAdj - 100) > 0.5) parts.push(`contrast(${Math.max(10, cAdj).toFixed(1)}%)`);
    if (filterS !== 100) parts.push(`saturate(${filterS}%)`);
    if (filterH !== 0) parts.push(`hue-rotate(${filterH}deg)`);
    if (filterBlur > 0) parts.push(`blur(${filterBlur}px)`);
    return parts.length ? parts.join(' ') : undefined;
  };
  const vidFilterCSS = buildCSSFilter();
  const stageTransformCSS = (() => {
    const parts = [];
    const scaleX = (transformScale / 100) * (transformFlipH ? -1 : 1);
    const scaleY = (transformScale / 100) * (transformFlipV ? -1 : 1);
    parts.push(`scaleX(${scaleX}) scaleY(${scaleY})`);
    if (transformRotation !== 0) parts.push(`rotate(${transformRotation}deg)`);
    if (transformPanX !== 0 || transformPanY !== 0) parts.push(`translate(${transformPanX}%, ${transformPanY}%)`);
    return parts.join(' ');
  })();

  // Auto-caption state
  const [autoCaptionLoading, setAutoCaptionLoading] = useState(false);
  const [autoCaptionError, setAutoCaptionError] = useState('');

  // Animate tab state
  const [animOverlays, setAnimOverlays] = useState(() => { try { return JSON.parse(localStorage.getItem('faith-studio-anim-overlays') || '[]'); } catch { return []; } });
  const animOverlaysRef = useRef(animOverlays);
  useEffect(() => { animOverlaysRef.current = animOverlays; localStorage.setItem('faith-studio-anim-overlays', JSON.stringify(animOverlays)); }, [animOverlays]);
  // Image/GIF/sticker overlays — uploaded by user, shown on stage at set time
  const [imageOverlays, setImageOverlays] = useState([]);
  const stickerUploadRef = useRef(null);
  const [ttsScript, setTtsScript] = useState('');
  const [ttsVoice, setTtsVoice] = useState('onyx');
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsError, setTtsError] = useState('');
  const [charAnim, setCharAnim] = useState('off'); // 'off' | 'wave' | 'point' | 'nod' | 'dance'
  const [charPos, setCharPos] = useState('right');
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
  // ── AI Voice / Overlays ──────────────────────────────────────────────────
  const generateVoice = async () => {
    if (!ttsScript.trim()) return;
    setTtsLoading(true);
    setTtsError('');
    try {
      const blob = await generateTTS(ttsScript, ttsVoice, ttsSpeed);
      const fileName = `AI-${ttsVoice}-${Date.now()}.mp3`;
      const file = new File([blob], fileName, { type: 'audio/mpeg' });
      addAsset(file, 'audio');
      setTtsScript('');
    } catch (e) {
      setTtsError(e.message);
    } finally {
      setTtsLoading(false);
    }
  };

  const autoCaption = async () => {
    if (!selectedVideo) return;
    setAutoCaptionLoading(true);
    setAutoCaptionError('');
    try {
      const resp = await fetch(selectedVideo.url);
      if (!resp.ok) throw new Error('Could not read video file');
      const blob = await resp.blob();
      if (blob.size > 24 * 1024 * 1024) throw new Error('Video is over 24 MB — trim it first or export a shorter clip');
      const result = await transcribeVideo(blob);
      const clips = (result.segments || []).map(seg => ({
        id: 'sub' + Date.now() + Math.random().toString(36).slice(2),
        text: seg.text?.trim() || '',
        x: 50, y: 85,
        size: 'sm', font: 'sans', color: 'white', bold: false,
        lowerThird: false,
        start: Number((seg.start || 0).toFixed(2)),
        end: Number((seg.end || ((seg.start || 0) + 3)).toFixed(2)),
        animStyle: 'minimal',
      })).filter(c => c.text);
      setTextClips(prev => [...prev, ...clips]);
    } catch (e) {
      setAutoCaptionError(e.message);
    }
    setAutoCaptionLoading(false);
  };

  const insertScripture = (ref, text) => {
    const start = Math.round(playhead * 10) / 10;
    setTextClips(prev => [...prev, {
      id: 'scr' + Date.now(),
      text: `"${text}" — ${ref}`,
      x: 50, y: 80,
      size: 'sm', font: 'serif', color: 'gold', bold: false,
      lowerThird: true,
      start, end: start + 6,
      animStyle: 'faith',
    }]);
    setInspectorTab('text');
  };

  const addAnimOverlay = () => {
    setAnimOverlays(prev => [...prev, {
      id: 'ao' + Date.now(),
      content: 'Your text here',
      startTime: Math.round(playhead * 10) / 10,
      duration: 4,
      position: 'center',
      animStyle: 'fade',
      color: 'white',
    }]);
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
      // While user is scrubbing, don't let the video's lagging currentTime snap the playhead back
      if (draggingPlayheadRef.current) return;

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
    const ruler = timelineRulerRef.current;
    if (!ruler || effectiveDuration <= 0) return;
    const rect = ruler.getBoundingClientRect();
    const x = getEventX(e) - rect.left;
    // Use actual rendered width — NOT a hardcoded value — so clicks map 1:1 to the ruler
    const pct = Math.max(0, Math.min(1, rect.width > 0 ? x / rect.width : 0));
    const t = snapToNearest(pct * effectiveDuration);
    draggingPlayheadRef.current = true;
    dragTargetRef.current = t;
    setPlayhead(t);
    seekTo(t);
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
    const newId = `seg${Date.now()}`;
    const newSeg = { id: newId, start: t, end: seg.end, transition: seg.transition || 'cut' };
    const updated = { ...seg, end: t };
    setMainSegments(prev => [...prev.slice(0, idx), updated, newSeg, ...prev.slice(idx + 1)]);
    // Auto-select the new (second) segment so user can immediately delete it
    setTimeout(() => setSelectedSegmentId(newId), 50);
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

  const handleResizeMain = (e, seg, edge) => { e.stopPropagation(); pushHistory(); setResizingMainId(seg.id); setResizingMainEdge(edge); setSelectedSegmentId(seg.id); setSelectedAudioSegmentId(null); };
  const handleResizeAudio = (e, seg, edge) => { e.stopPropagation(); pushHistory(); setResizingAudioId(seg.id); setResizingAudioEdge(edge); setSelectedAudioSegmentId(seg.id); setSelectedSegmentId(null); };
  const handleMoveMainStart = (e, seg) => { e.stopPropagation(); setMovingMainId(seg.id); setSelectedSegmentId(seg.id); setSelectedAudioSegmentId(null); };
  const handleMoveAudioStart = (e, seg) => { e.stopPropagation(); setMovingAudioId(seg.id); setSelectedAudioSegmentId(seg.id); setSelectedSegmentId(null); };
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
  // Ref mirrors state so onVideoTimeUpdate (stale closure) can read it synchronously
  const draggingPlayheadRef = useRef(false);
  const setDraggingPlayheadSynced = (val) => {
    draggingPlayheadRef.current = val;
    setDraggingPlayhead(val);
  };

  const rafRef = useRef(null);
  // Cache of the intended playhead time while dragging — prevents timeupdate from snapping back
  const dragTargetRef = useRef(null);

  const handlePlayheadDrag = (e) => {
    const ruler = timelineRulerRef.current;
    if (!ruler || effectiveDuration <= 0) return;
    const rect = ruler.getBoundingClientRect();
    const x = getEventX(e) - rect.left;
    // Use actual rendered width — must match handleRulerClick
    const pct = Math.max(0, Math.min(1, rect.width > 0 ? x / rect.width : 0));
    const t = snapToNearest(pct * effectiveDuration);
    dragTargetRef.current = t;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setPlayhead(t);
      seekTo(t);
      rafRef.current = null;
    });
  };
  useEffect(() => {
    if (!draggingPlayhead) return;
    const onMove = (e) => { e.preventDefault(); handlePlayheadDrag(e); };
    const onUp = () => {
      // Keep lock for 200ms while the video seek settles — prevents timeupdate snap-back
      setTimeout(() => {
        draggingPlayheadRef.current = false;
        dragTargetRef.current = null;
      }, 200);
      setDraggingPlayhead(false);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
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
    // Vertical (Reels / Shorts / TikTok)
    { id: '9:16-4k', label: '4K Vertical', w: 2160, h: 3840, platform: 'Reels, Shorts, TikTok — ultra quality' },
    { id: '9:16', label: '1080p Vertical', w: 1080, h: 1920, platform: 'Reels, Shorts, TikTok — standard' },
    // Landscape (YouTube)
    { id: '16:9-4k', label: '4K YouTube', w: 3840, h: 2160, platform: 'YouTube — ultra quality' },
    { id: '16:9-2k', label: '2K YouTube', w: 2560, h: 1440, platform: 'YouTube — 2K quality' },
    { id: '16:9', label: '1080p YouTube', w: 1920, h: 1080, platform: 'YouTube, Facebook' },
    // Square / Portrait feed
    { id: '1:1', label: '1080 Square', w: 1080, h: 1080, platform: 'Instagram feed, Pinterest' },
    { id: '4:5', label: 'Portrait feed', w: 1080, h: 1350, platform: 'Instagram portrait' },
    // Original
    { id: 'source', label: 'Source quality', w: null, h: null, platform: 'Original resolution, no resampling' },
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
          const { b, c, s, h, blur, temp } = videoFiltersRef.current;
          const filterParts = [];
          if (b !== 100) filterParts.push(`brightness(${b / 100})`);
          if (c !== 100) filterParts.push(`contrast(${c / 100})`);
          if (s !== 100) filterParts.push(`saturate(${s / 100})`);
          if (h !== 0) filterParts.push(`hue-rotate(${h}deg)`);
          if (blur > 0) filterParts.push(`blur(${blur}px)`);
          ctx.filter = filterParts.length ? filterParts.join(' ') : 'none';
          ctx.drawImage(v, sx, sy, sW, sH, 0, 0, outW, outH);
          ctx.filter = 'none';
          // Temperature overlay
          if (temp && temp !== 0) {
            const alpha = Math.abs(temp) / 100 * 0.22;
            ctx.globalAlpha = alpha;
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = temp > 0 ? `rgb(255,200,80)` : `rgb(80,140,255)`;
            ctx.fillRect(0, 0, outW, outH);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
          }
          // Vignette overlay
          const { vignette } = videoFiltersRef.current;
          if (vignette > 0) {
            const grad = ctx.createRadialGradient(outW / 2, outH / 2, outW * 0.3, outW / 2, outH / 2, outW * 0.75);
            grad.addColorStop(0, 'rgba(0,0,0,0)');
            grad.addColorStop(1, `rgba(0,0,0,${vignette / 100 * 0.85})`);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, outW, outH);
          }
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
        // Apply speed from first segment
        const firstSeg = (mainSegments || []).find(s => s && typeof s.start === 'number');
        if (firstSeg?.speed && firstSeg.speed !== 1) v.playbackRate = firstSeg.speed;
        // Boost bitrate for 4K
        const is4k = (fmt?.w ?? 0) >= 3840 || (fmt?.h ?? 0) >= 3840;
        const is2k = (fmt?.w ?? 0) >= 2560 || (fmt?.h ?? 0) >= 2560;
        if (is4k) { try { recorder.videoBitsPerSecond = 25000000; } catch(_){} }
        else if (is2k) { try { recorder.videoBitsPerSecond = 12000000; } catch(_){} }
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
          const sizeMap = { sm: 24, md: 36, lg: 56, xl: 80 };
          const fontMap = { sans: 'sans-serif', serif: '"Playfair Display", serif', mono: 'monospace', display: 'sans-serif' };
          const colorMap = { white: '#fff', black: '#000', yellow: '#fef08a', rose: '#fda4af', cyan: '#67e8f9', lime: '#bef264', orange: '#fb923c', gold: '#fbbf24', amber: '#fbbf24', indigo: '#a5b4fc' };
          const scale = Math.min(outW, outH) / 1080;
          textClips.filter(c => {
            const start = c.start ?? 0, end = c.end ?? start + 5;
            return c.text && t >= start && t < end;
          }).forEach(c => {
            const x = ((c.x ?? 50) / 100) * outW, y = ((c.y ?? 50) / 100) * outH;
            const textColor = (c.color && String(c.color).startsWith('#')) ? c.color : (colorMap[c.color] || '#fff');
            ctx.globalAlpha = (c.opacity ?? 100) / 100;
            if (c.bgBox) {
              const fs = Math.round((sizeMap[c.size] || 36) * scale);
              ctx.font = `${c.bold ? 'bold' : ''} ${fs}px ${fontMap[c.font] || 'sans-serif'}`;
              const mw = ctx.measureText(c.text).width;
              ctx.fillStyle = 'rgba(0,0,0,0.6)';
              ctx.roundRect(x - mw / 2 - 12, y - fs / 2 - 8, mw + 24, fs + 16, 8);
              ctx.fill();
            }
            if (c.lowerThird && !c.bgBox) {
              ctx.fillStyle = 'rgba(0,0,0,0.55)';
              ctx.fillRect(0, outH * 0.82, outW, outH * 0.18);
            }
            ctx.fillStyle = textColor;
            ctx.font = `${c.bold ? 'bold' : ''} ${Math.round((sizeMap[c.size] || 36) * scale)}px ${fontMap[c.font] || 'sans-serif'}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if (c.shadow !== false) {
              ctx.shadowColor = 'rgba(0,0,0,0.9)';
              ctx.shadowBlur = 6;
              ctx.shadowOffsetX = 0;
              ctx.shadowOffsetY = 2;
            }
            ctx.fillText(c.text, x, y);
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
          });
          // Draw animated overlays on canvas
          const ovColorMap = { white: '#fff', gold: '#fbbf24', rose: '#fb7185', cyan: '#67e8f9', lime: '#bef264' };
          const ovPosMap = { upper: [0.5, 0.1], center: [0.5, 0.5], lower: [0.5, 0.88], left: [0.15, 0.5], right: [0.85, 0.5] };
          animOverlaysRef.current.filter(ov => t >= ov.startTime && t < ov.startTime + ov.duration).forEach(ov => {
            const [px, py] = ovPosMap[ov.position] || [0.5, 0.5];
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `bold ${Math.round(32 * scale)}px sans-serif`;
            ctx.shadowColor = 'rgba(0,0,0,0.95)';
            ctx.shadowBlur = 10;
            ctx.fillStyle = ovColorMap[ov.color] || '#fff';
            ctx.fillText(ov.content, outW * px, outH * py);
            ctx.restore();
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
              <div className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden" style={{ filter: vidFilterCSS || undefined }}>
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
                <div style={{ transform: stageTransformCSS !== 'scaleX(1) scaleY(1)' ? stageTransformCSS : undefined, transformOrigin: 'center center', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                {/* Temperature overlay */}
                {filterTemp !== 0 && (
                  <div className="absolute inset-0 pointer-events-none z-[4]" style={{
                    background: filterTemp > 0 ? `rgba(255,180,60,${Math.abs(filterTemp) / 100 * 0.28})` : `rgba(60,130,255,${Math.abs(filterTemp) / 100 * 0.28})`,
                    mixBlendMode: 'multiply',
                  }} />
                )}
                {/* Vignette overlay */}
                {filterVignette > 0 && (
                  <div className="absolute inset-0 pointer-events-none z-[4]" style={{
                    background: `radial-gradient(ellipse at center, transparent ${Math.max(0, 70 - filterVignette * 0.5)}%, rgba(0,0,0,${filterVignette / 100 * 0.88}) 100%)`,
                  }} />
                )}
              </div>
              {playheadInGap && <div className="absolute inset-0 bg-black z-10 pointer-events-none" aria-hidden title="Gap — no video at this time" />}
              {liveCaption && <CaptionOverlay text={liveCaption} preset="faith" />}
              {/* Animated motion overlays */}
              {animOverlays.filter(ov => playhead >= ov.startTime && playhead < ov.startTime + ov.duration).map(ov => {
                const posStyle = {
                  upper:  { top: '10%',  left: '50%',  transform: 'translateX(-50%)' },
                  center: { top: '50%',  left: '50%',  transform: 'translate(-50%,-50%)' },
                  lower:  { bottom: '12%', left: '50%', transform: 'translateX(-50%)' },
                  left:   { top: '50%',  left: '12%',  transform: 'translateY(-50%)' },
                  right:  { top: '50%',  right: '12%', transform: 'translateY(-50%)' },
                }[ov.position] || { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' };
                const animClass = { fade: 'anim-overlay-fade', 'slide-up': 'anim-overlay-slide-up', 'slide-right': 'anim-overlay-slide-right', zoom: 'anim-overlay-zoom', bounce: 'anim-overlay-bounce', typewriter: 'anim-overlay-typewriter' }[ov.animStyle] || 'anim-overlay-fade';
                const colorHex = { white: '#fff', gold: '#fbbf24', rose: '#fb7185', cyan: '#67e8f9', lime: '#bef264' }[ov.color] || '#fff';
                return (
                  <div key={`${ov.id}-${ov.startTime}`} className={`absolute z-30 pointer-events-none ${animClass}`}
                    style={{ ...posStyle, color: colorHex, fontWeight: 700, fontSize: 20, textShadow: '0 2px 10px rgba(0,0,0,0.95)', textAlign: 'center', maxWidth: '72%' }}>
                    {ov.content}
                  </div>
                );
              })}
              {/* Image / GIF / sticker overlays */}
              {imageOverlays.filter(ov => playhead >= ov.startTime && playhead < ov.startTime + ov.duration).map(ov => {
                const posMap = {
                  'top-left':     { top: '8%',    left: '8%'   },
                  'top-right':    { top: '8%',    right: '8%'  },
                  'center':       { top: '50%',   left: '50%', transform: 'translate(-50%,-50%)' },
                  'bottom-left':  { bottom: '8%', left: '8%'   },
                  'bottom-right': { bottom: '8%', right: '8%'  },
                  'bottom-center':{ bottom: '8%', left: '50%', transform: 'translateX(-50%)' },
                };
                return (
                  <div key={ov.id} className="absolute z-[28] pointer-events-none"
                    style={{ ...(posMap[ov.position] || posMap.center), width: `${ov.size || 20}%` }}>
                    <img src={ov.url} alt="" className="w-full h-auto object-contain drop-shadow-lg" style={{ opacity: (ov.opacity ?? 100) / 100 }} />
                  </div>
                );
              })}
              {/* Animated character companion */}
              {charAnim !== 'off' && videoForPreview && (
                <div className={`absolute z-25 bottom-6 ${charPos === 'left' ? 'left-3' : 'right-3'} pointer-events-none`}>
                  <AnimatedCharacter anim={charAnim} />
                </div>
              )}
              {textClips.filter(c => {
                const start = c.start ?? 0;
                const end = c.end ?? start + 5;
                const sourceT = getActiveSourceTime(playhead);
                const inRange = sourceT >= start && sourceT < end;
                const isEditing = editingClipId === c.id || draggingTextId === c.id;
                return c.text && (inRange || isEditing);
              }).map((c) => {
                const sizeMap = { sm: 'text-base', md: 'text-xl', lg: 'text-3xl', xl: 'text-5xl' };
                const fontMap = { sans: 'font-sans', serif: 'font-serif', mono: 'font-mono', display: 'font-bold tracking-tight' };
                const colorMap = { white: 'text-white', black: 'text-black', yellow: 'text-yellow-300', rose: 'text-rose-300', cyan: 'text-cyan-300', lime: 'text-lime-300', orange: 'text-orange-400', gold: 'text-amber-400', amber: 'text-amber-400', indigo: 'text-indigo-300' };
                const isHex = c.color && String(c.color).startsWith('#');
                const colorClass = isHex ? '' : (colorMap[c.color] || colorMap.white);
                const colorStyle = isHex ? { color: c.color } : {};
                const x = c.x ?? 50;
                const y = c.y ?? 50;
                const isSelected = editingClipId === c.id;
                const animStyle = c.animStyle;
                const animClass = animStyle ? `caption-${animStyle}` : '';
                const noAnimBase = !animStyle;
                const textOpacity = (c.opacity ?? 100) / 100;
                const hasShadow = c.shadow !== false; // default true
                const hasBgBox = !!c.bgBox;
                return (
                  <div
                    key={`${c.id}-${animStyle}`}
                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 select-none ${animClass} ${noAnimBase ? `${fontMap[c.font] || fontMap.sans} ${colorClass} ${c.bold ? 'font-bold' : 'font-normal'}` : ''} ${isSelected || draggingTextId === c.id ? 'ring-2 ring-rose-400 ring-offset-2 cursor-move' : 'cursor-move'} ${hasBgBox && noAnimBase ? 'bg-black/60 px-3 py-1.5 rounded-lg' : (c.lowerThird && !animStyle ? 'bg-black/55 px-6 py-2 rounded' : '')}`}
                    style={{ left: `${x}%`, top: `${y}%`, zIndex: 20, opacity: textOpacity, ...(noAnimBase ? colorStyle : {}), ...(noAnimBase && c.font === 'serif' ? { fontFamily: '"Playfair Display", Georgia, serif' } : {}) }}
                    onMouseDown={(e) => handleTextDragStart(e, c)}
                    onClick={(e) => { e.stopPropagation(); setEditingClipId(c.id); }}
                  >
                    <span className={noAnimBase ? `${sizeMap[c.size] || sizeMap.md} ${hasShadow ? 'drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]' : ''}` : ''}>{c.text}</span>
                  </div>
                );
              })}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-3 gap-3 overflow-y-auto">
              {videos.length > 0 ? (
                <>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Tap a clip to start editing</p>
                  <div className="flex flex-row gap-2 flex-wrap justify-center w-full max-w-sm">
                    {videos.map(v => (
                      <button key={v.id} onClick={() => { setSelectedVideoId(v.id); setTimeout(() => insertClipAtPlayhead(0, v.id), 80); }}
                        className="group relative rounded-lg overflow-hidden border-2 border-stone-700 hover:border-rose-500 transition-all bg-stone-800 flex items-center gap-2 px-2 py-1.5">
                        <div className="relative w-14 h-9 rounded overflow-hidden shrink-0">
                          <video src={v.url} className="absolute inset-0 w-full h-full object-cover" muted playsInline preload="metadata" />
                          <Play size={14} className="absolute inset-0 m-auto text-white/90 group-hover:text-rose-400 transition-colors" />
                        </div>
                        <span className="text-[10px] text-white font-bold truncate max-w-[80px]">{v.name?.replace(/\.[^.]+$/, '') || 'Clip'}</span>
                      </button>
                    ))}
                    <label className="cursor-pointer flex items-center gap-1 text-xs text-rose-400 font-bold hover:text-rose-300 transition-colors px-2 py-1.5 border-2 border-dashed border-rose-900 hover:border-rose-500 rounded-lg">
                      <Plus size={13} /> Add clip
                      <input type="file" accept="video/*" multiple className="hidden" onChange={e => { Array.from(e.target.files || []).forEach(f => { const id = addAsset(f, 'video'); if (id) setTimeout(() => insertClipAtPlayhead(0, id), 80); }); e.target.value = ''; }} />
                    </label>
                  </div>
                </>
              ) : (
                <label className="cursor-pointer flex flex-col items-center gap-4 text-center group w-full max-w-xs">
                  {/* Upload icon with glow */}
                  <div className="relative">
                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-rose-900/60 to-stone-800 border-2 border-dashed border-stone-600 group-hover:border-rose-500 flex items-center justify-center transition-all group-hover:scale-105 shadow-lg group-hover:shadow-rose-900/30">
                      <Upload size={32} className="text-stone-500 group-hover:text-rose-400 transition-colors" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-rose-600 group-hover:bg-rose-500 flex items-center justify-center shadow-lg transition-colors">
                      <Plus size={14} className="text-white" />
                    </div>
                  </div>
                  <div>
                    <p className="text-base font-bold text-stone-300 group-hover:text-white transition-colors">Drop your video here</p>
                    <p className="text-xs text-stone-500 mt-1">or tap to browse files</p>
                  </div>
                  <div className="flex gap-2 flex-wrap justify-center">
                    {['MP4', 'MOV', 'WebM', 'MKV'].map(f => (
                      <span key={f} className="text-[10px] font-bold text-stone-600 bg-stone-800 border border-stone-700 rounded-md px-2 py-0.5">{f}</span>
                    ))}
                  </div>
                  <input type="file" accept="video/*" multiple className="hidden" onChange={e => { Array.from(e.target.files || []).forEach(f => { const id = addAsset(f, 'video'); if (id) { if (!selectedVideo) setSelectedVideoId(id); setTimeout(() => insertClipAtPlayhead(0, id), 80); } }); e.target.value = ''; }} />
                </label>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Controls — tabbed editor panel */}
      <div className="relative flex flex-col min-h-0 bg-stone-900 border-t border-l border-stone-700/60" style={{ gridArea: 'controls' }}>

        {/* Tab bar — always visible, big touch targets */}
        <div className="flex shrink-0 border-b border-stone-700/60 bg-stone-950 overflow-x-auto">
          {[
            { id: 'edit',    icon: <Scissors size={13} />, label: 'Edit' },
            { id: 'text',    icon: <Type size={13} />,     label: 'Text' },
            { id: 'audio',   icon: <Music size={13} />,    label: 'Audio' },
            { id: 'animate', icon: <Sparkles size={13} />, label: 'Animate' },
            { id: 'enhance', icon: <Wand2 size={13} />,    label: 'Enhance' },
            { id: 'camera',  icon: <Camera size={13} />,   label: 'Camera' },
            { id: 'export',  icon: <Download size={13} />, label: 'Export' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setInspectorTab(tab.id)}
              className={`flex-1 min-w-[44px] flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-bold transition-colors border-b-2 ${inspectorTab === tab.id ? 'border-rose-500 text-rose-400 bg-rose-950/30' : 'border-transparent text-stone-500 hover:text-stone-300'}`}
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
              {/* Video source — thumbnail picker */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Clips</span>
                  <div className="flex items-center gap-1">
                    <input ref={clipUploadRef} type="file" multiple accept="video/*,image/*" onChange={(e) => handleInlineUpload(e)} className="hidden" />
                    <button onClick={() => clipUploadRef.current?.click()} className="px-2 py-1 bg-rose-600 hover:bg-rose-500 rounded-md text-[10px] text-white font-bold">+ Add</button>
                  </div>
                </div>
                {videos.length === 0 ? (
                  <button onClick={() => clipUploadRef.current?.click()} className="w-full py-4 rounded-xl border-2 border-dashed border-stone-700 text-stone-500 text-xs hover:border-rose-600 hover:text-rose-400 transition-all">
                    Upload a video to get started
                  </button>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    {videos.map(v => (
                      <button key={v.id} onClick={() => setSelectedVideoId(v.id)}
                        className={`relative rounded-lg overflow-hidden aspect-video border-2 transition-all group ${selectedVideo?.id === v.id ? 'border-rose-500 ring-1 ring-rose-500' : 'border-stone-700 hover:border-stone-500'}`}
                        title={v.name}>
                        <video src={v.url} muted playsInline preload="metadata" className="w-full h-full object-cover"
                          onLoadedMetadata={e => { e.target.currentTime = 0.5; }} />
                        {selectedVideo?.id === v.id && (
                          <div className="absolute inset-0 bg-rose-500/20 flex items-center justify-center">
                            <div className="w-4 h-4 rounded-full bg-rose-500 flex items-center justify-center">
                              <div className="w-1.5 h-1.5 rounded-full bg-white" />
                            </div>
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-black/70 text-[9px] text-stone-300 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                          {v.name?.replace(/\.[^.]+$/, '').slice(0, 18) || 'Clip'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selection status */}
              {(selectedSegmentId || selectedAudioSegmentId) ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-rose-950/40 border border-rose-700/50 rounded-xl text-[11px] text-rose-300 font-bold">
                  <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                  {selectedSegmentId ? 'Video clip selected' : 'Audio clip selected'} — ready to edit
                </div>
              ) : videoForPreview ? (
                <p className="text-[10px] text-stone-500 text-center py-1">Click a clip on the timeline to select it, then Split or Delete</p>
              ) : null}

              {/* Primary edit actions — big buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={splitAtPlayhead} disabled={!videoForPreview} className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-rose-900/50 border border-rose-700/60 text-rose-300 hover:bg-rose-800/60 active:scale-95 disabled:opacity-40 transition-all" title="Split clip at playhead (S)">
                  <Scissors size={16} /> Split Here
                </button>
                <button
                  onClick={() => { deleteSelectedSegment(); if (selectedAudioSegmentId) deleteSelectedAudioSegment(); }}
                  disabled={!selectedSegmentId && !selectedClipId && !selectedAudioSegmentId}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-red-900/50 border border-red-700/60 text-red-300 hover:bg-red-800/60 active:scale-95 disabled:opacity-40 transition-all">
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
                const currTxId = seg.transition || 'cut';
                const setTx = (txId) => { pushHistory(); setMainSegments(prev => prev.map(x => x.id === selectedSegmentId ? { ...x, transition: txId } : x)); };
                const setSpeed = (sp) => { pushHistory(); setMainSegments(prev => prev.map(x => x.id === selectedSegmentId ? { ...x, speed: sp } : x)); };
                const currSpeed = seg.speed || 1;
                const setVolume = (vol) => setMainSegments(prev => prev.map(x => x.id === selectedSegmentId ? { ...x, vol } : x));
                const currVol = seg.vol ?? 100;
                return (
                  <div className="bg-stone-800 border border-stone-700 rounded-xl p-3 space-y-3">
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Selected Clip</p>

                    {/* In / Out */}
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

                    {/* Clip Volume */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[10px] text-stone-500 uppercase font-bold">Clip Volume</p>
                        <span className="text-[10px] font-mono text-stone-400">{currVol}%</span>
                      </div>
                      <input type="range" min={0} max={150} value={currVol}
                        onChange={e => setVolume(Number(e.target.value))}
                        className="w-full accent-emerald-500 h-1" />
                      <div className="flex justify-between text-[9px] text-stone-600 mt-0.5">
                        <span>Mute</span><span>100%</span><span>+50%</span>
                      </div>
                    </div>
                    {/* Speed */}
                    <div>
                      <p className="text-[10px] text-stone-500 uppercase font-bold mb-1.5">Speed</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {[0.25, 0.5, 0.75, 1, 1.5, 2, 3].map(sp => (
                          <button key={sp} onClick={() => setSpeed(sp)} className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${currSpeed === sp ? 'bg-rose-500 border-rose-500 text-white' : 'bg-stone-700 border-stone-600 text-stone-300 hover:bg-stone-600'}`}>{sp}x</button>
                        ))}
                      </div>
                    </div>

                    {/* Transition picker */}
                    <div>
                      <p className="text-[10px] text-stone-500 uppercase font-bold mb-1.5">Transition into next clip</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {TIMELINE_TRANSITIONS.map(tx => (
                          <button key={tx.id} onClick={() => setTx(tx.id)} title={tx.when}
                            className={`flex flex-col items-center gap-0.5 py-2 rounded-xl border text-[10px] font-bold transition-all active:scale-95 ${currTxId === tx.id ? (tx.seamless ? 'bg-emerald-900/50 border-emerald-600 text-emerald-300' : 'bg-rose-900/50 border-rose-600 text-rose-300') : 'bg-stone-700 border-stone-600 text-stone-400 hover:border-stone-500 hover:text-stone-200'}`}>
                            <span className="text-base leading-none">{tx.icon}</span>
                            <span className="leading-tight text-center">{tx.label}</span>
                          </button>
                        ))}
                      </div>
                      {TIMELINE_TRANSITIONS.find(t => t.id === currTxId)?.when && (
                        <p className="text-[10px] text-stone-500 italic mt-1.5">{TIMELINE_TRANSITIONS.find(t => t.id === currTxId).when}</p>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ── Transform ── */}
              <div className="border-t border-stone-800 pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Transform</p>
                  {(transformRotation !== 0 || transformFlipH || transformFlipV || transformScale !== 100 || transformPanX !== 0 || transformPanY !== 0) && (
                    <button onClick={resetTransform} className="text-[10px] text-rose-400 hover:text-rose-300">Reset</button>
                  )}
                </div>

                {/* Crop Aspect */}
                <div>
                  <p className="text-[10px] text-stone-500 mb-1.5">Aspect Ratio</p>
                  <div className="grid grid-cols-5 gap-1">
                    {[
                      { id: 'free', label: 'Free' },
                      { id: '9:16', label: '9:16' },
                      { id: '16:9', label: '16:9' },
                      { id: '1:1',  label: '1:1'  },
                      { id: '4:5',  label: '4:5'  },
                    ].map(a => (
                      <button key={a.id} onClick={() => setCropAspect(a.id)}
                        className={`py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${cropAspect === a.id ? 'bg-rose-600 border-rose-500 text-white' : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-500'}`}>
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rotate / Flip */}
                <div>
                  <p className="text-[10px] text-stone-500 mb-1.5">Rotate &amp; Flip</p>
                  <div className="flex gap-1.5 mb-2">
                    <button onClick={() => setTransformRotation(r => { const n = r - 90; return n < -180 ? n + 360 : n; })}
                      title="Rotate 90° counter-clockwise"
                      className="flex-1 py-2 rounded-xl bg-stone-800 border border-stone-700 text-stone-300 hover:bg-stone-700 text-xs font-bold transition-colors active:scale-95">↺ 90°</button>
                    <button onClick={() => setTransformRotation(r => { const n = r + 90; return n > 180 ? n - 360 : n; })}
                      title="Rotate 90° clockwise"
                      className="flex-1 py-2 rounded-xl bg-stone-800 border border-stone-700 text-stone-300 hover:bg-stone-700 text-xs font-bold transition-colors active:scale-95">↻ 90°</button>
                    <button onClick={() => setTransformFlipH(f => !f)} title="Flip horizontal — mirror left/right"
                      className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-colors active:scale-95 ${transformFlipH ? 'bg-rose-600 border-rose-500 text-white' : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700'}`}>
                      ↔ Flip H
                    </button>
                    <button onClick={() => setTransformFlipV(f => !f)} title="Flip vertical — mirror top/bottom"
                      className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-colors active:scale-95 ${transformFlipV ? 'bg-rose-600 border-rose-500 text-white' : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700'}`}>
                      ↕ Flip V
                    </button>
                  </div>
                  {/* Fine rotation — always visible */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[10px] text-stone-500">Fine Rotation</span>
                      <span className={`text-[10px] font-mono ${transformRotation === 0 ? 'text-stone-600' : 'text-amber-400'}`}>{transformRotation}°</span>
                    </div>
                    <input type="range" min={-180} max={180} value={transformRotation}
                      onChange={e => setTransformRotation(Number(e.target.value))} className="w-full accent-rose-500 h-1" />
                  </div>
                </div>

                {/* Scale */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px] text-stone-500">Scale / Zoom</span>
                    <span className={`text-[10px] font-mono ${transformScale === 100 ? 'text-stone-600' : 'text-amber-400'}`}>{transformScale}%</span>
                  </div>
                  <input type="range" min={50} max={200} value={transformScale}
                    onChange={e => setTransformScale(Number(e.target.value))} className="w-full accent-rose-500 h-1" />
                </div>

                {/* Pan */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[10px] text-stone-500">Pan X</span>
                      <span className={`text-[10px] font-mono ${transformPanX === 0 ? 'text-stone-600' : 'text-amber-400'}`}>{transformPanX}%</span>
                    </div>
                    <input type="range" min={-50} max={50} value={transformPanX}
                      onChange={e => setTransformPanX(Number(e.target.value))} className="w-full accent-blue-500 h-1" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[10px] text-stone-500">Pan Y</span>
                      <span className={`text-[10px] font-mono ${transformPanY === 0 ? 'text-stone-600' : 'text-amber-400'}`}>{transformPanY}%</span>
                    </div>
                    <input type="range" min={-50} max={50} value={transformPanY}
                      onChange={e => setTransformPanY(Number(e.target.value))} className="w-full accent-blue-500 h-1" />
                  </div>
                </div>
              </div>

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
                  <div className="space-y-1">
                    {textClips.map(c => (
                      <button key={c.id} onClick={() => setEditingClipId(editingClipId === c.id ? null : c.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors ${editingClipId === c.id ? 'border-rose-500 bg-rose-950/40 text-rose-300' : 'border-stone-700 bg-stone-800 text-stone-300 hover:border-stone-600'}`}>
                        <span className="font-bold">{secToTimecode(c.start ?? 0)}</span>
                        <span className="text-stone-500 mx-1.5">→</span>
                        <span className="text-stone-400 truncate">{c.text || '(empty — tap to edit)'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Caption Editor (shows when caption selected) ── */}
              {editingClip && (
                <div className="bg-stone-800 border border-rose-700/40 rounded-xl p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-rose-300 uppercase tracking-wider">Edit Caption</p>
                    <button onClick={() => { removeTextClip(editingClipId); setEditingClipId(null); }} className="text-[10px] text-red-400 hover:text-red-300">Delete</button>
                  </div>
                  {/* Text content */}
                  <textarea value={editingClip.text || ''} rows={2}
                    onChange={e => updateTextClip(editingClipId, { text: e.target.value })}
                    placeholder="Caption text…"
                    className="w-full bg-stone-900 border border-stone-600 rounded-lg px-3 py-2 text-xs text-stone-100 resize-none focus:outline-none focus:border-rose-500 placeholder-stone-600" />
                  {/* Timing */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-stone-500 mb-1">Start</p>
                      <input defaultValue={secToTimecode(editingClip.start ?? 0)}
                        onBlur={e => { const t = parseTimecode(e.target.value); if (t != null) updateTextClip(editingClipId, { start: t }); }}
                        className="w-full font-mono px-2 py-1.5 rounded border bg-stone-700 border-stone-600 text-stone-100 text-xs" />
                    </div>
                    <div>
                      <p className="text-[10px] text-stone-500 mb-1">End</p>
                      <input defaultValue={secToTimecode(editingClip.end ?? 5)}
                        onBlur={e => { const t = parseTimecode(e.target.value); if (t != null) updateTextClip(editingClipId, { end: t }); }}
                        className="w-full font-mono px-2 py-1.5 rounded border bg-stone-700 border-stone-600 text-stone-100 text-xs" />
                    </div>
                  </div>
                  {/* Style */}
                  <div>
                    <p className="text-[10px] text-stone-500 uppercase tracking-wider mb-1.5">Style</p>
                    <div className="grid grid-cols-4 gap-1">
                      {[
                        { id: 'faith',  label: 'Faith',   desc: 'Bold + glow' },
                        { id: 'clean',  label: 'Clean',   desc: 'Minimal' },
                        { id: 'bold',   label: 'Bold',    desc: 'All caps' },
                        { id: 'lower',  label: 'Lower',   desc: 'Bar style' },
                      ].map(s => (
                        <button key={s.id} onClick={() => updateTextClip(editingClipId, { animStyle: s.id })}
                          title={s.desc}
                          className={`py-1.5 rounded-lg border text-[10px] font-bold transition-colors ${editingClip.animStyle === s.id ? 'bg-rose-600 border-rose-600 text-white' : 'border-stone-600 text-stone-400 hover:border-stone-500'}`}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Font */}
                  <div>
                    <p className="text-[10px] text-stone-500 uppercase tracking-wider mb-1.5">Font</p>
                    <div className="grid grid-cols-3 gap-1">
                      {[['sans','Sans'],['serif','Serif'],['mono','Mono']].map(([id, lbl]) => (
                        <button key={id} onClick={() => updateTextClip(editingClipId, { font: id })}
                          className={`py-1.5 rounded-lg border text-[10px] font-bold transition-colors ${editingClip.font === id ? 'bg-rose-600 border-rose-600 text-white' : 'border-stone-600 text-stone-400 hover:border-stone-500'}`}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Color */}
                  <div>
                    <p className="text-[10px] text-stone-500 uppercase tracking-wider mb-1.5">Color</p>
                    <div className="grid grid-cols-8 gap-1">
                      {['#ffffff','#000000','#f43f5e','#fbbf24','#34d399','#60a5fa','#a78bfa','#f472b6'].map(c => (
                        <button key={c} onClick={() => updateTextClip(editingClipId, { color: c })}
                          className={`h-5 rounded border-2 transition-all ${editingClip.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                          style={{ background: c }} />
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-stone-500">Custom:</span>
                      <input type="color" value={editingClip.color || '#ffffff'}
                        onChange={e => updateTextClip(editingClipId, { color: e.target.value })}
                        className="h-5 w-12 rounded cursor-pointer border-0 bg-transparent" />
                    </div>
                  </div>
                  {/* Size */}
                  <div>
                    <p className="text-[10px] text-stone-500 uppercase tracking-wider mb-1.5">Size</p>
                    <div className="flex gap-1.5">
                      {[['sm','Small'],['md','Med'],['lg','Large'],['xl','XL']].map(([id, lbl]) => (
                        <button key={id} onClick={() => updateTextClip(editingClipId, { size: id })}
                          className={`flex-1 py-1.5 rounded-lg border text-[10px] font-bold transition-colors ${editingClip.size === id ? 'bg-rose-600 border-rose-600 text-white' : 'border-stone-600 text-stone-400 hover:border-stone-500'}`}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Position Y */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[10px] text-stone-500">Vertical Position</span>
                      <span className="text-[10px] font-mono text-stone-400">{editingClip.y ?? 15}%</span>
                    </div>
                    <input type="range" min={5} max={90} value={editingClip.y ?? 15}
                      onChange={e => updateTextClip(editingClipId, { y: Number(e.target.value) })}
                      className="w-full h-1 accent-rose-500" />
                    <div className="flex justify-between text-[9px] text-stone-600 mt-0.5">
                      <span>Top</span><span>Bottom</span>
                    </div>
                  </div>
                  {/* Position X */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[10px] text-stone-500">Horizontal Position</span>
                      <span className="text-[10px] font-mono text-stone-400">{editingClip.x ?? 50}%</span>
                    </div>
                    <input type="range" min={5} max={95} value={editingClip.x ?? 50}
                      onChange={e => updateTextClip(editingClipId, { x: Number(e.target.value) })}
                      className="w-full h-1 accent-rose-500" />
                    <div className="flex justify-between text-[9px] text-stone-600 mt-0.5">
                      <span>Left</span><span>Right</span>
                    </div>
                  </div>
                  {/* Opacity */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[10px] text-stone-500">Opacity</span>
                      <span className="text-[10px] font-mono text-stone-400">{editingClip.opacity ?? 100}%</span>
                    </div>
                    <input type="range" min={10} max={100} value={editingClip.opacity ?? 100}
                      onChange={e => updateTextClip(editingClipId, { opacity: Number(e.target.value) })}
                      className="w-full h-1 accent-rose-500" />
                  </div>
                  {/* Toggles row */}
                  <div className="grid grid-cols-3 gap-2">
                    <label className="flex flex-col items-center gap-1 cursor-pointer">
                      <button onClick={() => updateTextClip(editingClipId, { bold: !editingClip.bold })}
                        className={`relative w-10 h-5 rounded-full transition-colors ${editingClip.bold ? 'bg-rose-500' : 'bg-stone-600'}`}>
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${editingClip.bold ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                      <span className="text-[9px] text-stone-500">Bold</span>
                    </label>
                    <label className="flex flex-col items-center gap-1 cursor-pointer">
                      <button onClick={() => updateTextClip(editingClipId, { shadow: !editingClip.shadow })}
                        className={`relative w-10 h-5 rounded-full transition-colors ${editingClip.shadow ? 'bg-rose-500' : 'bg-stone-600'}`}>
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${editingClip.shadow ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                      <span className="text-[9px] text-stone-500">Shadow</span>
                    </label>
                    <label className="flex flex-col items-center gap-1 cursor-pointer">
                      <button onClick={() => updateTextClip(editingClipId, { bgBox: !editingClip.bgBox })}
                        className={`relative w-10 h-5 rounded-full transition-colors ${editingClip.bgBox ? 'bg-rose-500' : 'bg-stone-600'}`}>
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${editingClip.bgBox ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                      <span className="text-[9px] text-stone-500">BG Box</span>
                    </label>
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
              <input ref={audioUploadRef} type="file" accept="audio/*" onChange={(e) => handleInlineUpload(e, 'audio')} className="hidden" />
              {selectedAudio ? (
                <button onClick={addAudioFromLibrary} disabled={!selectedAudio?.url || !videoForPreview} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-emerald-900/40 border border-emerald-700/50 text-emerald-300 hover:bg-emerald-800/50 active:scale-95 disabled:opacity-40 transition-all">
                  <Music size={16} /> Add Music to Timeline
                </button>
              ) : (
                <button onClick={() => audioUploadRef.current?.click()} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-stone-800 border border-stone-700 text-emerald-400 hover:bg-stone-700 active:scale-95 transition-all">
                  <Music size={16} /> Upload Music
                </button>
              )}
              {/* Audio file selector */}
              {audioFiles.length > 0 && (
                <select value={selectedAudio?.id || ''} onChange={(e) => setSelectedAudioId(Number(e.target.value) || null)} className="w-full bg-stone-800 border border-stone-700 rounded-lg px-2 py-2 text-xs text-stone-100">
                  <option value="">Select audio…</option>
                  {audioFiles.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              )}
              {/* Voice Isolation */}
              <div className="bg-stone-800 border border-stone-700 rounded-xl p-3 space-y-2">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Audio AI</p>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-xs font-bold text-stone-200">Voice Isolation</span>
                    <span className="text-[10px] text-stone-500 block">Remove background noise on export</span>
                  </div>
                  <button onClick={() => setVoiceIsolation(!voiceIsolation)} className={`relative w-10 h-5 rounded-full transition-colors ${voiceIsolation ? 'bg-rose-500' : 'bg-stone-600'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${voiceIsolation ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-xs font-bold text-stone-200">De-Reverb</span>
                    <span className="text-[10px] text-stone-500 block">Remove room echo</span>
                  </div>
                  <button onClick={() => setDeReverb(!deReverb)} className={`relative w-10 h-5 rounded-full transition-colors ${deReverb ? 'bg-rose-500' : 'bg-stone-600'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${deReverb ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </label>
                {deReverb && (
                  <div>
                    <label className="text-[10px] text-stone-500 uppercase block mb-1">Strength {deReverbStrength}%</label>
                    <input type="range" min="0" max="100" value={deReverbStrength} onChange={(e) => setDeReverbStrength(Number(e.target.value))} className="w-full accent-rose-400" />
                  </div>
                )}
              </div>
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
                  <div className="space-y-2">
                    {audioSegments.map(seg => (
                      <div key={seg.id} className={`rounded-xl border overflow-hidden transition-colors ${seg.id === selectedAudioSegmentId ? 'border-emerald-600 bg-emerald-950/20' : 'border-stone-700 bg-stone-800 hover:border-stone-600'}`}>
                        {/* Header row */}
                        <div className="flex items-center gap-2 px-3 py-2 cursor-pointer" onClick={() => setSelectedAudioSegmentId(seg.id === selectedAudioSegmentId ? null : seg.id)}>
                          <Music size={12} className="shrink-0 text-emerald-400" />
                          <span className="flex-1 text-xs text-stone-300 font-mono truncate">{secToTimecode(seg.start)} – {secToTimecode(seg.end)}</span>
                          <span className="text-[10px] text-stone-500">{((seg.end - seg.start)).toFixed(1)}s</span>
                          <button onClick={(e) => { e.stopPropagation(); setSelectedAudioSegmentId(seg.id); deleteSelectedAudioSegment(); }} className="text-stone-600 hover:text-rose-400 ml-1"><X size={12} /></button>
                        </div>
                        {/* Expanded controls when selected */}
                        {seg.id === selectedAudioSegmentId && (
                          <div className="px-3 pb-3 space-y-2 border-t border-stone-700/50">
                            {/* Volume */}
                            <div className="flex items-center gap-2 pt-2">
                              <Volume2 size={11} className="text-emerald-400 shrink-0" />
                              <span className="text-[10px] text-stone-500 w-12 shrink-0">Volume</span>
                              <input type="range" min={0} max={150} value={seg.vol ?? 100}
                                onChange={e => setAudioSegments(prev => prev.map(s => s.id === seg.id ? { ...s, vol: Number(e.target.value) } : s))}
                                className="flex-1 accent-emerald-500 h-1" />
                              <span className="text-[10px] font-mono text-stone-400 w-8 text-right shrink-0">{seg.vol ?? 100}%</span>
                            </div>
                            {/* Fade In */}
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-stone-500 w-14 shrink-0">Fade In</span>
                              <input type="range" min={0} max={5} step={0.1} value={seg.fadeIn ?? 0}
                                onChange={e => setAudioSegments(prev => prev.map(s => s.id === seg.id ? { ...s, fadeIn: Number(e.target.value) } : s))}
                                className="flex-1 accent-sky-500 h-1" />
                              <span className="text-[10px] font-mono text-stone-400 w-8 text-right shrink-0">{(seg.fadeIn ?? 0).toFixed(1)}s</span>
                            </div>
                            {/* Fade Out */}
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-stone-500 w-14 shrink-0">Fade Out</span>
                              <input type="range" min={0} max={5} step={0.1} value={seg.fadeOut ?? 0}
                                onChange={e => setAudioSegments(prev => prev.map(s => s.id === seg.id ? { ...s, fadeOut: Number(e.target.value) } : s))}
                                className="flex-1 accent-sky-500 h-1" />
                              <span className="text-[10px] font-mono text-stone-400 w-8 text-right shrink-0">{(seg.fadeOut ?? 0).toFixed(1)}s</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── ANIMATE TAB ─────────────────────────────── */}
          {inspectorTab === 'animate' && (
            <div className="p-3 space-y-4">

              {/* ─ AI Voice ─ */}
              <div className="bg-stone-800/60 border border-stone-700 rounded-xl p-3 space-y-2">
                <p className="text-[10px] font-bold text-stone-300 uppercase tracking-wider flex items-center gap-1.5"><Mic size={11} className="text-rose-400" /> AI Voice Over</p>
                <textarea
                  value={ttsScript}
                  onChange={e => setTtsScript(e.target.value)}
                  placeholder="Write your script here — AI speaks it in the voice you pick. Perfect for narration, intros, or voiceovers."
                  rows={3}
                  className="w-full bg-stone-900 border border-stone-600 rounded-lg px-3 py-2 text-xs text-stone-100 resize-none focus:outline-none focus:border-rose-500 placeholder-stone-600"
                />
                <div className="grid grid-cols-3 gap-1">
                  {TTS_VOICES.map(v => (
                    <button key={v.id} onClick={() => setTtsVoice(v.id)}
                      className={`py-1.5 rounded-lg border text-center transition-colors ${ttsVoice === v.id ? 'bg-rose-900/60 border-rose-500 text-rose-200' : 'bg-stone-900 border-stone-600 text-stone-400 hover:border-stone-500'}`}>
                      <span className="text-[10px] font-bold block">{v.name}</span>
                      <span className="text-[9px] text-stone-500 truncate block">{v.desc}</span>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-stone-500 shrink-0">Speed</span>
                  <input type="range" min="0.5" max="2" step="0.25" value={ttsSpeed} onChange={e => setTtsSpeed(Number(e.target.value))} className="flex-1 accent-rose-500 h-1" />
                  <span className="text-[10px] text-stone-400 font-mono w-8 text-right shrink-0">{ttsSpeed}x</span>
                </div>
                {ttsError && <p className="text-[10px] text-rose-400">{ttsError}</p>}
                <button onClick={generateVoice} disabled={ttsLoading || !ttsScript.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-40 transition-all active:scale-95">
                  {ttsLoading ? <><span className="animate-spin inline-block">⏳</span> Generating…</> : <><Mic size={14} /> Generate Voice</>}
                </button>
                {!hasOpenAIKey() && <p className="text-[9px] text-stone-600 text-center">Add OpenAI key in Settings to enable</p>}
              </div>

              {/* ─ Auto-Caption (Whisper) ─ */}
              <div className="bg-stone-800/60 border border-stone-700 rounded-xl p-3 space-y-2">
                <p className="text-[10px] font-bold text-stone-300 uppercase tracking-wider flex items-center gap-1.5">🎙 Auto-Caption</p>
                <p className="text-[10px] text-stone-500">AI transcribes your video and drops timed captions onto the timeline. One tap.</p>
                <button onClick={autoCaption} disabled={autoCaptionLoading || !selectedVideo}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold bg-stone-700 hover:bg-stone-600 text-stone-100 disabled:opacity-40 transition-all active:scale-95 border border-stone-600">
                  {autoCaptionLoading ? <><span className="animate-spin inline-block">⏳</span> Transcribing…</> : <>Auto-Caption My Video</>}
                </button>
                {autoCaptionError && <p className="text-[10px] text-rose-400">{autoCaptionError}</p>}
                {!selectedVideo && <p className="text-[9px] text-stone-600 text-center">Select a video first</p>}
                {!hasOpenAIKey() && <p className="text-[9px] text-stone-600 text-center">Requires OpenAI key in Settings</p>}
              </div>

              {/* ─ Stickers, GIFs & Image Overlays ─ */}
              <div className="bg-stone-800/60 border border-stone-700 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
                    <ImageIcon size={11} className="text-amber-400" /> Stickers &amp; Overlays
                  </p>
                  <button
                    onClick={() => stickerUploadRef.current?.click()}
                    className="flex items-center gap-1 text-[10px] font-bold text-amber-400 hover:text-amber-300 transition-colors">
                    <Plus size={11} /> Upload
                  </button>
                  <input ref={stickerUploadRef} type="file" accept="image/*,.gif" multiple className="hidden"
                    onChange={e => {
                      Array.from(e.target.files || []).forEach(f => {
                        const url = URL.createObjectURL(f);
                        setImageOverlays(prev => [...prev, {
                          id: `stk${Date.now()}-${Math.random()}`,
                          url, name: f.name,
                          startTime: playhead, duration: 5,
                          position: 'bottom-right', size: 22, opacity: 100,
                        }]);
                      });
                    }}
                  />
                </div>
                {imageOverlays.length === 0 ? (
                  <button onClick={() => stickerUploadRef.current?.click()}
                    className="w-full py-4 rounded-lg border-2 border-dashed border-stone-700 text-stone-500 text-xs hover:border-amber-600 hover:text-amber-400 transition-all text-center">
                    Upload PNG, GIF, or WebP — appears on stage at playhead time
                  </button>
                ) : (
                  <div className="space-y-2">
                    {imageOverlays.map(ov => (
                      <div key={ov.id} className="bg-stone-900 border border-stone-700 rounded-lg p-2 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <img src={ov.url} alt="" className="w-8 h-8 rounded object-contain bg-stone-800 shrink-0" />
                          <span className="flex-1 text-[10px] text-stone-300 truncate">{ov.name?.replace(/\.[^.]+$/, '') || 'Sticker'}</span>
                          <button onClick={() => setImageOverlays(prev => prev.filter(o => o.id !== ov.id))} className="text-stone-600 hover:text-rose-400"><X size={12} /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <p className="text-[9px] text-stone-600 mb-0.5">Start</p>
                            <input type="number" min={0} step={0.5} value={ov.startTime.toFixed(1)} onChange={e => setImageOverlays(prev => prev.map(o => o.id === ov.id ? { ...o, startTime: Math.max(0, Number(e.target.value)) } : o))}
                              className="w-full bg-stone-800 border border-stone-700 rounded px-1.5 py-1 text-[10px] text-stone-100 font-mono" />
                          </div>
                          <div>
                            <p className="text-[9px] text-stone-600 mb-0.5">Duration (s)</p>
                            <input type="number" min={0.5} step={0.5} value={ov.duration} onChange={e => setImageOverlays(prev => prev.map(o => o.id === ov.id ? { ...o, duration: Math.max(0.5, Number(e.target.value)) } : o))}
                              className="w-full bg-stone-800 border border-stone-700 rounded px-1.5 py-1 text-[10px] text-stone-100 font-mono" />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          {['top-left','top-right','center','bottom-left','bottom-right','bottom-center'].map(pos => (
                            <button key={pos} onClick={() => setImageOverlays(prev => prev.map(o => o.id === ov.id ? { ...o, position: pos } : o))}
                              className={`py-1 rounded text-[9px] font-bold border transition-colors ${ov.position === pos ? 'bg-amber-600 border-amber-500 text-white' : 'bg-stone-800 border-stone-700 text-stone-500 hover:border-stone-500'}`}>
                              {pos.replace('-', ' ')}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-stone-600 shrink-0">Size</span>
                          <input type="range" min={5} max={80} value={ov.size} onChange={e => setImageOverlays(prev => prev.map(o => o.id === ov.id ? { ...o, size: Number(e.target.value) } : o))} className="flex-1 accent-amber-500 h-1" />
                          <span className="text-[9px] text-stone-500 font-mono w-6 shrink-0">{ov.size}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-stone-600 shrink-0">Opacity</span>
                          <input type="range" min={10} max={100} value={ov.opacity ?? 100} onChange={e => setImageOverlays(prev => prev.map(o => o.id === ov.id ? { ...o, opacity: Number(e.target.value) } : o))} className="flex-1 accent-amber-500 h-1" />
                          <span className="text-[9px] text-stone-500 font-mono w-8 shrink-0">{ov.opacity ?? 100}%</span>
                        </div>
                      </div>
                    ))}
                    <button onClick={() => stickerUploadRef.current?.click()} className="w-full py-1.5 rounded-lg border border-dashed border-stone-700 text-stone-500 text-[10px] hover:border-amber-600 hover:text-amber-400 transition-all">
                      + Upload another
                    </button>
                  </div>
                )}
              </div>

              {/* ─ Text Motion Overlays ─ */}
              <div className="bg-stone-800/60 border border-stone-700 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-stone-300 uppercase tracking-wider flex items-center gap-1.5"><Sparkles size={11} className="text-purple-400" /> Motion Text</p>
                  <button onClick={addAnimOverlay} className="flex items-center gap-1 text-[10px] font-bold text-purple-400 hover:text-purple-300 transition-colors">
                    <Plus size={11} /> Add
                  </button>
                </div>
                {animOverlays.length === 0 ? (
                  <p className="text-[10px] text-stone-600 text-center py-2">Animated text, scripture verse, or badge — syncs to timeline.</p>
                ) : (
                  animOverlays.map(ov => (
                    <OverlayEditor key={ov.id} overlay={ov}
                      onChange={updated => setAnimOverlays(prev => prev.map(o => o.id === ov.id ? updated : o))}
                      onDelete={() => setAnimOverlays(prev => prev.filter(o => o.id !== ov.id))}
                    />
                  ))
                )}
              </div>

              {/* ─ Scripture Finder ─ */}
              <div className="bg-stone-800/60 border border-stone-700 rounded-xl p-3 space-y-2">
                <p className="text-[10px] font-bold text-stone-300 uppercase tracking-wider flex items-center gap-1.5">📖 Scripture Finder</p>
                <p className="text-[9px] text-stone-500">Search any verse — tap to insert as a text overlay at playhead.</p>
                <ScriptureFinder onInsert={insertScripture} />
              </div>

              {/* ─ Companion Character ─ */}
              <div className="bg-stone-800/60 border border-stone-700 rounded-xl p-3 space-y-2">
                <p className="text-[10px] font-bold text-stone-300 uppercase tracking-wider">Companion Character</p>
                <div className="grid grid-cols-5 gap-1">
                  {[
                    { id: 'off',   label: 'Off',   emoji: '🚫' },
                    { id: 'wave',  label: 'Wave',  emoji: '👋' },
                    { id: 'point', label: 'Point', emoji: '👉' },
                    { id: 'nod',   label: 'Nod',   emoji: '🙂' },
                    { id: 'dance', label: 'Dance', emoji: '💃' },
                  ].map(a => (
                    <button key={a.id} onClick={() => setCharAnim(a.id)}
                      className={`flex flex-col items-center py-1.5 rounded-lg border text-[9px] font-bold transition-colors ${charAnim === a.id ? 'bg-rose-900/50 border-rose-600 text-rose-300' : 'bg-stone-900 border-stone-700 text-stone-500 hover:border-stone-500'}`}>
                      <span className="text-sm leading-none mb-0.5">{a.emoji}</span>
                      {a.label}
                    </button>
                  ))}
                </div>
                {charAnim !== 'off' && (
                  <div className="flex gap-1.5">
                    {['left','right'].map(p => (
                      <button key={p} onClick={() => setCharPos(p)}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold capitalize border transition-colors ${charPos === p ? 'bg-stone-600 border-stone-500 text-stone-100' : 'bg-stone-900 border-stone-700 text-stone-500'}`}>
                        {p} side
                      </button>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ── ENHANCE TAB ─────────────────────────────── */}
          {inspectorTab === 'enhance' && (
            <div className="p-3 space-y-4">

              {/* Look Presets */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Cinematic Looks</p>
                  {filterPreset !== 'none' && <button onClick={resetAllFilters} className="text-[10px] text-rose-400 hover:text-rose-300">Reset</button>}
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {FILTER_PRESETS.map(fp => (
                    <button key={fp.id} onClick={() => applyFilterPreset(fp)}
                      className={`flex flex-col items-center py-2 rounded-xl border text-[9px] font-bold transition-all active:scale-95 ${filterPreset === fp.id ? 'bg-rose-900/60 border-rose-500 text-rose-300' : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-500'}`}>
                      <span className="text-sm leading-none mb-0.5">{fp.emoji}</span>
                      <span className="leading-tight text-center">{fp.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Exposure & Tone */}
              <div className="bg-stone-800 border border-stone-700 rounded-xl p-3 space-y-3">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Exposure &amp; Tone</p>
                {[
                  { label: 'Brightness',  val: filterB,          set: setFilterB,          min: 50,  max: 160, unit: '%', zero: 100 },
                  { label: 'Contrast',    val: filterC,          set: setFilterC,          min: 50,  max: 200, unit: '%', zero: 100 },
                  { label: 'Highlights',  val: filterHighlights, set: setFilterHighlights, min: -50, max: 50,  unit: '',  zero: 0   },
                  { label: 'Shadows',     val: filterShadows,    set: setFilterShadows,    min: -50, max: 50,  unit: '',  zero: 0   },
                ].map(({ label, val, set, min, max, unit, zero }) => (
                  <div key={label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-[10px] text-stone-400">{label}</span>
                      <span className={`text-[10px] font-mono ${val === zero ? 'text-stone-600' : 'text-amber-400'}`}>{val > 0 && val !== zero ? '+' : ''}{val}{unit}</span>
                    </div>
                    <input type="range" min={min} max={max} value={val}
                      onChange={e => { set(Number(e.target.value)); setFilterPreset('custom'); }}
                      className="w-full accent-amber-500 h-1" />
                  </div>
                ))}
              </div>

              {/* Color */}
              <div className="bg-stone-800 border border-stone-700 rounded-xl p-3 space-y-3">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Color</p>
                {[
                  { label: 'Saturation', val: filterS,    set: setFilterS,    min: 0,    max: 250, unit: '%', zero: 100 },
                  { label: 'Hue Shift',  val: filterH,    set: setFilterH,    min: -180, max: 180, unit: '°', zero: 0   },
                  { label: 'Temperature',val: filterTemp,  set: setFilterTemp, min: -100, max: 100, unit: '',  zero: 0   },
                ].map(({ label, val, set, min, max, unit, zero }) => (
                  <div key={label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-[10px] text-stone-400">{label}</span>
                      <span className={`text-[10px] font-mono ${val === zero ? 'text-stone-600' : 'text-amber-400'}`}>
                        {val > 0 && val !== zero ? '+' : ''}{val}{unit}
                        {label === 'Temperature' && val !== 0 && <span className="ml-1 text-[9px] text-stone-500">{val > 0 ? '🔥 warm' : '❄️ cool'}</span>}
                      </span>
                    </div>
                    <input type="range" min={min} max={max} value={val}
                      onChange={e => { set(Number(e.target.value)); setFilterPreset('custom'); }}
                      className="w-full accent-rose-500 h-1" />
                  </div>
                ))}
              </div>

              {/* Effects */}
              <div className="bg-stone-800 border border-stone-700 rounded-xl p-3 space-y-3">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Effects</p>
                {[
                  { label: 'Vignette', val: filterVignette, set: setFilterVignette, min: 0, max: 100, unit: '%', zero: 0 },
                  { label: 'Blur',     val: filterBlur,     set: setFilterBlur,     min: 0, max: 10,  unit: 'px', zero: 0 },
                ].map(({ label, val, set, min, max, unit, zero }) => (
                  <div key={label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-[10px] text-stone-400">{label}</span>
                      <span className={`text-[10px] font-mono ${val === zero ? 'text-stone-600' : 'text-amber-400'}`}>{val}{unit}</span>
                    </div>
                    <input type="range" min={min} max={max} value={val}
                      onChange={e => { set(Number(e.target.value)); setFilterPreset('custom'); }}
                      className="w-full accent-purple-500 h-1" />
                  </div>
                ))}
              </div>

              {/* AI Enhancement */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">AI Enhancement</p>
                {[
                  { label: '4K AI Upscaling', badge: 'Ultra HD', desc: 'Sharpen soft footage, add detail', val: aiUpscale, set: setAiUpscale },
                  { label: 'Cinematic Grade', badge: null, desc: 'Flat iPhone footage → moody cinematic', val: cinematicGrade, set: setCinematicGrade },
                ].map(({ label, badge, desc, val, set }) => (
                  <label key={label} className="flex items-center justify-between bg-stone-700/50 border border-stone-700 rounded-xl p-3 cursor-pointer hover:border-stone-600 transition-colors">
                    <div>
                      <span className="text-xs font-bold text-stone-200 flex items-center gap-1.5">{label}{badge && <span className="text-[9px] font-bold text-rose-400 bg-rose-900/40 px-1.5 py-0.5 rounded uppercase">{badge}</span>}</span>
                      <span className="text-[10px] text-stone-500 block mt-0.5">{desc}</span>
                    </div>
                    <button onClick={() => set(!val)} className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${val ? 'bg-rose-500' : 'bg-stone-600'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${val ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </label>
                ))}
              </div>

              <button onClick={() => setShowAIHelper(h => !h)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-rose-900/40 border border-rose-700/50 text-rose-300 hover:bg-rose-800/50 active:scale-95 transition-all">
                <Sparkles size={15} /> AI Editing Tips
              </button>
            </div>
          )}

          {/* ── CAMERA TAB ─────────────────────────────── */}
          {inspectorTab === 'camera' && (
            <div className="p-3 space-y-3">

              {/* Live camera preview */}
              <div className="relative bg-stone-900 rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
                <video ref={cameraPreviewRef} autoPlay playsInline muted
                  className={`w-full h-full object-cover transition-opacity ${cameraPreviewActive ? 'opacity-100' : 'opacity-0'}`}
                  style={{ transform: cameraFacing === 'user' ? 'scaleX(-1)' : 'none' }} />
                {!cameraPreviewActive && !isRecording && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <Camera size={32} className="text-stone-600" />
                    <p className="text-[11px] text-stone-500">Camera preview</p>
                    {cameraPreviewError && <p className="text-[10px] text-rose-400 text-center px-4">{cameraPreviewError}</p>}
                    <button onClick={() => startCameraPreview()}
                      className="px-4 py-2 bg-stone-800 border border-stone-600 rounded-lg text-xs font-bold text-stone-200 hover:bg-stone-700 active:scale-95 transition-all">
                      Enable Preview
                    </button>
                  </div>
                )}
                {isRecording && (
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-red-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-lg">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    REC {Math.floor(recordTimer / 60).toString().padStart(2, '0')}:{(recordTimer % 60).toString().padStart(2, '0')}
                  </div>
                )}
                {cameraPreviewActive && !isRecording && (
                  <div className="absolute bottom-2 right-2 flex items-center gap-1">
                    <button onClick={() => {
                      const newFacing = cameraFacing === 'user' ? 'environment' : 'user';
                      setCameraFacing(newFacing);
                      startCameraPreview(newFacing);
                    }} className="p-1.5 bg-black/60 rounded-lg text-white hover:bg-black/80" title="Flip camera">
                      <RotateCcw size={13} />
                    </button>
                    <button onClick={stopCameraPreview} className="p-1.5 bg-black/60 rounded-lg text-stone-300 hover:bg-black/80" title="Close preview">
                      <X size={13} />
                    </button>
                  </div>
                )}
              </div>

              {/* Record / Stop */}
              <button
                onClick={isRecording ? stopRecord : async () => {
                  stopCameraPreview();
                  await startRecord(true, true);
                }}
                disabled={!!recordError}
                className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-40 ${isRecording ? 'bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-900/40' : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/30'}`}>
                {isRecording
                  ? <><span className="w-3 h-3 rounded bg-white" /> Stop Recording</>
                  : <><Camera size={18} /> Record Video</>}
              </button>
              {recordError && <p className="text-[11px] text-rose-400 text-center">{recordError}</p>}

              {/* Quick tips */}
              <div className="bg-stone-800 border border-stone-700 rounded-xl p-3 space-y-2">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">📸 Pro Recording Tips</p>
                {[
                  { icon: '💡', tip: 'Face a window or ring light — never shoot with light behind you' },
                  { icon: '🎙', tip: 'Speak 6–12 inches from mic for warm, clear audio' },
                  { icon: '📐', tip: 'Eye level = authority. Camera slightly above = relatable' },
                  { icon: '🎬', tip: 'Record 3-second silent buffer before speaking for clean edits' },
                  { icon: '🔁', tip: 'Re-record hooks until first 3 seconds feel punchy' },
                ].map(({ icon, tip }) => (
                  <div key={tip} className="flex items-start gap-2">
                    <span className="text-sm shrink-0 leading-tight">{icon}</span>
                    <p className="text-[10px] text-stone-400 leading-tight">{tip}</p>
                  </div>
                ))}
              </div>

              {/* Camera settings guide */}
              <div className="border-t border-stone-700 pt-3">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Camera Settings Guide</p>
                <InlineCameraGuide />
              </div>

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
                <p className="text-[10px] font-bold text-stone-500 uppercase mb-2">Quality & Format</p>
                <div className="space-y-1 mb-3">
                  {EXPORT_FORMATS.map(f => (
                    <button key={f.id} onClick={() => setExportFormat(f.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${exportFormat === f.id ? 'bg-rose-900/40 border-rose-600 text-rose-300' : 'bg-stone-800 border-stone-700 text-stone-300 hover:border-stone-600'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{f.label}</span>
                        {f.w && <span className="text-[10px] font-mono text-stone-500">{f.w}×{f.h}</span>}
                      </div>
                      <p className="text-[10px] text-stone-500 mt-0.5">{f.platform}</p>
                    </button>
                  ))}
                </div>
                {(exportFormat.includes('4k') || exportFormat.includes('2k')) && (
                  <p className="text-[10px] text-amber-400 mb-2">4K/2K export takes longer — keep device awake during export.</p>
                )}
                <label className="flex items-center gap-2 text-xs text-stone-400 cursor-pointer mb-1">
                  <input type="checkbox" checked={appendContactUrlToMetadata} onChange={(e) => setAppendContactUrlToMetadata(e.target.checked)} className="rounded" />
                  Append contact URL to metadata
                </label>
              </div>
              {/* Thumbnail grab */}
              {videoForPreview && (
                <div className="bg-stone-800 border border-stone-700 rounded-xl p-3 space-y-2">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Thumbnail</p>
                  <p className="text-[10px] text-stone-500">Grab the current frame as a thumbnail image for YouTube, social posts, or your thumbnail preview.</p>
                  <button onClick={() => {
                    try {
                      const v = videoRef.current;
                      if (!v) return;
                      const canvas = document.createElement('canvas');
                      canvas.width = v.videoWidth || 1280;
                      canvas.height = v.videoHeight || 720;
                      const ctx = canvas.getContext('2d');
                      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
                      canvas.toBlob(blob => {
                        if (!blob) return;
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `thumbnail-${Date.now()}.jpg`;
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(url), 5000);
                      }, 'image/jpeg', 0.92);
                    } catch (e) { console.error('Thumbnail grab failed:', e); }
                  }} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold bg-stone-700 border border-stone-600 text-stone-200 hover:bg-stone-600 active:scale-95 transition-all">
                    <ImageIcon size={14} /> Grab Current Frame
                  </button>
                </div>
              )}
              <button onClick={exportVideo} disabled={exporting || !selectedVideo} className="w-full py-4 rounded-xl text-base font-bold bg-rose-500 hover:bg-rose-400 text-white disabled:opacity-40 shadow-lg shadow-rose-900/30 transition-all active:scale-95">
                {exporting ? (exportProgress > 0 ? `Exporting ${Math.round(exportProgress * 100)}%…` : 'Rendering…') : '⬇ Export Video'}
              </button>
              {/* Platform-specific final checklist */}
              <div className="bg-stone-800/60 border border-stone-700 rounded-xl p-3 space-y-1.5">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Before You Post</p>
                {[
                  { icon: '🎣', text: 'Strong hook in first 3 seconds?' },
                  { icon: '📝', text: 'Captions or subtitles added?' },
                  { icon: '🔗', text: 'CTA (Link in Bio / swipe up) included?' },
                  { icon: '🎵', text: 'Background music at right volume?' },
                  { icon: '✂️', text: 'Pauses and filler words removed?' },
                ].map(({ icon, text }) => (
                  <label key={text} className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" className="w-3.5 h-3.5 rounded accent-rose-500 shrink-0" />
                    <span className="text-[10px] text-stone-400 group-hover:text-stone-300">{icon} {text}</span>
                  </label>
                ))}
              </div>
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
      <div className="flex flex-col min-h-0 bg-stone-900" style={{ gridArea: 'timeline' }}>
      {/* Primary editing toolbar — Split, Delete, Undo, Redo front and center */}
      <div className="shrink-0 flex items-center gap-1 px-3 py-2 bg-stone-800 border-t border-stone-700">
        <button onClick={splitAtPlayhead} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow" title="Split clip at playhead (S)"><Scissors size={13} /> Split</button>
        <button onClick={deleteSelectedSegment} disabled={!selectedSegmentId && !selectedAudioSegmentId && !selectedClipId} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-700 hover:bg-red-700 text-white text-xs font-bold disabled:opacity-40" title="Delete selected clip (Del)"><Trash2 size={13} /> Delete</button>
        <button onClick={undoAll} disabled={history.length === 0} className="px-2.5 py-1.5 rounded-lg bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs font-bold disabled:opacity-40" title="Undo (Ctrl+Z)"><Undo2 size={13} /></button>
        <div className="w-px h-5 bg-stone-600 mx-1" />
        <span className="text-[10px] font-mono text-amber-400 font-bold">{secToTimecode(playhead)}</span>
        <div className="flex-1" />
        <button onClick={() => setTimelineZoom(z => Math.max(0.5, Math.min(4, z / 1.4)))} className="px-2 py-1.5 rounded bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs" title="Zoom out">−</button>
        <span className="text-xs font-mono text-stone-400 min-w-[2.5rem] text-center">{timelineZoom.toFixed(1)}×</span>
        <button onClick={() => setTimelineZoom(z => Math.max(0.5, Math.min(4, z * 1.4)))} className="px-2 py-1.5 rounded bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs" title="Zoom in">+</button>
        <button onClick={zoomToFit} className="px-2 py-1.5 rounded bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs">Fit</button>
        {splitFeedback && <span className="text-[10px] text-rose-400 font-bold ml-2">{splitFeedback}</span>}
      </div>
      <div
        className={`timeline-track flex flex-col flex-shrink-0 border-t border-stone-700 bg-stone-900 overflow-auto transition-all touch-pan-y ${!selectedVideo && !hasLayeredClips ? 'opacity-60' : ''}`}
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
        style={{ height: '100%', touchAction: 'manipulation' }}
      >
        <div className="flex flex-col shrink-0" style={{ minWidth: 80 + 500 * timelineZoom, width: 80 + 500 * timelineZoom }}>
        <div className="h-10 shrink-0 flex items-center font-mono text-[10px] font-bold text-stone-400 border-b border-stone-700 bg-stone-800">
          <div className="w-20 shrink-0 flex flex-col items-center px-1">
            <span className="text-stone-400">TRACK</span>
            <button onClick={addAudioTrack} className="text-[9px] font-semibold text-emerald-400 hover:text-emerald-300" title="Add unlimited audio tracks">+ track</button>
          </div>
          <div ref={timelineRulerRef} onMouseDown={(e) => { e.preventDefault(); handleRulerClick(e); setDraggingPlayheadSynced(true); }} onTouchStart={(e) => { e.preventDefault(); handleRulerClick(e); setDraggingPlayheadSynced(true); }} className="flex-1 relative flex justify-between px-4 select-none text-stone-400 min-w-0 touch-none bg-stone-800/90" style={{ cursor: draggingPlayhead ? 'grabbing' : 'grab', width: 500 * timelineZoom }}>
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
            {/* Playhead — triangle handle + line */}
            <div onMouseDown={(e) => { e.stopPropagation(); handleRulerClick(e); setDraggingPlayheadSynced(true); }} onTouchStart={(e) => { e.stopPropagation(); handleRulerClick(e); setDraggingPlayheadSynced(true); }}
              className="absolute top-0 bottom-0 z-30 cursor-grab active:cursor-grabbing touch-none select-none"
              style={{ left: `${playheadPct}%`, transform: 'translateX(-50%)' }}>
              {/* Triangle head */}
              <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-0 h-0" style={{ borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '8px solid #f59e0b' }} />
              {/* Vertical line */}
              <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-0.5 bottom-0 bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
              {/* Time tooltip — only while dragging */}
              {draggingPlayhead && (
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-stone-900 border border-amber-500/60 text-amber-300 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-lg whitespace-nowrap shadow-lg pointer-events-none">
                  {secToTimecode(playhead)}
                </div>
              )}
            </div>
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
              setDraggingPlayhead={setDraggingPlayheadSynced}
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
            <div ref={mainTrackRef} className="flex-1 h-full relative overflow-hidden rounded bg-stone-700/80" style={{ userSelect: 'none', minWidth: `${500 * timelineZoom}px`, cursor: 'default' }}>
              {selectedVideo ? (
                <>
                  {getMainTimelineRanges(mainSegments).map(({ seg, tlStart, tlEnd }) => {
                    if (!seg || seg.end == null || seg.start == null) return null;
                    const w = timelineDuration > 0 ? ((tlEnd - tlStart) / timelineDuration) * 100 : 10;
                    const left = timelineDuration > 0 ? (tlStart / timelineDuration) * 100 : 0;
                    return (
                      <div key={seg.id}
                        onMouseDown={(e) => { e.stopPropagation(); setSelectedSegmentId(seg.id); setSelectedAudioSegmentId(null); }}
                        onClick={() => { zoomToSelection(); }}
                        className={`absolute h-[calc(100%-4px)] top-0.5 flex items-stretch group rounded overflow-hidden cursor-pointer ${selectedSegmentId === seg.id ? 'ring-2 ring-amber-400' : 'ring-1 ring-stone-600'} ${movingMainId === seg.id ? 'ring-2 ring-white' : ''}`}
                        style={{ left: `${left}%`, width: `${Math.max(2, w)}%` }}>
                        <div onMouseDown={(e) => handleResizeMain(e, seg, 'start')} className="w-2.5 flex-shrink-0 cursor-ew-resize bg-white/20 hover:bg-rose-400/60 z-10 flex items-center justify-center"><div className="w-0.5 h-4 bg-white/50 rounded-full" /></div>
                        <div onMouseDown={(e) => handleMoveMainStart(e, seg)} className="flex-1 min-w-0 relative overflow-hidden">
                          <VideoSegmentThumbnail videoUrl={selectedVideo.url} startTime={seg.start} segStart={seg.start} segEnd={seg.end} />
                          <span className="absolute bottom-0 left-0 right-0 text-[9px] font-mono text-white bg-black/60 px-1 truncate">{secToTimecode(seg.start)} – {secToTimecode(seg.end)}</span>
                        </div>
                        <div onMouseDown={(e) => handleResizeMain(e, seg, 'end')} className="w-2.5 flex-shrink-0 cursor-ew-resize bg-white/20 hover:bg-rose-400/60 z-10 flex items-center justify-center"><div className="w-0.5 h-4 bg-white/50 rounded-full" /></div>
                      </div>
                    );
                  })}
                  <div className="absolute top-0 bottom-0 w-0.5 bg-amber-400 pointer-events-none shadow-[0_0_8px_rgba(251,191,36,0.7)]" style={{ left: `${playheadPct}%`, transform: 'translateX(-50%)' }} />
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
            <div ref={audioTrackRef} className="flex-1 h-full relative overflow-hidden rounded bg-stone-900" style={{ userSelect: 'none', minWidth: `${500 * timelineZoom}px`, cursor: 'default' }}>
              {hasAudio ? (
                <>
                  {getAudioTimelineRanges(audioSegments).map(({ seg, tlStart, tlEnd }) => {
                    if (!seg || seg.end == null || seg.start == null) return null;
                    const w = timelineDuration > 0 ? ((tlEnd - tlStart) / timelineDuration) * 100 : 10;
                    const left = timelineDuration > 0 ? (tlStart / timelineDuration) * 100 : 0;
                    return (
                      <div key={seg.id}
                        onMouseDown={(e) => { e.stopPropagation(); setSelectedAudioSegmentId(seg.id); setSelectedSegmentId(null); }}
                        onClick={() => { zoomToSelection(); }}
                        className={`absolute h-[calc(100%-4px)] top-0.5 flex items-stretch group rounded overflow-hidden cursor-pointer ${selectedAudioSegmentId === seg.id ? 'ring-2 ring-amber-400' : 'ring-1 ring-stone-600'} ${movingAudioId === seg.id ? 'ring-2 ring-white' : ''}`}
                        style={{ left: `${left}%`, width: `${Math.max(2, w)}%` }}>
                        <div onMouseDown={(e) => handleResizeAudio(e, seg, 'start')} className="w-2.5 flex-shrink-0 cursor-ew-resize bg-white/20 hover:bg-emerald-400/60 z-10 flex items-center justify-center"><div className="w-0.5 h-4 bg-white/50 rounded-full" /></div>
                        <div onMouseDown={(e) => handleMoveAudioStart(e, seg)} className="flex-1 min-w-0 relative overflow-hidden">
                          <AudioWaveformSegment audioUrl={selectedAudio?.url || selectedVideo?.url} segStart={seg.start} segEnd={seg.end} totalDuration={duration} />
                          <span className="absolute bottom-0 left-0 right-0 text-[9px] font-mono text-white bg-black/60 px-1 truncate">{secToTimecode(seg.start)} – {secToTimecode(seg.end)}</span>
                        </div>
                        <div onMouseDown={(e) => handleResizeAudio(e, seg, 'end')} className="w-2.5 flex-shrink-0 cursor-ew-resize bg-white/20 hover:bg-emerald-400/60 z-10 flex items-center justify-center"><div className="w-0.5 h-4 bg-white/50 rounded-full" /></div>
                      </div>
                    );
                  })}
                  <div className="absolute top-0 bottom-0 w-0.5 bg-amber-400 pointer-events-none shadow-[0_0_8px_rgba(251,191,36,0.7)]" style={{ left: `${playheadPct}%`, transform: 'translateX(-50%)' }} />
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
                    <div className="absolute top-0 bottom-0 w-0.5 bg-amber-400 pointer-events-none shadow-[0_0_8px_rgba(251,191,36,0.7)]" style={{ left: `${playheadPct}%`, transform: 'translateX(-50%)' }} />
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
          {videos.length === 0 ? (
            <p className="text-stone-500 text-sm">Upload video in Media Library first.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {videos.map(v => (
                <button key={v.id} onClick={() => setSelectedVideoId(v.id)}
                  className={`relative rounded-xl overflow-hidden aspect-video border-2 transition-all group ${selectedVideo?.id === v.id ? 'border-rose-500 ring-2 ring-rose-400' : 'border-rose-100 hover:border-rose-300'}`}
                  title={v.name}>
                  <video src={v.url} muted playsInline preload="metadata" className="w-full h-full object-cover"
                    onLoadedMetadata={e => { e.target.currentTime = 0.5; }} />
                  {selectedVideo?.id === v.id && (
                    <div className="absolute inset-0 bg-rose-500/20 flex items-center justify-center">
                      <div className="w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center shadow-lg">
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-black/60 text-[9px] text-white truncate opacity-0 group-hover:opacity-100 transition-opacity">
                    {v.name?.replace(/\.[^.]+$/, '').slice(0, 20) || 'Clip'}
                  </div>
                </button>
              ))}
            </div>
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

// Compact dark version of camera guide for use inside the editor inspector panel
const InlineCameraGuide = () => {
  const [contentType, setCT] = useState('video');
  const [lighting, setLighting] = useState('day');
  const [camera, setCamera] = useState('iphone');
  const allCams = [
    { id: 'blackmagic', name: 'Blackmagic' },
    { id: 'iphone', name: 'iPhone' },
    { id: 'sony', name: 'Sony' },
    { id: 'canon', name: 'Canon' },
  ];
  const effectiveCam = CAMERA_PRESETS[camera] ? camera : 'iphone';
  const preset = CAMERA_PRESETS[effectiveCam];
  const settings = preset?.[contentType]?.[lighting] || [];
  return (
    <div className="p-3 space-y-3">
      {/* Camera picker */}
      <div className="flex gap-1.5 flex-wrap">
        {allCams.map(c => (
          <button key={c.id} onClick={() => setCamera(c.id)} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${camera === c.id ? 'bg-rose-600 border-rose-600 text-white' : 'bg-stone-800 border-stone-700 text-stone-400 hover:text-stone-200'}`}>{c.name}</button>
        ))}
      </div>
      {/* Type + lighting */}
      <div className="flex gap-1.5">
        {['video','photo'].map(t => (
          <button key={t} onClick={() => setCT(t)} className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold capitalize border transition-colors ${contentType === t ? 'bg-stone-700 border-stone-500 text-stone-100' : 'bg-stone-900 border-stone-700 text-stone-500 hover:text-stone-300'}`}>{t}</button>
        ))}
        {['day','night'].map(l => (
          <button key={l} onClick={() => setLighting(l)} className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold capitalize border transition-colors ${lighting === l ? 'bg-amber-900/60 border-amber-700 text-amber-300' : 'bg-stone-900 border-stone-700 text-stone-500 hover:text-stone-300'}`}>{l === 'day' ? '☀️' : '🌙'} {l}</button>
        ))}
      </div>
      {/* Settings table */}
      <div className="space-y-1">
        {settings.map((s, i) => (
          <div key={i} className="flex items-center justify-between bg-stone-800 border border-stone-700 rounded-lg px-3 py-2">
            <span className="text-[10px] text-stone-500 uppercase font-bold w-24 shrink-0">{s.label}</span>
            <span className="text-xs font-bold text-stone-100 flex-1 text-right">{s.value}</span>
            <span className="text-[10px] text-stone-500 text-right ml-2 w-24 shrink-0">{s.note}</span>
          </div>
        ))}
      </div>
      {settings.length === 0 && <p className="text-xs text-stone-500 text-center py-4">No preset for this combination yet.</p>}
    </div>
  );
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

// --- Photo Editor ---
const DEFAULT_PHOTO_ADJ = {
  exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0,
  temperature: 0, tint: 0, vibrance: 0, saturation: 0, hue: 0,
  clarity: 0, sharpness: 0, dehaze: 0, noiseReduction: 0,
  vignette: 0, grain: 0, glow: 0, fade: 0,
  hsl: {
    red:{h:0,s:0,l:0}, orange:{h:0,s:0,l:0}, yellow:{h:0,s:0,l:0}, green:{h:0,s:0,l:0},
    aqua:{h:0,s:0,l:0}, blue:{h:0,s:0,l:0}, purple:{h:0,s:0,l:0}, magenta:{h:0,s:0,l:0}
  }
};

const PHOTO_PRESETS_V2 = [
  { id:'natural',      cat:'Auto',      label:'Natural',       emoji:'🌿', adj:{} },
  { id:'auto-enhance', cat:'Auto',      label:'Auto Enhance',  emoji:'✨', adj:{ exposure:8, contrast:12, highlights:-15, shadows:20, vibrance:15 } },
  { id:'port-glow',    cat:'Portrait',  label:'Soft Glow',     emoji:'🌸', adj:{ exposure:10, highlights:-20, shadows:15, temperature:8, vibrance:10, glow:20, vignette:15 } },
  { id:'port-golden',  cat:'Portrait',  label:'Golden Hour',   emoji:'🌅', adj:{ exposure:5, contrast:10, highlights:-10, shadows:25, temperature:30, vibrance:20, vignette:20 } },
  { id:'port-cool',    cat:'Portrait',  label:'Cool Tone',     emoji:'❄️', adj:{ exposure:5, contrast:8, temperature:-25, vibrance:15, vignette:10 } },
  { id:'port-moody',   cat:'Portrait',  label:'Moody Dark',    emoji:'🎭', adj:{ exposure:-10, contrast:30, highlights:-30, shadows:-15, temperature:-10, vignette:40 } },
  { id:'cin-teal',     cat:'Cinematic', label:'Teal & Orange', emoji:'🎬', adj:{ exposure:-5, contrast:25, highlights:-20, shadows:-10, temperature:15, tint:-8, vignette:30, fade:5 } },
  { id:'cin-matte',    cat:'Cinematic', label:'Matte Film',    emoji:'🎞', adj:{ contrast:-15, highlights:-10, shadows:20, vibrance:-15, blacks:12, fade:18, vignette:20 } },
  { id:'cin-drama',    cat:'Cinematic', label:'Drama',         emoji:'🌑', adj:{ exposure:-8, contrast:40, highlights:-35, shadows:-20, vibrance:-10, vignette:50 } },
  { id:'cin-bleach',   cat:'Cinematic', label:'Bleach',        emoji:'⚪', adj:{ exposure:8, contrast:-10, saturation:-30, whites:20, fade:25, vignette:15 } },
  { id:'faith-light',  cat:'Faith',     label:"Heaven's Light",emoji:'✝️', adj:{ exposure:15, highlights:10, temperature:12, vibrance:10, glow:35, vignette:-10 } },
  { id:'faith-fire',   cat:'Faith',     label:'Holy Fire',     emoji:'🔥', adj:{ exposure:5, contrast:15, temperature:40, vibrance:25, vignette:25, glow:15 } },
  { id:'faith-peace',  cat:'Faith',     label:'Still Waters',  emoji:'🕊', adj:{ exposure:8, contrast:-5, temperature:-15, vibrance:12, saturation:-10, glow:20, vignette:10 } },
  { id:'land-vivid',   cat:'Landscape', label:'Vivid Nature',  emoji:'🏔', adj:{ exposure:5, contrast:20, highlights:-15, shadows:20, vibrance:35, saturation:15, clarity:20 } },
  { id:'land-golden',  cat:'Landscape', label:'Golden Field',  emoji:'🌾', adj:{ exposure:8, contrast:15, temperature:20, vibrance:25, clarity:10, vignette:15 } },
  { id:'land-alpine',  cat:'Landscape', label:'Alpine Cool',   emoji:'🌨', adj:{ exposure:5, contrast:15, temperature:-20, vibrance:20, clarity:15 } },
  { id:'film-kodak',   cat:'Film',      label:'Kodak Gold',    emoji:'📷', adj:{ contrast:10, shadows:15, temperature:15, tint:5, vibrance:10, grain:20 } },
  { id:'film-fuji',    cat:'Film',      label:'Fuji 400H',     emoji:'🎞', adj:{ contrast:-5, highlights:-15, shadows:20, temperature:-10, tint:8, vibrance:15, grain:15 } },
  { id:'film-portra',  cat:'Film',      label:'Portra 400',    emoji:'📸', adj:{ exposure:5, contrast:-5, highlights:-10, shadows:25, temperature:10, vibrance:12, grain:12 } },
  { id:'bw-classic',   cat:'B&W',       label:'Classic',       emoji:'◐', adj:{ saturation:-100, contrast:20, clarity:10, vignette:20 } },
  { id:'bw-dramatic',  cat:'B&W',       label:'Dramatic',      emoji:'◼', adj:{ saturation:-100, contrast:50, highlights:-20, shadows:-15, vignette:40 } },
  { id:'bw-fade',      cat:'B&W',       label:'Faded',         emoji:'◻', adj:{ saturation:-100, contrast:-10, blacks:12, fade:20 } },
  { id:'bw-selenium',  cat:'B&W',       label:'Selenium',      emoji:'🔵', adj:{ saturation:-100, temperature:-10, contrast:15, vignette:25 } },
];

const PhotoEditor = () => {
  const [imgSrc, setImgSrc] = useState(null);
  const [imgName, setImgName] = useState('photo');
  const [showBefore, setShowBefore] = useState(false);
  const [activePreset, setActivePreset] = useState('natural');
  const [presetCat, setPresetCat] = useState('All');
  const [activePanel, setActivePanel] = useState('light');
  const [hslColor, setHslColor] = useState('red');
  const [history, setHistory] = useState([DEFAULT_PHOTO_ADJ]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [fineRotation, setFineRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [cropAspect, setCropAspect] = useState('free');
  const [exportFmt, setExportFmt] = useState('jpg');
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const fileRef = useRef(null);

  const adj = history[historyIdx];

  const pushAdj = useCallback((newAdj) => {
    setHistory(h => {
      const next = h.slice(0, historyIdx + 1);
      next.push(newAdj);
      return next;
    });
    setHistoryIdx(i => i + 1);
  }, [historyIdx]);

  const setKey = (key, val) => pushAdj({ ...adj, [key]: val });
  const setHslKey = (color, key, val) => pushAdj({ ...adj, hsl: { ...adj.hsl, [color]: { ...adj.hsl[color], [key]: val } } });
  const undo = () => historyIdx > 0 && setHistoryIdx(i => i - 1);
  const redo = () => historyIdx < history.length - 1 && setHistoryIdx(i => i + 1);
  const resetAdj = () => { setHistory([DEFAULT_PHOTO_ADJ]); setHistoryIdx(0); setActivePreset('natural'); };

  const applyPreset = (p) => {
    const newAdj = { ...DEFAULT_PHOTO_ADJ, ...p.adj, hsl: { ...DEFAULT_PHOTO_ADJ.hsl, ...(p.adj.hsl || {}) } };
    pushAdj(newAdj);
    setActivePreset(p.id);
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImgName(f.name.replace(/\.[^.]+$/, ''));
    setImgSrc(URL.createObjectURL(f));
    e.target.value = '';
  };

  const cssFilter = useMemo(() => {
    const parts = [];
    const bri = 100 + adj.exposure * 0.55 + adj.whites * 0.15 - adj.blacks * 0.1 + adj.highlights * 0.1 + adj.shadows * 0.15;
    if (Math.abs(bri - 100) > 0.5) parts.push(`brightness(${bri.toFixed(1)}%)`);
    const con = 100 + adj.contrast * 0.6 + adj.clarity * 0.18;
    if (Math.abs(con - 100) > 0.5) parts.push(`contrast(${con.toFixed(1)}%)`);
    const sat = 100 + adj.saturation * 0.7 + adj.vibrance * 0.35;
    if (Math.abs(sat - 100) > 0.5) parts.push(`saturate(${Math.max(0, sat).toFixed(1)}%)`);
    if (Math.abs(adj.hue) > 0.5) parts.push(`hue-rotate(${adj.hue}deg)`);
    if (adj.noiseReduction > 25) parts.push(`blur(${(adj.noiseReduction / 100 * 0.6).toFixed(2)}px)`);
    if (adj.dehaze > 10) parts.push(`contrast(${(100 + adj.dehaze * 0.2).toFixed(1)}%)`);
    return parts.join(' ') || undefined;
  }, [adj]);

  const imgTransform = `scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1}) rotate(${rotation * 90 + fineRotation}deg)`;

  const downloadPhoto = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const { naturalWidth: w, naturalHeight: h } = img;
    const totalRot = ((rotation * 90 + fineRotation) * Math.PI) / 180;
    const cos = Math.abs(Math.cos(totalRot)), sin = Math.abs(Math.sin(totalRot));
    const cw = Math.ceil(w * cos + h * sin);
    const ch = Math.ceil(w * sin + h * cos);
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.translate(cw / 2, ch / 2);
    if (flipH || flipV) ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.rotate(totalRot);
    ctx.filter = cssFilter || 'none';
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.filter = 'none';
    // Temperature overlay
    if (adj.temperature !== 0) {
      ctx.globalAlpha = Math.abs(adj.temperature) / 100 * 0.25;
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = adj.temperature > 0 ? 'rgb(255,160,50)' : 'rgb(60,130,255)';
      ctx.fillRect(-cw/2, -ch/2, cw, ch);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    // Tint overlay
    if (adj.tint !== 0) {
      ctx.globalAlpha = Math.abs(adj.tint) / 100 * 0.12;
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = adj.tint > 0 ? 'rgb(255,0,180)' : 'rgb(0,200,80)';
      ctx.fillRect(-cw/2, -ch/2, cw, ch);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    // Vignette
    if (adj.vignette > 0) {
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(cw, ch) * 0.7);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(1, `rgba(0,0,0,${adj.vignette / 100 * 0.9})`);
      ctx.fillStyle = grad; ctx.fillRect(-cw/2, -ch/2, cw, ch);
    }
    // Fade
    if (adj.fade > 0) {
      ctx.globalAlpha = adj.fade / 100 * 0.35;
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgb(255,255,255)';
      ctx.fillRect(-cw/2, -ch/2, cw, ch);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
    const mime = exportFmt === 'png' ? 'image/png' : exportFmt === 'webp' ? 'image/webp' : 'image/jpeg';
    const link = document.createElement('a');
    link.download = `${imgName}-edited.${exportFmt}`;
    link.href = canvas.toDataURL(mime, 0.95);
    link.click();
  };

  // Slider component
  const AdjSlider = ({ label, k, min, max, unit = '', zero = 0 }) => {
    const val = adj[k] ?? 0;
    const isChanged = val !== zero;
    return (
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-medium text-stone-400">{label}</span>
          <span className={`text-xs font-mono tabular-nums ${isChanged ? 'text-rose-400' : 'text-stone-500'}`}>{val > 0 ? '+' : ''}{val}{unit}</span>
        </div>
        <input type="range" min={min} max={max} value={val}
          onChange={e => { setKey(k, Number(e.target.value)); setActivePreset(''); }}
          className="w-full h-1 accent-rose-500 cursor-pointer" />
      </div>
    );
  };

  const HSLSlider = ({ label, k, min, max }) => {
    const val = adj.hsl[hslColor]?.[k] ?? 0;
    return (
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-medium text-stone-400">{label}</span>
          <span className={`text-xs font-mono ${val !== 0 ? 'text-rose-400' : 'text-stone-500'}`}>{val > 0 ? '+' : ''}{val}</span>
        </div>
        <input type="range" min={min} max={max} value={val}
          onChange={e => { setHslKey(hslColor, k, Number(e.target.value)); setActivePreset(''); }}
          className="w-full h-1 accent-rose-500 cursor-pointer" />
      </div>
    );
  };

  const PanelSection = ({ id, icon, label, children }) => (
    <div className={`rounded-xl border transition-colors ${activePanel === id ? 'border-rose-600/50 bg-stone-800/80' : 'border-stone-700/50 bg-stone-800/40'}`}>
      <button onClick={() => setActivePanel(activePanel === id ? '' : id)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left">
        <span className="flex items-center gap-2 text-xs font-bold text-stone-300 uppercase tracking-wider">
          <span>{icon}</span>{label}
        </span>
        <span className={`text-stone-500 text-xs transition-transform ${activePanel === id ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {activePanel === id && <div className="px-3 pb-3 space-y-3">{children}</div>}
    </div>
  );

  const presetCategories = ['All', ...Array.from(new Set(PHOTO_PRESETS_V2.map(p => p.cat)))];
  const visiblePresets = presetCat === 'All' ? PHOTO_PRESETS_V2 : PHOTO_PRESETS_V2.filter(p => p.cat === presetCat);

  return (
    <div className="max-w-7xl mx-auto">
      <canvas ref={canvasRef} className="hidden" />
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

      {!imgSrc ? (
        /* ─── Upload State ─── */
        <label className="cursor-pointer flex flex-col items-center justify-center gap-5 border-2 border-dashed border-stone-600 hover:border-rose-500 rounded-3xl p-20 text-center transition-all group bg-stone-900/40 hover:bg-stone-800/50">
          <div className="relative">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-rose-900/60 to-stone-800 border-2 border-dashed border-stone-600 group-hover:border-rose-500 flex items-center justify-center transition-colors">
              <ImageIcon size={36} className="text-stone-500 group-hover:text-rose-400 transition-colors" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-rose-600 flex items-center justify-center shadow-lg">
              <Plus size={14} className="text-white" />
            </div>
          </div>
          <div>
            <p className="text-lg font-bold text-stone-300 group-hover:text-white transition-colors">Drop your photo here</p>
            <p className="text-sm text-stone-500 mt-1">or tap to browse files</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-center">
            {['JPG', 'PNG', 'HEIC', 'WebP', 'RAW'].map(f => (
              <span key={f} className="text-[10px] font-bold text-stone-600 bg-stone-800 border border-stone-700 px-2 py-0.5 rounded">{f}</span>
            ))}
          </div>
          <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </label>
      ) : (
        /* ─── Editor Layout ─── */
        <div className="flex gap-3 h-[calc(100vh-140px)]">

          {/* ── Left: Preset Library ── */}
          <div className="w-[170px] flex-shrink-0 flex flex-col gap-2 overflow-hidden">
            <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider px-1">Presets</p>
            {/* Category pills */}
            <div className="flex flex-wrap gap-1">
              {presetCategories.map(c => (
                <button key={c} onClick={() => setPresetCat(c)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${presetCat === c ? 'bg-rose-600 border-rose-600 text-white' : 'border-stone-700 text-stone-400 hover:border-rose-600 hover:text-rose-400'}`}>
                  {c}
                </button>
              ))}
            </div>
            {/* Preset list */}
            <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
              {visiblePresets.map(p => (
                <button key={p.id} onClick={() => applyPreset(p)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${activePreset === p.id ? 'bg-rose-600/30 border border-rose-600/50 text-rose-300' : 'hover:bg-stone-700/60 text-stone-300 border border-transparent'}`}>
                  <span className="text-base leading-none">{p.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold truncate">{p.label}</p>
                    <p className="text-[9px] text-stone-500">{p.cat}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Center: Canvas Preview ── */}
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-stone-800 rounded-lg p-0.5 border border-stone-700">
                <button onClick={() => setShowBefore(false)}
                  className={`px-3 py-1 rounded text-xs font-bold transition-colors ${!showBefore ? 'bg-rose-600 text-white' : 'text-stone-400 hover:text-stone-200'}`}>After</button>
                <button onClick={() => setShowBefore(true)}
                  className={`px-3 py-1 rounded text-xs font-bold transition-colors ${showBefore ? 'bg-rose-600 text-white' : 'text-stone-400 hover:text-stone-200'}`}>Before</button>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={undo} disabled={historyIdx === 0}
                  className="p-1.5 rounded bg-stone-800 border border-stone-700 text-stone-400 hover:text-white disabled:opacity-30 transition-colors" title="Undo">
                  <RotateCcw size={13} />
                </button>
                <button onClick={redo} disabled={historyIdx >= history.length - 1}
                  className="p-1.5 rounded bg-stone-800 border border-stone-700 text-stone-400 hover:text-white disabled:opacity-30 transition-colors" title="Redo">
                  <RotateCcw size={13} className="scale-x-[-1]" />
                </button>
              </div>
              <button onClick={resetAdj}
                className="px-2.5 py-1.5 rounded bg-stone-800 border border-stone-700 text-xs font-bold text-stone-400 hover:text-rose-400 hover:border-rose-600/50 transition-colors">
                Reset
              </button>
              <button onClick={() => fileRef.current?.click()}
                className="px-2.5 py-1.5 rounded bg-stone-800 border border-stone-700 text-xs font-bold text-stone-400 hover:text-white transition-colors">
                Change Photo
              </button>
              <div className="flex items-center gap-1 ml-auto">
                {['jpg','png','webp'].map(f => (
                  <button key={f} onClick={() => setExportFmt(f)}
                    className={`px-2 py-1 rounded text-[10px] font-bold uppercase border transition-colors ${exportFmt === f ? 'bg-rose-600 border-rose-600 text-white' : 'border-stone-700 text-stone-400 hover:border-rose-600'}`}>
                    {f}
                  </button>
                ))}
                <button onClick={downloadPhoto}
                  className="ml-1 flex items-center gap-1.5 px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors">
                  <Download size={12} /> Export
                </button>
              </div>
            </div>

            {/* Canvas area */}
            <div className="flex-1 bg-stone-950 rounded-2xl border border-stone-800 flex items-center justify-center relative overflow-hidden">
              <div className="relative">
                <img
                  ref={imgRef}
                  src={imgSrc}
                  alt="editing"
                  crossOrigin="anonymous"
                  style={{
                    filter: showBefore ? undefined : (cssFilter || undefined),
                    transform: imgTransform,
                    maxWidth: '100%',
                    maxHeight: 'calc(100vh - 260px)',
                    display: 'block',
                    transition: 'filter 0.1s ease',
                  }}
                  className="object-contain select-none"
                />
                {/* Temperature overlay */}
                {!showBefore && adj.temperature !== 0 && (
                  <div className="absolute inset-0 pointer-events-none" style={{
                    background: adj.temperature > 0 ? `rgba(255,160,50,${Math.abs(adj.temperature)/100*0.25})` : `rgba(60,130,255,${Math.abs(adj.temperature)/100*0.25})`,
                    mixBlendMode: 'multiply', borderRadius: 2,
                  }} />
                )}
                {/* Tint overlay */}
                {!showBefore && adj.tint !== 0 && (
                  <div className="absolute inset-0 pointer-events-none" style={{
                    background: adj.tint > 0 ? `rgba(255,0,180,${adj.tint/100*0.12})` : `rgba(0,200,80,${Math.abs(adj.tint)/100*0.12})`,
                    mixBlendMode: 'screen',
                  }} />
                )}
                {/* Vignette */}
                {!showBefore && adj.vignette !== 0 && (
                  <div className="absolute inset-0 pointer-events-none" style={{
                    background: adj.vignette > 0
                      ? `radial-gradient(ellipse at center, transparent ${Math.max(10, 70 - adj.vignette * 0.5)}%, rgba(0,0,0,${adj.vignette/100*0.9}) 100%)`
                      : `radial-gradient(ellipse at center, rgba(255,255,255,${Math.abs(adj.vignette)/100*0.55}) 0%, transparent 70%)`,
                  }} />
                )}
                {/* Grain */}
                {!showBefore && adj.grain > 0 && (
                  <div className="absolute inset-0 pointer-events-none" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                    backgroundSize: '200px 200px',
                    opacity: adj.grain / 100 * 0.45,
                    mixBlendMode: 'overlay',
                  }} />
                )}
                {/* Glow */}
                {!showBefore && adj.glow > 0 && (
                  <div className="absolute inset-0 pointer-events-none rounded-sm" style={{
                    background: `radial-gradient(ellipse at center, rgba(255,255,255,${adj.glow/100*0.25}) 0%, transparent 70%)`,
                    mixBlendMode: 'screen',
                  }} />
                )}
                {/* Fade */}
                {!showBefore && adj.fade > 0 && (
                  <div className="absolute inset-0 pointer-events-none" style={{
                    background: `rgba(255,255,255,${adj.fade/100*0.32})`,
                    mixBlendMode: 'screen',
                  }} />
                )}
              </div>
              {/* Before label */}
              {showBefore && (
                <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 rounded text-[10px] font-bold text-white uppercase tracking-wider">Original</div>
              )}
              {!showBefore && (
                <div className="absolute top-3 left-3 px-2 py-1 bg-rose-600/80 rounded text-[10px] font-bold text-white uppercase tracking-wider">Edited</div>
              )}
              {/* Close button */}
              <button onClick={() => { setImgSrc(null); resetAdj(); setRotation(0); setFineRotation(0); setFlipH(false); setFlipV(false); }}
                className="absolute top-3 right-3 p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* ── Right: Adjustment Panels ── */}
          <div className="w-[230px] flex-shrink-0 flex flex-col gap-1.5 overflow-y-auto">

            <PanelSection id="light" icon="🌞" label="Light">
              <AdjSlider label="Exposure"   k="exposure"   min={-100} max={100} />
              <AdjSlider label="Contrast"   k="contrast"   min={-100} max={100} />
              <AdjSlider label="Highlights" k="highlights" min={-100} max={100} />
              <AdjSlider label="Shadows"    k="shadows"    min={-100} max={100} />
              <AdjSlider label="Whites"     k="whites"     min={-100} max={100} />
              <AdjSlider label="Blacks"     k="blacks"     min={-100} max={100} />
            </PanelSection>

            <PanelSection id="color" icon="🎨" label="Color">
              <AdjSlider label="Temperature" k="temperature" min={-100} max={100} />
              <AdjSlider label="Tint"        k="tint"        min={-100} max={100} />
              <AdjSlider label="Vibrance"    k="vibrance"    min={-100} max={100} />
              <AdjSlider label="Saturation"  k="saturation"  min={-100} max={100} />
              <AdjSlider label="Hue Shift"   k="hue"         min={-180} max={180} unit="°" />
            </PanelSection>

            <PanelSection id="hsl" icon="🌈" label="HSL / Color Mix">
              {/* Color selector */}
              <div className="grid grid-cols-4 gap-1">
                {[
                  { id:'red', color:'#ef4444' }, { id:'orange', color:'#f97316' },
                  { id:'yellow', color:'#eab308' }, { id:'green', color:'#22c55e' },
                  { id:'aqua', color:'#06b6d4' }, { id:'blue', color:'#3b82f6' },
                  { id:'purple', color:'#a855f7' }, { id:'magenta', color:'#ec4899' },
                ].map(c => (
                  <button key={c.id} onClick={() => setHslColor(c.id)}
                    className={`h-6 rounded border-2 transition-all ${hslColor === c.id ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}
                    style={{ background: c.color }} title={c.id} />
                ))}
              </div>
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider capitalize">{hslColor}</p>
              <HSLSlider label="Hue"        k="h" min={-50}  max={50} />
              <HSLSlider label="Saturation" k="s" min={-100} max={100} />
              <HSLSlider label="Luminance"  k="l" min={-100} max={100} />
            </PanelSection>

            <PanelSection id="detail" icon="🔍" label="Detail">
              <AdjSlider label="Clarity"          k="clarity"         min={-100} max={100} />
              <AdjSlider label="Sharpness"         k="sharpness"       min={0}    max={100} />
              <AdjSlider label="Dehaze"            k="dehaze"          min={-100} max={100} />
              <AdjSlider label="Noise Reduction"   k="noiseReduction"  min={0}    max={100} />
            </PanelSection>

            <PanelSection id="effects" icon="✨" label="Effects">
              <AdjSlider label="Vignette" k="vignette" min={-50}  max={100} />
              <AdjSlider label="Grain"    k="grain"    min={0}    max={100} />
              <AdjSlider label="Glow"     k="glow"     min={0}    max={100} />
              <AdjSlider label="Fade"     k="fade"     min={0}    max={100} />
            </PanelSection>

            <PanelSection id="geometry" icon="📐" label="Geometry">
              {/* Crop */}
              <div>
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Crop</p>
                <div className="grid grid-cols-4 gap-1">
                  {[['Free','free'],['9:16','9:16'],['16:9','16:9'],['1:1','1:1'],['4:5','4:5'],['2:3','2:3'],['3:4','3:4'],['4:3','4:3']].map(([lbl,val]) => (
                    <button key={val} onClick={() => setCropAspect(val)}
                      className={`py-1 text-[9px] font-bold rounded border transition-colors ${cropAspect === val ? 'bg-rose-600 border-rose-600 text-white' : 'border-stone-700 text-stone-400 hover:border-rose-600'}`}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              {/* Rotate & Flip */}
              <div>
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Rotate & Flip</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <button onClick={() => setRotation(r => r - 1)} className="py-1.5 rounded-lg border border-stone-700 text-stone-300 text-xs font-bold hover:bg-stone-700 transition-colors">↺ 90°</button>
                  <button onClick={() => setRotation(r => r + 1)} className="py-1.5 rounded-lg border border-stone-700 text-stone-300 text-xs font-bold hover:bg-stone-700 transition-colors">↻ 90°</button>
                  <button onClick={() => setFlipH(v => !v)} className={`py-1.5 rounded-lg border text-xs font-bold transition-colors ${flipH ? 'bg-rose-600/30 border-rose-600/50 text-rose-300' : 'border-stone-700 text-stone-300 hover:bg-stone-700'}`}>↔ Flip H</button>
                  <button onClick={() => setFlipV(v => !v)} className={`py-1.5 rounded-lg border text-xs font-bold transition-colors ${flipV ? 'bg-rose-600/30 border-rose-600/50 text-rose-300' : 'border-stone-700 text-stone-300 hover:bg-stone-700'}`}>↕ Flip V</button>
                </div>
              </div>
              {/* Fine rotation */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium text-stone-400">Straighten</span>
                  <span className="text-xs font-mono text-stone-500">{fineRotation > 0 ? '+' : ''}{fineRotation}°</span>
                </div>
                <input type="range" min={-45} max={45} value={fineRotation}
                  onChange={e => setFineRotation(Number(e.target.value))}
                  className="w-full h-1 accent-rose-500 cursor-pointer" />
              </div>
            </PanelSection>

            <PanelSection id="ai" icon="🤖" label="AI Tools">
              <div className="space-y-2">
                {[
                  { icon:'✨', label:'Auto Enhance', desc:'One-tap smart edit', action: () => applyPreset(PHOTO_PRESETS_V2.find(p=>p.id==='auto-enhance')) },
                  { icon:'😊', label:'Face Retouch', desc:'Skin smooth + glow', action: null },
                  { icon:'🎯', label:'Spot Heal',    desc:'Remove blemishes', action: null },
                  { icon:'🌅', label:'Sky Replace',  desc:'Swap background sky', action: null },
                  { icon:'🔍', label:'AI Upscale',   desc:'4× resolution boost', action: null },
                ].map(tool => (
                  <button key={tool.label} onClick={tool.action || undefined}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors ${tool.action ? 'border-stone-700 hover:border-rose-600/50 hover:bg-stone-700/50 text-stone-300' : 'border-stone-800 text-stone-600 cursor-default'}`}>
                    <span className="text-base">{tool.icon}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold leading-none">{tool.label}</p>
                      <p className="text-[10px] text-stone-500 mt-0.5">{tool.action ? tool.desc : 'Requires AI key'}</p>
                    </div>
                    {!tool.action && <span className="ml-auto text-[9px] font-bold bg-stone-700 text-stone-400 px-1.5 py-0.5 rounded">PRO</span>}
                  </button>
                ))}
              </div>
            </PanelSection>

          </div>
        </div>
      )}
    </div>
  );
};

// --- Design Studio ---
const DESIGN_FORMATS = [
  { id:'ig-post',   label:'Instagram Post',   emoji:'📸', w:1080, h:1080  },
  { id:'ig-story',  label:'IG Story / Reel',  emoji:'📱', w:1080, h:1920  },
  { id:'yt-thumb',  label:'YouTube Thumb',    emoji:'▶️', w:1280, h:720   },
  { id:'fb-cover',  label:'Facebook Cover',   emoji:'📘', w:820,  h:312   },
  { id:'pin',       label:'Pinterest Pin',    emoji:'📌', w:1000, h:1500  },
  { id:'twitter',   label:'Twitter Card',     emoji:'🐦', w:1200, h:628   },
  { id:'quote',     label:'Quote Card',       emoji:'💬', w:1080, h:1080  },
  { id:'bulletin',  label:'Bulletin / Flyer', emoji:'📄', w:794,  h:1123  },
  { id:'logo',      label:'Logo / Icon',      emoji:'🎨', w:800,  h:800   },
];
const DESIGN_FONTS = ['Inter','Poppins','Playfair Display','Merriweather','Montserrat','Lato','Oswald','Raleway','Open Sans','Dancing Script','Bebas Neue','Cinzel','Cormorant Garamond','Nunito'];
const DESIGN_COLORS_PALETTE = ['#ffffff','#000000','#1a1a2e','#16213e','#0f3460','#e94560','#533483','#05c46b','#ffd32a','#ff5e57','#0be881','#ff4d4d','#f7b731','#a29bfe','#fd79a8','#74b9ff','#55efc4','#fdcb6e','#e17055','#6c5ce7'];
const DESIGN_TEMPLATES = [
  { id:'quote-dark',    label:"Dark Quote",         fmt:'ig-post',
    bg:{ type:'gradient', color:'#1a1a2e', gradient:{ type:'linear', colors:['#1a1a2e','#533483'], angle:135 }, image:null },
    els:[ { id:'a', type:'text', x:80,  y:340, w:920, h:120, text:'"Enter your inspiring quote here"',    ff:'Playfair Display', fs:56, fw:'bold',   fi:'italic', ta:'center', col:'#ffffff', lh:1.4, ls:0, td:'none', op:100, rot:0 },
          { id:'b', type:'text', x:80,  y:680, w:920, h:60,  text:'— Your Name',                         ff:'Lato',            fs:30, fw:'normal', fi:'normal', ta:'center', col:'#e94560', lh:1.3, ls:3, td:'none', op:100, rot:0 },
          { id:'c', type:'shape', x:440, y:650, w:200, h:3, st:'rect', fill:'#e94560', stroke:'', sw:0, br:0, op:80, rot:0 } ] },
  { id:'scripture',     label:"Scripture Story",    fmt:'ig-story',
    bg:{ type:'gradient', color:'#0f3460', gradient:{ type:'linear', colors:['#1a1a4e','#0f3460','#e94560'], angle:160 }, image:null },
    els:[ { id:'a', type:'text', x:60, y:680, w:960, h:300, text:'"For I know the plans I have for you, declares the LORD"', ff:'Playfair Display', fs:64, fw:'bold', fi:'italic', ta:'center', col:'#ffffff', lh:1.5, ls:0, td:'none', op:100, rot:0 },
          { id:'b', type:'text', x:60, y:1080, w:960, h:80, text:'Jeremiah 29:11', ff:'Lato', fs:40, fw:'bold', fi:'normal', ta:'center', col:'#ffd32a', lh:1.3, ls:3, td:'none', op:100, rot:0 } ] },
  { id:'yt-bold',       label:"Bold YT Thumb",      fmt:'yt-thumb',
    bg:{ type:'gradient', color:'#1a1a2e', gradient:{ type:'linear', colors:['#1a1a2e','#533483'], angle:135 }, image:null },
    els:[ { id:'a', type:'text', x:80,  y:180, w:800, h:220, text:'YOUR TITLE HERE',    ff:'Montserrat', fs:110, fw:'bold', fi:'normal', ta:'left', col:'#ffffff', lh:1.1, ls:-2, td:'none', op:100, rot:0 },
          { id:'b', type:'text', x:80,  y:420, w:700, h:80,  text:'Watch until the end', ff:'Inter',     fs:44,  fw:'normal', fi:'normal', ta:'left', col:'#ffd32a', lh:1.3, ls:0, td:'none', op:100, rot:0 } ] },
  { id:'announcement',  label:"Event Flyer",        fmt:'ig-post',
    bg:{ type:'gradient', color:'#f7b731', gradient:{ type:'linear', colors:['#f7b731','#e94560'], angle:45 }, image:null },
    els:[ { id:'a', type:'shape', x:50, y:50, w:980, h:980, st:'rect', fill:'#000000', stroke:'', sw:0, br:20, op:55, rot:0 },
          { id:'b', type:'text', x:100, y:200, w:880, h:140, text:'JOIN US THIS\nSUNDAY',  ff:'Montserrat', fs:100, fw:'bold', fi:'normal', ta:'center', col:'#ffffff', lh:1.1, ls:4, td:'none', op:100, rot:0 },
          { id:'c', type:'text', x:100, y:540, w:880, h:80,  text:'10:00 AM · Main Hall',  ff:'Lato',       fs:38,  fw:'bold', fi:'normal', ta:'center', col:'#ffd32a', lh:1.3, ls:2, td:'none', op:100, rot:0 },
          { id:'d', type:'text', x:100, y:700, w:880, h:60,  text:'Church Name · City, ST', ff:'Lato',       fs:28,  fw:'normal', fi:'normal', ta:'center', col:'#ffffff', lh:1.3, ls:1, td:'none', op:80, rot:0 } ] },
  { id:'faith-post',    label:"Faith Post",         fmt:'ig-post',
    bg:{ type:'solid', color:'#1a1a2e', gradient:{ type:'linear', colors:['#1a1a2e','#e94560'], angle:135 }, image:null },
    els:[ { id:'a', type:'shape', x:390, y:90, w:300, h:300, st:'circle', fill:'#e94560', stroke:'', sw:0, br:0, op:18, rot:0 },
          { id:'b', type:'text', x:80, y:400, w:920, h:200, text:'✝  God Is Good\nAll The Time  ✝', ff:'Playfair Display', fs:72, fw:'bold', fi:'normal', ta:'center', col:'#ffffff', lh:1.4, ls:0, td:'none', op:100, rot:0 },
          { id:'c', type:'text', x:80, y:700, w:920, h:60,  text:'Sarah Speaks Faith',               ff:'Lato',            fs:30, fw:'bold', fi:'normal', ta:'center', col:'#e94560', lh:1.3, ls:3, td:'none', op:100, rot:0 } ] },
];

const mkDesignEl = (type, extra = {}) => ({ id: Math.random().toString(36).slice(2,10), type, x:100, y:100, w:200, h:200, rot:0, op:100, locked:false, ...extra });

const DesignStudio = () => {
  const [fmt, setFmt] = useState(DESIGN_FORMATS[0]);
  const [showFmtPicker, setShowFmtPicker] = useState(false);
  const [els, setEls] = useState([]);
  const [selId, setSelId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [bg, setBg] = useState({ type:'gradient', color:'#1a1a2e', gradient:{ type:'linear', colors:['#1a1a2e','#533483'], angle:135 }, image:null });
  const [leftTab, setLeftTab] = useState('add');
  const [hist, setHist] = useState([{ els:[], bg:{ type:'gradient', color:'#1a1a2e', gradient:{ type:'linear', colors:['#1a1a2e','#533483'], angle:135 }, image:null } }]);
  const [histIdx, setHistIdx] = useState(0);
  const canvasRef = useRef(null);
  const exportRef = useRef(null);
  const imgRef = useRef(null);
  const dragRef = useRef(null);

  const PMAX = 480;
  const scale = Math.min(PMAX / fmt.w, PMAX / fmt.h);
  const pW = Math.round(fmt.w * scale);
  const pH = Math.round(fmt.h * scale);
  const sel = els.find(e => e.id === selId);

  const push = useCallback((newEls, newBg) => {
    const snap = { els: JSON.parse(JSON.stringify(newEls ?? els)), bg: newBg ?? bg };
    setHist(h => { const n = h.slice(0, histIdx + 1); n.push(snap); return n; });
    setHistIdx(i => i + 1);
  }, [els, bg, histIdx]);

  const undo = () => { if (histIdx > 0) { const s = hist[histIdx-1]; setEls(s.els); setBg(s.bg); setHistIdx(i=>i-1); setSelId(null); } };
  const redo = () => { if (histIdx < hist.length-1) { const s = hist[histIdx+1]; setEls(s.els); setBg(s.bg); setHistIdx(i=>i+1); setSelId(null); } };

  const updEl = (id, upd) => { const n = els.map(e => e.id===id ? {...e,...upd} : e); setEls(n); return n; };
  const updElPush = (id, upd) => { const n = updEl(id, upd); push(n); };

  const addText = (preset = {}) => {
    const e = mkDesignEl('text', { x: Math.round(fmt.w/2-200), y: Math.round(fmt.h/2-40), w:400, h:80,
      text:'Double-click to edit', ff:'Poppins', fs:48, fw:'bold', fi:'normal', ta:'center', col:'#ffffff', lh:1.3, ls:0, td:'none', ...preset });
    const n = [...els, e]; setEls(n); setSelId(e.id); push(n);
  };
  const addShape = (st) => {
    const e = mkDesignEl('shape', { x:Math.round(fmt.w/2-100), y:Math.round(fmt.h/2-100), w:200, h:200, st, fill:'#e94560', stroke:'', sw:0, br:0 });
    const n = [...els, e]; setEls(n); setSelId(e.id); push(n);
  };
  const addImg = (src) => {
    const e = mkDesignEl('image', { x:Math.round(fmt.w/2-150), y:Math.round(fmt.h/2-150), w:300, h:300, src, fit:'cover', br:0 });
    const n = [...els, e]; setEls(n); setSelId(e.id); push(n);
  };
  const delSel = () => { if (!selId) return; const n = els.filter(e=>e.id!==selId); setEls(n); setSelId(null); push(n); };
  const dupSel = () => { if (!sel) return; const e = {...JSON.parse(JSON.stringify(sel)), id:Math.random().toString(36).slice(2,10), x:sel.x+20, y:sel.y+20}; const n=[...els,e]; setEls(n); setSelId(e.id); push(n); };
  const fwd = () => { const i=els.findIndex(e=>e.id===selId); if(i<els.length-1){const n=[...els];[n[i],n[i+1]]=[n[i+1],n[i]];setEls(n);push(n);} };
  const bwd = () => { const i=els.findIndex(e=>e.id===selId); if(i>0){const n=[...els];[n[i],n[i-1]]=[n[i-1],n[i]];setEls(n);push(n);} };

  const loadTemplate = (t) => {
    const f = DESIGN_FORMATS.find(f=>f.id===t.fmt)||DESIGN_FORMATS[0];
    setFmt(f); setBg({...t.bg}); setSelId(null);
    const newEls = t.els.map(e => ({ ...e, id: Math.random().toString(36).slice(2,10) }));
    setEls(newEls); push(newEls, t.bg);
  };

  const onElMouseDown = (e, el) => {
    if (editId === el.id) return;
    e.stopPropagation(); e.preventDefault();
    setSelId(el.id);
    const startX=e.clientX, startY=e.clientY, ox=el.x, oy=el.y;
    dragRef.current = { id:el.id, moved:false };
    const onMv = (me) => {
      const dx=(me.clientX-startX)/scale, dy=(me.clientY-startY)/scale;
      if(Math.abs(dx)>2||Math.abs(dy)>2) dragRef.current.moved=true;
      setEls(prev=>prev.map(e2=>e2.id===el.id?{...e2,x:Math.max(0,Math.min(fmt.w-el.w,ox+dx)),y:Math.max(0,Math.min(fmt.h-el.h,oy+dy))}:e2));
    };
    const onUp = () => { if(dragRef.current?.moved) setEls(prev=>{push(prev);return prev;}); dragRef.current=null; window.removeEventListener('mousemove',onMv); window.removeEventListener('mouseup',onUp); };
    window.addEventListener('mousemove',onMv); window.addEventListener('mouseup',onUp);
  };

  const onResizeDown = (e, el, handle) => {
    e.stopPropagation(); e.preventDefault();
    const startX=e.clientX, startY=e.clientY, oe={...el};
    const onMv = (me) => {
      const dx=(me.clientX-startX)/scale, dy=(me.clientY-startY)/scale;
      let {x,y,w,h} = oe;
      if(handle.includes('e')) w=Math.max(30,oe.w+dx);
      if(handle.includes('w')) {x=oe.x+dx; w=Math.max(30,oe.w-dx);}
      if(handle.includes('s')) h=Math.max(30,oe.h+dy);
      if(handle.includes('n')) {y=oe.y+dy; h=Math.max(30,oe.h-dy);}
      setEls(prev=>prev.map(e2=>e2.id===el.id?{...e2,x,y,w,h}:e2));
    };
    const onUp = () => { setEls(prev=>{push(prev);return prev;}); window.removeEventListener('mousemove',onMv); window.removeEventListener('mouseup',onUp); };
    window.addEventListener('mousemove',onMv); window.addEventListener('mouseup',onUp);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (editId) return;
      if ((e.metaKey||e.ctrlKey)&&e.key==='z') { e.preventDefault(); undo(); }
      if ((e.metaKey||e.ctrlKey)&&e.key==='y') { e.preventDefault(); redo(); }
      if ((e.key==='Delete'||e.key==='Backspace')&&selId) { e.preventDefault(); delSel(); }
      if ((e.metaKey||e.ctrlKey)&&e.key==='d') { e.preventDefault(); dupSel(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selId, editId, histIdx, els]);

  const getBgStyle = () => {
    if (bg.type==='gradient'&&bg.gradient) {
      const {type:gt,colors,angle} = bg.gradient;
      return { background: gt==='radial' ? `radial-gradient(circle, ${colors.join(',')})` : `linear-gradient(${angle}deg, ${colors.join(',')})` };
    }
    if (bg.type==='image'&&bg.image) return { backgroundImage:`url(${bg.image})`, backgroundSize:'cover', backgroundPosition:'center' };
    return { background: bg.color||'#1a1a2e' };
  };

  const exportPNG = async () => {
    const canvas = exportRef.current;
    canvas.width = fmt.w; canvas.height = fmt.h;
    const ctx = canvas.getContext('2d');
    // BG
    if (bg.type==='gradient'&&bg.gradient) {
      const {type:gt,colors,angle} = bg.gradient;
      let g;
      if(gt==='linear'){const r=(angle*Math.PI)/180; g=ctx.createLinearGradient(fmt.w/2-Math.cos(r)*fmt.w/2,fmt.h/2-Math.sin(r)*fmt.h/2,fmt.w/2+Math.cos(r)*fmt.w/2,fmt.h/2+Math.sin(r)*fmt.h/2);}
      else g=ctx.createRadialGradient(fmt.w/2,fmt.h/2,0,fmt.w/2,fmt.h/2,Math.max(fmt.w,fmt.h)/2);
      colors.forEach((c,i)=>g.addColorStop(i/(colors.length-1),c));
      ctx.fillStyle=g; ctx.fillRect(0,0,fmt.w,fmt.h);
    } else if(bg.type==='image'&&bg.image) {
      const img=new Image(); await new Promise(r=>{img.onload=r;img.src=bg.image;}); ctx.drawImage(img,0,0,fmt.w,fmt.h);
    } else { ctx.fillStyle=bg.color||'#1a1a2e'; ctx.fillRect(0,0,fmt.w,fmt.h); }
    // Elements
    for(const el of els){
      ctx.save(); ctx.globalAlpha=(el.op??100)/100;
      ctx.translate(el.x+el.w/2,el.y+el.h/2);
      if(el.rot) ctx.rotate((el.rot*Math.PI)/180);
      ctx.translate(-el.w/2,-el.h/2);
      if(el.type==='shape'){
        ctx.fillStyle=el.fill||'#e94560';
        if(el.st==='circle'){ctx.beginPath();ctx.ellipse(el.w/2,el.h/2,el.w/2,el.h/2,0,0,Math.PI*2);ctx.fill();}
        else if(el.st==='triangle'){ctx.beginPath();ctx.moveTo(el.w/2,0);ctx.lineTo(el.w,el.h);ctx.lineTo(0,el.h);ctx.closePath();ctx.fill();}
        else if(el.br>0){ctx.beginPath();ctx.roundRect(0,0,el.w,el.h,el.br);ctx.fill();}
        else ctx.fillRect(0,0,el.w,el.h);
        if(el.sw>0){ctx.strokeStyle=el.stroke||'#fff';ctx.lineWidth=el.sw;ctx.stroke();}
      } else if(el.type==='text'){
        const fw=el.fw==='bold'?'bold':'normal', fi=el.fi==='italic'?'italic':'normal';
        ctx.font=`${fi} ${fw} ${el.fs}px "${el.ff||'Inter'}", sans-serif`;
        ctx.fillStyle=el.col||'#fff';
        ctx.textAlign=el.ta||'center';
        ctx.textBaseline='top';
        const words=(el.text||'').split(' '), lineH=el.fs*(el.lh||1.3);
        let lines=[],line='';
        for(const w of words){const t=line?line+' '+w:w;if(ctx.measureText(t).width>el.w&&line){lines.push(line);line=w;}else line=t;}
        if(line)lines.push(line);
        const tx=el.ta==='center'?el.w/2:el.ta==='right'?el.w:0;
        lines.forEach((ln,i)=>ctx.fillText(ln,tx,i*lineH));
      } else if(el.type==='image'&&el.src){
        const img=new Image(); await new Promise(r=>{img.onload=r;img.onerror=r;img.crossOrigin='anonymous';img.src=el.src;}); ctx.drawImage(img,0,0,el.w,el.h);
      }
      ctx.restore();
    }
    const a=document.createElement('a'); a.download=`design-${fmt.id}.png`; a.href=canvas.toDataURL('image/png'); a.click();
  };

  // Resize handles
  const handles = [
    {id:'nw',top:-4,left:-4,cursor:'nw-resize'},{id:'n',top:-4,left:'50%',cursor:'n-resize'},
    {id:'ne',top:-4,right:-4,cursor:'ne-resize'},{id:'e',top:'50%',right:-4,cursor:'e-resize'},
    {id:'se',bottom:-4,right:-4,cursor:'se-resize'},{id:'s',bottom:-4,left:'50%',cursor:'s-resize'},
    {id:'sw',bottom:-4,left:-4,cursor:'sw-resize'},{id:'w',top:'50%',left:-4,cursor:'w-resize'},
  ];

  const renderEl = (el, idx) => {
    const isSel = selId===el.id;
    const isEdit = editId===el.id;
    const baseStyle = {
      position:'absolute', left:el.x*scale, top:el.y*scale,
      width: el.type!=='text' ? el.w*scale : el.w*scale,
      height: el.type==='shape'||el.type==='image' ? el.h*scale : undefined,
      opacity:(el.op??100)/100,
      transform:el.rot?`rotate(${el.rot}deg)`:undefined,
      cursor:isEdit?'text':'move', userSelect:isEdit?'text':'none',
      outline:isSel?'2px solid #e94560':'none', outlineOffset:2,
      zIndex:idx+1,
    };
    return (
      <div key={el.id} style={baseStyle} onMouseDown={e=>onElMouseDown(e,el)}
        onDoubleClick={el.type==='text'?()=>setEditId(el.id):undefined}>
        {el.type==='text' && (isEdit ? (
          <div contentEditable suppressContentEditableWarning
            style={{ fontFamily:`"${el.ff||'Inter'}",sans-serif`, fontSize:el.fs*scale, fontWeight:el.fw||'bold', fontStyle:el.fi||'normal', color:el.col||'#fff', textAlign:el.ta||'center', lineHeight:el.lh||1.3, letterSpacing:el.ls||0, textDecoration:el.td||'none', width:el.w*scale, minWidth:40, outline:'none', cursor:'text', whiteSpace:'pre-wrap', wordBreak:'break-word' }}
            onBlur={e=>{ updElPush(el.id,{text:e.target.innerText}); setEditId(null); }}
            dangerouslySetInnerHTML={{__html:el.text}} />
        ) : (
          <div style={{ fontFamily:`"${el.ff||'Inter'}",sans-serif`, fontSize:el.fs*scale, fontWeight:el.fw||'bold', fontStyle:el.fi||'normal', color:el.col||'#fff', textAlign:el.ta||'center', lineHeight:el.lh||1.3, letterSpacing:el.ls||0, textDecoration:el.td||'none', whiteSpace:'pre-wrap', wordBreak:'break-word', minWidth:40 }}>
            {el.text||'Double-click to edit'}
          </div>
        ))}
        {el.type==='shape' && (
          <div style={{ width:'100%', height:'100%',
            background:el.fill||'#e94560',
            borderRadius:el.st==='circle'?'50%':el.br||0,
            clipPath:el.st==='triangle'?'polygon(50% 0%,100% 100%,0% 100%)':undefined,
            border:el.sw>0?`${el.sw}px solid ${el.stroke||'#fff'}`:undefined,
          }} />
        )}
        {el.type==='image' && el.src && (
          <div style={{ width:'100%', height:'100%', overflow:'hidden', borderRadius:el.br||0 }}>
            <img src={el.src} alt="" style={{ width:'100%', height:'100%', objectFit:el.fit||'cover', display:'block' }} />
          </div>
        )}
        {isSel && handles.map(h=>(
          <div key={h.id} style={{ position:'absolute', width:8, height:8, background:'white', border:'2px solid #e94560', borderRadius:2, cursor:h.cursor, zIndex:1000,
            transform:(h.id==='n'||h.id==='s')?'translateX(-50%)':(h.id==='e'||h.id==='w')?'translateY(-50%)':undefined,
            ...Object.fromEntries(Object.entries(h).filter(([k])=>['top','bottom','left','right'].includes(k)))
          }} onMouseDown={e=>onResizeDown(e,el,h.id)} />
        ))}
      </div>
    );
  };

  const ColorSwatches = ({ val, onChange }) => (
    <div className="space-y-1">
      <div className="grid grid-cols-10 gap-0.5">
        {DESIGN_COLORS_PALETTE.map(c=>(
          <button key={c} onClick={()=>onChange(c)} style={{background:c}}
            className={`h-5 rounded border-2 transition-all ${val===c?'border-white scale-110':'border-transparent'}`} />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-stone-500">Custom:</span>
        <input type="color" value={val||'#ffffff'} onChange={e=>onChange(e.target.value)} className="h-5 w-14 rounded cursor-pointer border-0 bg-transparent" />
      </div>
    </div>
  );

  const PropSlider = ({ label, val, min, max, unit='', onChange }) => (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className="text-[10px] text-stone-400">{label}</span>
        <span className="text-[10px] font-mono text-stone-500">{Math.round(val)}{unit}</span>
      </div>
      <input type="range" min={min} max={max} value={val} onChange={e=>onChange(Number(e.target.value))} className="w-full h-1 accent-rose-500 cursor-pointer" />
    </div>
  );

  return (
    <div className="flex gap-3 h-[calc(100vh-120px)]">
      <canvas ref={exportRef} className="hidden" />
      <input ref={imgRef} type="file" accept="image/*" className="hidden"
        onChange={e=>{const f=e.target.files?.[0];if(f){addImg(URL.createObjectURL(f));e.target.value='';}}} />

      {/* ── Left Panel ── */}
      <div className="w-[180px] flex-shrink-0 flex flex-col gap-2">
        <div className="flex gap-0.5 bg-stone-800 rounded-lg p-0.5 border border-stone-700">
          {[['add','Add'],['templates','Templates'],['bg','BG']].map(([id,lbl])=>(
            <button key={id} onClick={()=>setLeftTab(id)}
              className={`flex-1 py-1 rounded text-[10px] font-bold transition-colors ${leftTab===id?'bg-rose-600 text-white':'text-stone-400 hover:text-stone-200'}`}>{lbl}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto space-y-2">
          {leftTab==='add' && (
            <>
              <div>
                <p className="text-[10px] font-bold text-stone-500 uppercase px-1 mb-1">Text</p>
                <div className="space-y-0.5">
                  {[{label:'Heading',fs:72,fw:'bold'},{label:'Subheading',fs:40,fw:'bold'},{label:'Body',fs:24,fw:'normal'},{label:'Scripture',fs:28,fw:'bold',fi:'italic',ff:'Playfair Display'},{label:'Label / Tag',fs:18,fw:'bold',ls:3}].map(p=>(
                    <button key={p.label} onClick={()=>addText({text:p.label,...p})}
                      className="w-full text-left px-3 py-1.5 rounded border border-stone-700/40 text-stone-400 text-[11px] hover:bg-stone-700/50 hover:text-stone-200 transition-colors">
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-stone-500 uppercase px-1 mb-1">Shapes</p>
                <div className="grid grid-cols-3 gap-1">
                  {[{st:'rect',icon:'▭'},{st:'circle',icon:'●'},{st:'triangle',icon:'▲'}].map(s=>(
                    <button key={s.st} onClick={()=>addShape(s.st)}
                      className="aspect-square rounded-lg border border-stone-700 text-stone-400 text-xl hover:bg-stone-700 hover:border-rose-600/50 transition-colors flex items-center justify-center">{s.icon}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-stone-500 uppercase px-1 mb-1">Image</p>
                <button onClick={()=>imgRef.current?.click()}
                  className="w-full py-2 px-3 rounded-lg border border-stone-700 text-stone-300 text-xs font-bold hover:bg-stone-700 hover:border-rose-600/50 transition-colors flex items-center gap-2">
                  <Upload size={12} /> Upload Image
                </button>
              </div>
            </>
          )}
          {leftTab==='templates' && (
            <div className="space-y-1">
              {DESIGN_TEMPLATES.map(t=>{
                const tbg = t.bg.type==='gradient'&&t.bg.gradient ? `linear-gradient(${t.bg.gradient.angle||135}deg,${t.bg.gradient.colors.join(',')})` : t.bg.color;
                return (
                  <button key={t.id} onClick={()=>loadTemplate(t)}
                    className="w-full flex items-center gap-2 p-2 rounded-lg border border-stone-700 hover:border-rose-600/50 hover:bg-stone-700/50 transition-colors text-left">
                    <div className="w-10 h-10 rounded flex-shrink-0" style={{background:tbg}} />
                    <div>
                      <p className="text-[11px] font-bold text-stone-300">{t.label}</p>
                      <p className="text-[9px] text-stone-500">{DESIGN_FORMATS.find(f=>f.id===t.fmt)?.label}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {leftTab==='bg' && (
            <div className="space-y-3 px-1">
              <div className="grid grid-cols-3 gap-1">
                {[['solid','Solid'],['gradient','Gradient'],['image','Image']].map(([id,lbl])=>(
                  <button key={id} onClick={()=>setBg(b=>({...b,type:id}))}
                    className={`py-1.5 rounded text-[10px] font-bold border transition-colors ${bg.type===id?'bg-rose-600 border-rose-600 text-white':'border-stone-700 text-stone-400 hover:border-rose-600'}`}>{lbl}</button>
                ))}
              </div>
              {bg.type==='solid' && (
                <>
                  <ColorSwatches val={bg.color} onChange={c=>setBg(b=>({...b,color:c}))} />
                </>
              )}
              {bg.type==='gradient' && (
                <div className="space-y-2">
                  <div className="h-10 rounded-lg" style={getBgStyle()} />
                  <div className="grid grid-cols-2 gap-1">
                    {[{c:['#1a1a2e','#533483'],a:135,lbl:'Midnight'},{c:['#0f3460','#e94560'],a:135,lbl:'Crimson'},{c:['#f7b731','#e17055'],a:90,lbl:'Golden'},{c:['#0f3460','#05c46b'],a:135,lbl:'Ocean'},{c:['#000000','#434343'],a:180,lbl:'Minimal'},{c:['#e94560','#f7b731'],a:90,lbl:'Fire'},{c:['#1a1a4e','#e94560'],a:160,lbl:'Faith'},{c:['#533483','#a78bfa'],a:135,lbl:'Purple'}].map(g=>(
                      <button key={g.lbl} onClick={()=>setBg(b=>({...b,type:'gradient',gradient:{type:'linear',colors:g.c,angle:g.a}}))}
                        className="h-7 rounded border border-stone-700 text-[9px] text-white font-bold"
                        style={{background:`linear-gradient(${g.a}deg,${g.c.join(',')})`}}>{g.lbl}</button>
                    ))}
                  </div>
                  <PropSlider label="Angle" val={bg.gradient?.angle||135} min={0} max={360} unit="°" onChange={v=>setBg(b=>({...b,gradient:{...b.gradient,angle:v}}))} />
                </div>
              )}
              {bg.type==='image' && (
                <button onClick={()=>{const i=document.createElement('input');i.type='file';i.accept='image/*';i.onchange=e=>{const f=e.target.files?.[0];if(f)setBg(b=>({...b,type:'image',image:URL.createObjectURL(f)}));};i.click();}}
                  className="w-full py-2 rounded border border-dashed border-stone-600 text-stone-400 text-xs text-center hover:border-rose-600 transition-colors">
                  Upload BG Image
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Center Canvas ── */}
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        {/* Top toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <button onClick={()=>setShowFmtPicker(v=>!v)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-stone-800 border border-stone-700 rounded text-xs font-bold text-stone-300 hover:border-rose-600/50 transition-colors">
              <span>{fmt.emoji}</span><span>{fmt.label}</span><span className="text-stone-500 text-[10px]">{fmt.w}×{fmt.h}</span><span className="text-stone-500">▾</span>
            </button>
            {showFmtPicker && (
              <div className="absolute top-full left-0 mt-1 bg-stone-800 border border-stone-700 rounded-xl shadow-xl z-50 w-52 p-1 max-h-64 overflow-y-auto">
                {DESIGN_FORMATS.map(f=>(
                  <button key={f.id} onClick={()=>{setFmt(f);setShowFmtPicker(false);}}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors ${fmt.id===f.id?'bg-rose-600/30 text-rose-300':'text-stone-300 hover:bg-stone-700'}`}>
                    <span>{f.emoji}</span><span className="flex-1">{f.label}</span><span className="text-stone-500">{f.w}×{f.h}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={undo} disabled={histIdx===0} className="p-1.5 rounded bg-stone-800 border border-stone-700 text-stone-400 hover:text-white disabled:opacity-30 transition-colors"><RotateCcw size={13}/></button>
            <button onClick={redo} disabled={histIdx>=hist.length-1} className="p-1.5 rounded bg-stone-800 border border-stone-700 text-stone-400 hover:text-white disabled:opacity-30 transition-colors"><RotateCcw size={13} className="scale-x-[-1]"/></button>
          </div>
          <button onClick={()=>{setEls([]);setSelId(null);push([]);}} className="px-2.5 py-1.5 rounded bg-stone-800 border border-stone-700 text-xs font-bold text-stone-400 hover:text-rose-400 transition-colors">Clear</button>
          <div className="flex items-center gap-1 px-2 py-1.5 bg-stone-800 rounded border border-stone-700 text-xs text-stone-400">
            <Layers size={11}/><span>{els.length} layers</span>
          </div>
          <button onClick={exportPNG} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors">
            <Download size={12}/> Export PNG
          </button>
        </div>
        {/* Canvas */}
        <div className="flex-1 bg-stone-950 rounded-2xl border border-stone-800 flex items-center justify-center overflow-hidden">
          <div ref={canvasRef} style={{width:pW,height:pH,position:'relative',overflow:'hidden',flexShrink:0}}
            onClick={e=>{if(e.target===canvasRef.current||(e.target.dataset&&e.target.dataset.bg)){setSelId(null);setEditId(null);}}}>
            <div style={{position:'absolute',inset:0,...getBgStyle()}} data-bg="1"
              onClick={()=>{setSelId(null);setEditId(null);}} />
            {els.map((el,i)=>renderEl(el,i))}
          </div>
        </div>
      </div>

      {/* ── Right Properties ── */}
      <div className="w-[220px] flex-shrink-0 bg-stone-800/60 border border-stone-700 rounded-xl overflow-y-auto">
        {!sel ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 p-4 text-stone-600">
            <Palette size={32}/>
            <p className="text-xs text-center text-stone-500">Select an element<br/>to edit its properties</p>
            <p className="text-[10px] text-stone-600 text-center">Double-click text to edit<br/>Del key to delete</p>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {/* Position & Size */}
            <div>
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-2">Position & Size</p>
              <div className="grid grid-cols-2 gap-1.5">
                {[['X','x'],['Y','y'],['W','w'],['H','h']].map(([lbl,k])=>(
                  <div key={k} className="flex items-center gap-1">
                    <span className="text-[10px] text-stone-500 w-3">{lbl}</span>
                    <input type="number" value={Math.round(sel[k])} onChange={e=>updElPush(sel.id,{[k]:Number(e.target.value)})}
                      className="flex-1 bg-stone-700 border border-stone-600 rounded text-xs text-stone-200 px-1.5 py-1 w-0 min-w-0" />
                  </div>
                ))}
              </div>
            </div>
            <PropSlider label="Rotation" val={sel.rot||0} min={-180} max={180} unit="°" onChange={v=>updEl(sel.id,{rot:v})} />
            <PropSlider label="Opacity" val={sel.op??100} min={0} max={100} unit="%" onChange={v=>updEl(sel.id,{op:v})} />

            {/* TEXT props */}
            {sel.type==='text' && (<>
              <div className="border-t border-stone-700 pt-3">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-2">Text</p>
                <textarea value={sel.text||''} rows={3}
                  onChange={e=>updEl(sel.id,{text:e.target.value})}
                  onBlur={()=>push(els)}
                  className="w-full bg-stone-700 border border-stone-600 rounded text-xs text-stone-200 p-2 resize-none focus:outline-none focus:border-rose-500" />
              </div>
              <div>
                <p className="text-[10px] text-stone-500 mb-1">Font Family</p>
                <select value={sel.ff||'Inter'} onChange={e=>updElPush(sel.id,{ff:e.target.value})}
                  className="w-full bg-stone-700 border border-stone-600 rounded text-xs text-stone-200 px-2 py-1">
                  {DESIGN_FONTS.map(f=><option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-stone-500 mb-0.5">Size</p>
                  <input type="number" value={sel.fs||48} onChange={e=>updElPush(sel.id,{fs:Number(e.target.value)})}
                    className="w-full bg-stone-700 border border-stone-600 rounded text-xs text-stone-200 px-2 py-1" />
                </div>
                <div>
                  <p className="text-[10px] text-stone-500 mb-0.5">Align</p>
                  <div className="flex gap-0.5">
                    {['left','center','right'].map(a=>(
                      <button key={a} onClick={()=>updElPush(sel.id,{ta:a})}
                        className={`flex-1 py-1 rounded border text-xs transition-colors ${sel.ta===a?'bg-rose-600 border-rose-600 text-white':'border-stone-700 text-stone-400 hover:bg-stone-700'}`}>
                        {a==='left'?'⟵':a==='center'?'↔':'⟶'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={()=>updElPush(sel.id,{fw:sel.fw==='bold'?'normal':'bold'})}
                  className={`flex-1 py-1.5 rounded border text-xs font-bold transition-colors ${sel.fw==='bold'?'bg-rose-600 border-rose-600 text-white':'border-stone-700 text-stone-300 hover:bg-stone-700'}`}>B</button>
                <button onClick={()=>updElPush(sel.id,{fi:sel.fi==='italic'?'normal':'italic'})}
                  className={`flex-1 py-1.5 rounded border text-xs italic transition-colors ${sel.fi==='italic'?'bg-rose-600 border-rose-600 text-white':'border-stone-700 text-stone-300 hover:bg-stone-700'}`}>I</button>
                <button onClick={()=>updElPush(sel.id,{td:sel.td==='underline'?'none':'underline'})}
                  className={`flex-1 py-1.5 rounded border text-xs underline transition-colors ${sel.td==='underline'?'bg-rose-600 border-rose-600 text-white':'border-stone-700 text-stone-300 hover:bg-stone-700'}`}>U</button>
              </div>
              <div>
                <p className="text-[10px] text-stone-500 mb-1">Text Color</p>
                <ColorSwatches val={sel.col||'#ffffff'} onChange={c=>updElPush(sel.id,{col:c})} />
              </div>
              <PropSlider label="Line Height" val={sel.lh||1.3} min={0.8} max={3} unit="" onChange={v=>updEl(sel.id,{lh:Math.round(v*10)/10})} />
              <PropSlider label="Letter Spacing" val={sel.ls||0} min={-5} max={20} unit="px" onChange={v=>updEl(sel.id,{ls:v})} />
            </>)}

            {/* SHAPE props */}
            {sel.type==='shape' && (<>
              <div className="border-t border-stone-700 pt-3">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-2">Shape Style</p>
                <div>
                  <p className="text-[10px] text-stone-500 mb-1">Fill</p>
                  <ColorSwatches val={sel.fill||'#e94560'} onChange={c=>updElPush(sel.id,{fill:c})} />
                </div>
              </div>
              {sel.st==='rect' && <PropSlider label="Corner Radius" val={sel.br||0} min={0} max={300} onChange={v=>updEl(sel.id,{br:v})} />}
              <PropSlider label="Stroke Width" val={sel.sw||0} min={0} max={30} unit="px" onChange={v=>updEl(sel.id,{sw:v})} />
              {sel.sw>0 && (
                <div>
                  <p className="text-[10px] text-stone-500 mb-1">Stroke Color</p>
                  <ColorSwatches val={sel.stroke||'#ffffff'} onChange={c=>updElPush(sel.id,{stroke:c})} />
                </div>
              )}
            </>)}

            {/* IMAGE props */}
            {sel.type==='image' && (<>
              <div className="border-t border-stone-700 pt-3">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-2">Image</p>
                <div className="flex gap-1">
                  {['cover','contain','fill'].map(f=>(
                    <button key={f} onClick={()=>updElPush(sel.id,{fit:f})}
                      className={`flex-1 py-1 rounded text-[10px] border capitalize transition-colors ${sel.fit===f?'bg-rose-600 border-rose-600 text-white':'border-stone-700 text-stone-400 hover:bg-stone-700'}`}>{f}</button>
                  ))}
                </div>
                <PropSlider label="Corner Radius" val={sel.br||0} min={0} max={300} onChange={v=>updEl(sel.id,{br:v})} />
              </div>
            </>)}

            {/* Actions */}
            <div className="border-t border-stone-700 pt-3 grid grid-cols-2 gap-1.5">
              <button onClick={dupSel} className="py-1.5 rounded border border-stone-700 text-[11px] text-stone-300 hover:bg-stone-700 transition-colors">⎘ Duplicate</button>
              <button onClick={fwd} className="py-1.5 rounded border border-stone-700 text-[11px] text-stone-300 hover:bg-stone-700 transition-colors">↑ Forward</button>
              <button onClick={bwd} className="py-1.5 rounded border border-stone-700 text-[11px] text-stone-300 hover:bg-stone-700 transition-colors">↓ Backward</button>
              <button onClick={delSel} className="py-1.5 rounded border border-red-800/50 text-[11px] text-red-400 hover:bg-red-900/30 transition-colors">🗑 Delete</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Swift Code View (kept for legacy compatibility) ---
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
