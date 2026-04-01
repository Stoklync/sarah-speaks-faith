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
import { AdobeExpressEditor } from './components/AdobeExpressEditor';
import { VideoTab } from './components/VideoPlanner';
import { CompetitorIntel } from './components/CompetitorIntel';
import { FloatingAIChat } from './components/FloatingAIChat';
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
  ArrowLeft,
  Download,
  Volume2,
  Palette,
  Bot,
  Loader2,
  CheckCircle,
  Lightbulb,
  Hash as HashIcon,
  Clock as ClockIcon,
  Flame,
  Users,
  Brain
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
  newBusinessDesc: '', setNewBusinessDesc: noop, newBusinessType: 'business', setNewBusinessType: noop,
  editingBrandId: null, setEditingBrandId: noop, editingBrandDesc: '', setEditingBrandDesc: noop, saveBrandDesc: noop,
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
        <div className="p-6 rounded-2xl bg-violet-50 dark:bg-stone-800 border border-violet-200 dark:border-stone-600 max-w-xl">
          <h3 className="font-bold text-rose-700 dark:text-violet-400 mb-2">Something went wrong in the editor</h3>
          <p className="text-sm text-stone-600 dark:text-stone-400 mb-4">{err?.message || String(err)}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })} className="px-4 py-2 rounded-xl bg-violet-500 text-white font-bold text-sm hover:bg-violet-600">Try again (your media is safe)</button>
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
    try { return localStorage.getItem('kreativelync-theme') || 'system'; } catch { return 'light'; }
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
    try { localStorage.setItem('kreativelync-theme', theme); } catch (_) {}
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
        const mainTrack = state.timelineTracks?.find(t => t.label === 'Main');
        const hasClips = (mainTrack?.clips || []).length > 0;

        if (!hasClips && state.assets?.length > 0) {
          // Place videos sequentially from 0 using explicit positions (not playhead-based)
          const vids = state.assets.filter(a => a.type === 'video');
          const trackId = mainTrack?.id;
          if (trackId) {
            let cursor = 0;
            vids.forEach((v) => {
              const asset = useEditorStore.getState().assets.find(a => a.id === v.id);
              const dur = asset?.duration || 60;
              useEditorStore.getState().addClipToTrack(trackId, v.id, cursor, dur);
              cursor += dur;
            });
          }
        } else if (hasClips) {
          // Fix overlapping clips: sort by startOffset, reposition each clip right after the previous
          const clips = [...(mainTrack.clips || [])].sort((a, b) => a.startOffset - b.startOffset);
          let cursor = 0;
          let needsFix = false;
          const fixed = clips.map(c => {
            const pos = cursor;
            if (Math.abs(c.startOffset - pos) > 0.5) needsFix = true;
            cursor = pos + (c.duration || 0);
            return { ...c, startOffset: pos };
          });
          if (needsFix) {
            useEditorStore.setState({
              timelineTracks: state.timelineTracks.map(t =>
                t.id === mainTrack.id ? { ...t, clips: fixed } : t
              )
            });
          }
        }
        useEditorStore.setState({ playhead: 0 });
      }, 200);
    });
  }, []);

  const [activeTab, setActiveTab] = useState(() => { try { return localStorage.getItem('kreativelync-active-tab') || 'pro'; } catch { return 'pro'; } });
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
  const [contactPageUrl, setContactPageUrl] = useState(() => { try { return localStorage.getItem('kreativelync-contact-url') || ''; } catch { return ''; } });
  const [marketingGoal, setMarketingGoal] = useState(() => { try { return localStorage.getItem('kreativelync-marketing-goal') || ''; } catch { return ''; } });
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');

  const [businesses, setBusinesses] = useState(() => {
    const defaults = [
      { id: 'kreativelync', name: 'Sarah Speaks Faith', type: 'faith', color: 'violet' },
      { id: 'stewardship', name: 'Her Stewardship', type: 'stewardship', color: 'emerald' },
      { id: 'stoklync', name: 'Stoklync', type: 'business', color: 'indigo' },
      { id: 'skin', name: 'Skin Products', type: 'business', color: 'amber' }
    ];
    try {
      const raw = localStorage.getItem('kreativelync-businesses');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // migrate: rename display name only, keep id as 'kreativelync' so connections stay intact
          const migrated = parsed.map(b => {
            if (!b) return b;
            // Fix any kreativelync entry — always ensure correct name and type
            if (b.id === 'kreativelync') {
              return { ...b, name: 'Sarah Speaks Faith', type: 'faith', color: 'violet' };
            }
            if (b.id === 'sarah') {
              return { ...b, id: 'kreativelync', name: 'Sarah Speaks Faith', type: 'faith', color: 'violet' };
            }
            return b;
          });
          const valid = migrated.filter(b => b && (b.id || b.name));
          if (valid.length > 0) return valid;
        }
      }
    } catch (_) {}
    return defaults;
  });
  const [activeBusinessId, setActiveBusinessId] = useState(() => { try { const id = localStorage.getItem('kreativelync-active-business') || 'kreativelync'; return id === 'sarah' ? 'kreativelync' : id; } catch { return 'kreativelync'; } });
  const [showAddBusiness, setShowAddBusiness] = useState(false);

  useEffect(() => {
    try { localStorage.setItem('kreativelync-active-tab', activeTab); } catch (_) {}
  }, [activeTab]);
  useEffect(() => {
    try { if (contactPageUrl) localStorage.setItem('kreativelync-contact-url', contactPageUrl); } catch (_) {}
  }, [contactPageUrl]);
  useEffect(() => {
    try { if (marketingGoal) localStorage.setItem('kreativelync-marketing-goal', marketingGoal); } catch (_) {}
  }, [marketingGoal]);
  useEffect(() => {
    try { localStorage.setItem('kreativelync-businesses', JSON.stringify(businesses)); } catch (_) {}
  }, [businesses]);
  useEffect(() => {
    if (activeBusinessId) localStorage.setItem('kreativelync-active-business', activeBusinessId);
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
  const [settingsTab, setSettingsTab] = useState('brand');
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [canvaKey, setCanvaKey] = useState(() => { try { return localStorage.getItem('kreativelync-canva-api-key') || ''; } catch { return ''; } });

  const primaryNav = [
    ['video', Film, 'Video'],
    ['design', Palette, 'Express Design'],
    ['pro', Zap, 'Content Studio'],
    ['social', Share2, 'Social & Podcast'],
    ['analytics', BarChart2, 'Analytics'],
    ['intel', Brain, 'Intelligence'],
  ];

  const [newBusinessType, setNewBusinessType] = useState('business');
  const [newBusinessDesc, setNewBusinessDesc] = useState('');
  const [editingBrandId, setEditingBrandId] = useState(null);
  const [editingBrandDesc, setEditingBrandDesc] = useState('');
  const addBusiness = () => {
    if (!newBusinessName.trim()) return;
    const id = 'b' + Date.now();
    const colorMap = { faith: 'rose', stewardship: 'emerald', business: 'indigo' };
    setBusinesses(prev => [...prev, { id, name: newBusinessName.trim(), type: newBusinessType, color: colorMap[newBusinessType] || 'stone', description: newBusinessDesc.trim() }]);
    setActiveBusinessId(id);
    setNewBusinessName('');
    setNewBusinessType('business');
    setNewBusinessDesc('');
    setShowAddBusiness(false);
  };
  const saveBrandDesc = (id, desc) => {
    setBusinesses(prev => prev.map(b => b.id === id ? { ...b, description: desc.trim() } : b));
    setEditingBrandId(null);
  };

  const clearAllData = () => {
    if (confirm('Clear all app data? This cannot be undone.')) {
      try { Object.keys(localStorage).filter(k => k.startsWith('kreativelync')).forEach(k => localStorage.removeItem(k)); } catch (_) {}
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
    newBusinessDesc,
    setNewBusinessDesc,
    newBusinessType,
    setNewBusinessType,
    editingBrandId,
    setEditingBrandId,
    editingBrandDesc,
    setEditingBrandDesc,
    saveBrandDesc,
    setActiveTab,
    theme,
    isDark,
    toggleTheme: cycleTheme,
    setSidebarOpen
  };

  return (
    <StudioContext.Provider value={value}>
      <div className="flex h-screen max-h-[100dvh] bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 font-sans selection:bg-violet-200 dark:selection:bg-rose-900/50 transition-colors overflow-hidden">
        {/* ── Sidebar ── collapsible on desktop, drawer on mobile */}
        <aside className={`fixed md:relative inset-y-0 left-0 h-full md:h-auto md:min-h-0 bg-white dark:bg-stone-900 border-r border-violet-100 dark:border-stone-800 flex flex-col justify-between overflow-y-auto overflow-x-hidden shadow-[2px_0_16px_rgba(225,29,72,0.04)] dark:shadow-none z-30 transition-all duration-200 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${sidebarCollapsed ? 'md:w-[60px]' : 'md:w-[220px]'}
          w-[220px]`}>
          {/* Logo / collapse toggle */}
          <div>
            <div className={`flex items-center border-b border-rose-50 dark:border-stone-800 ${sidebarCollapsed ? 'justify-center px-2 py-4' : 'justify-between px-4 py-4'}`}>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <h1 className="text-sm font-black tracking-widest text-stone-800 dark:text-stone-100 uppercase leading-tight">KreativeLync</h1>
                  <p className="text-[9px] text-violet-400 tracking-[0.18em] uppercase font-bold">KreativeLync Studio</p>
                </div>
              )}
              <button onClick={() => { setSidebarCollapsed(c => !c); setSidebarOpen(false); }}
                className="p-1.5 rounded-lg text-stone-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-stone-800 transition-colors shrink-0 hidden md:flex"
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
                      ? 'bg-violet-500 text-white shadow-sm shadow-rose-200 dark:shadow-none'
                      : 'text-stone-500 dark:text-stone-400 hover:bg-violet-50 dark:hover:bg-stone-800 hover:text-violet-600 dark:hover:text-violet-400'}`}>
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
              <div className="space-y-0.5 max-h-36 overflow-y-auto">
                {(businesses || []).filter(Boolean).map((b) => (
                  <div key={b.id || b.name} className={`flex items-center gap-1 rounded-lg transition-colors ${activeBusinessId === b.id ? 'bg-violet-100 dark:bg-rose-900/30' : 'hover:bg-stone-100 dark:hover:bg-stone-800'}`}>
                    <button onClick={() => setActiveBusinessId(b.id)}
                      className={`flex-1 text-left px-2.5 py-1.5 text-xs font-medium truncate transition-colors ${activeBusinessId === b.id ? 'text-rose-700 dark:text-violet-300' : 'text-stone-500 dark:text-stone-400'}`}>
                      {b.name || 'Business'}
                    </button>
                    <button onClick={() => { setEditingBrandId(b.id); setEditingBrandDesc(b.description || ''); }} title="Edit brand description for AI" className="px-1.5 py-1.5 text-stone-300 hover:text-violet-500 transition-colors flex-shrink-0" >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowAddBusiness(true)} className="w-full text-left px-2.5 py-1.5 text-xs font-bold text-violet-500 hover:text-violet-600 flex items-center gap-1">
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
          <header className="bg-white/80 dark:bg-stone-900/80 backdrop-blur-md sticky top-0 border-b border-violet-100 dark:border-stone-700 px-4 md:px-10 z-10 flex justify-between items-center gap-2 transition-colors shrink-0 py-4 md:py-6">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 -ml-2 rounded-xl text-stone-600 dark:text-stone-400 hover:bg-violet-50 dark:hover:bg-stone-700" aria-label="Open menu"><Menu size={24} /></button>
            <h2 className="font-semibold text-stone-800 dark:text-stone-100 tracking-tight flex items-center gap-3 flex-wrap flex-1 min-w-0 truncate text-lg md:text-2xl">
              <span>
                {activeTab === 'start' && 'Start Here'}
                {activeTab === 'photo-edit' && 'Photo Editor'}
                {activeTab === 'design' && 'Design Studio'}
                {activeTab === 'pro' && 'Content Studio'}
                {activeTab === 'social' && 'Social & Podcast'}
                {activeTab === 'traffic' && 'Traffic Links'}
                {activeTab === 'analytics' && 'Analytics'}
              </span>
              {(businesses || []).find(b => b && b.id === activeBusinessId) && ['photo-edit','design','pro','social','traffic','analytics'].includes(activeTab) && (
                <span className="text-sm font-normal text-violet-600 dark:text-violet-400 normal-case bg-violet-50 dark:bg-rose-900/20 px-3 py-1 rounded-full">Creating for: {(businesses || []).find(b => b && b.id === activeBusinessId)?.name || 'Unknown'}</span>
              )}
            </h2>
            <div className="flex items-center gap-4">
              <button onClick={cycleTheme} aria-label="Toggle theme" className="p-2 rounded-xl text-stone-500 dark:text-stone-400 hover:bg-violet-50 dark:hover:bg-stone-700 hover:text-violet-600 dark:hover:text-violet-400 transition-colors">
                {isDark ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <span className="flex items-center text-xs font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-rose-900/30 px-4 py-2 rounded-full border border-violet-100 dark:border-rose-800">
                <span className="w-2 h-2 rounded-full bg-violet-500 mr-2 animate-pulse"></span>
                System Online
              </span>
            </div>
          </header>
          )}

          {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={() => setShowSettings(false)}>
            <div className="bg-white dark:bg-stone-900 rounded-2xl w-full max-w-lg shadow-2xl border border-stone-200 dark:border-stone-700 my-8 overflow-hidden" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-stone-800">
                <h3 className="text-lg font-black text-stone-800 dark:text-stone-100">Settings</h3>
                <button onClick={() => setShowSettings(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 transition-colors">✕</button>
              </div>

              {(() => {
                const activeBiz = businesses.find(b => b.id === activeBusinessId);

                const BRAND_COLORS = ['#7c3aed','#e11d48','#0891b2','#059669','#d97706','#dc2626','#7c3aed','#4f46e5','#db2777','#000000'];

                return (
                  <div>
                    {/* Tabs */}
                    <div className="flex border-b border-stone-100 dark:border-stone-800 px-2">
                      {[['brand','Brand'],['connections','Connections'],['appearance','Appearance'],['data','Data']].map(([id, label]) => (
                        <button key={id} onClick={() => setSettingsTab(id)}
                          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${settingsTab === id ? 'border-violet-500 text-violet-600 dark:text-violet-400' : 'border-transparent text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'}`}>
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">

                      {/* ── Brand Tab ── */}
                      {settingsTab === 'brand' && activeBiz && (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Brand Name</label>
                            <input
                              defaultValue={activeBiz.name}
                              onBlur={e => setBusinesses(prev => prev.map(b => b.id === activeBusinessId ? { ...b, name: e.target.value.trim() || b.name } : b))}
                              className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-2.5 text-sm text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-violet-400"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Brand Type</label>
                            <div className="grid grid-cols-3 gap-2">
                              {[['business','💼 Business'],['faith','✝️ Faith'],['stewardship','💚 Stewardship']].map(([val, label]) => (
                                <button key={val} onClick={() => setBusinesses(prev => prev.map(b => b.id === activeBusinessId ? { ...b, type: val } : b))}
                                  className={`py-2 rounded-xl border text-xs font-bold transition-colors ${activeBiz.type === val ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300' : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:border-violet-300'}`}>
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Brand Description <span className="font-normal text-stone-400">(tells the AI exactly what you do)</span></label>
                            <textarea
                              defaultValue={activeBiz.description || ''}
                              onBlur={e => setBusinesses(prev => prev.map(b => b.id === activeBusinessId ? { ...b, description: e.target.value.trim() } : b))}
                              rows={3}
                              placeholder="What does this brand do? Who is the audience? What's the mission or product?"
                              className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-2.5 text-sm text-stone-800 dark:text-stone-100 placeholder-stone-400 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Brand Color</label>
                            <div className="flex flex-wrap gap-2 items-center">
                              {BRAND_COLORS.map(c => (
                                <button key={c} onClick={() => setBusinesses(prev => prev.map(b => b.id === activeBusinessId ? { ...b, brandColor: c } : b))}
                                  style={{ background: c }}
                                  className={`w-8 h-8 rounded-full border-2 transition-all ${activeBiz.brandColor === c ? 'border-stone-800 dark:border-white scale-110' : 'border-transparent hover:scale-105'}`}
                                />
                              ))}
                              <input type="color" value={activeBiz.brandColor || '#7c3aed'}
                                onChange={e => setBusinesses(prev => prev.map(b => b.id === activeBusinessId ? { ...b, brandColor: e.target.value } : b))}
                                className="w-8 h-8 rounded-full border border-stone-200 dark:border-stone-700 cursor-pointer bg-transparent"
                                title="Custom color"
                              />
                              <span className="text-xs text-stone-400 font-mono">{activeBiz.brandColor || '#7c3aed'}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ── Connections Tab ── */}
                      {settingsTab === 'connections' && (
                        <div className="space-y-4">
                          <div className="p-4 bg-stone-50 dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700">
                            <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-0.5">Adobe Express</p>
                            <p className="text-xs text-stone-400 mb-3">Required for Express Design tab — professional design templates</p>
                            <input
                              type="text"
                              defaultValue={localStorage.getItem('kreativelync-adobe-client-id') || ''}
                              onChange={e => localStorage.setItem('kreativelync-adobe-client-id', e.target.value.trim())}
                              placeholder="Adobe Client ID..."
                              className="w-full bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-400"
                            />
                            <a href="https://developer.adobe.com/express/embed-sdk/" target="_blank" rel="noopener noreferrer" className="text-xs text-red-500 hover:underline mt-1.5 inline-block">Get Client ID at developer.adobe.com →</a>
                          </div>
                          <div className="p-4 bg-stone-50 dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700">
                            <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-0.5">Social Accounts</p>
                            <p className="text-xs text-stone-400 mb-3">Connect Instagram and YouTube in the Analytics tab to sync your posts and audience data</p>
                            <button onClick={() => setShowSettings(false) || setActiveTab('analytics')}
                              className="px-4 py-2 rounded-xl bg-violet-500 text-white text-sm font-bold hover:bg-violet-600 transition-colors">
                              Go to Analytics → Connect
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ── Appearance Tab ── */}
                      {settingsTab === 'appearance' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-4 bg-stone-50 dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700">
                            <div>
                              <p className="text-sm font-bold text-stone-800 dark:text-stone-100">Dark Mode</p>
                              <p className="text-xs text-stone-400 mt-0.5">Switch between light and dark theme</p>
                            </div>
                            <button onClick={toggleTheme}
                              className={`w-12 h-6 rounded-full transition-colors relative ${isDark ? 'bg-violet-500' : 'bg-stone-200'}`}>
                              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isDark ? 'translate-x-6' : 'translate-x-0.5'}`} />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ── Data Tab ── */}
                      {settingsTab === 'data' && (
                        <div className="space-y-3">
                          <p className="text-xs text-stone-500 dark:text-stone-400">All your data is stored locally in your browser. Export a backup regularly.</p>
                          <button onClick={() => {
                            const data = {};
                            try { Object.keys(localStorage).filter(k => k.startsWith('kreativelync')).forEach(k => { data[k] = localStorage.getItem(k); }); } catch {}
                            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `kreativelync-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href);
                          }} className="w-full py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-sm font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">
                            Export Backup
                          </button>
                          <label className="block w-full py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-sm font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors text-center cursor-pointer">
                            Import Backup
                            <input type="file" accept=".json" className="hidden" onChange={(e) => {
                              const f = e.target.files?.[0]; if (!f) return;
                              const r = new FileReader();
                              r.onload = () => { try { const d = JSON.parse(r.result); Object.entries(d).forEach(([k, v]) => { if (k.startsWith('kreativelync') && v) localStorage.setItem(k, v); }); window.location.reload(); } catch { alert('Invalid backup file'); } };
                              r.readAsText(f);
                            }} />
                          </label>
                          <button onClick={clearAllData} className="w-full py-2.5 rounded-xl border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            Clear All Data
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="px-6 py-4 border-t border-stone-100 dark:border-stone-800">
                      <button onClick={() => setShowSettings(false)} className="w-full py-2.5 rounded-xl bg-violet-500 text-white font-bold hover:bg-violet-600 transition-colors">Done</button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

          {/* Add Business Modal */}
        {showAddBusiness && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-stone-800 rounded-2xl p-6 max-w-md w-full shadow-xl border border-violet-100 dark:border-stone-700">
              <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100 mb-1">Add Brand or Business</h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">Each brand gets its own AI coach, roadmap, notes, and chat history — completely separate.</p>
              <input value={newBusinessName} onChange={(e) => setNewBusinessName(e.target.value)} placeholder="Brand name (e.g. Stoklync, Skin Care Co, Client Brand)" className="w-full bg-violet-50 dark:bg-stone-700 border border-violet-100 dark:border-stone-600 rounded-xl px-4 py-3 text-stone-800 dark:text-stone-100 placeholder-stone-400 mb-3" />
              <p className="text-xs font-bold text-stone-500 mb-2">What type is this brand?</p>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { value: 'business', label: '💼 Business', desc: 'Sales, marketing, SEO, revenue' },
                  { value: 'faith', label: '✝️ Faith', desc: 'Ministry, gospel, community' },
                  { value: 'stewardship', label: '💚 Stewardship', desc: 'Faith + finances podcast' },
                ].map(opt => (
                  <button key={opt.value} onClick={() => setNewBusinessType(opt.value)} className={`p-3 rounded-xl border-2 text-left transition-all ${newBusinessType === opt.value ? 'border-violet-500 bg-violet-50 dark:bg-rose-900/20' : 'border-stone-200 dark:border-stone-600 hover:border-violet-300'}`}>
                    <p className="font-bold text-xs text-stone-800 dark:text-stone-100">{opt.label}</p>
                    <p className="text-xs text-stone-400 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
              {newBusinessType === 'business' && (
                <div className="mb-4">
                  <p className="text-xs font-bold text-stone-500 mb-1">Tell the AI about this business <span className="text-stone-400 font-normal">(so it knows exactly what to create)</span></p>
                  <textarea value={newBusinessDesc} onChange={e => setNewBusinessDesc(e.target.value)} rows={3} placeholder={`What does ${newBusinessName || 'this business'} sell or offer? Who is the target customer? What problem does it solve? What's the niche?`} className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-4 py-3 text-sm text-stone-800 dark:text-stone-100 placeholder-stone-400 resize-none" />
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => { setShowAddBusiness(false); setNewBusinessName(''); setNewBusinessType('business'); setNewBusinessDesc(''); }} className="flex-1 py-2 rounded-xl border border-stone-200 dark:border-stone-600 text-stone-600 dark:text-stone-400 font-medium">Cancel</button>
                <button onClick={addBusiness} className="flex-1 py-2 rounded-xl bg-violet-500 text-white font-bold hover:bg-violet-600">Add Brand</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Brand Description modal */}
        {editingBrandId && (() => {
          const eb = (businesses || []).find(b => b.id === editingBrandId);
          if (!eb) return null;
          const saveBrandField = (field, value) => setBusinesses(prev => prev.map(b => b.id === editingBrandId ? { ...b, [field]: value } : b));
          const BRAND_COLORS = ['#7c3aed','#e11d48','#0891b2','#059669','#d97706','#dc2626','#4f46e5','#db2777','#000000','#1e293b'];
          const VOICES = ['Inspirational','Conversational','Educational','Bold & Direct','Warm & Nurturing','Professional','Raw & Authentic','Motivational'];
          const GOALS = ['Grow audience','Build trust','Generate leads','Drive sales','Spread the gospel','Build community','Educate','Entertain'];
          const PLATFORMS = ['Instagram','YouTube','TikTok','Facebook','Pinterest','LinkedIn','Spotify','X (Twitter)'];

          return (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
              <div className="bg-white dark:bg-stone-900 rounded-2xl w-full max-w-lg shadow-2xl border border-stone-200 dark:border-stone-700 my-8 overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-stone-800">
                  <div>
                    <h3 className="text-lg font-black text-stone-800 dark:text-stone-100">Brand Kit — {eb.name}</h3>
                    <p className="text-xs text-stone-400 mt-0.5">Everything the AI uses to create content and strategy for this brand</p>
                  </div>
                  <button onClick={() => setEditingBrandId(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400">✕</button>
                </div>

                <div className="p-6 space-y-5 max-h-[72vh] overflow-y-auto">

                  {/* Name */}
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Brand Name</label>
                    <input defaultValue={eb.name}
                      onBlur={e => saveBrandField('name', e.target.value.trim() || eb.name)}
                      className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-2.5 text-sm text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                  </div>

                  {/* Type */}
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Brand Type</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[['business','💼 Business'],['faith','✝️ Faith'],['stewardship','💚 Stewardship']].map(([val, label]) => (
                        <button key={val} onClick={() => saveBrandField('type', val)}
                          className={`py-2 rounded-xl border text-xs font-bold transition-colors ${eb.type === val ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300' : 'border-stone-200 dark:border-stone-700 text-stone-500 hover:border-violet-300'}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Brand Color */}
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Brand Color</label>
                    <div className="flex flex-wrap gap-2 items-center">
                      {BRAND_COLORS.map(c => (
                        <button key={c} onClick={() => saveBrandField('brandColor', c)}
                          style={{ background: c }}
                          className={`w-8 h-8 rounded-full border-2 transition-all ${eb.brandColor === c ? 'border-stone-900 dark:border-white scale-110' : 'border-transparent hover:scale-105'}`} />
                      ))}
                      <input type="color" value={eb.brandColor || '#7c3aed'}
                        onChange={e => saveBrandField('brandColor', e.target.value)}
                        className="w-8 h-8 rounded-full border border-stone-200 dark:border-stone-700 cursor-pointer bg-transparent" title="Custom color" />
                      <span className="text-xs text-stone-400 font-mono">{eb.brandColor || '#7c3aed'}</span>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">What This Brand Does <span className="font-normal text-stone-400">(the AI's main context)</span></label>
                    <textarea defaultValue={eb.description || ''}
                      onBlur={e => saveBrandField('description', e.target.value.trim())}
                      rows={3} placeholder="Products/services, who you serve, what problem you solve, pricing, niche..."
                      className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-2.5 text-sm text-stone-800 dark:text-stone-100 placeholder-stone-400 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400" />
                  </div>

                  {/* Target Audience */}
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Target Audience</label>
                    <input defaultValue={eb.targetAudience || ''}
                      onBlur={e => saveBrandField('targetAudience', e.target.value.trim())}
                      placeholder="e.g. Christian women 25-45, single professionals, small business owners..."
                      className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-2.5 text-sm text-stone-800 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                  </div>

                  {/* Brand Voice */}
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Brand Voice</label>
                    <div className="flex flex-wrap gap-2">
                      {VOICES.map(v => (
                        <button key={v} onClick={() => saveBrandField('brandVoice', v)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${eb.brandVoice === v ? 'bg-violet-500 border-violet-500 text-white' : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:border-violet-300'}`}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Content Goals */}
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Content Goals <span className="font-normal text-stone-400">(pick all that apply)</span></label>
                    <div className="flex flex-wrap gap-2">
                      {GOALS.map(g => {
                        const goals = eb.contentGoals || [];
                        const active = goals.includes(g);
                        return (
                          <button key={g} onClick={() => saveBrandField('contentGoals', active ? goals.filter(x => x !== g) : [...goals, g])}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${active ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:border-indigo-300'}`}>
                            {g}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Active Platforms */}
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Active Platforms</label>
                    <div className="flex flex-wrap gap-2">
                      {PLATFORMS.map(p => {
                        const active = (eb.activePlatforms || []).includes(p);
                        return (
                          <button key={p} onClick={() => saveBrandField('activePlatforms', active ? (eb.activePlatforms||[]).filter(x=>x!==p) : [...(eb.activePlatforms||[]),p])}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${active ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:border-emerald-300'}`}>
                            {p}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Content Pillars */}
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Content Pillars <span className="font-normal text-stone-400">(3–5 core themes, comma separated)</span></label>
                    <input defaultValue={eb.contentPillars || ''}
                      onBlur={e => saveBrandField('contentPillars', e.target.value.trim())}
                      placeholder="e.g. Faith & prayer, Financial freedom, Business tips, Personal growth"
                      className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-2.5 text-sm text-stone-800 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                  </div>

                  {/* Website + Podcast */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Website</label>
                      <input defaultValue={eb.website || ''}
                        onBlur={e => saveBrandField('website', e.target.value.trim())}
                        placeholder="https://..."
                        className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2.5 text-sm text-stone-800 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Podcast Name</label>
                      <input defaultValue={eb.podcastName || ''}
                        onBlur={e => saveBrandField('podcastName', e.target.value.trim())}
                        placeholder="e.g. Her Stewardship"
                        className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2.5 text-sm text-stone-800 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                    </div>
                  </div>

                  {/* Main Social Handle */}
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Main Social Handle</label>
                    <input defaultValue={eb.socialHandle || ''}
                      onBlur={e => saveBrandField('socialHandle', e.target.value.trim())}
                      placeholder="@yourbrand"
                      className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-2.5 text-sm text-stone-800 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                  </div>

                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-stone-100 dark:border-stone-800 flex gap-2">
                  <button onClick={() => setEditingBrandId(null)} className="flex-1 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 font-semibold text-sm hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">Done</button>
                  {businesses.length > 1 && (
                    <button onClick={() => { if (confirm(`Delete ${eb.name}? This cannot be undone.`)) { setBusinesses(prev => prev.filter(b => b.id !== editingBrandId)); setEditingBrandId(null); } }}
                      className="px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-900/50 text-red-500 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                      Delete Brand
                    </button>
                  )}
                </div>

              </div>
            </div>
          );
        })()}

        <div className="mx-auto flex-1 min-h-0 flex flex-col max-w-7xl p-4 md:p-10 pb-24" style={{ minHeight: 400 }}>
            {activeTab === 'start' && <StartHere setActiveTab={setActiveTab} />}
            {activeTab === 'video' && <VideoTab businesses={businesses} activeBusinessId={activeBusinessId} setActiveTab={setActiveTab} />}
            {activeTab === 'design' && <AdobeExpressEditor />}
            {activeTab === 'pro' && <ProContentToolkit />}
            {activeTab === 'social' && <SocialPublisher />}
            {activeTab === 'traffic' && <TrafficHub />}
            {activeTab === 'analytics' && <PostAnalytics onOpenSettings={() => setShowSettings(true)} />}
            {activeTab === 'intel' && <CompetitorIntel businesses={businesses} activeBusinessId={activeBusinessId} />}
            {!['start','video','design','pro','social','traffic','analytics','intel'].includes(activeTab) && <StartHere setActiveTab={setActiveTab} />}
          </div>
        </main>
      </div>

      {/* Floating AI Chat — visible on every tab */}
      <FloatingAIChat businesses={businesses} activeBusinessId={activeBusinessId} />

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
          <div key={id} className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-6 flex items-start gap-4 hover:border-violet-200 dark:hover:border-stone-600 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-rose-900/30 flex items-center justify-center shrink-0">
              <Icon className="text-violet-500 dark:text-violet-400" size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100">{title}</h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">{desc}</p>
              <button onClick={() => setActiveTab(id)} className="mt-4 px-4 py-2 rounded-xl bg-violet-500 text-white text-sm font-bold hover:bg-violet-600">
                {cta} →
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-center text-sm text-stone-400 dark:text-stone-500 mt-10">Need camera tips? Go to <button onClick={() => setActiveTab('camera')} className="text-violet-500 font-bold hover:underline">Camera Guide</button>. Need hooks & hashtags? Go to <button onClick={() => setActiveTab('pro')} className="text-violet-500 font-bold hover:underline">Pro Content Toolkit</button>.</p>
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
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-stone-800 p-4 rounded-2xl border border-violet-100 dark:border-stone-700 shadow-sm transition-colors">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
          <input
            type="text"
            value={librarySearch}
            onChange={(e) => setLibrarySearch(e.target.value)}
            placeholder="Search videos, reels, or audio..."
            className="w-full bg-violet-50/50 dark:bg-stone-700/50 border border-violet-100 dark:border-stone-600 rounded-xl pl-10 pr-4 py-2.5 text-sm text-stone-800 dark:text-stone-100 focus:outline-none focus:border-violet-400 dark:focus:border-violet-500 transition-colors"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {['all', 'video', 'audio', 'image'].map((f) => (
            <button
              key={f}
              onClick={() => setLibraryFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors capitalize ${libraryFilter === f ? 'bg-violet-500 text-white' : 'bg-violet-50 text-stone-600 hover:bg-violet-100'}`}
            >
              {f}
            </button>
          ))}
          <input ref={fileRef} type="file" multiple accept="video/*,audio/*,image/*" onChange={handleUpload} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            className="px-5 py-2 rounded-xl text-sm font-bold bg-violet-500 text-white hover:bg-violet-600 flex items-center gap-2"
          >
            <Upload size={16} /> Upload
          </button>
        </div>
      </div>

      {filteredAssets.length === 0 ? (
        <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-3xl p-16 text-center transition-colors">
          <Film className="mx-auto text-rose-200 dark:text-violet-600/40 w-16 h-16 mb-4" />
          <h3 className="text-xl font-semibold text-stone-800 dark:text-stone-100 mb-2">No media yet</h3>
          <p className="text-stone-500 dark:text-stone-400 mb-6">Upload videos, audio, or images to get started.</p>
          <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 bg-violet-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-violet-600">
            <Upload size={18} /> Upload Files
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssets.map((a) => (
            <div key={a.id} className={`rounded-2xl overflow-hidden transition-all group ${selectedVideoId === a.id || selectedAudioId === a.id || selectedImageId === a.id ? 'ring-2 ring-violet-500 ring-offset-2 dark:ring-offset-stone-900 bg-violet-50/50 dark:bg-rose-900/20 border-2 border-violet-400 dark:border-rose-600' : 'bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 hover:border-violet-300 dark:hover:border-rose-700'}`}>
              <div className="aspect-video bg-stone-900 dark:bg-black relative flex items-center justify-center overflow-hidden">
                {a.type === 'video' && (
                  <video src={a.url} muted playsInline preload="auto" onLoadedMetadata={(e) => { const v = e.target; if (v.duration > 0.5) v.currentTime = 0.5; }} className="w-full h-full object-contain" />
                )}
                {a.type === 'audio' && <Music className="text-emerald-300 w-12 h-12" />}
                {a.type === 'image' && (
                  <img src={a.url} alt={a.altText || generateAltText((businesses || []).find(b => b?.id === activeBusinessId)?.name)} className="w-full h-full object-cover" />
                )}
                {a.type === 'video' && <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Play className="text-white w-14 h-14 drop-shadow-lg" /></div>}
                <button onClick={() => removeAsset(a.id)} className="absolute top-2 right-2 p-2 bg-violet-500/90 rounded-lg text-white opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
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
                        <span className="text-xs font-bold text-violet-600 dark:text-violet-400">✓ Source</span>
                        <button onClick={() => setActiveTab('classic')} className="text-xs font-bold text-white bg-violet-500 hover:bg-violet-600 px-3 py-1 rounded-lg">Edit in Timeline →</button>
                      </>
                    ) : (
                      <button onClick={() => { setSelectedVideoId(a.id); setActiveTab('classic'); }} className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline">Use as source</button>
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
                      <button onClick={() => setSelectedImageId(selectedImageId === a.id ? null : a.id)} className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline">
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
                        <button onClick={async () => { if (applyingFilters) return; setApplyingFilters(true); try { const { blob, url } = await processImage(a.id, imageFilters); updateAssetBlob(a.id, blob); revoke(url); } finally { setApplyingFilters(false); } }} disabled={applyingFilters} className="mt-1 text-xs font-bold bg-violet-500 text-white px-2 py-1 rounded disabled:opacity-50">{applyingFilters ? 'Applying…' : 'Apply'}</button>
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

  const colorMap = { rose: 'bg-violet-50 text-violet-600 dark:bg-rose-900/30 dark:text-violet-400', emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400', indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400', amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400', stone: 'bg-stone-100 text-stone-700 dark:bg-stone-700 dark:text-stone-300' };

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
        <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-3xl p-8 shadow-sm transition-colors">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-semibold text-stone-800 flex items-center">
                <Instagram className="mr-2 text-violet-400" size={24} />
                Instagram Grid
              </h3>
              <p className="text-sm text-stone-500 mt-1">Upload and plan your layout.</p>
            </div>
            <input ref={igRef} type="file" multiple accept="image/*" onChange={handleIgUpload} className="hidden" />
            <button onClick={() => igRef.current?.click()} className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-violet-500 hover:bg-violet-600">
              + New Post
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {igPosts.length === 0 && (
              <div className="col-span-3 aspect-square rounded-2xl border-2 border-dashed border-violet-200 flex flex-col items-center justify-center text-stone-400 cursor-pointer hover:border-violet-400 hover:bg-violet-50/50" onClick={() => igRef.current?.click()}>
                <ImageIcon size={32} className="mb-2" />
                <span className="text-sm font-medium">Upload images</span>
              </div>
            )}
            {igPosts.slice(0, 9).map((p) => (
              <div key={p.id} className="aspect-square rounded-2xl border border-violet-100 overflow-hidden relative group">
                <img src={p.url} alt={p.altText || generateAltText(businessName)} className="w-full h-full object-cover" />
                <input value={p.altText || ''} onChange={(e) => setIgPosts(prev => prev.map(x => x.id === p.id ? { ...x, altText: e.target.value } : x))} placeholder="Alt text for SEO" className="absolute bottom-0 left-0 right-0 text-[10px] px-2 py-1 bg-black/70 text-white placeholder-stone-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                <button onClick={() => setIgPosts(prev => prev.filter(x => x.id !== p.id))} className="absolute top-1 right-1 p-1.5 bg-violet-500/90 rounded-lg text-white opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-3xl p-8 shadow-sm transition-colors">
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
            <button onClick={() => pinRef.current?.click()} className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-violet-500 hover:bg-violet-600">
              + New Pin
            </button>
          </div>
          <div className="space-y-4">
            {pinterestPins.length === 0 && (
              <div className="p-8 rounded-2xl border-2 border-dashed border-violet-200 text-center text-stone-400 cursor-pointer hover:border-violet-400 hover:bg-violet-50/50" onClick={() => pinRef.current?.click()}>
                <ImageIcon size={32} className="mx-auto mb-2" />
                <span className="text-sm font-medium">Upload pin images</span>
              </div>
            )}
            {pinterestPins.map((p) => (
              <div key={p.id} className="flex gap-4 p-4 rounded-2xl border border-violet-100 bg-violet-50/50 group">
                <div className="w-20 h-28 rounded-xl flex-shrink-0 overflow-hidden bg-violet-100">
                  <img src={p.url} alt={p.altText || generateAltText(businessName)} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <input value={p.title || ''} onChange={(e) => setPinterestPins(prev => prev.map(x => x.id === p.id ? { ...x, title: e.target.value } : x))} placeholder="Pin title" className="w-full text-sm font-bold text-stone-800 dark:text-stone-100 bg-transparent border-b border-transparent hover:border-violet-200 focus:border-violet-400 focus:outline-none mb-1" />
                  <input value={p.altText || ''} onChange={(e) => setPinterestPins(prev => prev.map(x => x.id === p.id ? { ...x, altText: e.target.value } : x))} placeholder="Alt text (SEO)" className="w-full text-xs text-stone-500 dark:text-stone-400 bg-transparent border-b border-transparent hover:border-violet-200 focus:border-violet-400 focus:outline-none mb-1" />
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

// ---- Shared planner saves hook ----
const usePlannerSaves = (storageKey) => {
  const [saves, setSaves] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { return []; }
  });
  const persist = (updated) => {
    setSaves(updated);
    try { localStorage.setItem(storageKey, JSON.stringify(updated)); } catch (_) {}
  };
  const saveItem = (title, body) => {
    const item = { id: Date.now().toString(), title, body, pinned: false, savedAt: Date.now() };
    persist([item, ...saves]);
  };
  const togglePin = (id) => persist(saves.map(s => s.id === id ? { ...s, pinned: !s.pinned } : s));
  const deleteItem = (id) => persist(saves.filter(s => s.id !== id));
  const sorted = [...saves].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.savedAt - a.savedAt);
  return { sorted, saveItem, togglePin, deleteItem };
};

const PlannerSavesList = ({ saves, togglePin, deleteItem, accentColor = 'rose' }) => {
  const [copiedId, setCopiedId] = useState(null);
  if (saves.length === 0) return null;
  return (
    <div className="space-y-3 pt-2">
      <p className="text-xs font-bold text-stone-400 uppercase">📌 Saved ({saves.length})</p>
      {saves.map(s => (
        <div key={s.id} className={`rounded-2xl border-2 p-4 ${s.pinned ? 'border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/10' : 'border-stone-100 dark:border-stone-700 bg-white dark:bg-stone-800'}`}>
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="font-bold text-stone-800 dark:text-stone-100 text-sm">{s.title}</p>
            <p className="text-xs text-stone-400 shrink-0">{new Date(s.savedAt).toLocaleDateString()}</p>
          </div>
          <p className="text-xs text-stone-600 dark:text-stone-300 whitespace-pre-wrap leading-relaxed mb-3 line-clamp-4">{s.body}</p>
          <div className="flex gap-3 pt-2 border-t border-stone-100 dark:border-stone-700">
            <button onClick={() => togglePin(s.id)} className={`text-xs font-bold ${s.pinned ? 'text-amber-500' : 'text-stone-400 hover:text-amber-500'}`}>{s.pinned ? '📌 Pinned' : 'Pin'}</button>
            <button onClick={() => { navigator.clipboard.writeText(s.body); setCopiedId(s.id); setTimeout(()=>setCopiedId(null),2000); }} className="text-xs text-stone-400 hover:text-violet-500 font-bold">{copiedId===s.id ? '✓ Copied' : 'Copy'}</button>
            <button onClick={() => { if(confirm('Delete?')) deleteItem(s.id); }} className="text-xs text-stone-400 hover:text-red-500 font-bold">Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
};

// ---- Poll & Engagement Creator ----
const PollEngagementCreator = ({ bizName, bizType, bizDesc }) => {
  const [pollType, setPollType] = useState('poll');
  const [topic, setTopic] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const { sorted: saves, saveItem, togglePin, deleteItem } = usePlannerSaves(`kreativelync-planner-polls-${bizName}`);

  const pollTypes = [
    { id: 'poll', label: '📊 Instagram Poll', desc: 'Yes/No or A vs B poll for Stories' },
    { id: 'question', label: '❓ Question Sticker', desc: 'Open question for Stories engagement' },
    { id: 'quiz', label: '🧠 Quiz Sticker', desc: '4-option quiz for Stories' },
    { id: 'carousel', label: '🎠 Engagement Carousel', desc: 'Swipeable post that drives saves & shares' },
    { id: 'debate', label: '🔥 Debate Post', desc: 'Controversial (but safe) take that drives comments' },
    { id: 'challenge', label: '🏆 Challenge/CTA', desc: 'Action-based post that grows your community' },
  ];

  const generate = async () => {
    if (!topic.trim()) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const r = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'chat',
          topic,
          brandName: bizName,
          brandType: bizType,
          brandDesc: bizDesc,
          chatHistory: [{
            role: 'user',
            text: `Create a "${pollTypes.find(p=>p.id===pollType)?.label}" for ${bizName} about: ${topic}

${pollType === 'poll' ? `Give me:
POLL QUESTION: [the question]
OPTION A: [first option]
OPTION B: [second option]
CAPTION: [short caption to post with it]
WHY THIS WORKS: [why this will get engagement]` :
pollType === 'question' ? `Give me:
QUESTION: [the open question]
CONTEXT CAPTION: [1-2 sentences to post before the question sticker]
FOLLOW UP: [what to do with the responses — story idea, DM strategy, etc]
WHY THIS WORKS: [why this drives engagement]` :
pollType === 'quiz' ? `Give me:
QUIZ QUESTION: [the question]
CORRECT ANSWER: [the right answer]
WRONG OPTION 1: [plausible wrong answer]
WRONG OPTION 2: [plausible wrong answer]
WRONG OPTION 3: [plausible wrong answer]
CAPTION: [short teaser caption]
WHY THIS WORKS: [why this drives engagement]` :
pollType === 'carousel' ? `Give me a full carousel post:
SLIDE 1 (Hook): [what to show/say on slide 1 to stop the scroll]
SLIDE 2: [content]
SLIDE 3: [content]
SLIDE 4: [content]
SLIDE 5: [content]
SLIDE 6 (CTA): [save this, share with a friend, or comment]
CAPTION: [full caption with hashtags]
DESIGN TIP: [visual direction for Canva]` :
pollType === 'debate' ? `Give me:
THE TAKE: [the debatable opinion — bold but not offensive]
CAPTION: [full caption presenting both sides, asking audience to weigh in]
HOOK LINE: [first line that stops the scroll]
COMMENT CTA: [exactly what to ask in comments]
HASHTAGS: [15-20 relevant hashtags]` :
`Give me:
CHALLENGE NAME: [name of the challenge or CTA]
WHAT TO DO: [exactly what you're asking your audience to do]
CAPTION: [full post caption with the challenge/CTA]
HOOK: [first line]
COMMUNITY ANGLE: [how this builds community or loyalty]
HASHTAGS: [15-20 hashtags]`}

Make it specific to ${bizName}'s audience and niche. Not generic — this should feel native to the brand.`
          }]
        })
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setResult(data.reply);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-3xl p-6 space-y-4">
      <h3 className="font-bold text-stone-800 dark:text-stone-100 text-lg">📊 Polls & Engagement Creator</h3>
      <p className="text-xs text-stone-400">Create polls, quizzes, debate posts, and carousels that drive real engagement — not just likes.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {pollTypes.map(pt => (
          <button key={pt.id} onClick={() => setPollType(pt.id)} className={`p-3 rounded-xl border-2 text-left transition-all ${pollType === pt.id ? 'border-violet-500 bg-violet-50 dark:bg-rose-900/20' : 'border-stone-200 dark:border-stone-600 hover:border-violet-300'}`}>
            <p className="font-bold text-xs text-stone-800 dark:text-stone-100">{pt.label}</p>
            <p className="text-xs text-stone-400 mt-0.5">{pt.desc}</p>
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === 'Enter' && generate()} placeholder={`Topic for your ${pollTypes.find(p=>p.id===pollType)?.label}…`} className="flex-1 bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-4 py-2 text-sm" />
        <button onClick={generate} disabled={loading || !topic.trim()} className="px-5 py-2 bg-violet-500 text-white rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-violet-600 whitespace-nowrap">
          {loading ? <Loader2 size={14} className="animate-spin" /> : 'Generate ✨'}
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {result && (
        <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-700/40 border border-stone-200 dark:border-stone-600 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs font-bold text-violet-500 uppercase">Your {pollTypes.find(p=>p.id===pollType)?.label}</p>
            <div className="flex gap-2">
              <button onClick={() => saveItem(`${pollTypes.find(p=>p.id===pollType)?.label}: ${topic}`, result)} className="text-xs text-violet-500 font-bold hover:text-violet-700">📌 Save</button>
              <button onClick={() => { navigator.clipboard.writeText(result); setCopied(true); setTimeout(()=>setCopied(false),2000); }} className="text-xs text-violet-500 font-bold">{copied ? '✓ Copied' : 'Copy all'}</button>
            </div>
          </div>
          <p className="text-sm text-stone-700 dark:text-stone-200 whitespace-pre-wrap leading-relaxed">{result}</p>
        </div>
      )}
      <PlannerSavesList saves={saves} togglePin={togglePin} deleteItem={deleteItem} />
    </div>
  );
};

// ---- Podcast Planner ----
const PodcastPlanner = ({ bizName, bizType, bizDesc }) => {
  const [planMode, setPlanMode] = useState('episode');
  const [topic, setTopic] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const { sorted: saves, saveItem, togglePin, deleteItem } = usePlannerSaves(`kreativelync-planner-podcast-${bizName}`);

  const modes = [
    { id: 'episode', label: '🎙️ Episode Plan', desc: 'Full episode structure & talking points' },
    { id: 'shownotes', label: '📝 Show Notes', desc: 'SEO-ready show notes + timestamps' },
    { id: 'titles', label: '✨ Episode Titles', desc: '10 title options that get clicks' },
    { id: 'series', label: '📚 Series Plan', desc: 'Multi-episode series around a theme' },
    { id: 'promo', label: '📣 Promo Content', desc: 'Reels, captions & clips to promote the episode' },
  ];

  const generate = async () => {
    if (!topic.trim()) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const r = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'chat',
          topic,
          brandName: bizName || 'Her Stewardship',
          brandType: bizType || 'stewardship',
          brandDesc: bizDesc,
          chatHistory: [{
            role: 'user',
            text: planMode === 'episode' ?
`Plan a full podcast episode for "${bizName || 'Her Stewardship'}" about: ${topic}

EPISODE TITLE: [compelling title]
EPISODE HOOK (first 60 seconds): [exactly what to say to open the episode and hook the listener]
INTRO: [2-3 minute intro — welcome, what this episode covers, why it matters]
SEGMENT 1 — [title]: [talking points and key ideas]
SEGMENT 2 — [title]: [talking points and key ideas]
SEGMENT 3 — [title]: [talking points and key ideas]
LISTENER ACTION (CTA): [what you want listeners to do by end of episode]
OUTRO: [how to close — subscribe ask, next episode tease, prayer/blessing if faith-based]
GUEST ANGLE: [would a guest work? Who type? What questions to ask?]
EPISODE LENGTH SUGGESTION: [recommended runtime and why]` :

planMode === 'shownotes' ?
`Write SEO-optimised show notes for a "${bizName || 'Her Stewardship'}" episode about: ${topic}

EPISODE TITLE: [SEO title with keyword]
EPISODE SUMMARY: [2-3 sentence description for podcast platforms]
WHAT YOU'LL LEARN: [3-5 bullet points]
TIMESTAMPS:
00:00 - Intro
[fill in logical timestamps]
KEY TAKEAWAYS: [3-5 actionable takeaways]
RESOURCES MENTIONED: [placeholder for links]
CONNECT WITH US: [placeholder for social links]
KEYWORDS: [10-15 search keywords this episode should rank for]` :

planMode === 'titles' ?
`Give me 10 episode title options for "${bizName || 'Her Stewardship'}" about: ${topic}

Mix these styles:
- Number-based ("5 Ways to...")
- Question-based ("Why Are You...")
- Bold statement
- Story-based ("How I...")
- Curiosity gap ("The One Thing...")

For each title, give a 1-line note on why it will get clicks.` :

planMode === 'series' ?
`Plan a podcast series for "${bizName || 'Her Stewardship'}" about: ${topic}

SERIES NAME: [title]
SERIES CONCEPT: [what the whole series covers and why listeners need it]
TARGET LISTENER: [who this is for, where they are in their journey]
EPISODE 1: [title + 2-sentence description]
EPISODE 2: [title + 2-sentence description]
EPISODE 3: [title + 2-sentence description]
EPISODE 4: [title + 2-sentence description]
EPISODE 5: [title + 2-sentence description]
EPISODE 6 (Finale): [title + 2-sentence description]
LAUNCH STRATEGY: [how to announce and promote the series]` :

`Create promotional content for a "${bizName || 'Her Stewardship'}" episode about: ${topic}

INSTAGRAM REEL HOOK (for a 15-30 sec clip): [exact words to say]
REEL CAPTION: [caption + hashtags]
INSTAGRAM STORY TEXT: [text for story announcing the episode]
PULL QUOTE (for graphic): [the most shareable quote from this episode topic]
EMAIL SUBJECT LINE: [subject line to send to email list]
YOUTUBE DESCRIPTION INTRO: [first 3 sentences for YouTube description]`
          }]
        })
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setResult(data.reply);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-3xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div>
          <h3 className="font-bold text-stone-800 dark:text-stone-100 text-lg">🎙️ Podcast Planner</h3>
          <p className="text-xs text-stone-400">Plan episodes, write show notes, create promo content — for Her Stewardship or any podcast brand.</p>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {modes.map(m => (
          <button key={m.id} onClick={() => { setPlanMode(m.id); setResult(null); }} className={`px-3 py-1.5 rounded-xl text-sm font-bold border transition-all ${planMode === m.id ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-stone-50 dark:bg-stone-700 border-stone-200 dark:border-stone-600 text-stone-600 dark:text-stone-300 hover:border-emerald-300'}`}>{m.label}</button>
        ))}
      </div>
      <p className="text-xs text-stone-400">{modes.find(m=>m.id===planMode)?.desc}</p>
      <div className="flex gap-2">
        <input value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === 'Enter' && generate()} placeholder={planMode === 'series' ? 'Series theme (e.g. "Financial freedom through faith")' : 'Episode topic (e.g. "How to tithe when you\'re broke")'} className="flex-1 bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-4 py-2 text-sm" />
        <button onClick={generate} disabled={loading || !topic.trim()} className="px-5 py-2 bg-emerald-500 text-white rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-emerald-600 whitespace-nowrap">
          {loading ? <Loader2 size={14} className="animate-spin" /> : 'Generate ✨'}
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {result && (
        <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-700/40 border border-stone-200 dark:border-stone-600 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs font-bold text-emerald-600 uppercase">{modes.find(m=>m.id===planMode)?.label}</p>
            <div className="flex gap-2">
              <button onClick={() => saveItem(`${modes.find(m=>m.id===planMode)?.label}: ${topic}`, result)} className="text-xs text-violet-500 font-bold hover:text-violet-700">📌 Save</button>
              <button onClick={() => { navigator.clipboard.writeText(result); setCopied(true); setTimeout(()=>setCopied(false),2000); }} className="text-xs text-violet-500 font-bold">{copied ? '✓ Copied' : 'Copy all'}</button>
            </div>
          </div>
          <p className="text-sm text-stone-700 dark:text-stone-200 whitespace-pre-wrap leading-relaxed">{result}</p>
        </div>
      )}
      <PlannerSavesList saves={saves} togglePin={togglePin} deleteItem={deleteItem} />
    </div>
  );
};

// ---- SEO & Keywords Planner ----
const SEOPlanner = ({ bizName, bizType, bizDesc }) => {
  const [seoMode, setSeoMode] = useState('keywords');
  const [topic, setTopic] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const { sorted: saves, saveItem, togglePin, deleteItem } = usePlannerSaves(`kreativelync-planner-seo-${bizName}`);

  const modes = [
    { id: 'keywords', label: '🔑 Keywords', desc: 'Find what your audience is searching for' },
    { id: 'youtube', label: '▶️ YouTube SEO', desc: 'Title, description & tags that rank' },
    { id: 'instagram', label: '📱 Instagram SEO', desc: 'Hashtags, keywords & bio optimisation' },
    { id: 'blog', label: '📄 Blog/Website', desc: 'Blog post outline optimised for Google' },
    { id: 'competitor', label: '🔭 Competitor Analysis', desc: 'What to do differently to stand out' },
  ];

  const generate = async () => {
    if (!topic.trim()) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const r = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'chat',
          topic,
          brandName: bizName,
          brandType: bizType,
          brandDesc: bizDesc,
          chatHistory: [{
            role: 'user',
            text: seoMode === 'keywords' ?
`Do a keyword analysis for ${bizName} around: ${topic}

PRIMARY KEYWORDS (high intent, moderate competition):
[list 5-8 with estimated monthly search intent: high/medium/low]

LONG-TAIL KEYWORDS (easier to rank, specific):
[list 8-10 specific phrases people actually search]

QUESTION-BASED KEYWORDS (for content):
[list 8 questions people ask about this topic]

CONTENT IDEAS BASED ON KEYWORDS:
[5 content pieces that could rank for these terms]

QUICK WIN: [the single keyword to target first and why]` :

seoMode === 'youtube' ?
`Write YouTube SEO for ${bizName} video about: ${topic}

TITLE OPTION 1: [optimised, click-worthy, under 60 chars]
TITLE OPTION 2: [alternative with different keyword angle]
TITLE OPTION 3: [curiosity/emotion-based]

DESCRIPTION:
[Full YouTube description — first 2-3 lines most important, include keyword naturally, timestamps placeholder, subscribe CTA, links section]

TAGS: [30 tags — mix of broad, specific, long-tail]

THUMBNAIL TEXT: [3-5 words for thumbnail overlay]

CHAPTERS:
00:00 Intro
[logical chapter breakdown]` :

seoMode === 'instagram' ?
`Instagram SEO strategy for ${bizName} around: ${topic}

HASHTAG STRATEGY (mix of sizes):
LARGE (1M+): [5 hashtags]
MEDIUM (100K-1M): [8 hashtags]
SMALL (10K-100K): [8 hashtags]
NICHE (under 10K): [5 hashtags]

KEYWORD-RICH CAPTION PHRASES:
[5 natural phrases to weave into captions that help discovery]

BIO OPTIMISATION:
[Suggested bio text that includes searchable keywords]

REELS KEYWORD TIP: [how to use keywords in Reels for discovery]` :

seoMode === 'blog' ?
`Write a full SEO blog post outline for ${bizName} about: ${topic}

SEO TITLE: [under 60 chars, includes primary keyword]
META DESCRIPTION: [under 155 chars, includes keyword + CTA]
URL SLUG: [/short-keyword-url]
PRIMARY KEYWORD: [main keyword]
SECONDARY KEYWORDS: [3-4 supporting keywords to include]

OUTLINE:
H1: [same as title]
H2: Introduction — [hook paragraph direction]
H2: [Section 1 heading with keyword]
  H3: [sub-point]
  H3: [sub-point]
H2: [Section 2 heading]
  H3: [sub-point]
  H3: [sub-point]
H2: [Section 3 heading]
H2: Conclusion + CTA
INTERNAL LINK OPPORTUNITY: [what to link to]
IMAGE ALT TEXT SUGGESTION: [for the featured image]` :

`Competitor analysis for ${bizName} in the space of: ${topic}

WHO'S WINNING THIS SPACE:
[Types of creators/businesses doing well — what they do right]

CONTENT GAPS (what nobody is doing well):
[3-5 specific angles that are underserved]

YOUR UNFAIR ADVANTAGE:
[What ${bizName} can do that generic competitors can't — be specific to this brand's unique position]

DIFFERENTIATION STRATEGY:
[Exactly how to position differently to stand out]

CONTENT TO CREATE FIRST:
[3 specific pieces that would carve out a unique position]`
          }]
        })
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setResult(data.reply);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-3xl p-6 space-y-4">
      <h3 className="font-bold text-stone-800 dark:text-stone-100 text-lg">🔍 SEO & Keywords</h3>
      <p className="text-xs text-stone-400">Get found. Research keywords, optimise YouTube & Instagram, plan content that ranks on Google.</p>
      <div className="flex gap-2 flex-wrap">
        {modes.map(m => (
          <button key={m.id} onClick={() => { setSeoMode(m.id); setResult(null); }} className={`px-3 py-1.5 rounded-xl text-sm font-bold border transition-all ${seoMode === m.id ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-stone-50 dark:bg-stone-700 border-stone-200 dark:border-stone-600 text-stone-600 dark:text-stone-300 hover:border-indigo-300'}`}>{m.label}</button>
        ))}
      </div>
      <p className="text-xs text-stone-400">{modes.find(m=>m.id===seoMode)?.desc}</p>
      <div className="flex gap-2">
        <input value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === 'Enter' && generate()} placeholder={seoMode === 'competitor' ? 'Your niche/market (e.g. "faith-based financial coaching")' : 'Topic or keyword to research…'} className="flex-1 bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-4 py-2 text-sm" />
        <button onClick={generate} disabled={loading || !topic.trim()} className="px-5 py-2 bg-indigo-500 text-white rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-indigo-600 whitespace-nowrap">
          {loading ? <Loader2 size={14} className="animate-spin" /> : 'Analyse ✨'}
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {result && (
        <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-700/40 border border-stone-200 dark:border-stone-600 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs font-bold text-indigo-600 uppercase">{modes.find(m=>m.id===seoMode)?.label} Results</p>
            <div className="flex gap-2">
              <button onClick={() => saveItem(`${modes.find(m=>m.id===seoMode)?.label}: ${topic}`, result)} className="text-xs text-violet-500 font-bold hover:text-violet-700">📌 Save</button>
              <button onClick={() => { navigator.clipboard.writeText(result); setCopied(true); setTimeout(()=>setCopied(false),2000); }} className="text-xs text-violet-500 font-bold">{copied ? '✓ Copied' : 'Copy all'}</button>
            </div>
          </div>
          <p className="text-sm text-stone-700 dark:text-stone-200 whitespace-pre-wrap leading-relaxed">{result}</p>
        </div>
      )}
      <PlannerSavesList saves={saves} togglePin={togglePin} deleteItem={deleteItem} />
    </div>
  );
};

// ---- Video Planner ----
const VideoPlanner = ({ bizName, bizType, bizDesc }) => {
  const [videoMode, setVideoMode] = useState('plan');
  const [topic, setTopic] = useState('');
  const [platform, setPlatform] = useState('reel');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const { sorted: saves, saveItem, togglePin, deleteItem } = usePlannerSaves(`kreativelync-planner-video-${bizName}`);

  const modes = [
    { id: 'plan', label: '🎬 Full Video Plan', desc: 'Shot list, talking points, B-roll, hook, outfit, setup' },
    { id: 'hook', label: '🪝 Hook Writer', desc: 'First 3 seconds that stop the scroll' },
    { id: 'shotlist', label: '📋 Shot List', desc: 'Every shot you need to film, in order' },
    { id: 'broll', label: '🎞️ B-Roll Ideas', desc: 'Supporting footage and visual story ideas' },
    { id: 'setup', label: '📷 Setup Guide', desc: 'Camera angle, lighting, background tips for this video' },
  ];

  const platforms = [
    { id: 'reel', label: '📱 Reel/Short' },
    { id: 'youtube', label: '▶️ YouTube' },
    { id: 'podcast', label: '🎙️ Podcast Video' },
    { id: 'story', label: '📸 Story/BTS' },
  ];

  const generate = async () => {
    if (!topic.trim()) return;
    setLoading(true); setError(''); setResult(null);
    const plat = platforms.find(p => p.id === platform)?.label || 'Reel';
    const prompts = {
      plan: `Create a complete video production plan for ${bizName} — a ${plat} about: "${topic}"

HOOK (first 3 seconds):
[exact words to say or show — must stop the scroll immediately]

TALKING POINTS (in order):
[numbered list — what to say in each section, keep it natural not scripted]

SHOT LIST:
[every shot needed — type, angle, what's happening]

B-ROLL IDEAS:
[supporting visual footage ideas to cut to]

OUTFIT / LOOK:
[what to wear that fits the message and brand]

BACKGROUND / SET:
[where to film, what to show behind you, props]

OPENING LINE (say exactly):
[the first sentence spoken on camera]

CALL TO ACTION:
[what to say at the end — comment, follow, link, etc]

POSTING TIP:
[best time, caption direction, key hashtag angle]`,

      hook: `Write 5 powerful video hook options for ${bizName} — a ${plat} about: "${topic}"

For each hook provide:
HOOK: [exact words]
WHY IT WORKS: [psychology/strategy behind it]
VISUAL: [what to show on screen during this hook]

Make hooks emotionally compelling, platform-native for ${plat}, and specific to this topic.`,

      shotlist: `Create a detailed shot list for ${bizName} — a ${plat} about: "${topic}"

For each shot include:
SHOT #: [number]
TYPE: [wide/medium/close-up/over-shoulder/etc]
WHAT'S HAPPENING: [describe what's in frame]
AUDIO: [talking / silence / music / voiceover]
NOTES: [tips for capturing this shot well]

Include: intro shot, main content shots, B-roll inserts, CTA shot
Total shots should be realistic for a ${plat === 'reel' ? '30-60 second Reel' : plat === 'youtube' ? '5-15 minute YouTube video' : plat === 'podcast' ? 'podcast recording' : 'Story/BTS'}.`,

      broll: `Generate B-roll and visual storytelling ideas for ${bizName} — a ${plat} about: "${topic}"

STORYTELLING B-ROLL (narrative support):
[5 shots that visually reinforce the message]

LIFESTYLE B-ROLL (brand feel):
[5 shots that show personality and behind-the-scenes]

TEXT / GRAPHIC OVERLAYS:
[3 on-screen text ideas to add impact]

TRANSITIONS TO USE:
[2-3 transition styles that fit this content]

MOOD BOARD DIRECTION:
[colour palette, energy, aesthetic feel for this video]

MUSIC VIBE:
[describe the type of background music that fits — tempo, feel, no specific titles]`,

      setup: `Give a camera and lighting setup guide for ${bizName} filming a ${plat} about: "${topic}"

CAMERA POSITION:
[exact angle, height, distance from camera]

FRAMING:
[head room, rule of thirds, how much of body to show]

LIGHTING SETUP:
[key light, fill light, position — using natural light or lamps]

BACKGROUND:
[what to put behind you — clean, branded, props, depth]

AUDIO:
[mic placement, reduce room echo tips, what to avoid]

PHONE / CAMERA SETTINGS:
[resolution, frame rate, any manual settings to lock in]

QUICK CHECKLIST BEFORE FILMING:
[5 things to check before pressing record]`,
    };

    try {
      const r = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'chat',
          topic,
          brandName: bizName,
          brandType: bizType,
          brandDesc: bizDesc,
          chatHistory: [{ role: 'user', text: prompts[videoMode] }],
        }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setResult(data.reply || data.result || '');
    } catch (e) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-bold text-stone-800 dark:text-stone-100">🎥 Video Planner</h3>
        <p className="text-xs text-stone-400">Plan your shoot before you film — hooks, shot lists, B-roll, setup, and talking points.</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {modes.map(m => (
          <button key={m.id} onClick={() => { setVideoMode(m.id); setResult(null); }} className={`px-3 py-1.5 rounded-xl text-sm font-bold border transition-all ${videoMode === m.id ? 'bg-violet-500 text-white border-violet-500' : 'bg-stone-50 dark:bg-stone-700 border-stone-200 dark:border-stone-600 text-stone-600 dark:text-stone-300 hover:border-violet-300'}`}>{m.label}</button>
        ))}
      </div>
      <p className="text-xs text-stone-400">{modes.find(m=>m.id===videoMode)?.desc}</p>
      <div className="flex gap-2 flex-wrap">
        <span className="text-xs text-stone-500 self-center font-medium">Platform:</span>
        {platforms.map(p => (
          <button key={p.id} onClick={() => setPlatform(p.id)} className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${platform === p.id ? 'bg-violet-500 text-white border-violet-500' : 'bg-stone-50 dark:bg-stone-700 border-stone-200 dark:border-stone-600 text-stone-500 dark:text-stone-400 hover:border-violet-300'}`}>{p.label}</button>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === 'Enter' && generate()} placeholder="What is this video about? (e.g. 'trusting God through financial stress')" className="flex-1 bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-4 py-2 text-sm" />
        <button onClick={generate} disabled={loading || !topic.trim()} className="px-5 py-2 bg-violet-500 text-white rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-violet-600 whitespace-nowrap">
          {loading ? <Loader2 size={14} className="animate-spin" /> : 'Plan It ✨'}
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {result && (
        <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-700/40 border border-stone-200 dark:border-stone-600 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs font-bold text-violet-600 uppercase">{modes.find(m=>m.id===videoMode)?.label} — {platforms.find(p=>p.id===platform)?.label}</p>
            <div className="flex gap-2">
              <button onClick={() => saveItem(`${modes.find(m=>m.id===videoMode)?.label}: ${topic}`, result)} className="text-xs text-violet-500 font-bold hover:text-violet-700">📌 Save</button>
              <button onClick={() => { navigator.clipboard.writeText(result); setCopied(true); setTimeout(()=>setCopied(false),2000); }} className="text-xs text-violet-500 font-bold">{copied ? '✓ Copied' : 'Copy all'}</button>
            </div>
          </div>
          <p className="text-sm text-stone-700 dark:text-stone-200 whitespace-pre-wrap leading-relaxed">{result}</p>
        </div>
      )}
      <PlannerSavesList saves={saves} togglePin={togglePin} deleteItem={deleteItem} />
    </div>
  );
};

const ProContentToolkit = () => {
  const { activeBusinessId, businesses } = useStudio();
  const activeBiz = (businesses || []).find(b => b?.id === activeBusinessId);
  const bizName = activeBiz?.name || 'Your brand';
  const bizType = activeBiz?.type || 'faith';
  const bizDesc = activeBiz?.description || '';
  const [aiMode, setAiMode] = useState('roadmap');
  const [topic, setTopic] = useState('');
  const [chatInput, setChatInput] = useState('');

  // Clear stale results when switching brands
  useEffect(() => {
    setAiResult(null);
    setAiError('');
    setTopic('');
  }, [activeBusinessId]);

  // Per-brand chat history, persisted to localStorage
  const [chatHistories, setChatHistories] = useState(() => {
    try { return JSON.parse(localStorage.getItem('kreativelync-chat-histories') || '{}'); } catch { return {}; }
  });
  const chatHistory = chatHistories[activeBusinessId] || [];
  const setChatHistory = (updater) => {
    setChatHistories(prev => {
      const current = prev[activeBusinessId] || [];
      const next = typeof updater === 'function' ? updater(current) : updater;
      const updated = { ...prev, [activeBusinessId]: next };
      try { localStorage.setItem('kreativelync-chat-histories', JSON.stringify(updated)); } catch (_) {}
      return updated;
    });
  };

  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Notes — saved per brand
  const [notes, setNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('kreativelync-notes') || '{}'); } catch { return {}; }
  });
  const brandNotes = (notes[activeBusinessId] || []).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.createdAt - a.createdAt);
  const saveNotes = (updatedMap) => {
    setNotes(updatedMap);
    try { localStorage.setItem('kreativelync-notes', JSON.stringify(updatedMap)); } catch (_) {}
  };
  const addNote = (note) => {
    const list = notes[activeBusinessId] || [];
    saveNotes({ ...notes, [activeBusinessId]: [note, ...list] });
  };
  const updateNote = (id, changes) => {
    const list = (notes[activeBusinessId] || []).map(n => n.id === id ? { ...n, ...changes } : n);
    saveNotes({ ...notes, [activeBusinessId]: list });
  };
  const deleteNote = (id) => {
    const list = (notes[activeBusinessId] || []).filter(n => n.id !== id);
    saveNotes({ ...notes, [activeBusinessId]: list });
  };
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteBody, setNewNoteBody] = useState('');
  const [newNoteVideo, setNewNoteVideo] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);

  // Roadmap state — keeps full history per brand (last 5 roadmaps)
  const [roadmapResult, setRoadmapResult] = useState(null);
  const [roadmapHistory, setRoadmapHistory] = useState([]);
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [roadmapError, setRoadmapError] = useState('');
  const [buildingPost, setBuildingPost] = useState(null); // { postKey, loading, brief }


  // Reload roadmap + history from localStorage whenever the active brand changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`kreativelync-roadmap-${activeBusinessId}`);
      setRoadmapResult(saved ? JSON.parse(saved) : null);
      const hist = localStorage.getItem(`kreativelync-roadmap-history-${activeBusinessId}`);
      setRoadmapHistory(hist ? JSON.parse(hist) : []);
    } catch { setRoadmapResult(null); setRoadmapHistory([]); }
    setRoadmapError('');
  }, [activeBusinessId]);

  const saveRoadmap = (data) => {
    const dataWithDate = { ...data, _generatedAt: Date.now() };
    setRoadmapResult(dataWithDate);
    // Push to history (keep last 5)
    const hist = [...roadmapHistory, dataWithDate].slice(-5);
    setRoadmapHistory(hist);
    try {
      localStorage.setItem(`kreativelync-roadmap-${activeBusinessId}`, JSON.stringify(dataWithDate));
      localStorage.setItem(`kreativelync-roadmap-history-${activeBusinessId}`, JSON.stringify(hist));
    } catch (_) {}
  };

  const copyText = (text, id) => { navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); };

  const callAI = async (promptTopic, promptDesc, format = '9:16 Reel') => {
    setAiLoading(true); setAiError(''); setAiResult(null);
    try {
      const r = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: promptTopic, description: promptDesc, niche: 'faith/lifestyle', format })
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setAiResult(data);
    } catch (e) {
      setAiError(e.message || 'AI failed');
    } finally {
      setAiLoading(false);
    }
  };

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    const newHistory = [...chatHistory, { role: 'user', text: userMsg }];
    setChatHistory(newHistory);
    setAiLoading(true);
    try {
      const r = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'chat',
          topic: userMsg,
          chatHistory: newHistory,
          brandName: bizName,
          brandType: bizType,
          brandDesc: bizDesc,
        })
      });
      const data = await r.json();
      const reply = data.reply || data.postingTip || data.caption || 'Sorry, I had trouble responding. Try again.';
      setChatHistory(h => [...h, { role: 'ai', text: reply }]);
    } catch (e) {
      setChatHistory(h => [...h, { role: 'ai', text: 'Sorry, I had trouble responding. Try again.' }]);
    } finally {
      setAiLoading(false);
    }
  };

  const QUICK_IDEAS = [
    'My faith journey — how I found God',
    'Morning routine as a Christian woman',
    '3 Bible verses that changed my life',
    'What I learned from my hardest season',
    'How prayer actually works',
    'Why I stopped chasing perfection',
    'What being a steward means to me',
    'A message for women who feel lost',
  ];
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
    <div className="max-w-4xl mx-auto space-y-6">
      <BrandKitReminder compact />

      {/* Header */}
      <div className="bg-gradient-to-br from-violet-50 to-amber-50 dark:from-stone-800 dark:to-stone-800 border-2 border-violet-200 dark:border-rose-800 rounded-3xl p-6">
        <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-1">✨ AI Content Studio</h2>
        <p className="text-stone-500 dark:text-stone-400 text-sm">Your personal content coach. Get scripts, ideas, captions, and a weekly plan — powered by AI.</p>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-2 flex-wrap">
        {[['roadmap','🗺️ Roadmap'],['ideas','💡 Ideas'],['script','🎬 Script'],['caption','✍️ Caption'],['calendar','📅 Weekly Plan'],['video-planner','🎥 Video Planner'],['poll','📊 Polls & Engagement'],['podcast','🎙️ Podcast Planner'],['seo','🔍 SEO & Keywords'],['review','✅ Review Before Post'],['chat','💬 Ask AI'],['notes','📌 Notes & Journal'],['guides','🎓 App Guides']].map(([mode, label]) => (
          <button key={mode} onClick={() => { setAiMode(mode); setAiResult(null); setAiError(''); }} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${aiMode === mode ? 'bg-violet-500 text-white shadow' : 'bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:border-violet-300'}`}>{label}</button>
        ))}
      </div>

      {/* Review mode */}
      {aiMode === 'review' && (
        <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-3xl p-6 space-y-4">
          <h3 className="font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2"><Search size={18} className="text-violet-400" /> Review before you post</h3>
          <p className="text-xs text-stone-500">AI will score your content, find weaknesses, and tell you exactly what to fix before you hit publish.</p>
          <div className="flex gap-2 flex-wrap">
            {[['caption','📝 Caption'],['script','🎬 Script'],['idea','💡 Idea'],['thumbnail','🖼️ Image/Thumbnail'],['video','🎬 Video (frame)']].map(([t,l]) => (
              <button key={t} onClick={() => { setTopic(t); setAiResult(null); setAiError(''); }} className={`px-3 py-1.5 rounded-xl text-sm font-bold border transition-all ${topic===t ? 'bg-violet-500 text-white border-violet-500' : 'bg-stone-50 dark:bg-stone-700 border-stone-200 dark:border-stone-600 text-stone-600 dark:text-stone-300'}`}>{l}</button>
            ))}
          </div>
          {topic === 'thumbnail' ? (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-stone-600 dark:text-stone-400">Upload your image or thumbnail</label>
              <input type="file" accept="image/*" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async (ev) => {
                  const base64 = ev.target.result.split(',')[1];
                  setAiLoading(true); setAiError(''); setAiResult(null);
                  try {
                    const r = await fetch('/api/ai/review', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ type: 'thumbnail', content: 'image review', imageBase64: base64, imageMimeType: file.type })
                    });
                    const data = await r.json();
                    if (data.error) throw new Error(data.error);
                    setAiResult(data);
                  } catch (err) { setAiError(err.message); } finally { setAiLoading(false); }
                };
                reader.readAsDataURL(file);
              }} className="block w-full text-sm text-stone-600 dark:text-stone-400 bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-4 py-3" />
            </div>
          ) : topic === 'video' ? (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-stone-600 dark:text-stone-400">Upload your video — AI will analyze a frame from it</label>
              <input type="file" accept="video/*" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setAiLoading(true); setAiError(''); setAiResult(null);
                try {
                  // Extract a frame from the video using canvas
                  const videoEl = document.createElement('video');
                  videoEl.muted = true;
                  videoEl.src = URL.createObjectURL(file);
                  await new Promise((resolve, reject) => {
                    videoEl.onloadedmetadata = () => {
                      videoEl.currentTime = Math.min(3, videoEl.duration * 0.1);
                    };
                    videoEl.onseeked = resolve;
                    videoEl.onerror = reject;
                    videoEl.load();
                  });
                  const canvas = document.createElement('canvas');
                  canvas.width = videoEl.videoWidth || 720;
                  canvas.height = videoEl.videoHeight || 1280;
                  canvas.getContext('2d').drawImage(videoEl, 0, 0);
                  URL.revokeObjectURL(videoEl.src);
                  const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
                  const r = await fetch('/api/ai/review', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'thumbnail', content: 'video frame review — analyze this Reel thumbnail/opening frame for visual impact, hook strength, and whether it will stop the scroll', imageBase64: base64, imageMimeType: 'image/jpeg' })
                  });
                  const data = await r.json();
                  if (data.error) throw new Error(data.error);
                  setAiResult(data);
                } catch (err) { setAiError('Could not read video frame: ' + (err.message || 'Try a different video')); } finally { setAiLoading(false); }
              }} className="block w-full text-sm text-stone-600 dark:text-stone-400 bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-4 py-3" />
              <p className="text-xs text-stone-400">Tip: AI analyzes the opening frame — make sure your first 3 seconds look amazing</p>
            </div>
          ) : (
            <div className="space-y-3">
              <textarea value={topic && topic !== 'thumbnail' ? undefined : ''} onChange={e => setChatInput(e.target.value)} placeholder={topic === 'caption' ? 'Paste your caption here…' : topic === 'script' ? 'Paste your Reel script here…' : 'Describe your content idea…'} rows={5} className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-4 py-3 text-sm resize-none" />
              <button onClick={async () => {
                if (!chatInput.trim()) return;
                setAiLoading(true); setAiError(''); setAiResult(null);
                try {
                  const r = await fetch('/api/ai/review', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: topic || 'caption', content: chatInput })
                  });
                  const data = await r.json();
                  if (data.error) throw new Error(data.error);
                  setAiResult(data);
                } catch (err) { setAiError(err.message); } finally { setAiLoading(false); }
              }} disabled={aiLoading || !chatInput.trim()} className="px-5 py-2 bg-violet-500 text-white rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-violet-600">
                {aiLoading ? <><Loader2 size={14} className="animate-spin inline mr-1" />Reviewing…</> : '🔍 Review My Content'}
              </button>
            </div>
          )}
          {aiError && <p className="text-sm text-red-500">{aiError}</p>}
          {aiResult && (
            <div className="space-y-3 pt-2">
              {aiResult.score != null && (
                <div className={`p-4 rounded-xl border-2 ${aiResult.score >= 80 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400' : aiResult.score >= 60 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-400' : 'bg-red-50 dark:bg-red-900/20 border-red-400'}`}>
                  <div className="flex items-center gap-3">
                    <span className={`text-4xl font-black ${aiResult.score >= 80 ? 'text-emerald-600' : aiResult.score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{aiResult.score}/100</span>
                    <div>
                      <p className="font-bold text-stone-800 dark:text-stone-100">{aiResult.verdict}</p>
                      <p className="text-xs text-stone-500">Powered by {aiResult.poweredBy === 'gemini' ? 'Gemini Vision' : 'Groq AI'}</p>
                    </div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(aiResult.strengths || aiResult.visualStrengths)?.length > 0 && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                    <p className="font-bold text-emerald-700 dark:text-emerald-400 text-xs mb-2">✅ Strengths</p>
                    {(aiResult.strengths || aiResult.visualStrengths).map((s,i) => <p key={i} className="text-xs text-stone-600 dark:text-stone-300">• {s}</p>)}
                  </div>
                )}
                {(aiResult.weaknesses || aiResult.visualWeaknesses)?.length > 0 && (
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <p className="font-bold text-red-700 dark:text-red-400 text-xs mb-2">⚠️ Weaknesses</p>
                    {(aiResult.weaknesses || aiResult.visualWeaknesses).map((w,i) => <p key={i} className="text-xs text-stone-600 dark:text-stone-300">• {w}</p>)}
                  </div>
                )}
              </div>
              {(aiResult.suggestions || aiResult.improvements)?.length > 0 && (
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <p className="font-bold text-blue-700 dark:text-blue-400 text-xs mb-2">🛠️ Fix these before posting</p>
                  {(aiResult.suggestions || aiResult.improvements).map((s,i) => <p key={i} className="text-xs text-stone-600 dark:text-stone-300 mb-1">{i+1}. {s}</p>)}
                </div>
              )}
              {aiResult.rewrite && (
                <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
                  <div className="flex justify-between mb-1"><p className="font-bold text-violet-700 dark:text-violet-400 text-xs">✍️ Improved version</p><button onClick={() => { navigator.clipboard.writeText(aiResult.rewrite); }} className="text-xs text-violet-500">Copy</button></div>
                  <p className="text-xs text-stone-600 dark:text-stone-300 whitespace-pre-wrap">{aiResult.rewrite}</p>
                </div>
              )}
              {(aiResult.rewrittenHook || aiResult.betterAngle) && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <p className="font-bold text-amber-700 dark:text-amber-400 text-xs mb-2">💡 Stronger version</p>
                  {aiResult.rewrittenHook && <p className="text-xs text-stone-600 dark:text-stone-300 mb-1"><strong>Hook:</strong> "{aiResult.rewrittenHook}"</p>}
                  {aiResult.rewrittenCTA && <p className="text-xs text-stone-600 dark:text-stone-300 mb-1"><strong>CTA:</strong> "{aiResult.rewrittenCTA}"</p>}
                  {aiResult.betterAngle && <p className="text-xs text-stone-600 dark:text-stone-300"><strong>Better angle:</strong> {aiResult.betterAngle}</p>}
                </div>
              )}
              {aiResult.predictedPerformance && (
                <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-700/40 border border-stone-200 dark:border-stone-600">
                  <p className="font-bold text-stone-700 dark:text-stone-200 text-xs mb-1">📊 Predicted performance</p>
                  <p className="text-xs text-stone-600 dark:text-stone-300">{aiResult.predictedPerformance}</p>
                </div>
              )}
              {aiResult.overallRecommendation && (
                <div className={`p-3 rounded-xl border-2 font-bold text-center ${aiResult.overallRecommendation?.includes('Post') ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-amber-50 border-amber-400 text-amber-700'}`}>
                  {aiResult.overallRecommendation}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Chat mode */}
      {aiMode === 'chat' && (
        <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2"><Bot size={18} className="text-violet-400" /> Ask your AI content coach — {bizName}</h3>
            {chatHistory.length > 0 && <button onClick={() => setChatHistory([])} className="text-xs text-stone-400 hover:text-red-400">Clear chat</button>}
          </div>
          <p className="text-xs text-stone-500">Ask anything — "What should I post this week?", "Write me a hook about faith", "How do I grow faster?", "Give me a 30-day content plan"</p>
          <div className="min-h-[200px] max-h-[400px] overflow-y-auto space-y-3 p-3 bg-stone-50 dark:bg-stone-700/30 rounded-2xl">
            {chatHistory.length === 0 && <p className="text-center text-stone-400 text-sm pt-8">Start a conversation with your AI coach</p>}
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-violet-500 text-white' : 'bg-white dark:bg-stone-600 text-stone-700 dark:text-stone-200 border border-stone-200 dark:border-stone-500'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {aiLoading && <div className="flex justify-start"><div className="bg-white dark:bg-stone-600 border border-stone-200 dark:border-stone-500 px-4 py-2 rounded-2xl text-sm text-stone-400"><Loader2 size={14} className="animate-spin inline mr-1" />Thinking…</div></div>}
          </div>
          <div className="flex gap-2">
            <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()} placeholder="Ask your AI coach anything…" className="flex-1 bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-4 py-2 text-sm" />
            <button onClick={sendChat} disabled={aiLoading || !chatInput.trim()} className="px-4 py-2 bg-violet-500 text-white rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-violet-600">Send</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {['What should I post this week?','Give me 5 faith Reel ideas','Write a hook about overcoming fear','How do I get more saves?','Give me a 30-day content plan'].map(q => (
              <button key={q} onClick={() => { setChatInput(q); }} className="text-xs px-3 py-1 bg-violet-50 dark:bg-rose-900/20 text-violet-600 dark:text-violet-400 rounded-lg border border-violet-200 dark:border-rose-800 hover:bg-violet-100">{q}</button>
            ))}
          </div>
        </div>
      )}

      {/* Ideas, Script, Caption, Calendar modes */}
      {/* Roadmap */}
      {aiMode === 'roadmap' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-violet-50 to-violet-50 dark:from-stone-800 dark:to-stone-800 border-2 border-violet-200 dark:border-violet-800 rounded-3xl p-6 space-y-3">
            <h3 className="text-xl font-bold text-stone-800 dark:text-stone-100">🗺️ Audience-First Content Roadmap</h3>
            <p className="text-sm text-stone-500 dark:text-stone-400">The AI studies your audience data — who they are, what they want, what makes them stop scrolling — then builds a 30-day roadmap around <em>them</em>, not your mood.</p>
            <button onClick={async () => {
              setRoadmapLoading(true); setRoadmapError('');
              try {
                const brandKey = `brand-${activeBusinessId}`;
                const igProfileMap = JSON.parse(localStorage.getItem('kreativelync-ig-profile-map') || '{}');
                const igGrowthMap = JSON.parse(localStorage.getItem('kreativelync-ig-growth-map') || '{}');
                const igAudienceMap = JSON.parse(localStorage.getItem('kreativelync-ig-audience-map') || '{}');
                const allPosts = JSON.parse(localStorage.getItem('kreativelync-posts') || '[]');
                const bizPosts = allPosts.filter(p => p.businessId === activeBusinessId || p.source === 'instagram_api');
                // Build history summary for the AI to learn from
                const prevHistory = roadmapHistory.slice(-3).map((r, i) => ({
                  generatedAt: new Date(r._generatedAt || 0).toLocaleDateString(),
                  audienceInsight: r.audienceInsight,
                  contentPillars: (r.contentPillars || []).map(p => `${p.pillar} (${p.percentage})`).join(', '),
                  whatEvolved: r._whatEvolved || null,
                }));

                const r = await fetch('/api/ai/generate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    mode: 'roadmap',
                    topic: `Roadmap for ${bizName}`,
                    analyticsData: {
                      brandName: bizName,
                      brandType: bizType,
                      brandDesc: bizDesc,
                      posts: bizPosts,
                      account: igProfileMap[brandKey] || null,
                      growth: igGrowthMap[brandKey] || null,
                      audience: igAudienceMap[brandKey] || null,
                      previousRoadmaps: prevHistory,
                    }
                  })
                });
                const data = await r.json();
                if (data.error) throw new Error(data.error);
                saveRoadmap(data);
              } catch (e) { setRoadmapError(e.message || 'Failed to generate roadmap'); }
              finally { setRoadmapLoading(false); }
            }} data-roadmap-generate disabled={roadmapLoading} className="px-6 py-3 bg-gradient-to-r from-violet-500 to-violet-500 text-white rounded-2xl font-bold text-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
              {roadmapLoading ? <><Loader2 size={16} className="animate-spin" /> Building your roadmap…</> : roadmapResult ? '🔄 Regenerate with latest data' : '✨ Build My 30-Day Roadmap'}
            </button>
            {roadmapError && <p className="text-sm text-red-500">{roadmapError}</p>}
            {roadmapResult && !roadmapLoading && (
              <div className="space-y-1">
                <p className="text-xs text-stone-400">
                  Generated {new Date(roadmapResult._generatedAt || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {roadmapHistory.length} version{roadmapHistory.length !== 1 ? 's' : ''} saved · Regenerates smarter each time
                </p>
                {roadmapResult.whatEvolved && (
                  <p className="text-xs text-violet-500 font-medium">📈 {roadmapResult.whatEvolved}</p>
                )}
              </div>
            )}
            {!roadmapResult && !roadmapLoading && <p className="text-xs text-stone-400">Tip: Connect Instagram in Analytics first for the most personalised roadmap. Works without it too.</p>}
          </div>

          {roadmapResult && (
            <div className="space-y-5">
              {/* Audience Insight */}
              {roadmapResult.audienceInsight && (
                <div className="bg-white dark:bg-stone-800 border-2 border-violet-200 dark:border-violet-800 rounded-2xl p-5">
                  <p className="text-xs font-bold text-violet-500 uppercase mb-2">👥 Who is watching you</p>
                  <p className="text-stone-700 dark:text-stone-200 text-sm leading-relaxed">{roadmapResult.audienceInsight}</p>
                </div>
              )}

              {/* Audience Persona */}
              {roadmapResult.audiencePersona && (
                <div className="bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-bold text-violet-500 uppercase mb-1">Who they are</p>
                    <p className="text-xs text-stone-600 dark:text-stone-300">{roadmapResult.audiencePersona.who}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-amber-500 uppercase mb-1">What they want</p>
                    <p className="text-xs text-stone-600 dark:text-stone-300">{roadmapResult.audiencePersona.whatTheyWant}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-emerald-500 uppercase mb-1">What stops the scroll</p>
                    <p className="text-xs text-stone-600 dark:text-stone-300">{roadmapResult.audiencePersona.whatStopsThemScrolling}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-violet-500 uppercase mb-1">Best emotional trigger</p>
                    <p className="text-xs text-stone-600 dark:text-stone-300">{roadmapResult.audiencePersona.bestEmotionalTrigger}</p>
                  </div>
                </div>
              )}

              {/* Content Pillars */}
              {roadmapResult.contentPillars?.length > 0 && (
                <div className="bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-2xl p-5">
                  <p className="text-xs font-bold text-stone-500 uppercase mb-3">📊 Your Content Pillars</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {roadmapResult.contentPillars.map((p, i) => (
                      <div key={i} className="p-3 rounded-xl bg-stone-50 dark:bg-stone-700/40 border border-stone-200 dark:border-stone-600">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-bold text-stone-800 dark:text-stone-100 text-sm">{p.pillar}</p>
                          <span className="text-xs font-bold text-violet-500">{p.percentage}</span>
                        </div>
                        <p className="text-xs text-stone-500 dark:text-stone-400 mb-2">{p.why}</p>
                        <div className="flex flex-wrap gap-1">{(p.exampleTopics||[]).map((t,j) => <span key={j} className="text-xs px-2 py-0.5 bg-violet-50 dark:bg-rose-900/20 text-violet-600 dark:text-violet-400 rounded-lg">{t}</span>)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 30-Day Roadmap */}
              {roadmapResult.roadmap?.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-stone-500 uppercase">🗓️ 30-Day Post Plan</p>
                  {roadmapResult.roadmap.map((week, wi) => (
                    <div key={wi} className="bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-bold text-stone-800 dark:text-stone-100">Week {week.week} — {week.theme}</p>
                        <span className="text-xs text-violet-500 font-semibold">{week.goal}</span>
                      </div>
                      <div className="space-y-2">
                        {(week.posts||[]).map((post, pi) => {
                          const isHS = post.brand === 'Her Stewardship';
                          const postKey = `w${wi}-p${pi}`;
                          const isBuilding = buildingPost?.postKey === postKey && buildingPost?.loading;
                          const brief = buildingPost?.postKey === postKey ? buildingPost?.brief : null;
                          const isOpen = !!brief;

                          const buildPost = async () => {
                            setBuildingPost({ postKey, loading: true, brief: null });
                            try {
                              const r = await fetch('/api/ai/generate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  mode: 'chat',
                                  topic: `Full content brief for this post`,
                                  brandName: bizName,
                                  brandType: bizType,
                                  brandDesc: bizDesc,
                                  chatHistory: [{
                                    role: 'user',
                                    text: `Build me a complete content brief for this post:

Topic: ${post.topic}
Format: ${post.type}
Hook: ${post.hook}
Day: ${post.day}
Brand: ${post.brand || bizName}
Why it works: ${post.audienceWhy}

Give me ALL of this in detail:
1. HOOK (first 3 seconds — exactly what to say or show)
2. FULL SCRIPT or TALKING POINTS (word for word if Reel, bullet points if Carousel)
3. CAPTION (ready to copy-paste with line breaks, emojis if appropriate)
4. HASHTAGS (20-25 relevant ones)
5. VISUAL/DESIGN DESCRIPTION (what to wear, background, text overlays, colours, mood for Canva graphics if needed)
6. CALL TO ACTION (exactly what to say at the end)
7. POSTING TIPS (best time, any special instructions)
${bizType === 'business' ? '8. SALES/MARKETING ANGLE (how this post moves people toward buying or taking action)' : ''}`
                                  }],
                                })
                              });
                              const data = await r.json();
                              setBuildingPost({ postKey, loading: false, brief: data.reply || 'Could not build brief.' });
                            } catch (e) {
                              setBuildingPost({ postKey, loading: false, brief: 'Failed: ' + e.message });
                            }
                          };

                          return (
                          <div key={pi} className={`rounded-xl border ${isHS ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-stone-50 dark:bg-stone-700/40 border-stone-200 dark:border-stone-600'}`}>
                            <div className="flex gap-3 p-3">
                              <span className="text-xs font-bold text-violet-500 w-8 shrink-0 pt-0.5">{post.day}</span>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                  <span className="text-xs font-bold text-stone-700 dark:text-stone-200">{post.topic}</span>
                                  <span className="text-xs text-stone-400 bg-stone-100 dark:bg-stone-600 px-2 py-0.5 rounded-full">{post.type}</span>
                                  {post.brand && <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isHS ? 'bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300' : 'bg-violet-100 dark:bg-rose-900 text-violet-600 dark:text-violet-300'}`}>{post.brand}</span>}
                                </div>
                                <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">Hook: "{post.hook}"</p>
                                <p className="text-xs text-stone-500 dark:text-stone-400 mb-2">Why it works: {post.audienceWhy}</p>
                                <button onClick={isOpen ? () => setBuildingPost(null) : buildPost} disabled={isBuilding} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50 flex items-center gap-1">
                                  {isBuilding ? <><Loader2 size={11} className="animate-spin" /> Building brief…</> : isOpen ? '▲ Close brief' : '✏️ Build this out'}
                                </button>
                              </div>
                            </div>
                            {isOpen && (
                              <div className="border-t border-stone-200 dark:border-stone-600 p-4 space-y-2">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs font-bold text-violet-600 uppercase">Full Content Brief</p>
                                  <button onClick={() => navigator.clipboard.writeText(brief)} className="text-xs text-violet-500 font-bold">Copy all</button>
                                </div>
                                <p className="text-xs text-stone-700 dark:text-stone-200 whitespace-pre-wrap leading-relaxed">{brief}</p>
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Series + Viral */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {roadmapResult.seriesIdea && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
                    <p className="text-xs font-bold text-amber-600 uppercase mb-1">🔁 Recurring Series Idea</p>
                    <p className="font-bold text-stone-800 dark:text-stone-100 text-sm mb-1">"{roadmapResult.seriesIdea.name}"</p>
                    <p className="text-xs text-stone-600 dark:text-stone-300 mb-1">{roadmapResult.seriesIdea.concept}</p>
                    <p className="text-xs text-stone-500">{roadmapResult.seriesIdea.why}</p>
                  </div>
                )}
                {roadmapResult.viralOpportunity && (
                  <div className="bg-violet-50 dark:bg-rose-900/20 border border-violet-200 dark:border-rose-800 rounded-2xl p-4">
                    <p className="text-xs font-bold text-violet-600 uppercase mb-1">🔥 Highest Viral Opportunity Now</p>
                    <p className="text-sm text-stone-700 dark:text-stone-200">{roadmapResult.viralOpportunity}</p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button onClick={() => document.querySelector('[data-roadmap-generate]')?.click()} className="px-4 py-2 bg-gradient-to-r from-violet-500 to-violet-500 text-white rounded-xl font-bold text-sm hover:opacity-90">🔄 Regenerate with latest data</button>
                <button onClick={() => { setRoadmapResult(null); localStorage.removeItem(`kreativelync-roadmap-${activeBusinessId}`); }} className="text-xs text-stone-400 hover:text-red-400">Clear roadmap</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Notes & Journal */}
      {aiMode === 'notes' && (
        <div className="space-y-4">
          {/* New note form */}
          <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-3xl p-6 space-y-3">
            <h3 className="font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">📌 New Note — {bizName}</h3>
            <p className="text-xs text-stone-400">Journal your ideas, track what worked, plan your next video. Pinned notes stay at the top.</p>
            <input value={newNoteTitle} onChange={e => setNewNoteTitle(e.target.value)} placeholder="Title (e.g. 'Reel idea — faith over fear')" className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-4 py-2 text-sm" />
            <input value={newNoteVideo} onChange={e => setNewNoteVideo(e.target.value)} placeholder="Video/post link or title (optional)" className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-4 py-2 text-sm" />
            <textarea value={newNoteBody} onChange={e => setNewNoteBody(e.target.value)} placeholder="Write your note… What's your idea? What worked? What to improve? What trends did you notice?" rows={4} className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-4 py-3 text-sm resize-none" />
            <button onClick={() => {
              if (!newNoteBody.trim() && !newNoteTitle.trim()) return;
              addNote({ id: Date.now().toString(), title: newNoteTitle.trim(), body: newNoteBody.trim(), video: newNoteVideo.trim(), pinned: false, createdAt: Date.now() });
              setNewNoteTitle(''); setNewNoteBody(''); setNewNoteVideo('');
            }} className="px-5 py-2 bg-violet-500 text-white rounded-xl font-bold text-sm hover:bg-violet-600">Save Note</button>
          </div>

          {/* Notes list */}
          {brandNotes.length === 0 && (
            <div className="text-center py-10 text-stone-400 text-sm">No notes yet. Start journaling your content journey ✍️</div>
          )}
          {brandNotes.map(note => (
            <div key={note.id} className={`bg-white dark:bg-stone-800 rounded-2xl p-5 border-2 transition-all ${note.pinned ? 'border-amber-400 dark:border-amber-600' : 'border-stone-100 dark:border-stone-700'}`}>
              {editingNoteId === note.id ? (
                <div className="space-y-2">
                  <input defaultValue={note.title} id={`edit-title-${note.id}`} className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-4 py-2 text-sm font-bold" />
                  <input defaultValue={note.video} id={`edit-video-${note.id}`} placeholder="Video/post link (optional)" className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-4 py-2 text-sm" />
                  <textarea defaultValue={note.body} id={`edit-body-${note.id}`} rows={4} className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-4 py-3 text-sm resize-none" />
                  <div className="flex gap-2">
                    <button onClick={() => {
                      updateNote(note.id, {
                        title: document.getElementById(`edit-title-${note.id}`).value,
                        body: document.getElementById(`edit-body-${note.id}`).value,
                        video: document.getElementById(`edit-video-${note.id}`).value,
                      });
                      setEditingNoteId(null);
                    }} className="px-4 py-1.5 bg-violet-500 text-white rounded-xl text-xs font-bold hover:bg-violet-600">Save</button>
                    <button onClick={() => setEditingNoteId(null)} className="px-4 py-1.5 bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 rounded-xl text-xs font-bold">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      {note.pinned && <span className="text-xs text-amber-500 font-bold mr-2">📌 Pinned</span>}
                      {note.title && <span className="font-bold text-stone-800 dark:text-stone-100">{note.title}</span>}
                      {note.video && <p className="text-xs text-violet-400 mt-0.5">🎬 {note.video}</p>}
                    </div>
                    <p className="text-xs text-stone-400 shrink-0">{new Date(note.createdAt).toLocaleDateString()}</p>
                  </div>
                  <p className="text-sm text-stone-600 dark:text-stone-300 whitespace-pre-wrap">{note.body}</p>
                  <div className="flex gap-3 mt-3 pt-3 border-t border-stone-100 dark:border-stone-700">
                    <button onClick={() => updateNote(note.id, { pinned: !note.pinned })} className={`text-xs font-bold ${note.pinned ? 'text-amber-500' : 'text-stone-400 hover:text-amber-500'}`}>{note.pinned ? 'Unpin' : '📌 Pin'}</button>
                    <button onClick={() => setEditingNoteId(note.id)} className="text-xs text-stone-400 hover:text-violet-500 font-bold">Edit</button>
                    <button onClick={() => { if (confirm('Delete this note?')) deleteNote(note.id); }} className="text-xs text-stone-400 hover:text-red-500 font-bold">Delete</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* App Guides */}
      {aiMode === 'guides' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-stone-800 dark:to-stone-800 border-2 border-indigo-200 dark:border-indigo-800 rounded-3xl p-6">
            <h3 className="text-xl font-bold text-stone-800 dark:text-stone-100 mb-1">🎓 Creator Tools Quick Guide</h3>
            <p className="text-sm text-stone-500">Your cheat sheet for DaVinci Resolve, Lightroom & Canva. Ask the AI coach anything more specific.</p>
          </div>

          {/* DaVinci Resolve */}
          <div className="bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-2xl p-5 space-y-4">
            <h4 className="font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">🎬 DaVinci Resolve — Reels Workflow</h4>
            <div className="space-y-3">
              {[
                { step: '1. Set up your project', detail: 'Open DaVinci → New Project → name it → go to File > Project Settings → set Timeline Resolution to 1080x1920 (vertical 9:16) → Frame Rate: 30fps → OK' },
                { step: '2. Import your video', detail: 'Drag your video file into the Media Pool (top left). Then drag it from Media Pool onto the timeline at the bottom.' },
                { step: '3. Trim & cut', detail: 'Press B for Blade tool → click on the clip where you want to cut → press A to go back to Select tool → click the unwanted piece → Delete key.' },
                { step: '4. Add text/captions', detail: 'Go to Edit page → Effects Library → Titles → drag "Text+" onto timeline above your video → double-click it → type your text in Inspector panel on the right.' },
                { step: '5. Color grade', detail: 'Click Color page (bottom bar) → use the Color Wheels to adjust: Lift (shadows), Gamma (midtones), Gain (highlights). For a clean faith creator look: slightly warm highlights, lifted blacks, high clarity.' },
                { step: '6. Add music', detail: 'Drag your audio file into Media Pool → drag it to the timeline below your video. Click the audio clip → use Inspector to adjust volume.' },
                { step: '7. Export for Instagram', detail: 'Go to Deliver page → Quick Export → Format: H.264 → Resolution: 1080x1920 → Frame Rate: 30 → Quality: Restrict to 50,000 Kbps → Export.' },
              ].map((item, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-xl bg-stone-50 dark:bg-stone-700/40">
                  <span className="text-xs font-bold text-indigo-500 shrink-0 pt-0.5 w-4">{i+1}</span>
                  <div>
                    <p className="font-semibold text-stone-800 dark:text-stone-100 text-sm">{item.step}</p>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{item.detail}</p>
                  </div>
                </div>
              ))}
              <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                <p className="text-xs font-bold text-indigo-600 mb-2">⌨️ Key Shortcuts</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[['Space','Play/Pause'],['B','Blade (cut) tool'],['A','Select tool'],['Cmd+Z','Undo'],['I / O','Mark in/out point'],['Cmd+D','Deliver (export)']].map(([k,v]) => (
                    <div key={k} className="flex items-center gap-2"><code className="text-xs bg-stone-200 dark:bg-stone-600 px-2 py-0.5 rounded font-mono">{k}</code><span className="text-xs text-stone-500">{v}</span></div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Lightroom */}
          <div className="bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-2xl p-5 space-y-4">
            <h4 className="font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">📷 Adobe Lightroom — Photo Editing Workflow</h4>
            <div className="space-y-3">
              {[
                { step: '1. Import your photo', detail: 'Mobile: tap the + button → choose photo from camera roll. Desktop: File → Import Photos → select your files → Import.' },
                { step: '2. Start with Light (Basic panel)', detail: 'Exposure: overall brightness. Contrast: punch/flatness. Highlights: pull down to recover blown-out sky/skin. Shadows: push up to lift dark areas. Whites & Blacks: set the range. Start here before anything else.' },
                { step: '3. Color & Tone', detail: 'Temp/Tint: warm up (drag right) or cool down (drag left). Vibrance: boosts muted colors without overdoing skin. Saturation: boosts all colors — use carefully.' },
                { step: '4. HSL / Color Mix', detail: 'Fine-tune individual colors. For faith/lifestyle: boost Orange (warm skin), reduce Aqua/Blue (clean background), lift Yellow for a warm glow.' },
                { step: '5. Tone Curve', detail: 'Create an S-curve: pull highlights up slightly, pull shadows up slightly (creates that lifted matte look popular on Instagram).' },
                { step: '6. Sharpening & Noise', detail: 'Detail panel → Sharpening: Amount 40-60. Noise Reduction: push Luminance to 20-40 if photo looks grainy.' },
                { step: '7. Apply a Preset', detail: 'Tap Presets → browse → tap to preview → tap again to apply. You can adjust after. Save your own: tap 3 dots → Create Preset.' },
                { step: '8. Export for Instagram', detail: 'Tap Share → Export as JPEG → Quality 100% → Color Space sRGB → Long Edge 1080px (portrait: 1080x1350). This is the perfect Instagram size.' },
              ].map((item, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-xl bg-stone-50 dark:bg-stone-700/40">
                  <span className="text-xs font-bold text-violet-400 shrink-0 pt-0.5 w-4">{i+1}</span>
                  <div>
                    <p className="font-semibold text-stone-800 dark:text-stone-100 text-sm">{item.step}</p>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Canva */}
          <div className="bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-2xl p-5 space-y-4">
            <h4 className="font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">🎨 Canva — Graphics & Reels Covers</h4>
            <div className="space-y-3">
              {[
                { step: '1. Set up the right size', detail: 'New Design → Custom size → 1080x1920px for Reels cover/story. 1080x1080px for feed post. 1080x1350px for portrait feed. Always start with the right canvas.' },
                { step: '2. Find your brand template', detail: 'Search for "Instagram Reel Cover" or "Faith" in templates. Pick one close to your vibe → customize. Never post a default template — change colors and fonts to match your brand.' },
                { step: '3. Brand your colors', detail: 'Click any element → change color → add your brand hex codes. Save them in Brand Kit (Canva Pro) so they\'re always one click away.' },
                { step: '4. Typography for Reels covers', detail: 'Use max 2 fonts. One bold for the hook/headline (big, readable on mobile). One clean font for subtitle. Test: zoom out to thumbnail size — if you can\'t read it, neither can your audience.' },
                { step: '5. Add your photo', detail: 'Uploads → drag your photo in → right click → Set as background (or place it and resize). Use the background remover (Pro) to cut yourself out and layer over designs.' },
                { step: '6. Reel cover best practices', detail: 'Put the hook text in the center-top third. Keep the bottom third clear (Instagram overlays buttons there). Use high contrast — light text on dark background or vice versa.' },
                { step: '7. Export', detail: 'Download → PNG (for covers/graphics) or MP4 (if you made an animated Reel cover). PNG at default quality is perfect for Instagram.' },
              ].map((item, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-xl bg-stone-50 dark:bg-stone-700/40">
                  <span className="text-xs font-bold text-emerald-500 shrink-0 pt-0.5 w-4">{i+1}</span>
                  <div>
                    <p className="font-semibold text-stone-800 dark:text-stone-100 text-sm">{item.step}</p>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-violet-50 dark:bg-rose-900/20 border border-violet-200 dark:border-rose-800 rounded-2xl p-4">
            <p className="text-sm font-bold text-violet-600 dark:text-violet-400 mb-1">💬 Ask the AI anything more specific</p>
            <p className="text-xs text-stone-500">Go to Ask AI tab and say things like: "How do I add subtitles in DaVinci?", "How do I make my skin look natural in Lightroom?", "How do I create a Reel cover template in Canva?" — it will walk you through it step by step.</p>
          </div>
        </div>
      )}

      {/* Poll & Engagement Creator */}
      {aiMode === 'poll' && (
        <PollEngagementCreator bizName={bizName} bizType={bizType} bizDesc={bizDesc} />
      )}

      {/* Podcast Planner */}
      {aiMode === 'podcast' && (
        <PodcastPlanner bizName={bizName} bizType={bizType} bizDesc={bizDesc} />
      )}

      {/* SEO & Keywords */}
      {aiMode === 'seo' && (
        <SEOPlanner bizName={bizName} bizType={bizType} bizDesc={bizDesc} />
      )}

      {/* Video Planner */}
      {aiMode === 'video-planner' && (
        <VideoPlanner bizName={bizName} bizType={bizType} bizDesc={bizDesc} />
      )}

      {aiMode !== 'chat' && aiMode !== 'notes' && aiMode !== 'roadmap' && aiMode !== 'guides' && aiMode !== 'poll' && aiMode !== 'podcast' && aiMode !== 'seo' && aiMode !== 'video-planner' && (
        <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-3xl p-6 space-y-4">
          {aiMode === 'ideas' && <>
            <h3 className="font-bold text-stone-800 dark:text-stone-100">💡 Content Ideas Generator</h3>
            <p className="text-xs text-stone-500">Enter a topic or pick one below — get hooks, caption, hashtags, and posting tips instantly.</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_IDEAS.map(q => <button key={q} onClick={() => setTopic(q)} className={`text-xs px-3 py-1 rounded-lg border transition-all ${topic===q ? 'bg-violet-500 text-white border-violet-500' : 'bg-violet-50 dark:bg-rose-900/20 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-rose-800 hover:bg-violet-100'}`}>{q}</button>)}
            </div>
          </>}
          {aiMode === 'script' && <>
            <h3 className="font-bold text-stone-800 dark:text-stone-100">🎬 Reel Script Generator</h3>
            <p className="text-xs text-stone-500">Get a full script with hook, story, and CTA for your next Reel.</p>
          </>}
          {aiMode === 'caption' && <>
            <h3 className="font-bold text-stone-800 dark:text-stone-100">✍️ Caption + Hashtag Generator</h3>
            <p className="text-xs text-stone-500">Enter your post topic and get a ready-to-post caption with hashtags.</p>
          </>}
          {aiMode === 'calendar' && <>
            <h3 className="font-bold text-stone-800 dark:text-stone-100">📅 Weekly Content Plan</h3>
            <p className="text-xs text-stone-500">Get a full week of content ideas tailored to your niche.</p>
          </>}

          <div className="flex gap-2">
            <input value={topic} onChange={e => setTopic(e.target.value)} placeholder={aiMode === 'calendar' ? 'Optional: focus theme (e.g. "prayer", "faith & money")' : 'Enter your topic or idea…'} className="flex-1 bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-4 py-2 text-sm" />
            <button onClick={() => {
              const modeDescriptions = {
                ideas: `Generate content ideas for this topic for a faith-based Instagram creator. Give hooks, caption, hashtags, and posting tip.`,
                script: `Write a complete Reel script for a faith-based creator with: 1) A strong hook (first 3 seconds), 2) The main story/teaching (30-60 seconds), 3) A clear CTA at the end. Format as: HOOK: ...\n\nSTORY: ...\n\nCTA: ... Put the full script in the "caption" field and tips in "postingTip".`,
                caption: `Write an Instagram caption with hashtags for this post topic for a faith-based lifestyle creator.`,
                calendar: `Create a 7-day content calendar for a faith-based Instagram creator${topic ? ` focused on: ${topic}` : ''}. For each day give a post idea and hook. Put the full calendar in the "caption" field.`,
              };
              callAI(topic || `${aiMode} for ${bizName}`, modeDescriptions[aiMode], aiMode === 'script' ? 'Reel script' : '9:16 Reel');
            }} disabled={aiLoading} className="px-5 py-2 bg-violet-500 text-white rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-violet-600 whitespace-nowrap">
              {aiLoading ? <Loader2 size={14} className="animate-spin" /> : 'Generate ✨'}
            </button>
          </div>
          {aiError && <p className="text-sm text-red-500">{aiError}</p>}

          {aiResult && (
            <div className="space-y-3 pt-2">
              {aiResult.hooks?.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <p className="font-bold text-amber-700 dark:text-amber-400 text-xs uppercase mb-2">🎣 Hooks (first 3 seconds)</p>
                  {aiResult.hooks.map((h, i) => (
                    <div key={i} className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-stone-700 dark:text-stone-200 text-sm flex-1">"{h}"</p>
                      <button onClick={() => copyText(h, `hook-${i}`)} className="text-xs text-violet-500 shrink-0">{copiedId===`hook-${i}` ? '✓' : 'Copy'}</button>
                    </div>
                  ))}
                </div>
              )}
              {aiResult.caption && (
                <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-700/40 border border-stone-200 dark:border-stone-600">
                  <div className="flex justify-between mb-2"><p className="font-bold text-stone-700 dark:text-stone-200 text-xs uppercase">📝 Caption / Script</p><button onClick={() => copyText(aiResult.caption, 'cap')} className="text-xs text-violet-500">{copiedId==='cap' ? '✓ Copied' : 'Copy'}</button></div>
                  <p className="text-stone-600 dark:text-stone-300 text-sm whitespace-pre-wrap">{aiResult.caption}</p>
                </div>
              )}
              {aiResult.hashtags?.length > 0 && (
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <div className="flex justify-between mb-1"><p className="font-bold text-blue-700 dark:text-blue-400 text-xs uppercase"># Hashtags</p><button onClick={() => copyText(aiResult.hashtags.map(h=>`#${h}`).join(' '), 'tags')} className="text-xs text-violet-500">{copiedId==='tags' ? '✓ Copied' : 'Copy all'}</button></div>
                  <p className="text-blue-600 dark:text-blue-300 text-sm">{aiResult.hashtags.map(h=>`#${h}`).join(' ')}</p>
                </div>
              )}
              {aiResult.cta && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                  <p className="font-bold text-emerald-700 dark:text-emerald-400 text-xs uppercase mb-1">📣 Call to Action</p>
                  <p className="text-stone-600 dark:text-stone-300 text-sm">"{aiResult.cta}"</p>
                </div>
              )}
              {aiResult.postingTip && (
                <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
                  <p className="font-bold text-violet-700 dark:text-violet-400 text-xs uppercase mb-1">💡 Posting tip</p>
                  <p className="text-stone-600 dark:text-stone-300 text-sm">{aiResult.postingTip}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
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

  const activeBiz = (businesses || []).find(b => b?.id === activeBusinessId);
  const bizNameSocial = activeBiz?.name || 'Your brand';
  const bizTypeSocial = activeBiz?.type || 'faith';

  const writeCaption = async () => {
    if (!aiTopic.trim()) return;
    setAiLoading(true); setAiResult('');
    try {
      const r = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'chat',
          topic: aiTopic,
          brandName: bizNameSocial,
          brandType: bizTypeSocial,
          chatHistory: [{
            role: 'user',
            text: `Write a ${aiPlatform} caption for: ${aiTopic}\n\nFormat your response as:\nCAPTION:\n[the caption with line breaks and emojis]\n\nHASHTAGS:\n[20-25 hashtags]`
          }]
        })
      });
      const data = await r.json();
      setAiResult(data.reply || 'Could not generate caption.');
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
      const r = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'chat',
          topic: 'repurpose content',
          brandName: bizNameSocial,
          brandType: bizTypeSocial,
          chatHistory: [{
            role: 'user',
            text: `Repurpose this content for every platform. Be platform-native — each one should feel like it was written for that platform specifically.\n\nOriginal script/content:\n${repScript}\n\nGive me:\nINSTAGRAM REEL CAPTION:\n[caption + hashtags]\n\nTIKTOK CAPTION:\n[caption + hashtags]\n\nYOUTUBE DESCRIPTION:\n[full description with timestamps placeholder]\n\nFACEBOOK POST:\n[longer form, community-focused]\n\nEMAIL SUBJECT + PREVIEW:\n[subject line + 2 sentence preview]\n\nHOOK 1:\n[first hook variation]\n\nHOOK 2:\n[second hook variation]\n\nHOOK 3:\n[third hook variation]`
          }]
        })
      });
      const data = await r.json();
      setRepResult(data.reply || 'Could not repurpose content.');
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
      const existing = JSON.parse(localStorage.getItem('kreativelync-post-analytics') || '[]');
      existing.push({ id: 'p' + Date.now(), businessId: activeBusinessId, title, platform: firstPlatform, postedAt: new Date().toISOString().slice(0, 10), views: 0, likes: 0, comments: 0, shares: 0, saves: 0, notes: '', autoLogged: true });
      localStorage.setItem('kreativelync-post-analytics', JSON.stringify(existing));
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
        <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-3xl p-8 shadow-sm transition-colors">
          <h3 className="text-xl font-semibold text-stone-800 flex items-center mb-6">
            <Share2 className="mr-2 text-violet-400" size={24} />
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
              <label key={key} className="flex items-center justify-between p-4 rounded-2xl border border-violet-100 hover:border-violet-300 transition-all cursor-pointer bg-violet-50/30 hover:bg-violet-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: bg, color: fg }}>
                    <Icon size={20} />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-stone-800">{label}</span>
                    <span className="text-xs text-stone-500 block mt-0.5">{desc}</span>
                  </div>
                </div>
                <div onClick={(e) => { e.preventDefault(); togglePlatform(key); }} className={`relative inline-block w-12 h-6 rounded-full transition-colors cursor-pointer ${platforms[key] ? 'bg-violet-400' : 'bg-violet-200'}`}>
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${platforms[key] ? 'translate-x-7' : 'translate-x-1'}`}></span>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-3xl p-8 shadow-sm transition-colors">
          <h3 className="text-xl font-semibold text-stone-800 flex items-center mb-6">
            <Wand2 className="mr-2 text-violet-400" size={24} />
            Smart Caption & SEO
          </h3>
          <div className="space-y-5">
            <div>
              <div className="mb-4 p-3 rounded-xl bg-violet-50 dark:bg-stone-700/50 border border-violet-100 dark:border-stone-600 text-sm">
                <span className="text-[10px] font-bold text-stone-400 uppercase">Publishing</span>
                {selectedVideo ? <p className="font-medium text-stone-800 dark:text-stone-100 mt-1">Video: {selectedVideo.name}</p> : <p className="text-stone-500 dark:text-stone-400 mt-1">No video selected. <button type="button" onClick={() => setActiveTab('library')} className="text-violet-600 dark:text-violet-400 font-bold hover:underline">Select in Media Library</button></p>}
                {selectedAudio ? <p className="font-medium text-stone-800 dark:text-stone-100 mt-0.5">Audio: {selectedAudio.name}</p> : <p className="text-stone-500 dark:text-stone-400 mt-0.5 text-xs">Optional: add music/voiceover from Media Library.</p>}
              </div>
              <label className="block text-xs font-bold text-stone-400 mb-2 uppercase tracking-widest">Master Caption</label>
              {/* AI Write Caption */}
              <div className="mb-4">
                <div className="flex gap-2">
                  <button onClick={() => { setAiOpen(o => !o); setRepOpen(false); }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-100 hover:bg-violet-200 text-rose-700 text-xs font-bold transition-colors">
                    <Sparkles size={13} /> AI Write Caption
                  </button>
                  <button onClick={() => { setRepOpen(o => !o); setAiOpen(false); }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-xs font-bold transition-colors">
                    <Wand2 size={13} /> Repurpose for All Platforms
                  </button>
                </div>

                {aiOpen && (
                  <div className="mt-3 bg-violet-50 border border-violet-200 rounded-2xl p-4 space-y-3">
                    <p className="text-xs font-bold text-stone-700">Write with AI</p>
                    <textarea value={aiTopic} onChange={e => setAiTopic(e.target.value)} placeholder="What's your video about? Paste your script or describe your topic..." rows={3} className="w-full bg-white border border-violet-200 rounded-xl p-3 text-sm text-stone-700 resize-none focus:outline-none focus:border-violet-400" />
                    <div className="flex gap-2 flex-wrap">
                      {['instagram','tiktok','youtube','facebook'].map(p => (
                        <button key={p} onClick={() => setAiPlatform(p)} className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize border transition-colors ${aiPlatform === p ? 'bg-violet-500 border-violet-500 text-white' : 'bg-white border-violet-200 text-stone-600 hover:border-violet-400'}`}>{p}</button>
                      ))}
                    </div>
                    <button onClick={writeCaption} disabled={aiLoading || !aiTopic.trim()} className="w-full py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-bold disabled:opacity-50 transition-all">
                      {aiLoading ? 'Writing...' : 'Generate Caption + Hashtags'}
                    </button>
                    {aiResult && (
                      <div className="bg-white border border-violet-200 rounded-xl p-3 text-xs text-stone-700 whitespace-pre-wrap max-h-48 overflow-y-auto">{aiResult}</div>
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

              <textarea rows="5" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Write your message..." className="w-full bg-violet-50/50 border border-violet-100 rounded-2xl p-4 text-sm text-stone-700 focus:outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-50 transition-all resize-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-400 mb-2 uppercase tracking-widest">Tags</label>
              <div className="flex flex-wrap gap-2 p-4 bg-violet-50/50 rounded-2xl border border-violet-100 mb-2">
                {tags.map((t) => (
                  <span key={t} className="text-xs bg-white text-violet-500 font-medium px-3 py-1.5 rounded-lg border border-violet-200 flex items-center gap-1">
                    #{t} <button type="button" onClick={() => removeTag(t)} className="text-stone-400 hover:text-red-500">&times;</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTag()} placeholder="Add tag (e.g. FaithJourney)" className="flex-1 bg-violet-50/50 border border-violet-100 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-violet-400" />
                <button onClick={addTag} className="px-4 py-2 rounded-xl bg-violet-100 text-violet-600 font-bold text-sm hover:bg-violet-200">Add</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="text-[10px] font-bold text-stone-400 uppercase">Tag Bundles:</span>
                <button onClick={() => applyTagBundle(TAG_BUNDLES.ministry)} className="px-3 py-1 rounded-lg text-xs font-bold bg-violet-100 text-violet-600 hover:bg-violet-200">Ministry</button>
                <button onClick={() => applyTagBundle(TAG_BUNDLES.business)} className="px-3 py-1 rounded-lg text-xs font-bold bg-indigo-100 text-indigo-600 hover:bg-indigo-200">Business</button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-400 mb-2 uppercase tracking-widest">Marketing Goal</label>
              <select value={marketingGoal || ''} onChange={(e) => setMarketingGoal(e.target.value)} className="w-full bg-violet-50/50 border border-violet-100 rounded-xl px-4 py-2 text-sm text-stone-700 focus:outline-none focus:border-violet-400">
                <option value="">None</option>
                <option value="growth">Growth (Contact)</option>
                <option value="sales">Sales (Stoklync)</option>
                <option value="prayer">Prayer Request (Her Stewardship)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-400 mb-2 uppercase tracking-widest">Contact Page (for QR overlay)</label>
              <input type="url" value={contactPageUrl || ''} onChange={(e) => setContactPageUrl(e.target.value)} placeholder="https://linktr.ee/... or Google Form for prayer requests" className="w-full bg-violet-50/50 border border-violet-100 rounded-xl px-4 py-2 text-sm text-stone-700 focus:outline-none focus:border-violet-400" />
              <p className="text-[10px] text-stone-500 mt-1">Link to Linktree, Google Form, or Her Stewardship signup. Used for QR overlay in Reels.</p>
            </div>
            <button onClick={handlePublish} className="w-full bg-violet-500 hover:bg-violet-600 text-white px-4 py-4 rounded-2xl text-sm font-bold shadow-lg flex items-center justify-center mt-4">
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
      <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-3xl p-8 shadow-sm transition-colors">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="text-xl font-semibold text-stone-800 flex items-center">
              <Video className="mr-2 text-violet-400" size={24} />
              Source: {selectedVideo ? selectedVideo.name : 'Select a video'}
            </h3>
            <p className="text-sm text-stone-500 mt-2">Define exact times to cut. No timeline scrubbing required.</p>
          </div>
          {videos.length > 0 && !selectedVideo && (
            <select onChange={(e) => setSelectedVideoId(Number(e.target.value))} className="bg-violet-50/50 border border-violet-100 rounded-xl px-4 py-2 text-sm">
              <option value="">Choose video...</option>
              {videos.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          )}
          {selectedVideo && (
            <button onClick={() => setSelectedVideoId(null)} className="text-sm text-violet-600 hover:underline">Change source</button>
          )}
        </div>

        {!selectedVideo && videos.length === 0 && (
          <div className="py-12 text-center text-stone-500">
            <p>Upload a video in Media Library first, then select it here.</p>
            <button onClick={() => studio.setActiveTab('library')} className="mt-4 text-violet-600 font-bold hover:underline">Go to Media Library</button>
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
                <div key={cut.id} className="grid grid-cols-12 gap-4 items-center bg-violet-50/50 p-3 rounded-2xl border border-violet-100">
                  <div className="col-span-3">
                    <input value={cut.start} onChange={(e) => updateCut(cut.id, 'start', e.target.value)} className="w-full bg-white border border-violet-200 rounded-xl px-4 py-2.5 text-sm text-violet-600 font-mono font-bold focus:outline-none focus:border-violet-400" placeholder="MM:SS.MS" />
                  </div>
                  <div className="col-span-3">
                    <input value={cut.end} onChange={(e) => updateCut(cut.id, 'end', e.target.value)} className="w-full bg-white border border-violet-200 rounded-xl px-4 py-2.5 text-sm text-violet-600 font-mono font-bold focus:outline-none focus:border-violet-400" placeholder="MM:SS.MS" />
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
            <div className="mt-8 flex justify-between items-center pt-8 border-t border-violet-100">
              <button onClick={addCut} className="text-sm font-bold text-violet-600 hover:text-violet-700 flex items-center bg-violet-50 px-5 py-2.5 rounded-xl border border-violet-100">
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
                className="bg-violet-500 hover:bg-violet-600 text-white px-8 py-3 rounded-xl text-sm font-bold shadow-lg flex items-center"
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
              <button type="button" onClick={() => setActiveTab('classic')} className="mt-4 text-sm font-bold text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-2">
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

/** KreativeLync brand kit — Ministry Brand Identity
 * Terracotta (Warmth, Humanity, Blood of Jesus), Sage (Spiritual Growth, Peace), Cream (Purity, Light), Charcoal (The Word, Truth), Gold (The King, Glory)
 * Typography: Playfair Display (headings), Inter (body)
 */
const BRAND_PRESETS = {
  sarah: {
    tagline: 'A woman like that, first.',
    color: 'violet',
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
      <div className="flex items-center gap-3 flex-wrap p-3 rounded-xl bg-violet-50/50 dark:bg-stone-700/30 border border-violet-100 dark:border-stone-600">
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
    <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-6 shadow-sm">
      <h4 className="text-sm font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <Package size={16} className="text-violet-400" /> Brand Kit — {businessName}
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
    <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-3xl p-8 shadow-sm">
      <h3 className="text-xl font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2 mb-4">
        <ImageIcon size={24} className="text-violet-400" />
        Create Post & Flyer
      </h3>
      <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">Use your brand kit to make cool graphics. Headline, subhead, colors—all from your brand.</p>
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="space-y-4 flex-1 max-w-sm">
          <div>
            <label className="text-xs font-bold text-stone-500 uppercase block mb-2">Size</label>
            <div className="flex gap-2">
              {POST_SIZES.map((s) => (
                <button key={s.id} onClick={() => setSize(s.id)} className={`px-3 py-2 rounded-xl text-sm font-medium ${size === s.id ? 'bg-violet-500 text-white' : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-400'}`}>{s.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-stone-500 uppercase block mb-2">Headline</label>
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Your main message" className="w-full px-4 py-3 rounded-xl bg-violet-50 dark:bg-stone-700 border border-violet-100 dark:border-stone-600 text-stone-800 dark:text-stone-100 placeholder-stone-400" style={{ fontFamily: `"${headingFont}", serif` }} />
          </div>
          <div>
            <label className="text-xs font-bold text-stone-500 uppercase block mb-2">Subhead</label>
            <input value={subhead} onChange={(e) => setSubhead(e.target.value)} placeholder="Optional tagline" className="w-full px-4 py-3 rounded-xl bg-violet-50 dark:bg-stone-700 border border-violet-100 dark:border-stone-600 text-stone-800 dark:text-stone-100 placeholder-stone-400" />
          </div>
          <div>
            <label className="text-xs font-bold text-stone-500 uppercase block mb-2">Background</label>
            <div className="flex gap-2 flex-wrap">
              {colors.map((hex, i) => (
                <button key={i} onClick={() => setBgColor(hex)} title={colorNames[i]} className={`w-10 h-10 rounded-xl border-2 ${bgColor === hex ? 'border-violet-500 ring-2 ring-violet-300' : 'border-transparent'} transition-all`} style={{ backgroundColor: hex }} />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-stone-500 uppercase block mb-2">Text color</label>
            <div className="flex gap-2 flex-wrap">
              {colors.map((hex, i) => (
                <button key={i} onClick={() => setTextColor(hex)} title={colorNames[i]} className={`w-10 h-10 rounded-xl border-2 ${textColor === hex ? 'border-violet-500 ring-2 ring-violet-300' : 'border-transparent'} transition-all`} style={{ backgroundColor: hex }} />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <button onClick={exportPng} className="px-4 py-2.5 rounded-xl bg-violet-500 text-white font-bold text-sm hover:bg-violet-600">Download PNG</button>
            <button onClick={addToIg} className="px-4 py-2.5 rounded-xl border border-violet-200 dark:border-stone-600 text-violet-600 dark:text-violet-400 font-bold text-sm hover:bg-violet-50 dark:hover:bg-stone-700">Add to IG Grid</button>
            <button onClick={addToPins} className="px-4 py-2.5 rounded-xl border border-violet-200 dark:border-stone-600 text-violet-600 dark:text-violet-400 font-bold text-sm hover:bg-violet-50 dark:hover:bg-stone-700">Add to Pins</button>
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
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search verses by keyword..." className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-violet-500" />
      <div className="max-h-48 overflow-y-auto space-y-1 pr-0.5">
        {filtered.map(v => (
          <button key={v.ref} onClick={() => onInsert(v.ref, v.text)}
            className="w-full text-left bg-stone-800 border border-stone-700 hover:border-rose-600 rounded-xl px-3 py-2 transition-colors group">
            <span className="text-[10px] font-black text-violet-400 block">{v.ref}</span>
            <span className="text-[10px] text-stone-400 group-hover:text-stone-200 transition-colors line-clamp-2">{v.text}</span>
          </button>
        ))}
        {filtered.length === 0 && <p className="text-[10px] text-stone-600 text-center py-2">No matches — try a custom lookup below</p>}
      </div>
      <div className="flex gap-1.5">
        <input value={lookupRef} onChange={e => setLookupRef(e.target.value)} onKeyDown={e => e.key === 'Enter' && lookupVerse()} placeholder="Any verse... e.g. Romans 8:1" className="flex-1 bg-stone-800 border border-stone-700 rounded-xl px-3 py-1.5 text-xs text-stone-100 focus:outline-none focus:border-violet-500" />
        <button onClick={lookupVerse} disabled={lookupLoading} className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold disabled:opacity-50">{lookupLoading ? '...' : 'Find'}</button>
      </div>
      {lookupError && <p className="text-[10px] text-violet-400">{lookupError}</p>}
      {lookupResult && (
        <button onClick={() => onInsert(lookupResult.ref, lookupResult.text)} className="w-full text-left bg-violet-950/40 border border-rose-700 rounded-xl px-3 py-2 hover:border-violet-500 transition-colors">
          <span className="text-[10px] font-black text-violet-400 block">{lookupResult.ref}</span>
          <span className="text-[10px] text-stone-300 line-clamp-3">{lookupResult.text}</span>
          <span className="text-[10px] text-violet-500 font-bold mt-1 block">Tap to insert as overlay</span>
        </button>
      )}
    </div>
  );
};

// ── Animated Character ────────────────────────────────────────────────────
const AnimatedCharacter = ({ anim }) => (
  <div className={`char-entrance char-body-${anim} relative select-none`} style={{ width: 56, height: 92, filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.6))' }}>
    {/* Head */}
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-11 h-11 rounded-full bg-gradient-to-br from-violet-200 to-violet-400 border-2 border-violet-500 flex items-center justify-center">
      <span className="text-lg leading-none">😊</span>
    </div>
    {/* Body */}
    <div className="absolute top-10 left-1/2 -translate-x-1/2 w-8 h-11 rounded-xl bg-gradient-to-b from-violet-400 to-violet-600" />
    {/* Left arm */}
    <div className={`absolute top-12 left-0 w-6 h-2.5 rounded-full bg-violet-400 origin-right ${anim === 'wave' ? 'char-arm-wave' : anim === 'point' ? 'char-arm-point' : ''}`}
      style={{ transform: anim === 'point' ? 'rotate(-55deg)' : 'rotate(22deg)' }} />
    {/* Right arm */}
    <div className="absolute top-12 right-0 w-6 h-2.5 rounded-full bg-violet-400" style={{ transform: 'rotate(-22deg)' }} />
    {/* Legs */}
    <div className="absolute bottom-0 left-3 w-2.5 h-8 rounded-full bg-violet-500" style={{ transform: 'rotate(6deg)' }} />
    <div className="absolute bottom-0 right-3 w-2.5 h-8 rounded-full bg-violet-500" style={{ transform: 'rotate(-6deg)' }} />
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
        <button onPointerDown={e => { e.stopPropagation(); onDelete(); }} className="text-stone-600 hover:text-violet-400 shrink-0"><X size={12} /></button>
      </div>
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-stone-700 pt-2">
          <input value={overlay.content} onChange={e => onChange({ ...overlay, content: e.target.value })} placeholder="Text content" className="w-full bg-stone-900 border border-stone-700 rounded-lg px-2 py-1.5 text-xs text-stone-100 focus:outline-none focus:border-violet-500" />
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
                <button key={p} onClick={() => onChange({ ...overlay, position: p })} className={`px-2 py-1 rounded-lg text-[10px] font-bold border capitalize transition-colors ${overlay.position === p ? 'bg-violet-600 border-rose-600 text-white' : 'bg-stone-900 border-stone-700 text-stone-400 hover:border-stone-500'}`}>{p}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-stone-500 mb-1">Animation</p>
            <div className="flex flex-wrap gap-1">
              {['fade','slide-up','slide-right','zoom','bounce','typewriter'].map(a => (
                <button key={a} onClick={() => onChange({ ...overlay, animStyle: a })} className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${overlay.animStyle === a ? 'bg-violet-600 border-rose-600 text-white' : 'bg-stone-900 border-stone-700 text-stone-400 hover:border-stone-500'}`}>{a}</button>
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
  const nextVideoRef = useRef(null);
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
  const [markers, setMarkers] = useState(() => JSON.parse(localStorage.getItem('kreativelync-markers') || '[]'));
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [trackHeights, setTrackHeights] = useState({ text: 36, video: 100, audio: 64, extra: 48 });
  const [resizingTrack, setResizingTrack] = useState(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showAIHelper, setShowAIHelper] = useState(false);
  const [inspectorTab, setInspectorTab] = useState('edit');
  // AI Content Generator state
  const [aiTopic, setAiTopic] = useState('');
  const [aiDescription, setAiDescription] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState('');
  const [aiCopied, setAiCopied] = useState('');
  const generateAIContent = async () => {
    if (!aiTopic.trim()) return;
    setAiLoading(true); setAiError(''); setAiResult(null);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: aiTopic.trim(), description: aiDescription.trim(), niche: 'faith/lifestyle', format: '9:16 Reel' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setAiResult(data);
    } catch (err) {
      setAiError(err.message || 'Something went wrong');
    } finally {
      setAiLoading(false);
    }
  };
  const copyAI = (text, key) => {
    navigator.clipboard.writeText(text).then(() => { setAiCopied(key); setTimeout(() => setAiCopied(''), 2000); });
  };
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
  const [animOverlays, setAnimOverlays] = useState(() => { try { return JSON.parse(localStorage.getItem('kreativelync-anim-overlays') || '[]'); } catch { return []; } });
  const animOverlaysRef = useRef(animOverlays);
  useEffect(() => { animOverlaysRef.current = animOverlays; localStorage.setItem('kreativelync-anim-overlays', JSON.stringify(animOverlays)); }, [animOverlays]);
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
  const rippleDeleteClip = useEditorStore(s => s.rippleDeleteClip);
  const updateClip = useEditorStore(s => s.updateClip);
  const addClipToTrack = useEditorStore(s => s.addClipToTrack);
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
  const nearestMainClip = useMemo(() => {
    if (!hasLayeredClips) return null;
    const mainTrack = timelineTracks?.find(t => t.label === 'Main');
    const clips = (mainTrack?.clips || []).sort((a, b) => a.startOffset - b.startOffset);
    if (!clips.length) return null;
    return clips.reduce((nearest, c) => {
      const dist = Math.min(Math.abs(c.startOffset - playhead), Math.abs(c.startOffset + c.duration - playhead));
      const nearestDist = nearest ? Math.min(Math.abs(nearest.startOffset - playhead), Math.abs(nearest.startOffset + nearest.duration - playhead)) : Infinity;
      return dist < nearestDist ? c : nearest;
    }, null);
  }, [hasLayeredClips, timelineTracks, playhead]);
  const videoForPreview = activeMainClipAtPlayhead?.asset || (nearestMainClip ? assets?.find(a => a.id === nearestMainClip.assetId) : null) || selectedVideo;

  // Pre-load the next clip's video asset so clip transitions are instant
  const nextClipAsset = useMemo(() => {
    if (!hasLayeredClips) return null;
    const mainTrack = timelineTracks?.find(t => t.label === 'Main');
    const clips = (mainTrack?.clips || []).sort((a, b) => a.startOffset - b.startOffset);
    const nextClip = clips.find(c => c.startOffset > playhead);
    if (!nextClip) return null;
    const asset = assets?.find(a => a.id === nextClip.assetId);
    // Only preload if it's a different file than what's currently playing
    return (asset && asset.url !== videoForPreview?.url) ? asset : null;
  }, [hasLayeredClips, timelineTracks, playhead, assets, videoForPreview?.url]);

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

  useEffect(() => { localStorage.setItem('kreativelync-markers', JSON.stringify(markers)); }, [markers]);

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
      const raw = JSON.parse(localStorage.getItem('kreativelync-timeline-text') || '[]');
      const parsed = raw.map(c => {
        const end = c.end ?? (c.start + ((c.width ?? 10) * 90 / 100));
        return { ...c, start: c.start ?? 0, end, x: c.x ?? (c.position === 'center' ? 50 : c.position === 'bottom' ? 50 : 50), y: c.y ?? (c.position === 'center' ? 50 : c.position === 'bottom' ? 85 : 15) };
      });
      if (parsed.length > 0) setTextClips(parsed);
    } catch (_) {}
  }, []);
  useEffect(() => { localStorage.setItem('kreativelync-timeline-text', JSON.stringify(textClips)); }, [textClips]);

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
      const state = useEditorStore.getState();
      const hasLayered = state.timelineTracks?.some(t => (t.clips || []).length > 0);
      if (hasLayered) {
        // Seek video to correct position within the newly loaded NLE clip
        const mainTrack = state.timelineTracks?.find(tr => tr.label === 'Main');
        const ph = playheadRef.current;
        const clip = (mainTrack?.clips || []).find(c => ph >= c.startOffset && ph < c.startOffset + (c.duration || 0));
        e.target.currentTime = clip ? Math.max(0, (clip.trimStart ?? 0) + (ph - clip.startOffset)) : 0;
      } else {
        setMainSegments([{ id: 'seg0', start: 0, end: d, transition: 'cut' }]);
        setAudioSegments([{ id: 'a0', start: 0, end: d }]);
        setPlayhead(0);
        e.target.currentTime = 0;
      }
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
      if (draggingPlayheadRef.current) return;
      const v = e.target;
      const sourceT = v.currentTime;

      // NLE mode: map source time back to timeline position via active clip
      const state = useEditorStore.getState();
      const hasLayered = state.timelineTracks?.some(t => (t.clips || []).length > 0);
      if (hasLayered) {
        const mainTrack = state.timelineTracks?.find(tr => tr.label === 'Main');
        const clips = (mainTrack?.clips || []).sort((a, b) => a.startOffset - b.startOffset);
        const clip = clips.find(c => {
          const rel = sourceT - (c.trimStart ?? 0);
          return rel >= 0 && rel < (c.duration || 0);
        });
        if (clip) {
          const tl = clip.startOffset + (sourceT - (clip.trimStart ?? 0));
          setPlayhead(tl);
          // If we've reached the end of this clip, jump to next
          if (sourceT >= (clip.trimStart ?? 0) + (clip.duration || 0) - 0.08) {
            const nextClip = clips.find(c2 => c2.startOffset > clip.startOffset);
            if (nextClip) {
              v.currentTime = nextClip.trimStart ?? 0;
              setPlayhead(nextClip.startOffset);
            } else {
              v.pause();
              setStorePlaying(false);
            }
          }
        } else {
          // Playhead is in a gap — auto-jump to the next clip instead of freezing
          const ph = playheadRef.current;
          const nextClip = clips.find(c => c.startOffset > ph);
          if (nextClip) {
            v.currentTime = nextClip.trimStart ?? 0;
            setPlayhead(nextClip.startOffset);
          } else {
            v.pause();
            setStorePlaying(false);
          }
        }
        return;
      }

      // Legacy mode
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
      if (sourceT >= tlDuration || ranges.length === 0) { v.pause(); setPlayhead(tlDuration); return; }
      const next = ranges.find(r => r?.seg && r.seg.start > sourceT);
      if (next?.seg) v.currentTime = next.seg.start;
    } catch (_) {}
  };

  // Seeks only the video element — no state update. Used for throttled seeking during drag.
  const seekVideoOnly = (timelineT) => {
    const v = videoRef.current;
    if (!v) return;
    const t = Math.max(0, Math.min(effectiveDuration, timelineT));
    const state = useEditorStore.getState();
    const hasLayered = state.timelineTracks?.some(tr => (tr.clips || []).length > 0);
    if (hasLayered) {
      const mainTrack = state.timelineTracks?.find(tr => tr.label === 'Main');
      const clips = (mainTrack?.clips || []).sort((a, b) => a.startOffset - b.startOffset);
      let clip = clips.find(c => t >= c.startOffset && t < c.startOffset + (c.duration || 0));
      if (!clip) clip = clips.reduce((nearest, c) => {
        const dist = Math.min(Math.abs(c.startOffset - t), Math.abs(c.startOffset + c.duration - t));
        const nearestDist = nearest ? Math.min(Math.abs(nearest.startOffset - t), Math.abs(nearest.startOffset + nearest.duration - t)) : Infinity;
        return dist < nearestDist ? c : nearest;
      }, null);
      if (clip) {
        const inClip = t >= clip.startOffset && t < clip.startOffset + clip.duration;
        const sourceTime = inClip ? (clip.trimStart ?? 0) + (t - clip.startOffset) : (clip.trimStart ?? 0);
        if (Math.abs(v.currentTime - sourceTime) > 0.05) v.currentTime = Math.max(0, sourceTime);
      }
      return;
    }
    const sourceTime = timelineToSource(t);
    const t0 = clipIn ?? 0;
    const t1 = clipOut ?? duration;
    v.currentTime = Math.max(t0, Math.min(t1, sourceTime));
    const ranges = getAudioTimelineRanges(audioSegmentsRef.current);
    const inAudioGap = ranges.length > 0 && !ranges.find(r => t >= r.tlStart && r.tlEnd > t);
    const shouldMute = userMuted || inAudioGap;
    if (v.muted !== shouldMute) v.muted = shouldMute;
  };

  const seekTo = (timelineT) => {
    const t = Math.max(0, Math.min(effectiveDuration, timelineT));
    setPlayhead(t);
    seekVideoOnly(t);
  };

  const getEventX = (e) => e.clientX ?? e.touches?.[0]?.clientX ?? e.changedTouches?.[0]?.clientX ?? 0;
  const handleRulerClick = (e) => {
    const ruler = timelineRulerRef.current;
    if (!ruler || effectiveDuration <= 0) return;
    const rect = ruler.getBoundingClientRect();
    const x = getEventX(e) - rect.left;
    // Use actual rendered width — NOT a hardcoded value — so clicks map 1:1 to the ruler
    const pct = Math.max(0, Math.min(1, rect.width > 0 ? x / rect.width : 0));
    const t = Math.max(0, Math.min(effectiveDuration, pct * effectiveDuration));
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
      pushHistory();
      const newClipId = splitClipAtPlayheadStore('Main') || splitClipAtPlayheadStore('Audio');
      if (newClipId) {
        // Auto-select the second clip so Delete is immediately available
        setSelectedClipId(newClipId);
        setSplitFeedback('✂ Split! Select a piece and press Delete');
        setTimeout(() => setSplitFeedback(null), 3000);
      } else {
        setSplitFeedback('Move playhead into a clip (at least 0.5s from start or end)');
        setTimeout(() => setSplitFeedback(null), 3000);
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
        if (clip) { pushHistory(); rippleDeleteClip(t.id, clip.id); setSelectedClipId(null); return; }
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
  // Throttle video .currentTime updates to ~30fps so the decoder doesn't lock up during fast drags
  const lastSeekTimeRef = useRef(0);

  const handlePlayheadDrag = (e) => {
    if (effectiveDuration <= 0) return;
    // Use the lane element if available (more accurate), otherwise fall back to ruler
    const lane = e.target?.closest?.('[data-timeline-lane]');
    const el = lane || timelineRulerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = getEventX(e) - rect.left;
    const pct = Math.max(0, Math.min(1, rect.width > 0 ? x / rect.width : 0));
    let t = Math.max(0, Math.min(effectiveDuration, pct * effectiveDuration));

    // Snap playhead to clip edges when within 0.15s (CapCut-style precision)
    if (hasLayeredClips) {
      const state = useEditorStore.getState();
      const clips = state.timelineTracks?.flatMap(tr => tr.clips || []) || [];
      const snapPoints = clips.flatMap(c => [c.startOffset, c.startOffset + (c.duration || 0)]);
      if (snapPoints.length) {
        const closest = snapPoints.reduce((prev, curr) => Math.abs(curr - t) < Math.abs(prev - t) ? curr : prev);
        if (isFinite(closest) && Math.abs(closest - t) < 0.15) t = closest;
      }
    }

    dragTargetRef.current = t;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      // UI playhead moves every frame — smooth at 120fps
      setPlayhead(t);
      // Video decoder only seeks every ~32ms (30fps) to prevent lockup during fast drags
      const now = performance.now();
      if (now - lastSeekTimeRef.current > 32) {
        seekVideoOnly(t);
        lastSeekTimeRef.current = now;
      }
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
      title: caption?.slice(0, 60) || businesses.find(b => b.id === activeBusinessId)?.name || 'KreativeLync',
      tags: [...(tags || []), 'KreativeLync', 'Ministry', businesses.find(b => b.id === activeBusinessId)?.name].filter(Boolean),
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
        await saveToDevice(mp4Blob, baseName + fmtSuffix + '-kreativelync.mp4');
      } else if (!hasText && exportFormat === 'source') {
        const segs = (mainSegments || []).filter(s => s && typeof s?.start === 'number' && typeof s?.end === 'number');
        const start = segs.length > 0 ? Math.min(...segs.map(s => s.start)) : 0;
        const end = segs.length > 0 ? Math.max(...segs.map(s => s.end)) : duration;
        const { url } = await processVideo(selectedVideo.id, start, end);
        const res = await fetch(url);
        const blob = await res.blob();
        const mp4Blob = await encodeToMp4WithMetadata(blob, metadata);
        await saveToDevice(mp4Blob, baseName + '-kreativelync.mp4');
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
        await saveToDevice(mp4Blob, baseName + fmtSuffix + '-kreativelync.mp4');
      }
      // Auto-log this post to analytics
      try {
        const existing = JSON.parse(localStorage.getItem('kreativelync-post-analytics') || '[]');
        existing.push({ id: 'p' + Date.now(), businessId: activeBusinessId, title: baseName, platform: exportFormat.startsWith('9') ? 'instagram' : exportFormat.startsWith('16') ? 'youtube' : 'instagram', postedAt: new Date().toISOString().slice(0, 10), views: 0, likes: 0, comments: 0, shares: 0, saves: 0, notes: '', autoLogged: true });
        localStorage.setItem('kreativelync-post-analytics', JSON.stringify(existing));
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
      {/* ── Left Media Panel — CapCut-style, desktop only ── */}
      <div className="hidden lg:flex flex-col min-h-0 bg-stone-950 border-r border-stone-700/50 overflow-hidden" style={{ gridArea: 'media' }}>
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-stone-700/50 bg-stone-900">
          <span className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Media</span>
          <label className="cursor-pointer flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-bold transition-colors">
            <Plus size={11} /> Import
            <input type="file" accept="video/*,audio/*,image/*" multiple className="hidden" onChange={(e) => handleInlineUpload(e)} />
          </label>
        </div>
        {/* Clip grid */}
        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {videos.length === 0 ? (
            <label className="cursor-pointer flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-dashed border-stone-700 hover:border-rose-600 hover:bg-violet-950/20 transition-all text-center mt-2">
              <div className="w-12 h-12 rounded-2xl bg-stone-800 flex items-center justify-center">
                <Upload size={22} className="text-stone-500" />
              </div>
              <div>
                <p className="text-xs font-bold text-stone-400">Import video</p>
                <p className="text-[10px] text-stone-600 mt-0.5">MP4, MOV, WebM</p>
              </div>
              <input type="file" accept="video/*" multiple className="hidden" onChange={(e) => handleInlineUpload(e)} />
            </label>
          ) : (
            <>
              <div>
                <p className="text-[9px] font-bold text-stone-600 uppercase tracking-widest mb-1.5 px-0.5">Videos</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {videos.map(v => (
                    <button key={v.id}
                      draggable
                      onDragStart={e => { e.dataTransfer.setData('assetId', v.id); e.dataTransfer.setData('assetType', 'video'); }}
                      onClick={() => { insertClipAtPlayhead(0, v.id); setSelectedVideoId(v.id); }}
                      className={`relative rounded-lg overflow-hidden aspect-video border-2 transition-all group ${selectedVideo?.id === v.id ? 'border-violet-500 ring-1 ring-violet-500/50' : 'border-stone-700 hover:border-stone-500'}`}
                      title={`Add "${v.name?.replace(/\.[^.]+$/, '') || 'Clip'}" to timeline`}>
                      <video src={v.url} muted playsInline preload="metadata" className="w-full h-full object-cover"
                        onLoadedMetadata={e => { e.target.currentTime = 0.5; }} />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                      <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-gradient-to-t from-black/80 to-transparent">
                        <span className="text-[8px] text-stone-300 truncate block leading-tight">
                          {v.name?.replace(/\.[^.]+$/, '').slice(0, 16) || 'Clip'}
                        </span>
                      </div>
                      <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-violet-600/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow">
                        <Plus size={10} className="text-white" />
                      </div>
                    </button>
                  ))}
                  <label className="cursor-pointer aspect-video rounded-lg border-2 border-dashed border-stone-700 hover:border-rose-600 flex items-center justify-center bg-stone-900/50 hover:bg-violet-950/20 transition-all">
                    <Plus size={16} className="text-stone-600 hover:text-violet-400" />
                    <input type="file" accept="video/*" multiple className="hidden" onChange={(e) => handleInlineUpload(e)} />
                  </label>
                </div>
              </div>
              {/* Audio assets */}
              {audioFiles.length > 0 && (
                <div>
                  <p className="text-[9px] font-bold text-stone-600 uppercase tracking-widest mb-1.5 px-0.5">Audio</p>
                  <div className="space-y-1">
                    {audioFiles.map(a => (
                      <button key={a.id}
                        onClick={() => { insertClipAtPlayhead(3, a.id); setSelectedAudioId(a.id); }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border border-stone-700 bg-stone-900 hover:border-emerald-600 hover:bg-emerald-950/20 transition-all text-left group">
                        <div className="w-7 h-7 rounded-md bg-emerald-900/40 flex items-center justify-center shrink-0">
                          <Music size={12} className="text-emerald-400" />
                        </div>
                        <span className="text-[10px] text-stone-300 truncate flex-1">{a.name?.replace(/\.[^.]+$/, '').slice(0, 18) || 'Audio'}</span>
                        <Plus size={10} className="text-stone-600 group-hover:text-emerald-400 shrink-0 opacity-0 group-hover:opacity-100 transition-all" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Stage — 40vh mobile, object-contain, no crop on phone */}
      <div className="min-h-0 overflow-hidden flex flex-col" style={{ gridArea: 'stage' }}>
        <div ref={canvasRef} onClick={videoForPreview ? togglePlayPause : undefined} className={`flex-1 min-h-0 flex flex-col ${videoForPreview ? 'cursor-pointer' : ''}`}>
          {videoForPreview ? (
            <>
              <div className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden" style={{ filter: vidFilterCSS || undefined }}>
                <video
                  key={videoForPreview.id}
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
                {/* Hidden preloader: buffers next clip so clip transitions are instant */}
                {nextClipAsset && (
                  <video
                    key={`preload-${nextClipAsset.id}`}
                    ref={nextVideoRef}
                    src={nextClipAsset.url}
                    preload="auto"
                    muted
                    playsInline
                    style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }}
                  />
                )}
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
                const colorMap = { white: 'text-white', black: 'text-black', yellow: 'text-yellow-300', rose: 'text-violet-300', cyan: 'text-cyan-300', lime: 'text-lime-300', orange: 'text-orange-400', gold: 'text-amber-400', amber: 'text-amber-400', indigo: 'text-indigo-300' };
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
                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 select-none ${animClass} ${noAnimBase ? `${fontMap[c.font] || fontMap.sans} ${colorClass} ${c.bold ? 'font-bold' : 'font-normal'}` : ''} ${isSelected || draggingTextId === c.id ? 'ring-2 ring-violet-400 ring-offset-2 cursor-move' : 'cursor-move'} ${hasBgBox && noAnimBase ? 'bg-black/60 px-3 py-1.5 rounded-lg' : (c.lowerThird && !animStyle ? 'bg-black/55 px-6 py-2 rounded' : '')}`}
                    style={{ left: `${x}%`, top: `${y}%`, zIndex: 20, opacity: textOpacity, ...(noAnimBase ? colorStyle : {}), ...(noAnimBase && c.font === 'serif' ? { fontFamily: '"Playfair Display", Georgia, serif' } : {}) }}
                    onMouseDown={(e) => handleTextDragStart(e, c)}
                    onClick={(e) => { e.stopPropagation(); setEditingClipId(c.id); }}
                  >
                    <span className={noAnimBase ? `${sizeMap[c.size] || sizeMap.md} ${hasShadow ? 'drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]' : ''}` : ''}>{c.text}</span>
                  </div>
                );
              })}
            </>
          ) : hasLayeredClips ? (
            // NLE clips exist but playhead is in a gap — show black screen, not the picker
            <div className="flex-1 flex items-center justify-center bg-black">
              <span className="text-stone-600 text-xs">Click a clip on the timeline to preview</span>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-3 gap-3 overflow-y-auto">
              {videos.length > 0 ? (
                <>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Tap a clip to start editing</p>
                  <div className="flex flex-row gap-2 flex-wrap justify-center w-full max-w-sm">
                    {videos.map(v => (
                      <button key={v.id} onClick={() => { setSelectedVideoId(v.id); setTimeout(() => insertClipAtPlayhead(0, v.id), 80); }}
                        className="group relative rounded-lg overflow-hidden border-2 border-stone-700 hover:border-violet-500 transition-all bg-stone-800 flex items-center gap-2 px-2 py-1.5">
                        <div className="relative w-14 h-9 rounded overflow-hidden shrink-0">
                          <video src={v.url} className="absolute inset-0 w-full h-full object-cover" muted playsInline preload="metadata" />
                          <Play size={14} className="absolute inset-0 m-auto text-white/90 group-hover:text-violet-400 transition-colors" />
                        </div>
                        <span className="text-[10px] text-white font-bold truncate max-w-[80px]">{v.name?.replace(/\.[^.]+$/, '') || 'Clip'}</span>
                      </button>
                    ))}
                    <label className="cursor-pointer flex items-center gap-1 text-xs text-violet-400 font-bold hover:text-violet-300 transition-colors px-2 py-1.5 border-2 border-dashed border-rose-900 hover:border-violet-500 rounded-lg">
                      <Plus size={13} /> Add clip
                      <input type="file" accept="video/*" multiple className="hidden" onChange={e => { Array.from(e.target.files || []).forEach(f => { const id = addAsset(f, 'video'); if (id) setTimeout(() => insertClipAtPlayhead(0, id), 80); }); e.target.value = ''; }} />
                    </label>
                  </div>
                </>
              ) : (
                <label className="cursor-pointer flex flex-col items-center gap-4 text-center group w-full max-w-xs">
                  {/* Upload icon with glow */}
                  <div className="relative">
                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-900/60 to-stone-800 border-2 border-dashed border-stone-600 group-hover:border-violet-500 flex items-center justify-center transition-all group-hover:scale-105 shadow-lg group-hover:shadow-rose-900/30">
                      <Upload size={32} className="text-stone-500 group-hover:text-violet-400 transition-colors" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-violet-600 group-hover:bg-violet-500 flex items-center justify-center shadow-lg transition-colors">
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
            { id: 'ai',      icon: <Bot size={13} />,      label: 'AI' },
            { id: 'camera',  icon: <Camera size={13} />,   label: 'Camera' },
            { id: 'export',  icon: <Download size={13} />, label: 'Export' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setInspectorTab(tab.id)}
              className={`flex-1 min-w-[44px] flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-bold transition-colors border-b-2 ${inspectorTab === tab.id ? 'border-violet-500 text-violet-400 bg-violet-950/30' : 'border-transparent text-stone-500 hover:text-stone-300'}`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Playback row — always visible above tabs */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-stone-700/40 shrink-0 bg-stone-900">
          <button onClick={togglePlayPause} disabled={!videoForPreview} className="w-8 h-8 rounded-full flex items-center justify-center bg-violet-500 hover:bg-violet-400 disabled:opacity-40 text-white shrink-0" title="Play / Pause (Space)">
            {!playing ? <Play size={13} fill="currentColor" /> : <Pause size={13} />}
          </button>
          <span className="font-mono text-sm font-bold text-violet-300 tabular-nums">{secToTimecode(playhead)}</span>
          <span className="text-[10px] text-stone-600 font-mono">/ {secToTimecode(timelineDuration)}</span>
          <div className="flex-1" />
          {/* Format quick-switch */}
          <div className="flex gap-1">
            {[{ id: '9:16', label: '9:16' }, { id: '16:9', label: '16:9' }, { id: '1:1', label: '1:1' }].map(f => (
              <button key={f.id} onClick={() => setExportFormat(f.id)} className={`px-1.5 py-1 rounded text-[10px] font-bold border transition-colors ${exportFormat === f.id ? 'bg-violet-500 border-violet-500 text-white' : 'bg-stone-800 border-stone-700 text-stone-500 hover:text-stone-300'}`}>{f.label}</button>
            ))}
          </div>
          <button onClick={undoAll} disabled={history.length === 0} className="p-1.5 text-stone-600 hover:text-white disabled:opacity-30" title="Undo"><RotateCcw size={12} /></button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden text-stone-100">

          {/* ── EDIT TAB ─────────────────────────────── */}
          {inspectorTab === 'edit' && (
            <div className="p-3 space-y-3">
              {/* Selection status */}
              {(selectedSegmentId || selectedAudioSegmentId) ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-violet-950/40 border border-rose-700/50 rounded-xl text-[11px] text-violet-300 font-bold">
                  <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
                  {selectedSegmentId ? 'Video clip selected' : 'Audio clip selected'} — ready to edit
                </div>
              ) : videoForPreview ? (
                <p className="text-[10px] text-stone-500 text-center py-1">Click a clip on the timeline to select it, then Split or Delete</p>
              ) : null}

              {/* Primary edit actions — big buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={splitAtPlayhead} disabled={!videoForPreview} className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-rose-900/50 border border-rose-700/60 text-violet-300 hover:bg-violet-800/60 active:scale-95 disabled:opacity-40 transition-all" title="Split clip at playhead (S)">
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
                <button onClick={() => setSnapEnabled(s => !s)} className={`p-2 rounded-lg border ${snapEnabled ? 'bg-rose-900/40 border-rose-800/50 text-violet-400' : 'bg-stone-800 border-stone-700 text-stone-500'}`} title={`Snap ${snapEnabled ? 'on' : 'off'}`}><Magnet size={13} /></button>
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
                          <button key={sp} onClick={() => setSpeed(sp)} className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${currSpeed === sp ? 'bg-violet-500 border-violet-500 text-white' : 'bg-stone-700 border-stone-600 text-stone-300 hover:bg-stone-600'}`}>{sp}x</button>
                        ))}
                      </div>
                    </div>

                    {/* Transition picker */}
                    <div>
                      <p className="text-[10px] text-stone-500 uppercase font-bold mb-1.5">Transition into next clip</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {TIMELINE_TRANSITIONS.map(tx => (
                          <button key={tx.id} onClick={() => setTx(tx.id)} title={tx.when}
                            className={`flex flex-col items-center gap-0.5 py-2 rounded-xl border text-[10px] font-bold transition-all active:scale-95 ${currTxId === tx.id ? (tx.seamless ? 'bg-emerald-900/50 border-emerald-600 text-emerald-300' : 'bg-rose-900/50 border-rose-600 text-violet-300') : 'bg-stone-700 border-stone-600 text-stone-400 hover:border-stone-500 hover:text-stone-200'}`}>
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
                    <button onClick={resetTransform} className="text-[10px] text-violet-400 hover:text-violet-300">Reset</button>
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
                        className={`py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${cropAspect === a.id ? 'bg-violet-600 border-violet-500 text-white' : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-500'}`}>
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
                      className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-colors active:scale-95 ${transformFlipH ? 'bg-violet-600 border-violet-500 text-white' : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700'}`}>
                      ↔ Flip H
                    </button>
                    <button onClick={() => setTransformFlipV(f => !f)} title="Flip vertical — mirror top/bottom"
                      className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-colors active:scale-95 ${transformFlipV ? 'bg-violet-600 border-violet-500 text-white' : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700'}`}>
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
                <button onClick={isListening ? stopSpeech : startSpeech} className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 ${isListening ? 'bg-violet-500 text-white' : 'bg-stone-800 border border-stone-700 text-violet-400 hover:bg-stone-700'}`}>
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
                        className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors ${editingClipId === c.id ? 'border-violet-500 bg-violet-950/40 text-violet-300' : 'border-stone-700 bg-stone-800 text-stone-300 hover:border-stone-600'}`}>
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
                    <p className="text-[10px] font-bold text-violet-300 uppercase tracking-wider">Edit Caption</p>
                    <button onClick={() => { removeTextClip(editingClipId); setEditingClipId(null); }} className="text-[10px] text-red-400 hover:text-red-300">Delete</button>
                  </div>
                  {/* Text content */}
                  <textarea value={editingClip.text || ''} rows={2}
                    onChange={e => updateTextClip(editingClipId, { text: e.target.value })}
                    placeholder="Caption text…"
                    className="w-full bg-stone-900 border border-stone-600 rounded-lg px-3 py-2 text-xs text-stone-100 resize-none focus:outline-none focus:border-violet-500 placeholder-stone-600" />
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
                          className={`py-1.5 rounded-lg border text-[10px] font-bold transition-colors ${editingClip.animStyle === s.id ? 'bg-violet-600 border-rose-600 text-white' : 'border-stone-600 text-stone-400 hover:border-stone-500'}`}>
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
                          className={`py-1.5 rounded-lg border text-[10px] font-bold transition-colors ${editingClip.font === id ? 'bg-violet-600 border-rose-600 text-white' : 'border-stone-600 text-stone-400 hover:border-stone-500'}`}>
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
                          className={`flex-1 py-1.5 rounded-lg border text-[10px] font-bold transition-colors ${editingClip.size === id ? 'bg-violet-600 border-rose-600 text-white' : 'border-stone-600 text-stone-400 hover:border-stone-500'}`}>
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
                        className={`relative w-10 h-5 rounded-full transition-colors ${editingClip.bold ? 'bg-violet-500' : 'bg-stone-600'}`}>
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${editingClip.bold ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                      <span className="text-[9px] text-stone-500">Bold</span>
                    </label>
                    <label className="flex flex-col items-center gap-1 cursor-pointer">
                      <button onClick={() => updateTextClip(editingClipId, { shadow: !editingClip.shadow })}
                        className={`relative w-10 h-5 rounded-full transition-colors ${editingClip.shadow ? 'bg-violet-500' : 'bg-stone-600'}`}>
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${editingClip.shadow ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                      <span className="text-[9px] text-stone-500">Shadow</span>
                    </label>
                    <label className="flex flex-col items-center gap-1 cursor-pointer">
                      <button onClick={() => updateTextClip(editingClipId, { bgBox: !editingClip.bgBox })}
                        className={`relative w-10 h-5 rounded-full transition-colors ${editingClip.bgBox ? 'bg-violet-500' : 'bg-stone-600'}`}>
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
                  <button onClick={() => setVoiceIsolation(!voiceIsolation)} className={`relative w-10 h-5 rounded-full transition-colors ${voiceIsolation ? 'bg-violet-500' : 'bg-stone-600'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${voiceIsolation ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-xs font-bold text-stone-200">De-Reverb</span>
                    <span className="text-[10px] text-stone-500 block">Remove room echo</span>
                  </div>
                  <button onClick={() => setDeReverb(!deReverb)} className={`relative w-10 h-5 rounded-full transition-colors ${deReverb ? 'bg-violet-500' : 'bg-stone-600'}`}>
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
                <button type="button" onClick={() => setUserMuted(m => !m)} className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${userMuted ? 'text-violet-400 bg-rose-900/40' : 'text-stone-500 hover:text-violet-400'}`}>{userMuted ? 'Unmute' : 'Mute'}</button>
              </div>
              {/* Recording */}
              <button onClick={isRecording ? stopRecord : () => startRecord(true, true)} disabled={!!recordError} className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 ${isRecording ? 'bg-red-500 text-white' : 'bg-stone-800 border border-stone-700 text-violet-400 hover:bg-stone-700'} disabled:opacity-40`}>
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
                          <button onClick={(e) => { e.stopPropagation(); setSelectedAudioSegmentId(seg.id); deleteSelectedAudioSegment(); }} className="text-stone-600 hover:text-violet-400 ml-1"><X size={12} /></button>
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
                <p className="text-[10px] font-bold text-stone-300 uppercase tracking-wider flex items-center gap-1.5"><Mic size={11} className="text-violet-400" /> AI Voice Over</p>
                <textarea
                  value={ttsScript}
                  onChange={e => setTtsScript(e.target.value)}
                  placeholder="Write your script here — AI speaks it in the voice you pick. Perfect for narration, intros, or voiceovers."
                  rows={3}
                  className="w-full bg-stone-900 border border-stone-600 rounded-lg px-3 py-2 text-xs text-stone-100 resize-none focus:outline-none focus:border-violet-500 placeholder-stone-600"
                />
                <div className="grid grid-cols-3 gap-1">
                  {TTS_VOICES.map(v => (
                    <button key={v.id} onClick={() => setTtsVoice(v.id)}
                      className={`py-1.5 rounded-lg border text-center transition-colors ${ttsVoice === v.id ? 'bg-rose-900/60 border-violet-500 text-rose-200' : 'bg-stone-900 border-stone-600 text-stone-400 hover:border-stone-500'}`}>
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
                {ttsError && <p className="text-[10px] text-violet-400">{ttsError}</p>}
                <button onClick={generateVoice} disabled={ttsLoading || !ttsScript.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40 transition-all active:scale-95">
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
                {autoCaptionError && <p className="text-[10px] text-violet-400">{autoCaptionError}</p>}
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
                          <button onClick={() => setImageOverlays(prev => prev.filter(o => o.id !== ov.id))} className="text-stone-600 hover:text-violet-400"><X size={12} /></button>
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
                      className={`flex flex-col items-center py-1.5 rounded-lg border text-[9px] font-bold transition-colors ${charAnim === a.id ? 'bg-rose-900/50 border-rose-600 text-violet-300' : 'bg-stone-900 border-stone-700 text-stone-500 hover:border-stone-500'}`}>
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
                  {filterPreset !== 'none' && <button onClick={resetAllFilters} className="text-[10px] text-violet-400 hover:text-violet-300">Reset</button>}
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {FILTER_PRESETS.map(fp => (
                    <button key={fp.id} onClick={() => applyFilterPreset(fp)}
                      className={`flex flex-col items-center py-2 rounded-xl border text-[9px] font-bold transition-all active:scale-95 ${filterPreset === fp.id ? 'bg-rose-900/60 border-violet-500 text-violet-300' : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-500'}`}>
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
                      <span className="text-xs font-bold text-stone-200 flex items-center gap-1.5">{label}{badge && <span className="text-[9px] font-bold text-violet-400 bg-rose-900/40 px-1.5 py-0.5 rounded uppercase">{badge}</span>}</span>
                      <span className="text-[10px] text-stone-500 block mt-0.5">{desc}</span>
                    </div>
                    <button onClick={() => set(!val)} className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${val ? 'bg-violet-500' : 'bg-stone-600'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${val ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </label>
                ))}
              </div>

              <button onClick={() => setShowAIHelper(h => !h)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-rose-900/40 border border-rose-700/50 text-violet-300 hover:bg-violet-800/50 active:scale-95 transition-all">
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
                    {cameraPreviewError && <p className="text-[10px] text-violet-400 text-center px-4">{cameraPreviewError}</p>}
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
                className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-40 ${isRecording ? 'bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-900/40' : 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-rose-900/30'}`}>
                {isRecording
                  ? <><span className="w-3 h-3 rounded bg-white" /> Stop Recording</>
                  : <><Camera size={18} /> Record Video</>}
              </button>
              {recordError && <p className="text-[11px] text-violet-400 text-center">{recordError}</p>}

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
                const barColor = score >= 80 ? 'bg-emerald-500' : score >= 55 ? 'bg-amber-400' : 'bg-violet-500';
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
                      <p key={i} className="text-[11px] text-stone-500 flex gap-1"><span className="text-violet-500">›</span>{tip}</p>
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
                      className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${exportFormat === f.id ? 'bg-rose-900/40 border-rose-600 text-violet-300' : 'bg-stone-800 border-stone-700 text-stone-300 hover:border-stone-600'}`}>
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
              <button onClick={exportVideo} disabled={exporting || !selectedVideo} className="w-full py-4 rounded-xl text-base font-bold bg-violet-500 hover:bg-violet-400 text-white disabled:opacity-40 shadow-lg shadow-rose-900/30 transition-all active:scale-95">
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

          {/* ── AI CONTENT TAB ─────────────────────────────── */}
          {inspectorTab === 'ai' && (
            <div className="p-3 space-y-3">
              {/* Header */}
              <div className="flex items-center gap-2 pb-1">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                  <Bot size={14} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white leading-tight">Instagram AI</p>
                  <p className="text-[10px] text-stone-500 leading-tight">Hooks · Captions · Hashtags</p>
                </div>
              </div>

              {/* Algorithm tips banner */}
              <div className="bg-gradient-to-r from-violet-950/60 to-purple-950/60 border border-rose-800/40 rounded-xl p-3">
                <p className="text-[10px] font-bold text-violet-300 uppercase tracking-wider mb-1.5 flex items-center gap-1"><Flame size={11} /> What the Algorithm rewards</p>
                <div className="space-y-1 text-[10px] text-stone-400">
                  <p>• <strong className="text-stone-300">Hook</strong> — first 1–3 seconds must stop the scroll</p>
                  <p>• <strong className="text-stone-300">Watch time</strong> — loops = more reach, keep it tight</p>
                  <p>• <strong className="text-stone-300">Comments</strong> — end with a question, saves share</p>
                  <p>• <strong className="text-stone-300">9:16 full screen</strong> — fills screen = more engagement</p>
                  <p>• <strong className="text-stone-300">Post 3–5×/week</strong> — consistency beats perfection</p>
                </div>
              </div>

              {/* Input */}
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">What's your video about?</label>
                  <input
                    type="text"
                    value={aiTopic}
                    onChange={e => setAiTopic(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') generateAIContent(); }}
                    placeholder="e.g. morning prayer routine, faith over fear, 5am wake up"
                    className="w-full px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 text-stone-100 text-xs placeholder-stone-600 focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Extra context (optional)</label>
                  <textarea
                    value={aiDescription}
                    onChange={e => setAiDescription(e.target.value)}
                    placeholder="e.g. sharing my personal struggle with doubt and how God answered"
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 text-stone-100 text-xs placeholder-stone-600 focus:border-violet-500 focus:outline-none resize-none"
                  />
                </div>
                <button
                  onClick={generateAIContent}
                  disabled={!aiTopic.trim() || aiLoading}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-xs font-bold disabled:opacity-50 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  {aiLoading ? <><Loader2 size={13} className="animate-spin" /> Generating…</> : <><Sparkles size={13} /> Generate Content</>}
                </button>
                {aiError && <p className="text-[11px] text-red-400 bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2">{aiError}</p>}
              </div>

              {/* Results */}
              {aiResult && (
                <div className="space-y-3">
                  {/* Hooks */}
                  <div className="bg-stone-800 border border-stone-700 rounded-xl p-3 space-y-2">
                    <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1"><Flame size={11} /> Opening Hooks (first 3 seconds)</p>
                    {(aiResult.hooks || []).map((hook, i) => (
                      <div key={i} className="flex items-start gap-2 bg-stone-900/60 rounded-lg px-2.5 py-2">
                        <span className="text-[10px] font-bold text-violet-400 shrink-0 mt-0.5">{i + 1}</span>
                        <p className="text-xs text-stone-200 flex-1 leading-tight">{hook}</p>
                        <button onClick={() => copyAI(hook, `hook${i}`)} className="shrink-0 text-stone-600 hover:text-violet-400 transition-colors" title="Copy">
                          {aiCopied === `hook${i}` ? <CheckCircle size={12} className="text-green-400" /> : <Copy size={12} />}
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Caption */}
                  {aiResult.caption && (
                    <div className="bg-stone-800 border border-stone-700 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider flex items-center gap-1"><AlignLeft size={11} /> Caption</p>
                        <button onClick={() => copyAI(aiResult.caption + (aiResult.cta ? '\n\n' + aiResult.cta : '') + '\n\n' + (aiResult.hashtags || []).map(h => `#${h.replace(/^#/, '')}`).join(' '), 'caption')} className="text-[10px] text-stone-500 hover:text-violet-400 flex items-center gap-1 transition-colors">
                          {aiCopied === 'caption' ? <><CheckCircle size={11} className="text-green-400" /> Copied!</> : <><Copy size={11} /> Copy all</>}
                        </button>
                      </div>
                      <p className="text-xs text-stone-300 leading-relaxed whitespace-pre-wrap">{aiResult.caption}</p>
                      {aiResult.cta && <p className="text-xs text-violet-400 font-bold mt-2 leading-tight">{aiResult.cta}</p>}
                    </div>
                  )}

                  {/* Hashtags */}
                  {aiResult.hashtags?.length > 0 && (
                    <div className="bg-stone-800 border border-stone-700 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider flex items-center gap-1"><HashIcon size={11} /> Hashtags</p>
                        <button onClick={() => copyAI((aiResult.hashtags || []).map(h => `#${h.replace(/^#/, '')}`).join(' '), 'hashtags')} className="text-[10px] text-stone-500 hover:text-violet-400 flex items-center gap-1 transition-colors">
                          {aiCopied === 'hashtags' ? <><CheckCircle size={11} className="text-green-400" /> Copied!</> : <><Copy size={11} /> Copy</>}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(aiResult.hashtags || []).map((tag, i) => (
                          <span key={i} onClick={() => copyAI(`#${tag.replace(/^#/, '')}`, `tag${i}`)} className="text-[10px] bg-stone-700 hover:bg-violet-900/40 text-violet-300 rounded-md px-2 py-0.5 cursor-pointer transition-colors">#{tag.replace(/^#/, '')}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Posting tip */}
                  {aiResult.postingTip && (
                    <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-3 flex items-start gap-2">
                      <Lightbulb size={13} className="text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-amber-200 leading-snug">{aiResult.postingTip}</p>
                    </div>
                  )}

                  {/* Regenerate */}
                  <button onClick={generateAIContent} disabled={aiLoading} className="w-full py-2 rounded-xl bg-stone-800 border border-stone-700 text-stone-400 text-xs font-bold hover:text-white hover:border-stone-500 transition-all flex items-center justify-center gap-2">
                    <RotateCcw size={12} /> Regenerate
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
        {showCreatorInsights && (
          <div className="absolute left-4 top-14 z-50 w-72 max-h-[70vh] overflow-y-auto">
            <CreatorInsights caption={caption} businessName={businesses.find(b => b.id === activeBusinessId)?.name} businessId={activeBusinessId} contactPageUrl={contactPageUrl} setContactPageUrl={setContactPageUrl} marketingGoal={marketingGoal} setMarketingGoal={setMarketingGoal} />
          </div>
        )}
        {showAIHelper && (
          <div className="absolute right-4 top-14 z-50 bg-white dark:bg-stone-800 border border-violet-200 dark:border-stone-600 rounded-xl shadow-xl p-4 w-80 text-xs max-h-[85vh] overflow-y-auto">
            <h4 className="font-bold text-stone-800 dark:text-stone-100 mb-3 flex items-center gap-2"><Sparkles size={16} className="text-violet-500" /> AI Helper</h4>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] uppercase font-bold text-stone-500 dark:text-stone-400 mb-1.5">Smart zoom</p>
                <div className="flex gap-2">
                  <button onClick={zoomToFit} className="px-2 py-1 rounded-lg bg-stone-100 dark:bg-stone-700 hover:bg-violet-100 dark:hover:bg-violet-900/40 text-stone-700 dark:text-stone-300 text-[11px] font-medium">Fit view</button>
                  <button onClick={zoomToSelection} disabled={!selectedSegmentId && !selectedAudioSegmentId} className="px-2 py-1 rounded-lg bg-stone-100 dark:bg-stone-700 hover:bg-violet-100 dark:hover:bg-violet-900/40 disabled:opacity-50 text-stone-700 dark:text-stone-300 text-[11px] font-medium">Zoom to selection</button>
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
                <button onClick={() => setActiveTab('audio')} className="px-2 py-1.5 rounded-lg bg-violet-100 dark:bg-rose-900/40 text-violet-600 dark:text-violet-400 text-[11px] font-medium hover:bg-violet-200 dark:hover:bg-violet-800/50">Smart Audio AI →</button>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-stone-500 dark:text-stone-400 mb-1.5">Manual filler removal</p>
                <p className="text-[11px] text-stone-600 dark:text-stone-400">Use Split at time to cut at each um, then delete the small segment. Type the exact time (e.g. 0:12) and hit Split at time.</p>
              </div>
            </div>
          </div>
        )}
        {showShortcuts && (
          <div className="absolute right-4 top-14 z-50 bg-white dark:bg-stone-800 border border-violet-200 dark:border-stone-600 rounded-xl shadow-xl p-4 w-64 text-xs">
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
        <div className="fixed right-4 top-24 z-50 w-72 p-4 bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl shadow-lg">
          <h4 className="font-bold text-stone-800 dark:text-stone-100 mb-3">Edit text</h4>
          <textarea value={editingClip.text || ''} onChange={(e) => updateTextClip(editingClip.id, e.target.value)} placeholder="Type your text..." rows={2} className="w-full p-3 rounded-xl border border-violet-100 dark:border-stone-600 bg-violet-50/50 dark:bg-stone-700 text-sm mb-3 resize-none" />
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
              return <button type="button" onClick={() => updateTextClip(editingClip.id, { color: brand.colors[0], font: brand.font })} className="text-xs font-bold text-violet-600 hover:underline" title={`Apply ${businesses.find(b => b.id === activeBusinessId)?.name || 'brand'} style`}>Use brand</button>;
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
                { id: 'highlight', label: 'Highlight', preview: 'Aa', cls: 'bg-violet-500 text-white font-extrabold' },
                { id: 'neon', label: 'Neon', preview: 'NEO', cls: 'bg-stone-900 text-cyan-300 font-bold uppercase' },
                { id: 'typewriter', label: 'Type', preview: 'Aa_', cls: 'bg-stone-800 text-white font-mono' },
              ].map(({ id, label, preview, cls }) => (
                <button
                  key={String(id)}
                  type="button"
                  onClick={() => updateTextClip(editingClip.id, { animStyle: id })}
                  className={`relative px-2 py-2 rounded-lg text-xs font-semibold transition-all border-2 ${editingClip.animStyle === id ? 'border-violet-400 scale-105 shadow-lg' : 'border-transparent'} ${cls}`}
                  title={label}
                >
                  <span className="block text-[11px] opacity-70 mb-0.5">{preview}</span>
                  <span className="block text-[10px] leading-none">{label}</span>
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => setEditingClipId(null)} className="w-full py-2 rounded-xl bg-violet-500 text-white font-bold text-sm">Done</button>
        </div>
      )}
      </div>
      {/* Timeline area — zoom + tracks, grid-area for layout */}
      <div className="flex flex-col min-h-0 bg-stone-900" style={{ gridArea: 'timeline' }}>
      {/* Primary editing toolbar — Split, Delete, Undo, Redo front and center */}
      <div className="shrink-0 flex items-center gap-1 px-3 py-2 bg-stone-800 border-t border-stone-700">
        <button onClick={splitAtPlayhead} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shadow" title="Split clip at playhead (S)"><Scissors size={13} /> Split</button>
        <button
          onClick={deleteSelectedSegment}
          disabled={!selectedSegmentId && !selectedAudioSegmentId && !selectedClipId}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold disabled:opacity-40 transition-colors ${selectedClipId || selectedSegmentId || selectedAudioSegmentId ? 'bg-red-600 hover:bg-red-500 shadow' : 'bg-stone-700'}`}
          title="Delete selected clip (Del)"
        ><Trash2 size={13} /> Delete{selectedClipId ? ' ✓' : ''}</button>
        <button onClick={undoAll} disabled={history.length === 0} className="px-2.5 py-1.5 rounded-lg bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs font-bold disabled:opacity-40" title="Undo (Ctrl+Z)"><Undo2 size={13} /></button>
        <div className="w-px h-5 bg-stone-600 mx-1" />
        <span className="text-[10px] font-mono text-amber-400 font-bold">{secToTimecode(playhead)}</span>
        <div className="flex-1" />
        <button onClick={() => setTimelineZoom(z => Math.max(0.5, Math.min(4, z / 1.4)))} className="px-2 py-1.5 rounded bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs" title="Zoom out">−</button>
        <span className="text-xs font-mono text-stone-400 min-w-[2.5rem] text-center">{timelineZoom.toFixed(1)}×</span>
        <button onClick={() => setTimelineZoom(z => Math.max(0.5, Math.min(4, z * 1.4)))} className="px-2 py-1.5 rounded bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs" title="Zoom in">+</button>
        <button onClick={zoomToFit} className="px-2 py-1.5 rounded bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs">Fit</button>
        {splitFeedback && <span className="text-[10px] text-violet-400 font-bold ml-2">{splitFeedback}</span>}
      </div>
      <div
        className={`timeline-track flex flex-col flex-shrink-0 border-t border-stone-700 bg-stone-900 overflow-auto transition-all touch-pan-y ${!selectedVideo && !hasLayeredClips ? 'opacity-60' : ''}`}
        ref={el => { timelineScrollRef.current = el; }}
        onWheel={e => { e.preventDefault(); const el = timelineScrollRef.current; if (!el) return; if (e.shiftKey) el.scrollLeft += e.deltaY; else el.scrollTop += e.deltaY; }}
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; e.currentTarget.classList.add('ring-2', 'ring-violet-500'); }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.classList.remove('ring-2', 'ring-violet-500'); }}
        onDrop={e => {
          e.preventDefault();
          e.currentTarget.classList.remove('ring-2', 'ring-violet-500');
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
            <div onMouseDown={(e) => { e.preventDefault(); setResizingTrack('text'); }} className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-violet-500/50 z-20 flex items-center justify-center" title="Drag to resize track"><div className="w-12 h-0.5 bg-stone-500 rounded opacity-0 group-hover/track:opacity-100" /></div>
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
              addClipToTrack={addClipToTrack}
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
          <div onMouseDown={(e) => { e.preventDefault(); setResizingTrack('video'); }} className="h-1.5 shrink-0 cursor-ns-resize hover:bg-violet-500/30 flex items-center justify-center" title="Drag to resize Video track"><div className="w-8 h-0.5 bg-stone-600 rounded" /></div>
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
                        <div onMouseDown={(e) => handleResizeMain(e, seg, 'start')} className="w-2.5 flex-shrink-0 cursor-ew-resize bg-white/20 hover:bg-violet-400/60 z-10 flex items-center justify-center"><div className="w-0.5 h-4 bg-white/50 rounded-full" /></div>
                        <div onMouseDown={(e) => handleMoveMainStart(e, seg)} className="flex-1 min-w-0 relative overflow-hidden">
                          <VideoSegmentThumbnail videoUrl={selectedVideo.url} startTime={seg.start} segStart={seg.start} segEnd={seg.end} />
                          <span className="absolute bottom-0 left-0 right-0 text-[9px] font-mono text-white bg-black/60 px-1 truncate">{secToTimecode(seg.start)} – {secToTimecode(seg.end)}</span>
                        </div>
                        <div onMouseDown={(e) => handleResizeMain(e, seg, 'end')} className="w-2.5 flex-shrink-0 cursor-ew-resize bg-white/20 hover:bg-violet-400/60 z-10 flex items-center justify-center"><div className="w-0.5 h-4 bg-white/50 rounded-full" /></div>
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
          <div onMouseDown={(e) => { e.preventDefault(); setResizingTrack('audio'); }} className="h-1.5 shrink-0 cursor-ns-resize hover:bg-violet-500/30 flex items-center justify-center" title="Drag to resize Audio track"><div className="w-8 h-0.5 bg-stone-600 rounded" /></div>
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
      <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-3xl p-8 shadow-sm transition-colors">
        <h3 className="text-xl font-semibold text-stone-800 flex items-center mb-2">
          <AudioLines className="mr-2 text-violet-400" size={24} />
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
            <select value={selectedAudio?.id || ''} onChange={(e) => setSelectedAudioId(Number(e.target.value) || null)} className="w-full bg-stone-50 border border-violet-100 rounded-xl px-4 py-2.5 text-sm">
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
          <div className="bg-violet-50/50 dark:bg-stone-700/40 p-6 rounded-3xl border border-violet-100 dark:border-stone-600">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="text-base font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">Voice Isolation {voiceIsolation && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded">ON</span>}</h4>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">Removes AC, traffic, and background noise.</p>
              </div>
              <button onClick={() => setVoiceIsolation(!voiceIsolation)} className={`relative w-12 h-6 rounded-full transition-colors ${voiceIsolation ? 'bg-violet-500' : 'bg-violet-200 dark:bg-stone-600'}`}>
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${voiceIsolation ? 'translate-x-7' : 'translate-x-1'}`}></span>
              </button>
            </div>
          </div>
          <div className="bg-violet-50/50 dark:bg-stone-700/40 p-6 rounded-3xl border border-violet-100 dark:border-stone-600">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="text-base font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">Studio De-Reverb {deReverb && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded">ON</span>}</h4>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">Removes room echo.</p>
              </div>
              <button onClick={() => setDeReverb(!deReverb)} className={`relative w-12 h-6 rounded-full transition-colors ${deReverb ? 'bg-violet-500' : 'bg-violet-200 dark:bg-stone-600'}`}>
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${deReverb ? 'translate-x-7' : 'translate-x-1'}`}></span>
              </button>
            </div>
            <div className="mt-4 pt-6 border-t border-violet-100 dark:border-stone-600">
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 block mb-3">Enhancement Strength</label>
              <input type="range" min="0" max="100" value={deReverbStrength} onChange={(e) => setDeReverbStrength(Number(e.target.value))} className="w-full accent-rose-400" />
            </div>
          </div>
          <div className="md:col-span-2 bg-violet-50/80 dark:bg-violet-950/30 p-6 rounded-3xl border border-violet-200 dark:border-rose-800">
            <h4 className="text-base font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
              <Sparkles size={18} className="text-violet-500" />
              Filler removal (ums, ahs, pauses)
            </h4>
            <p className="text-sm text-stone-600 dark:text-stone-300 mt-2">AI auto-detection coming soon. For now: use <button type="button" onClick={() => setActiveTab('classic')} className="text-violet-600 dark:text-violet-400 font-bold hover:underline">Classic Timeline</button> → type time (e.g. 0:12) → Split at time → delete segment.</p>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-2"><button type="button" onClick={() => setActiveTab('editor')} className="text-violet-600 dark:text-violet-400 hover:underline">No-Mouse Editor</button> for cut lists without timeline scrubbing.</p>
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
      <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-3xl p-8 shadow-sm transition-colors">
        <h3 className="text-xl font-semibold text-stone-800 flex items-center mb-2">
          <Wand2 className="mr-2 text-violet-400" size={24} />
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
                  className={`relative rounded-xl overflow-hidden aspect-video border-2 transition-all group ${selectedVideo?.id === v.id ? 'border-violet-500 ring-2 ring-violet-400' : 'border-violet-100 hover:border-violet-300'}`}
                  title={v.name}>
                  <video src={v.url} muted playsInline preload="metadata" className="w-full h-full object-cover"
                    onLoadedMetadata={e => { e.target.currentTime = 0.5; }} />
                  {selectedVideo?.id === v.id && (
                    <div className="absolute inset-0 bg-violet-500/20 flex items-center justify-center">
                      <div className="w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center shadow-lg">
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
          <label className="flex items-center justify-between bg-violet-50/50 p-5 rounded-2xl border border-violet-100 cursor-pointer hover:bg-violet-50 transition-colors">
            <div>
              <span className="text-base font-bold text-stone-800 flex items-center gap-2">
                4K AI Upscaling <span className="bg-violet-100 text-violet-600 text-[10px] px-2 py-0.5 rounded-full uppercase font-bold">Ultra HD</span>
              </span>
              <span className="text-xs text-stone-500 block mt-1">Sharpens soft footage and adds realistic details.</span>
            </div>
            <button onClick={() => setAiUpscale(!aiUpscale)} className={`relative w-12 h-6 rounded-full transition-colors ${aiUpscale ? 'bg-violet-400' : 'bg-violet-200'}`}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${aiUpscale ? 'translate-x-7' : 'translate-x-1'}`}></span>
            </button>
          </label>
          <label className="flex items-center justify-between bg-violet-50/50 p-5 rounded-2xl border border-violet-100 cursor-pointer hover:bg-violet-50 transition-colors">
            <div>
              <span className="text-base font-bold text-stone-800">Auto Cinematic Color Grade</span>
              <span className="text-xs text-stone-500 block mt-1">Converts flat iPhone footage into rich, moody cinematic tones.</span>
            </div>
            <button onClick={() => setCinematicGrade(!cinematicGrade)} className={`relative w-12 h-6 rounded-full transition-colors ${cinematicGrade ? 'bg-violet-400' : 'bg-violet-200'}`}>
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
          <button key={c.id} onClick={() => setCamera(c.id)} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${camera === c.id ? 'bg-violet-600 border-rose-600 text-white' : 'bg-stone-800 border-stone-700 text-stone-400 hover:text-stone-200'}`}>{c.name}</button>
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
  const [customCameras, setCustomCameras] = useState(() => JSON.parse(localStorage.getItem('kreativelync-custom-cameras') || '[]'));
  const [showAddCamera, setShowAddCamera] = useState(false);
  const [newCameraName, setNewCameraName] = useState('');
  const [lightroomSuggestion, setLightroomSuggestion] = useState(null);
  const images = filteredAssets.filter(a => a.type === 'image');
  const analyzeRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('kreativelync-custom-cameras', JSON.stringify(customCameras));
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
      <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-3xl p-6 shadow-sm transition-colors">
        <h3 className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-widest mb-4">What are you shooting?</h3>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'video', label: 'Video', Icon: Video },
            { id: 'photo', label: 'Photos', Icon: ImageIcon }
          ].map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setContentType(id)} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${contentType === id ? 'bg-violet-500 text-white shadow-lg' : 'bg-violet-50 dark:bg-stone-700 border border-violet-100 dark:border-stone-600 text-stone-600 dark:text-stone-300 hover:border-violet-300'}`}>
              <Icon size={18} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Lighting */}
      <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-3xl p-6 shadow-sm transition-colors">
        <h3 className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-widest mb-4">Lighting</h3>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'day', label: 'Day', Icon: Sun },
            { id: 'night', label: 'Night / Low Light', Icon: Moon }
          ].map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setLighting(id)} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${lighting === id ? 'bg-violet-500 text-white shadow-lg' : 'bg-violet-50 dark:bg-stone-700 border border-violet-100 dark:border-stone-600 text-stone-600 dark:text-stone-300 hover:border-violet-300'}`}>
              <Icon size={18} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Which camera? */}
      <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-3xl p-6 shadow-sm transition-colors">
        <h3 className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-widest mb-4">Which camera?</h3>
        <div className="flex flex-wrap gap-2 items-center">
          {allCameras.map((c) => (
            <button key={c.id} onClick={() => setCamera(c.id)} className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${camera === c.id ? 'bg-violet-500 text-white shadow-lg' : 'bg-violet-50 dark:bg-stone-700 border border-violet-100 dark:border-stone-600 text-stone-600 dark:text-stone-300 hover:border-violet-300'}`}>
              {c.name}
            </button>
          ))}
          <button onClick={() => setShowAddCamera(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-violet-300 dark:border-rose-600 text-violet-500 dark:text-violet-400 font-bold text-sm hover:bg-violet-50 dark:hover:bg-stone-700">
            <Plus size={18} /> Add new camera
          </button>
        </div>
        {showAddCamera && (
          <div className="mt-4 p-4 rounded-2xl bg-violet-50/50 dark:bg-stone-700/50 border border-violet-100 dark:border-stone-600 flex flex-wrap gap-2 items-center">
            <input value={newCameraName} onChange={(e) => setNewCameraName(e.target.value)} placeholder="Camera name (e.g. Nikon Z8)" className="flex-1 min-w-[180px] bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-600 rounded-xl px-4 py-2 text-sm" />
            <button onClick={addCustomCamera} className="px-4 py-2 rounded-xl bg-violet-500 text-white font-bold text-sm">Add</button>
            <button onClick={() => { setShowAddCamera(false); setNewCameraName(''); }} className="px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-600 text-stone-600 dark:text-stone-400 text-sm">Cancel</button>
          </div>
        )}
      </div>

      {/* Active Preset Card */}
      <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-3xl p-8 shadow-sm transition-colors">
        <h3 className="text-xl font-bold text-stone-800 dark:text-stone-100 mb-1">{displayCameraName} — {lighting === 'day' ? 'Day' : 'Night / Low Light'} ({contentType === 'video' ? 'Video' : 'Photos'})</h3>
        <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">Lock these before shooting to avoid auto-exposure flicker.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {settings.map((s, i) => (
            <div key={i} className="flex justify-between items-start p-4 rounded-2xl bg-violet-50/50 dark:bg-stone-700/50 border border-violet-100 dark:border-stone-600">
              <div>
                <span className="text-sm font-bold text-stone-800 dark:text-stone-100">{s.label}</span>
                <span className="text-xs text-stone-500 dark:text-stone-400 block mt-1">{s.note}</span>
              </div>
              <span className="text-sm font-mono font-bold text-violet-600 dark:text-violet-400 shrink-0 ml-4">{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Lightroom Preset Helper */}
      <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-3xl p-8 shadow-sm transition-colors">
        <h3 className="text-xl font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2 mb-2">
          <ImageIcon size={22} className="text-violet-400" />
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
          className="px-6 py-3 rounded-xl bg-violet-500 text-white font-bold hover:bg-violet-600 flex items-center gap-2 mb-6"
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
          <div className="mt-6 p-6 rounded-2xl bg-violet-50 dark:bg-stone-700/50 border border-violet-100 dark:border-stone-600">
            {lightroomSuggestion.type === 'empty' ? (
              <p className="text-stone-600 dark:text-stone-300">{lightroomSuggestion.message}</p>
            ) : (
              <>
                <p className="text-sm font-bold text-stone-800 dark:text-stone-100 mb-4">{lightroomSuggestion.message}</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="p-3 rounded-xl bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-600">
                    <span className="text-[10px] font-bold text-stone-400 uppercase">Exposure</span>
                    <p className="text-sm font-mono font-bold text-violet-600">{lightroomSuggestion.exposure}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-600">
                    <span className="text-[10px] font-bold text-stone-400 uppercase">Contrast</span>
                    <p className="text-sm font-mono font-bold text-violet-600">{lightroomSuggestion.contrast}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-600">
                    <span className="text-[10px] font-bold text-stone-400 uppercase">Shadows</span>
                    <p className="text-sm font-mono font-bold text-violet-600">{lightroomSuggestion.shadows}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-600">
                    <span className="text-[10px] font-bold text-stone-400 uppercase">Highlights</span>
                    <p className="text-sm font-mono font-bold text-violet-600">{lightroomSuggestion.highlights}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-600">
                    <span className="text-[10px] font-bold text-stone-400 uppercase">Temp</span>
                    <p className="text-sm font-mono font-bold text-violet-600">{lightroomSuggestion.temp}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-600">
                    <span className="text-[10px] font-bold text-stone-400 uppercase">Tint</span>
                    <p className="text-sm font-mono font-bold text-violet-600">{lightroomSuggestion.tint}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-600">
                    <span className="text-[10px] font-bold text-stone-400 uppercase">Clarity</span>
                    <p className="text-sm font-mono font-bold text-violet-600">{lightroomSuggestion.clarity}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-600">
                    <span className="text-[10px] font-bold text-stone-400 uppercase">Vibrance</span>
                    <p className="text-sm font-mono font-bold text-violet-600">{lightroomSuggestion.vibrance}</p>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-violet-100 dark:border-stone-600">
                  <h4 className="text-sm font-bold text-stone-800 dark:text-stone-100 mb-3 flex items-center gap-2"><Target size={16} className="text-violet-400" /> How to apply in Lightroom</h4>
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
    try { return JSON.parse(localStorage.getItem('kreativelync-campaigns') || '[]'); } catch { return []; }
  });
  const [copied, setCopied] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    localStorage.setItem('kreativelync-campaigns', JSON.stringify(campaigns));
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
      <div className="bg-gradient-to-br from-amber-50 to-violet-50 dark:from-stone-800 dark:to-stone-800 border-2 border-amber-200 dark:border-amber-800 rounded-3xl p-8 shadow-lg">
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
            <MapPin size={18} className="text-violet-400" />
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
            <div className="p-3 rounded-xl bg-violet-50 dark:bg-rose-900/20 border border-violet-100 dark:border-rose-800">
              <p className="font-bold text-rose-700 dark:text-violet-400 mb-1">What to look for</p>
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
  const [posts, setPosts] = useState(() => { try { return JSON.parse(localStorage.getItem('kreativelync-post-analytics') || '[]'); } catch { return []; } });
  const [editingId, setEditingId] = useState(null);
  const [editBuf, setEditBuf] = useState({});
  const [aiInsights, setAiInsightsState] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`kreativelync-ai-insights-brand-${activeBusinessId}`) || 'null'); } catch { return null; }
  });
  const setAiInsights = (data) => {
    setAiInsightsState(data);
    try { localStorage.setItem(`kreativelync-ai-insights-brand-${activeBusinessId}`, JSON.stringify(data)); } catch {}
  };
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  // Social account connection — per brand
  const brandKey = `brand-${activeBusinessId}`;
  const [connectedBrands, setConnectedBrands] = useState(() => { try { return JSON.parse(localStorage.getItem('kreativelync-connected-brands') || '{}'); } catch { return {}; } });
  const igConnected = !!connectedBrands[brandKey]?.ig;
  const ytConnected = !!connectedBrands[brandKey]?.yt;
  const setIgConnected = (v) => setConnectedBrands(prev => { const next = { ...prev, [brandKey]: { ...prev[brandKey], ig: v } }; localStorage.setItem('kreativelync-connected-brands', JSON.stringify(next)); return next; });
  const setYtConnected = (v) => setConnectedBrands(prev => { const next = { ...prev, [brandKey]: { ...prev[brandKey], yt: v } }; localStorage.setItem('kreativelync-connected-brands', JSON.stringify(next)); return next; });
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  // Ads state
  const [igProfileMap, setIgProfileMap] = useState(() => { try { return JSON.parse(localStorage.getItem('kreativelync-ig-profile-map') || '{}'); } catch { return {}; } });
  const [igGrowthMap, setIgGrowthMap] = useState(() => { try { return JSON.parse(localStorage.getItem('kreativelync-ig-growth-map') || '{}'); } catch { return {}; } });
  const [igInsightsMap, setIgInsightsMap] = useState(() => { try { return JSON.parse(localStorage.getItem('kreativelync-ig-insights-map') || '{}'); } catch { return {}; } });
  const [igAudienceMap, setIgAudienceMap] = useState(() => { try { return JSON.parse(localStorage.getItem('kreativelync-ig-audience-map') || '{}'); } catch { return {}; } });
  const igProfile = igProfileMap[brandKey] || null;
  const igGrowth = igGrowthMap[brandKey] || null;
  const igInsights = igInsightsMap[brandKey] || null;
  const igAudience = igAudienceMap[brandKey] || null;
  const [adsTab, setAdsTab] = useState(false);
  const [adAccountId, setAdAccountId] = useState(() => localStorage.getItem('kreativelync-ad-account') || '');
  const [adAccounts, setAdAccounts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [adsLoading, setAdsLoading] = useState(false);
  const [adsError, setAdsError] = useState('');
  const [adForm, setAdForm] = useState({ name: '', objective: 'OUTCOME_ENGAGEMENT', budget: '10', days: '7', url: '' });
  const [adCreating, setAdCreating] = useState(false);
  const [adMsg, setAdMsg] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const state = params.get('state');
    if (params.get('instagram_connected') === '1') {
      if (state) setConnectedBrands(prev => { const next = { ...prev, [state]: { ...prev[state], ig: true } }; localStorage.setItem('kreativelync-connected-brands', JSON.stringify(next)); return next; });
    }
    if (params.get('youtube_connected') === '1') {
      if (state) setConnectedBrands(prev => { const next = { ...prev, [state]: { ...prev[state], yt: true } }; localStorage.setItem('kreativelync-connected-brands', JSON.stringify(next)); return next; });
    }
    if (params.get('instagram_connected') || params.get('youtube_connected')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => { localStorage.setItem('kreativelync-post-analytics', JSON.stringify(posts)); }, [posts]);

  const removePost = (id) => setPosts(prev => prev.filter(p => p.id !== id));
  const updatePost = (id, updates) => setPosts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  const startEdit = (p) => { setEditingId(p.id); setEditBuf({ views: p.views || '', likes: p.likes || '', comments: p.comments || '', saves: p.saves || '' }); };
  const saveEdit = (id) => { updatePost(id, { views: Number(editBuf.views) || 0, likes: Number(editBuf.likes) || 0, comments: Number(editBuf.comments) || 0, saves: Number(editBuf.saves) || 0 }); setEditingId(null); };

  const connectInstagram = () => { window.location.href = `/api/auth/instagram?state=${encodeURIComponent(brandKey)}`; };
  const connectYouTube = () => { window.location.href = `/api/auth/youtube?state=${encodeURIComponent(brandKey)}`; };

  const syncAll = async () => {
    setSyncing(true); setSyncMsg('');
    const added = [];
    if (igConnected) {
      try {
        const r = await fetch('/api/sync/instagram', { headers: { 'X-User-Key': brandKey } });
        const data = await r.json();
        if (data.account) { setIgProfileMap(p => { const n = { ...p, [brandKey]: data.account }; localStorage.setItem('kreativelync-ig-profile-map', JSON.stringify(n)); return n; }); }
        if (data.growth) { setIgGrowthMap(p => { const n = { ...p, [brandKey]: data.growth }; localStorage.setItem('kreativelync-ig-growth-map', JSON.stringify(n)); return n; }); }
        if (data.insights) { setIgInsightsMap(p => { const n = { ...p, [brandKey]: data.insights }; localStorage.setItem('kreativelync-ig-insights-map', JSON.stringify(n)); return n; }); }
        if (data.audience) { setIgAudienceMap(p => { const n = { ...p, [brandKey]: data.audience }; localStorage.setItem('kreativelync-ig-audience-map', JSON.stringify(n)); return n; }); }
        if (data.posts?.length) {
          const existing = new Set(posts.map(p => p.id));
          const newPosts = data.posts.filter(p => !existing.has(p.id)).map(p => ({ ...p, businessId: activeBusinessId }));
          const updated = data.posts.filter(p => existing.has(p.id));
          if (newPosts.length) { setPosts(prev => [...prev, ...newPosts]); added.push(`${newPosts.length} new Instagram posts`); }
          if (updated.length) { setPosts(prev => prev.map(p => { const u = updated.find(x => x.id === p.id); return u ? { ...p, businessId: activeBusinessId, views: u.views, likes: u.likes, comments: u.comments, saves: u.saves, reach: u.reach, engagement: u.engagement, avgWatchTimeMs: u.avgWatchTimeMs, totalPlays: u.totalPlays } : p; })); added.push(`${updated.length} Instagram posts updated`); }
        } else if (data.error) setSyncMsg('Instagram: ' + data.error);
      } catch (e) { setSyncMsg('Instagram sync failed: ' + e.message); }
    }
    if (ytConnected) {
      try {
        const r = await fetch('/api/sync/youtube', { headers: { 'X-User-Key': brandKey } });
        const data = await r.json();
        if (data.posts?.length) {
          const existing = new Set(posts.map(p => p.id));
          const newPosts = data.posts.filter(p => !existing.has(p.id)).map(p => ({ ...p, businessId: activeBusinessId }));
          const updated = data.posts.filter(p => existing.has(p.id));
          if (newPosts.length) { setPosts(prev => [...prev, ...newPosts]); added.push(`${newPosts.length} new YouTube videos`); }
          if (updated.length) { setPosts(prev => prev.map(p => { const u = updated.find(x => x.id === p.id); return u ? { ...p, views: u.views, likes: u.likes, comments: u.comments } : p; })); added.push(`${updated.length} YouTube videos updated`); }
        } else if (data.error) setSyncMsg(m => (m ? m + ' | ' : '') + 'YouTube: ' + data.error);
      } catch (e) { setSyncMsg(m => (m ? m + ' | ' : '') + 'YouTube failed: ' + e.message); }
    }
    setSyncing(false);
    if (added.length) setSyncMsg('Synced: ' + added.join(', '));
    else if (!igConnected && !ytConnected) setSyncMsg('Connect an account first.');
  };

  const loadAdAccounts = async () => {
    if (!igConnected) { setAdsError('Connect Instagram/Facebook first to access your ad accounts.'); return; }
    setAdsLoading(true); setAdsError('');
    try {
      const r = await fetch('/api/ads?action=accounts', { headers: { 'X-User-Key': brandKey } });
      const data = await r.json();
      if (data.error) { setAdsError(data.error); } else { setAdAccounts(data.accounts || []); }
    } catch (e) { setAdsError('Failed to load ad accounts: ' + e.message); }
    setAdsLoading(false);
  };

  const loadCampaigns = async (accountId) => {
    if (!accountId) return;
    setAdsLoading(true); setAdsError('');
    try {
      const r = await fetch(`/api/ads?action=campaigns&account_id=${encodeURIComponent(accountId)}`, { headers: { 'X-User-Key': brandKey } });
      const data = await r.json();
      if (data.error) setAdsError(data.error);
      else setCampaigns(data.campaigns || []);
    } catch (e) { setAdsError(e.message); }
    setAdsLoading(false);
  };

  const createAd = async () => {
    if (!adAccountId) { setAdMsg('Select an ad account first.'); return; }
    if (!adForm.name || !adForm.url) { setAdMsg('Fill in campaign name and destination URL.'); return; }
    setAdCreating(true); setAdMsg('');
    try {
      const r = await fetch('/api/ads?action=create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Key': userKey },
        body: JSON.stringify({ account_id: adAccountId, name: adForm.name, objective: adForm.objective, daily_budget: Math.round(Number(adForm.budget) * 100), days: Number(adForm.days), url: adForm.url, user_key: brandKey }),
      });
      const data = await r.json();
      if (data.error) setAdMsg('Error: ' + data.error);
      else { setAdMsg('Campaign created! ID: ' + (data.campaign_id || 'done')); loadCampaigns(adAccountId); }
    } catch (e) { setAdMsg('Failed: ' + e.message); }
    setAdCreating(false);
  };

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

      {/* Tab bar: Analytics | Ads Manager */}
      <div className="flex gap-2">
        <button onClick={() => setAdsTab(false)} className={`px-5 py-2 rounded-xl font-bold text-sm transition-colors ${!adsTab ? 'bg-violet-500 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-violet-50 dark:hover:bg-stone-700'}`}>Post Analytics</button>
        <button onClick={() => { setAdsTab(true); if (!adAccounts.length) loadAdAccounts(); }} className={`px-5 py-2 rounded-xl font-bold text-sm transition-colors ${adsTab ? 'bg-violet-500 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-violet-50 dark:hover:bg-stone-700'}`}>Ads Manager</button>
      </div>

      {/* Connected Accounts */}
      <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm">
        <h3 className="font-bold text-stone-800 dark:text-stone-100 mb-4 flex items-center gap-2"><Zap size={16} className="text-violet-400" /> Connected Accounts</h3>
        <div className="flex flex-wrap gap-3 mb-4">
          <button onClick={connectInstagram} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm border-2 transition-all ${igConnected ? 'border-pink-400 bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300' : 'border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300 hover:border-pink-400 hover:text-pink-600'}`}>
            <Instagram size={16} /> {igConnected ? 'Instagram Connected' : 'Connect Instagram'}
          </button>
          <button onClick={connectYouTube} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm border-2 transition-all ${ytConnected ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300 hover:border-red-400 hover:text-red-600'}`}>
            <Youtube size={16} /> {ytConnected ? 'YouTube Connected' : 'Connect YouTube'}
          </button>
          {(igConnected || ytConnected) && (
            <button onClick={syncAll} disabled={syncing} className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50">
              {syncing ? <><Loader2 size={14} className="animate-spin" /> Syncing…</> : <><Zap size={14} /> Sync Posts</>}
            </button>
          )}
        </div>
        {syncMsg && <p className={`text-sm font-medium ${syncMsg.includes('ailed') || syncMsg.includes('Error') ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>{syncMsg}</p>}
        {!igConnected && !ytConnected && <p className="text-xs text-stone-400">Connect your accounts to auto-sync real post data — views, likes, reach, saves.</p>}
      </div>

      {/* ADS MANAGER TAB */}
      {adsTab && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm">
            <h3 className="font-bold text-stone-800 dark:text-stone-100 mb-1 flex items-center gap-2"><TrendingUp size={16} className="text-violet-400" /> Meta Ads Manager</h3>
            <p className="text-xs text-stone-400 mb-4">Create and manage Facebook & Instagram ad campaigns directly. Requires your Instagram/Facebook to be connected with ads permissions.</p>

            {/* Ad Account Selector */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Your Ad Accounts</label>
              {adAccounts.length === 0 ? (
                <button onClick={loadAdAccounts} disabled={adsLoading} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-100 dark:bg-stone-700 text-sm font-bold text-stone-600 dark:text-stone-300 hover:bg-violet-50 dark:hover:bg-violet-900/20">
                  {adsLoading ? <><Loader2 size={14} className="animate-spin" /> Loading…</> : 'Load Ad Accounts'}
                </button>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {adAccounts.map(a => (
                    <button key={a.id} onClick={() => { setAdAccountId(a.id); localStorage.setItem('kreativelync-ad-account', a.id); loadCampaigns(a.id); }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-bold border-2 ${adAccountId === a.id ? 'border-violet-400 bg-violet-50 dark:bg-rose-900/20 text-rose-700 dark:text-violet-300' : 'border-stone-200 dark:border-stone-600 text-stone-600 dark:text-stone-300'}`}>
                      {a.name} ({a.currency}) — Balance: {a.balance}
                    </button>
                  ))}
                </div>
              )}
              {adsError && <p className="text-sm text-red-500 mt-2">{adsError}</p>}
            </div>

            {/* Active Campaigns */}
            {campaigns.length > 0 && (
              <div className="mb-6">
                <h4 className="text-xs font-bold text-stone-500 uppercase mb-2">Active Campaigns</h4>
                <div className="space-y-2">
                  {campaigns.map(c => (
                    <div key={c.id} className="flex items-center justify-between bg-stone-50 dark:bg-stone-700/50 rounded-xl px-4 py-2">
                      <div>
                        <p className="font-bold text-sm text-stone-800 dark:text-stone-100">{c.name}</p>
                        <p className="text-xs text-stone-400">{c.objective} · {c.status}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold text-sm text-violet-600 dark:text-violet-400">${(Number(c.spend || 0) / 100).toFixed(2)} spent</p>
                        <p className="text-xs text-stone-400">{c.impressions || 0} impressions · {c.clicks || 0} clicks</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Create Campaign */}
            {adAccountId && (
              <div className="border-t border-stone-200 dark:border-stone-700 pt-5">
                <h4 className="text-xs font-bold text-stone-500 uppercase mb-3">Create New Campaign</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Campaign Name</label>
                    <input value={adForm.name} onChange={e => setAdForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Spring Promo 2026" className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Objective</label>
                    <select value={adForm.objective} onChange={e => setAdForm(f => ({ ...f, objective: e.target.value }))} className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-3 py-2 text-sm">
                      <option value="OUTCOME_ENGAGEMENT">Engagement (likes, comments)</option>
                      <option value="OUTCOME_TRAFFIC">Traffic (clicks to website)</option>
                      <option value="OUTCOME_LEADS">Leads (capture info)</option>
                      <option value="OUTCOME_AWARENESS">Brand Awareness</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Daily Budget (USD)</label>
                    <input type="number" min="1" value={adForm.budget} onChange={e => setAdForm(f => ({ ...f, budget: e.target.value }))} placeholder="10" className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Duration (days)</label>
                    <input type="number" min="1" max="90" value={adForm.days} onChange={e => setAdForm(f => ({ ...f, days: e.target.value }))} placeholder="7" className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-3 py-2 text-sm" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-stone-500 mb-1">Destination URL</label>
                    <input value={adForm.url} onChange={e => setAdForm(f => ({ ...f, url: e.target.value }))} placeholder="https://yourwebsite.com" className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-3 py-2 text-sm" />
                  </div>
                </div>
                <p className="text-xs text-stone-400 mb-3">Total budget: <strong>${(Number(adForm.budget || 0) * Number(adForm.days || 0)).toFixed(2)}</strong> over {adForm.days} days</p>
                <button onClick={createAd} disabled={adCreating} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-violet-500 text-white font-bold text-sm hover:bg-violet-600 disabled:opacity-50">
                  {adCreating ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : <><Zap size={14} /> Launch Campaign</>}
                </button>
                {adMsg && <p className={`text-sm mt-2 font-medium ${adMsg.includes('Error') || adMsg.includes('Failed') ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>{adMsg}</p>}
                <p className="text-xs text-stone-400 mt-3">Note: Ads require <strong>ads_management</strong> permission approved by Meta. In development mode, only your own account can run ads.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ANALYTICS TAB — hidden when Ads tab active */}
      {!adsTab && <>

      {/* Instagram Growth Dashboard */}
      {igProfile && (
        <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm space-y-5">
          {/* Profile header */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-400 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
              {igProfile.username?.[0]?.toUpperCase() || 'I'}
            </div>
            <div>
              <h3 className="font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
                <Instagram size={16} className="text-pink-500" /> @{igProfile.username}
              </h3>
              <p className="text-xs text-stone-400">{igProfile.bio?.slice(0, 80) || 'Instagram Business Account'}</p>
            </div>
          </div>

          {/* Key numbers */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-pink-50 dark:bg-pink-900/20 rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-pink-600 dark:text-pink-400">{(igProfile.followers || 0).toLocaleString()}</p>
              <p className="text-xs text-stone-500 mt-1">Followers</p>
            </div>
            <div className="bg-violet-50 dark:bg-rose-900/20 rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">{igGrowth?.newFollowers30d != null ? (igGrowth.newFollowers30d >= 0 ? '+' : '') + igGrowth.newFollowers30d : '—'}</p>
              <p className="text-xs text-stone-500 mt-1">New followers (30d)</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{(igGrowth?.reach30d || 0).toLocaleString()}</p>
              <p className="text-xs text-stone-500 mt-1">Reach (30d)</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{(igGrowth?.profileViews30d || 0).toLocaleString()}</p>
              <p className="text-xs text-stone-500 mt-1">Profile views (30d)</p>
            </div>
          </div>

          {/* What works */}
          {igInsights && (
            <div className="bg-stone-50 dark:bg-stone-700/40 rounded-2xl p-4 space-y-2">
              <h4 className="font-bold text-stone-700 dark:text-stone-200 flex items-center gap-2"><Flame size={14} className="text-violet-400" /> What works for you</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {igInsights.avgReelEngagement > igInsights.avgImageEngagement ? (
                  <p className="text-emerald-700 dark:text-emerald-400">✓ <strong>Reels</strong> get {igInsights.avgReelEngagement} avg engagement vs {igInsights.avgImageEngagement} for images — post more Reels</p>
                ) : igInsights.avgImageEngagement > 0 ? (
                  <p className="text-emerald-700 dark:text-emerald-400">✓ <strong>Images</strong> get {igInsights.avgImageEngagement} avg engagement vs {igInsights.avgReelEngagement} for Reels</p>
                ) : null}
                {igInsights.bestPostingHour && (
                  <p className="text-blue-700 dark:text-blue-400">✓ Best time to post: <strong>{igInsights.bestPostingHour}</strong> based on your top posts</p>
                )}
                {igInsights.topPost && (
                  <p className="text-stone-600 dark:text-stone-300 sm:col-span-2">🏆 Top post: "<strong>{igInsights.topPost.title?.slice(0,60)}</strong>" — {igInsights.topPost.engagement} engagement
                    {igInsights.topPost.permalink && <a href={igInsights.topPost.permalink} target="_blank" rel="noopener noreferrer" className="ml-2 text-violet-500 underline">View</a>}
                  </p>
                )}
                {igProfile.followers > 0 && igGrowth?.newFollowers30d != null && (
                  <p className="text-stone-500 dark:text-stone-400">
                    Growth rate: <strong>{((igGrowth.newFollowers30d / igProfile.followers) * 100).toFixed(1)}%</strong> this month
                    {igGrowth.newFollowers30d < 0 ? ' — you lost followers. Try posting more consistently.' : igGrowth.newFollowers30d === 0 ? ' — flat growth. Try a new content format.' : ' — keep it up!'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Audience Demographics */}
          {igAudience && (igAudience.topCountries?.length > 0 || Object.keys(igAudience.genderAge || {}).length > 0) && (
            <div className="bg-stone-50 dark:bg-stone-700/40 rounded-2xl p-4 space-y-3">
              <h4 className="font-bold text-stone-700 dark:text-stone-200 flex items-center gap-2"><Users size={14} className="text-violet-400" /> Your audience</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {igAudience.topCountries?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-2 uppercase tracking-wide">Top countries</p>
                    <div className="space-y-1">
                      {igAudience.topCountries.map(({ name, count }) => {
                        const total = igAudience.topCountries.reduce((s, c) => s + c.count, 0);
                        const pct = total ? Math.round((count / total) * 100) : 0;
                        return (
                          <div key={name}>
                            <div className="flex justify-between text-xs mb-0.5"><span>{name}</span><span className="text-stone-500">{pct}%</span></div>
                            <div className="h-1.5 bg-stone-200 dark:bg-stone-600 rounded-full"><div className="h-1.5 bg-violet-400 rounded-full" style={{ width: `${pct}%` }} /></div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {igAudience.topCities?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-2 uppercase tracking-wide">Top cities</p>
                    <div className="space-y-1">
                      {igAudience.topCities.map(({ name, count }) => {
                        const total = igAudience.topCities.reduce((s, c) => s + c.count, 0);
                        const pct = total ? Math.round((count / total) * 100) : 0;
                        return (
                          <div key={name}>
                            <div className="flex justify-between text-xs mb-0.5"><span>{name}</span><span className="text-stone-500">{pct}%</span></div>
                            <div className="h-1.5 bg-stone-200 dark:bg-stone-600 rounded-full"><div className="h-1.5 bg-amber-400 rounded-full" style={{ width: `${pct}%` }} /></div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {Object.keys(igAudience.genderAge || {}).length > 0 && (
                  <div className="sm:col-span-2">
                    <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-2 uppercase tracking-wide">Age & gender</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(igAudience.genderAge).sort((a,b) => b[1]-a[1]).slice(0,8).map(([key, count]) => (
                        <span key={key} className="px-2 py-1 bg-white dark:bg-stone-600 border border-stone-200 dark:border-stone-500 rounded-lg text-xs">
                          <span className={key.startsWith('F') ? 'text-pink-500' : 'text-blue-500'}>{key.startsWith('F') ? '♀' : '♂'}</span> {key.replace('F.','').replace('M.','')} — {count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Auto-log notice */}
      <div className="bg-gradient-to-br from-violet-50 to-amber-50 dark:from-stone-800 dark:to-stone-800 border-2 border-violet-200 dark:border-rose-800 rounded-3xl p-6 shadow-lg">
        <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-1">Post Analytics</h2>
        <p className="text-stone-500 dark:text-stone-400 text-sm">Posts are logged automatically every time you export a video or click Publish. After your post goes live, tap it below to add the numbers.</p>
        {bizPosts.length === 0 && (
          <p className="mt-4 text-sm text-violet-500 font-medium">No posts yet — export or publish a video to get started.</p>
        )}
      </div>

      {/* All accounts overview */}
      {(businesses || []).length > 0 && (
        <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-3xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100 mb-4 flex items-center gap-2"><BarChart2 size={20} className="text-violet-400" /> Each account — overall progress</h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mb-4">Progress and AI analysis are separate per business. Select a business below to see details.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(businesses || []).filter(Boolean).map((b) => {
              const bp = posts.filter(p => p.businessId === b.id);
              const tv = bp.reduce((s, p) => s + (p.views || 0), 0);
              const te = bp.reduce((s, p) => s + p.likes + p.comments + p.shares + p.saves, 0);
              return (
                <div key={b.id} className={`relative p-4 rounded-2xl border transition-all ${activeBusinessId === b.id ? 'border-violet-400 bg-violet-50 dark:bg-rose-900/20 dark:border-rose-600' : 'border-stone-200 dark:border-stone-600'}`}>
                  <button onClick={() => setActiveBusinessId(b.id)} className="text-left w-full">
                    <p className="font-bold text-stone-800 dark:text-stone-100">{b.name}</p>
                    <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">{bp.length} posts · {tv.toLocaleString()} views · {te.toLocaleString()} engagement</p>
                  </button>
                  {bp.length > 0 && (
                    <button onClick={() => { if (confirm(`Remove all ${bp.length} posts from ${b.name}?`)) setPosts(prev => prev.filter(p => p.businessId !== b.id)); }} className="absolute top-3 right-3 p-1 rounded-lg text-stone-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Progress tracker (current business) */}
      <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-3xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100 mb-4 flex items-center gap-2"><BarChart2 size={20} className="text-violet-400" /> {(businesses || []).find(b => b?.id === activeBusinessId)?.name || 'This account'} — this week</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="text-[10px] font-bold text-stone-400 uppercase">This week</span>
            <p className="text-xl font-bold text-violet-600 dark:text-violet-400">{postsThisWeek.length} posts · {viewsThisWeek.toLocaleString()} views</p>
          </div>
          <div>
            <span className="text-[10px] font-bold text-stone-400 uppercase">Last week</span>
            <p className="text-xl font-bold text-stone-600 dark:text-stone-400">{postsLastWeek.length} posts · {viewsLastWeek.toLocaleString()} views</p>
          </div>
          <div>
            <span className="text-[10px] font-bold text-stone-400 uppercase">This month</span>
            <p className="text-xl font-bold text-violet-600 dark:text-violet-400">{postsThisMonth.length} posts</p>
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
        <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold text-stone-400 uppercase">Total views</span>
          <p className="text-2xl font-bold text-violet-600 dark:text-violet-400 mt-1">{totalViews.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold text-stone-400 uppercase">Total engagement</span>
          <p className="text-2xl font-bold text-violet-600 dark:text-violet-400 mt-1">{totalEngagement.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold text-stone-400 uppercase">Avg views/post</span>
          <p className="text-2xl font-bold text-violet-600 dark:text-violet-400 mt-1">{avgViews.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold text-stone-400 uppercase">Posts logged</span>
          <p className="text-2xl font-bold text-violet-600 dark:text-violet-400 mt-1">{bizPosts.length}</p>
        </div>
      </div>

      {bizPosts.length > 0 && (
        <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-3xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100 mb-4 flex items-center gap-2"><TrendingUp size={20} className="text-violet-400" /> Insights & tips</h3>
          <ul className="space-y-3 text-sm text-stone-600 dark:text-stone-300">
            {bestPost && <li><strong>Top performer:</strong> &quot;{bestPost.title}&quot; — {bestPost.views != null ? bestPost.views.toLocaleString() : '—'} views. {bestPost.notes && `Notes: ${bestPost.notes}`}</li>}
            {Object.keys(byPlatform).length > 0 && <li><strong>By platform:</strong> {Object.entries(byPlatform).map(([k, v]) => `${platformLabels[k] || k}: ${v.toLocaleString()} views`).join('; ')}</li>}
            <li><strong>Improve:</strong> Log 3+ posts per platform to see patterns. Note your hook, time posted, and format.</li>
            <li><strong>What works:</strong> Reels/Shorts at 9–11am or 7–9pm tend to get more reach. Saves and shares matter more than likes.</li>
          </ul>
          <div className="mt-4 pt-4 border-t border-stone-200 dark:border-stone-600">
            <button onClick={async () => {
              setAiLoading(true); setAiError(null);
              try {
                const businessName = businesses?.find(b => b.id === activeBusinessId)?.name || 'Your brand';
                const r = await fetch('/api/ai/generate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    mode: 'analytics',
                    topic: `Analytics for ${businessName}`,
                    analyticsData: {
                      brandName: businessName,
                      posts: bizPosts,
                      account: igProfile,
                      growth: igGrowth,
                      insights: igInsights,
                      audience: igAudience,
                    }
                  })
                });
                const data = await r.json();
                if (data.error) throw new Error(data.error);
                setAiInsights(data);
              } catch (e) {
                setAiError(e?.message || 'AI analysis failed');
              } finally {
                setAiLoading(false);
              }
            }} disabled={aiLoading} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-violet-500/20 text-amber-700 dark:text-amber-400 font-bold text-sm hover:from-amber-500/30 hover:to-violet-500/30 disabled:opacity-50 border border-amber-200 dark:border-amber-800">
              {aiLoading ? <><Loader2 size={14} className="animate-spin" /> Analyzing your data…</> : '✨ Get AI Expert Analysis'}
            </button>
            {aiError && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{aiError}</p>}
            {aiInsights && typeof aiInsights === 'object' && (
              <div className="mt-4 space-y-4 text-sm">
                {aiInsights.verdict && (
                  <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-violet-50 dark:from-amber-900/20 dark:to-violet-900/20 border border-amber-200 dark:border-amber-800">
                    <p className="font-bold text-amber-800 dark:text-amber-300 mb-1">📊 Expert Verdict</p>
                    <p className="text-stone-700 dark:text-stone-300">{aiInsights.verdict}</p>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {aiInsights.whatIsWorking?.length > 0 && (
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                      <p className="font-bold text-emerald-700 dark:text-emerald-400 mb-2">✅ What's working</p>
                      <ul className="space-y-1">{aiInsights.whatIsWorking.map((w,i) => <li key={i} className="text-stone-600 dark:text-stone-300 text-xs">• {w}</li>)}</ul>
                    </div>
                  )}
                  {aiInsights.whatIsNotWorking?.length > 0 && (
                    <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                      <p className="font-bold text-red-700 dark:text-red-400 mb-2">⚠️ Fix these</p>
                      <ul className="space-y-1">{aiInsights.whatIsNotWorking.map((w,i) => <li key={i} className="text-stone-600 dark:text-stone-300 text-xs">• {w}</li>)}</ul>
                    </div>
                  )}
                </div>
                {aiInsights.contentStrategy && (
                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <p className="font-bold text-blue-700 dark:text-blue-400 mb-1">🎯 Content Strategy</p>
                    <p className="text-stone-600 dark:text-stone-300 text-xs">{aiInsights.contentStrategy}</p>
                  </div>
                )}
                {aiInsights.contentIdeas?.length > 0 && (
                  <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
                    <p className="font-bold text-violet-700 dark:text-violet-400 mb-2">💡 Content Ideas</p>
                    <div className="space-y-2">
                      {aiInsights.contentIdeas.map((idea, i) => (
                        <div key={i} className="bg-white dark:bg-stone-700 rounded-lg p-2">
                          <p className="font-semibold text-stone-700 dark:text-stone-200 text-xs">{i+1}. {idea.title}</p>
                          <p className="text-violet-600 dark:text-violet-400 text-xs mt-0.5">Hook: "{idea.hook}"</p>
                          <p className="text-stone-500 dark:text-stone-400 text-xs mt-0.5">{idea.why}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {aiInsights.bestTimeToPost && (
                    <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-700/40 border border-stone-200 dark:border-stone-600">
                      <p className="font-bold text-stone-700 dark:text-stone-200 mb-1">🕐 Best time to post</p>
                      <p className="text-stone-600 dark:text-stone-300 text-xs">{aiInsights.bestTimeToPost}</p>
                    </div>
                  )}
                  {aiInsights.growthHack && (
                    <div className="p-3 rounded-xl bg-violet-50 dark:bg-rose-900/20 border border-violet-200 dark:border-rose-800">
                      <p className="font-bold text-rose-700 dark:text-violet-400 mb-1">🚀 Growth hack</p>
                      <p className="text-stone-600 dark:text-stone-300 text-xs">{aiInsights.growthHack}</p>
                    </div>
                  )}
                </div>
                {aiInsights.warningSign && (
                  <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-300 dark:border-orange-700">
                    <p className="font-bold text-orange-700 dark:text-orange-400 mb-1">🚨 Critical warning</p>
                    <p className="text-stone-600 dark:text-stone-300 text-xs">{aiInsights.warningSign}</p>
                  </div>
                )}
                {aiInsights.weeklyPlan && (
                  <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-700/40 border border-stone-200 dark:border-stone-600">
                    <p className="font-bold text-stone-700 dark:text-stone-200 mb-2">📅 This week's posting plan</p>
                    <div className="grid grid-cols-2 gap-1">
                      {Object.entries(aiInsights.weeklyPlan).map(([day, plan]) => (
                        <div key={day} className="text-xs"><span className="font-semibold capitalize text-violet-600 dark:text-violet-400">{day}:</span> <span className="text-stone-600 dark:text-stone-300">{plan}</span></div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Post cards */}
      {bizPosts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-stone-500 dark:text-stone-400 uppercase">Your posts — tap to update numbers</h3>
          {[...bizPosts].reverse().map(p => (
            <div key={p.id} className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-stone-800 dark:text-stone-100 truncate">{p.title}</p>
                  <p className="text-xs text-stone-400 mt-0.5">{platformLabels[p.platform] || p.platform} · {p.postedAt} {p.source === 'instagram_api' || p.source === 'youtube_api' ? '· synced' : ''}</p>
                </div>
                <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                  <button onClick={() => editingId === p.id ? saveEdit(p.id) : startEdit(p)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${editingId === p.id ? 'bg-violet-500 text-white' : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-violet-50 dark:hover:bg-violet-900/30 hover:text-violet-600'}`}>{editingId === p.id ? 'Save' : 'Update'}</button>
                  <select onChange={e => { if (e.target.value) { updatePost(p.id, { businessId: e.target.value }); e.target.value = ''; } }} defaultValue="" className="px-2 py-1.5 rounded-lg text-xs bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 border-0 cursor-pointer">
                    <option value="" disabled>Move to…</option>
                    {(businesses || []).filter(Boolean).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
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
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-stone-500 dark:text-stone-400">
                  <span><strong className="text-stone-700 dark:text-stone-200 font-mono">{p.views != null ? Number(p.views).toLocaleString() : '—'}</strong> views</span>
                  <span><strong className="text-stone-700 dark:text-stone-200 font-mono">{(p.likes || 0).toLocaleString()}</strong> likes</span>
                  <span><strong className="text-stone-700 dark:text-stone-200 font-mono">{(p.comments || 0).toLocaleString()}</strong> comments</span>
                  <span><strong className="text-stone-700 dark:text-stone-200 font-mono">{(p.saves || 0).toLocaleString()}</strong> saves</span>
                  {p.totalPlays > 0 && <span><strong className="text-stone-700 dark:text-stone-200 font-mono">{p.totalPlays.toLocaleString()}</strong> plays</span>}
                  {p.avgWatchTimeMs > 0 && <span><strong className="text-violet-600 dark:text-violet-400 font-mono">{(p.avgWatchTimeMs / 1000).toFixed(1)}s</strong> avg watch</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      </> /* end analytics tab */}
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
          <span className={`text-xs font-mono tabular-nums ${isChanged ? 'text-violet-400' : 'text-stone-500'}`}>{val > 0 ? '+' : ''}{val}{unit}</span>
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
          <span className={`text-xs font-mono ${val !== 0 ? 'text-violet-400' : 'text-stone-500'}`}>{val > 0 ? '+' : ''}{val}</span>
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
        <label className="cursor-pointer flex flex-col items-center justify-center gap-5 border-2 border-dashed border-stone-600 hover:border-violet-500 rounded-3xl p-20 text-center transition-all group bg-stone-900/40 hover:bg-stone-800/50">
          <div className="relative">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-900/60 to-stone-800 border-2 border-dashed border-stone-600 group-hover:border-violet-500 flex items-center justify-center transition-colors">
              <ImageIcon size={36} className="text-stone-500 group-hover:text-violet-400 transition-colors" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center shadow-lg">
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
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${presetCat === c ? 'bg-violet-600 border-rose-600 text-white' : 'border-stone-700 text-stone-400 hover:border-rose-600 hover:text-violet-400'}`}>
                  {c}
                </button>
              ))}
            </div>
            {/* Preset list */}
            <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
              {visiblePresets.map(p => (
                <button key={p.id} onClick={() => applyPreset(p)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${activePreset === p.id ? 'bg-violet-600/30 border border-rose-600/50 text-violet-300' : 'hover:bg-stone-700/60 text-stone-300 border border-transparent'}`}>
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
                  className={`px-3 py-1 rounded text-xs font-bold transition-colors ${!showBefore ? 'bg-violet-600 text-white' : 'text-stone-400 hover:text-stone-200'}`}>After</button>
                <button onClick={() => setShowBefore(true)}
                  className={`px-3 py-1 rounded text-xs font-bold transition-colors ${showBefore ? 'bg-violet-600 text-white' : 'text-stone-400 hover:text-stone-200'}`}>Before</button>
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
                className="px-2.5 py-1.5 rounded bg-stone-800 border border-stone-700 text-xs font-bold text-stone-400 hover:text-violet-400 hover:border-rose-600/50 transition-colors">
                Reset
              </button>
              <button onClick={() => fileRef.current?.click()}
                className="px-2.5 py-1.5 rounded bg-stone-800 border border-stone-700 text-xs font-bold text-stone-400 hover:text-white transition-colors">
                Change Photo
              </button>
              <div className="flex items-center gap-1 ml-auto">
                {['jpg','png','webp'].map(f => (
                  <button key={f} onClick={() => setExportFmt(f)}
                    className={`px-2 py-1 rounded text-[10px] font-bold uppercase border transition-colors ${exportFmt === f ? 'bg-violet-600 border-rose-600 text-white' : 'border-stone-700 text-stone-400 hover:border-rose-600'}`}>
                    {f}
                  </button>
                ))}
                <button onClick={downloadPhoto}
                  className="ml-1 flex items-center gap-1.5 px-3 py-1.5 rounded bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-colors">
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
                <div className="absolute top-3 left-3 px-2 py-1 bg-violet-600/80 rounded text-[10px] font-bold text-white uppercase tracking-wider">Edited</div>
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
                      className={`py-1 text-[9px] font-bold rounded border transition-colors ${cropAspect === val ? 'bg-violet-600 border-rose-600 text-white' : 'border-stone-700 text-stone-400 hover:border-rose-600'}`}>
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
                  <button onClick={() => setFlipH(v => !v)} className={`py-1.5 rounded-lg border text-xs font-bold transition-colors ${flipH ? 'bg-violet-600/30 border-rose-600/50 text-violet-300' : 'border-stone-700 text-stone-300 hover:bg-stone-700'}`}>↔ Flip H</button>
                  <button onClick={() => setFlipV(v => !v)} className={`py-1.5 rounded-lg border text-xs font-bold transition-colors ${flipV ? 'bg-violet-600/30 border-rose-600/50 text-violet-300' : 'border-stone-700 text-stone-300 hover:bg-stone-700'}`}>↕ Flip V</button>
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

// --- Swift Code View (kept for legacy compatibility) ---
const SwiftCodeView = () => (
  <div className="max-w-4xl mx-auto text-center py-20">
    <Code className="mx-auto text-violet-300 dark:text-violet-600/50 w-16 h-16 mb-6" />
    <h3 className="text-2xl font-semibold text-stone-800 dark:text-stone-100 mb-2">System Logic</h3>
    <p className="text-stone-500 dark:text-stone-400 max-w-md mx-auto">AVFoundation Swift logic for time-based cutting and export.</p>
  </div>
);

// --- Sidebar Item ---
const SidebarItem = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-2xl transition-all ${active ? 'bg-violet-50 dark:bg-rose-900/30 border border-violet-100 dark:border-rose-800 text-violet-600 dark:text-violet-400 font-bold shadow-sm' : 'text-stone-500 dark:text-stone-400 hover:bg-violet-50 dark:hover:bg-stone-700 hover:text-stone-800 dark:hover:text-stone-100 font-medium'}`}>
    <span className={active ? 'text-violet-500' : 'text-stone-400'}>{icon}</span>
    <span className="text-sm">{label}</span>
    {active && <div className="ml-auto w-1.5 h-1.5 bg-violet-500 rounded-full" />}
  </button>
);

export default App;
