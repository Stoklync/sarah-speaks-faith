import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStudio } from '../App';
import {
  Film,
  Sparkles,
  Download,
  Loader2,
  Play,
  RefreshCw,
  Key,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle,
  AlertCircle,
  Wand2,
  Clock,
  ImageIcon,
  Video as VideoIcon,
  Palette,
  Monitor,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Creatomate source builder
// ---------------------------------------------------------------------------
function buildSource({
  format, durationSecs, bgType, bgBase64, bgMimeType,
  headline, subtext, cta, textPosition, textColor, overlayStyle, brandColor,
}) {
  const [width, height] = format === '1:1' ? [1080, 1080] : [1080, 1920];
  const duration = durationSecs;
  const elements = [];

  // Background
  if (bgType === 'image' && bgBase64) {
    elements.push({
      type: 'image',
      source: `data:${bgMimeType};base64,${bgBase64}`,
      fit: 'cover',
      width: '100%', height: '100%',
      x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
    });
  } else if (bgType === 'video' && bgBase64) {
    elements.push({
      type: 'video',
      source: `data:${bgMimeType};base64,${bgBase64}`,
      fit: 'cover',
      width: '100%', height: '100%',
      x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
      volume: 0,
    });
  } else {
    elements.push({
      type: 'shape',
      shape: 'rectangle',
      fill_color: brandColor || '#7C3AED',
      width: '100%', height: '100%',
      x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
    });
  }

  // Overlay
  if (overlayStyle === 'dark') {
    elements.push({
      type: 'shape', shape: 'rectangle',
      fill_color: 'rgba(0,0,0,0.5)',
      width: '100%', height: '100%',
      x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
    });
  } else if (overlayStyle === 'light') {
    elements.push({
      type: 'shape', shape: 'rectangle',
      fill_color: 'rgba(0,0,0,0.2)',
      width: '100%', height: '100%',
      x: '50%', y: '50%', x_anchor: '50%', y_anchor: '50%',
    });
  }

  // Text positioning
  const textY = textPosition === 'top' ? '25%' : textPosition === 'bottom' ? '75%' : '50%';
  const subtextOffset = format === '1:1' ? 12 : 8;
  const isSquare = format === '1:1';

  // Headline
  if (headline) {
    elements.push({
      type: 'text', text: headline,
      x: '50%', y: textY, width: '85%',
      font_family: 'Montserrat', font_weight: '700',
      font_size: isSquare ? '6vmin' : '7vmin',
      fill_color: textColor || '#ffffff',
      x_anchor: '50%', y_anchor: '50%',
      text_align: 'center',
    });
  }

  // Subtext
  if (subtext) {
    const subtextY = `calc(${textY} + ${subtextOffset}vmin)`;
    elements.push({
      type: 'text', text: subtext,
      x: '50%', y: subtextY, width: '80%',
      font_family: 'Montserrat', font_weight: '400',
      font_size: '4vmin',
      fill_color: textColor || '#ffffff',
      x_anchor: '50%', y_anchor: '50%',
      text_align: 'center',
    });
  }

  // CTA
  if (cta) {
    elements.push({
      type: 'text', text: cta,
      x: '50%', y: '92%', width: '80%',
      font_family: 'Montserrat', font_weight: '600',
      font_size: '3.5vmin',
      fill_color: textColor === '#000000' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)',
      x_anchor: '50%', y_anchor: '50%',
      text_align: 'center',
    });
  }

  return {
    output_format: 'mp4',
    width, height, duration,
    frame_rate: 30,
    elements,
  };
}

// ---------------------------------------------------------------------------
// File → base64
// ---------------------------------------------------------------------------
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // result is "data:<mime>;base64,<data>" — strip prefix
      const result = reader.result;
      const base64 = result.split(',')[1];
      resolve({ base64, mimeType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
// localStorage history helpers
// ---------------------------------------------------------------------------
const HISTORY_KEY = 'kreativelync-video-history';
const API_KEY_LS = 'kreativelync-creatomate-key';
const MAX_HISTORY = 10;

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; }
}
function saveHistory(items) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY))); } catch {}
}

// ---------------------------------------------------------------------------
// Small UI atoms
// ---------------------------------------------------------------------------
function Pill({ active, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
        active
          ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
          : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-600 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400'
      } ${className}`}
    >
      {children}
    </button>
  );
}

function SectionCard({ title, icon: Icon, children }) {
  return (
    <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-stone-100 dark:border-stone-700">
        <Icon className="w-4 h-4 text-violet-500" />
        <span className="text-sm font-bold text-stone-800 dark:text-stone-100">{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Setup screen (no API key)
// ---------------------------------------------------------------------------
function SetupScreen({ onSaved }) {
  const [key, setKey] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    if (!key.trim()) return;
    setSaving(true);
    localStorage.setItem(API_KEY_LS, key.trim());
    setTimeout(() => { setSaving(false); onSaved(); }, 400);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md w-full bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-xl p-8 text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg">
          <Film className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-black text-stone-800 dark:text-stone-100 mb-2">AI Video Creator</h2>
        <p className="text-stone-500 dark:text-stone-400 text-sm mb-6 leading-relaxed">
          Powered by <span className="font-semibold text-violet-600 dark:text-violet-400">Creatomate</span> — render
          stunning short-form videos in seconds. Free plan gives you 50 renders/month. No approval needed.
        </p>

        <div className="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-4 mb-6 text-left space-y-2">
          {[
            '✅ 50 free renders / month',
            '✅ 1080×1920 Reels & Stories',
            '✅ MP4 download, no watermark',
            '✅ Sign up takes 30 seconds',
          ].map(t => (
            <p key={t} className="text-xs text-violet-700 dark:text-violet-300 font-medium">{t}</p>
          ))}
        </div>

        <a
          href="https://creatomate.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-violet-300 dark:border-violet-600 text-violet-600 dark:text-violet-400 text-sm font-semibold hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors mb-4"
        >
          <ExternalLink className="w-4 h-4" /> Get free API key at creatomate.com
        </a>

        <div className="relative mb-4">
          <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="password"
            placeholder="Paste your Creatomate API key…"
            value={key}
            onChange={e => setKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            className="w-full pl-9 pr-4 py-3 rounded-xl border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-stone-800 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={!key.trim() || saving}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-sm hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
        >
          {saving ? 'Saving…' : 'Connect Creatomate →'}
        </button>

        <p className="text-[11px] text-stone-400 mt-3">
          Your key is stored locally in your browser. It's never sent to our servers — only directly to Creatomate.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main VideoCreator
// ---------------------------------------------------------------------------
export function VideoCreator() {
  // ---- brand context ----
  const { businesses = [], activeBusinessId } = useStudio();
  const activeBiz = businesses.find(b => b?.id === activeBusinessId) || businesses[0];
  const bizName = activeBiz?.name || 'My Brand';
  const bizType = activeBiz?.type || activeBiz?.niche || 'brand';

  // ---- API key ----
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_LS) || '');
  const [showSetup, setShowSetup] = useState(!apiKey);

  // ---- format & duration ----
  const FORMATS = [
    { id: '9:16-reel', label: '📱 Reel (9:16)', ratio: '9:16' },
    { id: '1:1-square', label: '⬜ Square (1:1)', ratio: '1:1' },
    { id: '9:16-yt', label: '▶️ YouTube Short (9:16)', ratio: '9:16' },
    { id: '9:16-story', label: '📖 Story (9:16)', ratio: '9:16' },
  ];
  const DURATIONS = [6, 10, 15, 30];
  const [selectedFormat, setSelectedFormat] = useState(FORMATS[0]);
  const [durationSecs, setDurationSecs] = useState(10);

  // ---- background ----
  const [bgType, setBgType] = useState('color'); // 'image' | 'video' | 'color'
  const [bgBase64, setBgBase64] = useState(null);
  const [bgMimeType, setBgMimeType] = useState(null);
  const [bgPreviewUrl, setBgPreviewUrl] = useState(null);
  const [bgWarning, setBgWarning] = useState('');
  const imgInputRef = useRef(null);
  const vidInputRef = useRef(null);

  // ---- content ----
  const [headline, setHeadline] = useState('');
  const [subtext, setSubtext] = useState('');
  const [cta, setCta] = useState('Follow for more');
  const [textPosition, setTextPosition] = useState('center'); // top | center | bottom

  // ---- style ----
  const [textColor, setTextColor] = useState('#ffffff');
  const [customTextColor, setCustomTextColor] = useState('#ffffff');
  const [textColorMode, setTextColorMode] = useState('white'); // white | black | custom
  const [overlayStyle, setOverlayStyle] = useState('dark'); // none | light | dark
  const brandColor = '#7C3AED'; // violet default

  // ---- AI generation ----
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  // ---- render state ----
  const [renderState, setRenderState] = useState('idle'); // idle | submitting | rendering | done | error
  const [renderProgress, setRenderProgress] = useState('');
  const [renderId, setRenderId] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [renderError, setRenderError] = useState('');
  const pollTimerRef = useRef(null);

  // ---- history ----
  const [history, setHistory] = useState(loadHistory);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Sync textColor when mode changes
  useEffect(() => {
    if (textColorMode === 'white') setTextColor('#ffffff');
    else if (textColorMode === 'black') setTextColor('#000000');
    else setTextColor(customTextColor);
  }, [textColorMode, customTextColor]);

  // ---- file upload handler ----
  const handleFileUpload = useCallback(async (file, type) => {
    setBgWarning('');
    if (file.size > 5 * 1024 * 1024) {
      setBgWarning(`⚠️ Large file (${(file.size / 1024 / 1024).toFixed(1)} MB). Render may be slow or fail — try under 5 MB.`);
    }
    try {
      const { base64, mimeType } = await fileToBase64(file);
      setBgBase64(base64);
      setBgMimeType(mimeType);
      setBgType(type);
      setBgPreviewUrl(URL.createObjectURL(file));
    } catch {
      setBgWarning('Failed to read file. Please try again.');
    }
  }, []);

  // ---- AI calls ----
  const generateHook = useCallback(async () => {
    setAiLoading(true);
    setAiError('');
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'chat',
          topic: `${bizName} short video hook`,
          brandName: bizName,
          brandType: bizType,
          chatHistory: [
            {
              role: 'user',
              text: `Write a single powerful 1-line hook for a ${selectedFormat.label} short video for "${bizName}" (${bizType} brand). Make it attention-grabbing, max 80 characters. Return ONLY the hook text, no quotes, no explanation.`,
            },
          ],
        }),
      });
      const data = await res.json();
      const text = (data.reply || data.text || '').trim().replace(/^["']|["']$/g, '');
      if (text) setHeadline(text.slice(0, 80));
    } catch {
      setAiError('AI generation failed. Check your connection and try again.');
    } finally {
      setAiLoading(false);
    }
  }, [bizName, bizType, selectedFormat]);

  const generateScript = useCallback(async () => {
    setAiLoading(true);
    setAiError('');
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'chat',
          topic: `${bizName} short video script`,
          brandName: bizName,
          brandType: bizType,
          chatHistory: [
            {
              role: 'user',
              text: `Write a short video script for "${bizName}" (${bizType} brand) for a ${selectedFormat.label} format, ${durationSecs}-second video. Return a JSON object with exactly these keys: {"headline": "...", "subtext": "...", "cta": "..."}. headline max 80 chars (main hook), subtext max 100 chars (supporting line), cta max 50 chars (call to action). Return ONLY the JSON, no markdown, no explanation.`,
            },
          ],
        }),
      });
      const data = await res.json();
      const rawText = (data.reply || data.text || '').trim();
      // Try to parse JSON from response
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.headline) setHeadline(String(parsed.headline).slice(0, 80));
        if (parsed.subtext) setSubtext(String(parsed.subtext).slice(0, 100));
        if (parsed.cta) setCta(String(parsed.cta).slice(0, 50));
      } else if (rawText) {
        // Fallback: use raw as headline
        setHeadline(rawText.slice(0, 80));
      }
    } catch (e) {
      setAiError('AI generation failed. Check your connection and try again.');
    } finally {
      setAiLoading(false);
    }
  }, [bizName, bizType, selectedFormat, durationSecs]);

  // ---- polling ----
  const pollStatus = useCallback(async (id, key) => {
    try {
      const res = await fetch(`/api/video?id=${encodeURIComponent(id)}&apiKey=${encodeURIComponent(key)}`);
      const data = await res.json();

      if (data.status === 'succeeded' && data.url) {
        clearInterval(pollTimerRef.current);
        setRenderState('done');
        setVideoUrl(data.url);
        setRenderProgress('');
        // Save to history
        const entry = {
          id,
          url: data.url,
          headline,
          format: selectedFormat.label,
          brandId: activeBusinessId,
          createdAt: new Date().toISOString(),
        };
        const updated = [entry, ...loadHistory()].slice(0, MAX_HISTORY);
        saveHistory(updated);
        setHistory(updated);
      } else if (data.status === 'failed') {
        clearInterval(pollTimerRef.current);
        setRenderState('error');
        setRenderError('Render failed. Check your composition settings or try a smaller background file.');
      } else if (data.status === 'rendering') {
        setRenderProgress('Rendering…');
      } else {
        setRenderProgress('In queue…');
      }
    } catch {
      // Don't abort polling on transient network errors
    }
  }, [headline, selectedFormat, activeBusinessId]);

  // ---- submit render ----
  const handleGenerate = useCallback(async () => {
    if (!apiKey) { setShowSetup(true); return; }
    if (!headline && !subtext) {
      setRenderError('Add at least a headline or subtext before generating.');
      return;
    }

    setRenderState('submitting');
    setRenderProgress('Submitting…');
    setRenderError('');
    setVideoUrl(null);
    clearInterval(pollTimerRef.current);

    const source = buildSource({
      format: selectedFormat.ratio,
      durationSecs,
      bgType,
      bgBase64,
      bgMimeType,
      headline,
      subtext,
      cta,
      textPosition,
      textColor,
      overlayStyle,
      brandColor,
    });

    try {
      const res = await fetch('/api/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, apiKey }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setRenderState('error');
        setRenderError(data.error || 'Failed to submit render.');
        return;
      }

      setRenderId(data.id);
      setRenderState('rendering');
      setRenderProgress('Rendering…');

      // Poll every 3 seconds
      pollTimerRef.current = setInterval(() => pollStatus(data.id, apiKey), 3000);
    } catch (err) {
      setRenderState('error');
      setRenderError('Network error. Check your connection and try again.');
    }
  }, [
    apiKey, headline, subtext, cta, selectedFormat, durationSecs,
    bgType, bgBase64, bgMimeType, textPosition, textColor, overlayStyle,
    brandColor, pollStatus,
  ]);

  // Cleanup polling on unmount
  useEffect(() => () => clearInterval(pollTimerRef.current), []);

  const resetCreator = () => {
    setRenderState('idle');
    setVideoUrl(null);
    setRenderError('');
    setRenderId(null);
    clearInterval(pollTimerRef.current);
  };

  const isRendering = renderState === 'submitting' || renderState === 'rendering';

  // ---- Setup screen ----
  if (showSetup) {
    return (
      <SetupScreen
        onSaved={() => {
          const k = localStorage.getItem(API_KEY_LS) || '';
          setApiKey(k);
          setShowSetup(false);
        }}
      />
    );
  }

  // ---- Result screen ----
  if (renderState === 'done' && videoUrl) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col items-center gap-6">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="w-5 h-5" />
          <span className="font-bold text-lg">Video ready!</span>
        </div>

        <div className="w-full bg-black rounded-2xl overflow-hidden shadow-2xl aspect-[9/16] max-h-[500px] flex items-center justify-center">
          <video
            src={videoUrl}
            controls
            autoPlay
            className="w-full h-full object-contain"
            style={{ maxHeight: 500 }}
          />
        </div>

        <div className="flex gap-3 w-full">
          <a
            href={videoUrl}
            download="kreativelync-video.mp4"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-sm shadow-md hover:from-violet-700 hover:to-indigo-700 transition-all"
          >
            <Download className="w-4 h-4" /> Download MP4
          </a>
          <button
            onClick={resetCreator}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-stone-200 dark:border-stone-600 text-stone-700 dark:text-stone-300 font-semibold text-sm hover:bg-stone-50 dark:hover:bg-stone-700 transition-all"
          >
            <RefreshCw className="w-4 h-4" /> Create Another
          </button>
        </div>

        {/* History below result */}
        <HistorySection history={history} setHistory={setHistory} open={historyOpen} setOpen={setHistoryOpen} />
      </div>
    );
  }

  // ---- Main creator UI ----
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-stone-800 dark:text-stone-100 flex items-center gap-2">
            <Film className="w-6 h-6 text-violet-500" /> AI Video Creator
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">Powered by Creatomate · {selectedFormat.label} · {durationSecs}s</p>
        </div>
        <button
          onClick={() => setShowSetup(true)}
          className="text-xs text-stone-400 hover:text-violet-500 transition-colors flex items-center gap-1"
          title="Change API key"
        >
          <Key className="w-3 h-3" /> API Key
        </button>
      </div>

      {/* Error banner */}
      {renderError && (
        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{renderError}</span>
          <button onClick={() => setRenderError('')} className="ml-auto text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ── Section 1: Format & Background ── */}
      <SectionCard title="Format & Background" icon={Monitor}>
        {/* Format */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-2 uppercase tracking-wide">Format</p>
          <div className="flex flex-wrap gap-2">
            {FORMATS.map(f => (
              <Pill key={f.id} active={selectedFormat.id === f.id} onClick={() => setSelectedFormat(f)}>
                {f.label}
              </Pill>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-2 uppercase tracking-wide">Duration</p>
          <div className="flex gap-2">
            {DURATIONS.map(d => (
              <Pill key={d} active={durationSecs === d} onClick={() => setDurationSecs(d)}>
                {d}s
              </Pill>
            ))}
          </div>
        </div>

        {/* Background */}
        <div>
          <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-2 uppercase tracking-wide">Background</p>
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              type="button"
              onClick={() => imgInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-600 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400 transition-all"
            >
              <ImageIcon className="w-3 h-3" /> Upload Image
            </button>
            <button
              type="button"
              onClick={() => vidInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-600 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400 transition-all"
            >
              <VideoIcon className="w-3 h-3" /> Upload Video
            </button>
            <button
              type="button"
              onClick={() => { setBgType('color'); setBgBase64(null); setBgPreviewUrl(null); setBgWarning(''); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${bgType === 'color' ? 'bg-violet-600 text-white border-violet-600' : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-600 hover:border-violet-400'}`}
            >
              <span className="w-3 h-3 rounded-full inline-block" style={{ background: brandColor }} />
              Brand Color
            </button>

            {/* Hidden file inputs */}
            <input
              ref={imgInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, 'image'); e.target.value = ''; }}
            />
            <input
              ref={vidInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, 'video'); e.target.value = ''; }}
            />
          </div>

          {bgWarning && (
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2 mb-3">{bgWarning}</p>
          )}

          {/* Background preview */}
          {bgPreviewUrl && bgType === 'image' && (
            <div className="relative w-20 h-32 rounded-xl overflow-hidden border-2 border-violet-400 shadow-md">
              <img src={bgPreviewUrl} alt="Background preview" className="w-full h-full object-cover" />
              <button
                onClick={() => { setBgType('color'); setBgBase64(null); setBgPreviewUrl(null); }}
                className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          {bgPreviewUrl && bgType === 'video' && (
            <div className="relative w-20 h-32 rounded-xl overflow-hidden border-2 border-violet-400 shadow-md">
              <video src={bgPreviewUrl} className="w-full h-full object-cover" muted />
              <button
                onClick={() => { setBgType('color'); setBgBase64(null); setBgPreviewUrl(null); }}
                className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80"
              >
                <X className="w-3 h-3" />
              </button>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <Play className="w-5 h-5 text-white/80" />
              </div>
            </div>
          )}
          {bgType === 'color' && (
            <div className="w-20 h-32 rounded-xl border-2 border-violet-400 shadow-md flex items-center justify-center" style={{ background: brandColor }}>
              <span className="text-white text-xs font-bold">Brand</span>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Section 2: AI Content ── */}
      <SectionCard title="AI Content" icon={Sparkles}>
        {/* Brand context strip */}
        <div className="flex items-center gap-2 bg-violet-50 dark:bg-violet-900/20 rounded-xl px-3 py-2 mb-4">
          <Sparkles className="w-3 h-3 text-violet-500 flex-shrink-0" />
          <span className="text-xs text-violet-700 dark:text-violet-300 font-medium">
            Creating for: <strong>{bizName}</strong>
            {bizType && bizType !== bizName ? <span className="font-normal opacity-75"> · {bizType}</span> : ''}
          </span>
        </div>

        {/* AI buttons */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={generateHook}
            disabled={aiLoading}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 text-xs font-bold border border-violet-200 dark:border-violet-700 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-all disabled:opacity-50"
          >
            {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            ✨ Generate Hook
          </button>
          <button
            type="button"
            onClick={generateScript}
            disabled={aiLoading}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 text-xs font-bold border border-violet-200 dark:border-violet-700 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-all disabled:opacity-50"
          >
            {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Film className="w-3.5 h-3.5" />}
            🎬 Generate Script
          </button>
        </div>

        {aiError && (
          <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 mb-3">{aiError}</p>
        )}

        {/* Headline */}
        <div className="mb-3">
          <label className="block text-xs font-semibold text-stone-600 dark:text-stone-400 mb-1">
            Headline <span className="text-stone-400 font-normal">({headline.length}/80)</span>
          </label>
          <textarea
            value={headline}
            onChange={e => setHeadline(e.target.value.slice(0, 80))}
            rows={2}
            placeholder="Your main hook — grab attention instantly"
            className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-stone-800 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
          />
        </div>

        {/* Subtext */}
        <div className="mb-3">
          <label className="block text-xs font-semibold text-stone-600 dark:text-stone-400 mb-1">
            Subtext <span className="text-stone-400 font-normal">({subtext.length}/100)</span>
          </label>
          <input
            value={subtext}
            onChange={e => setSubtext(e.target.value.slice(0, 100))}
            placeholder="Supporting line beneath the headline"
            className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-stone-800 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        {/* CTA */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-stone-600 dark:text-stone-400 mb-1">
            Call to Action <span className="text-stone-400 font-normal">({cta.length}/50)</span>
          </label>
          <input
            value={cta}
            onChange={e => setCta(e.target.value.slice(0, 50))}
            placeholder="e.g. Follow for more"
            className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-stone-800 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        {/* Text Position */}
        <div>
          <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-2 uppercase tracking-wide">Text Position</p>
          <div className="flex gap-2">
            {['top', 'center', 'bottom'].map(pos => (
              <Pill key={pos} active={textPosition === pos} onClick={() => setTextPosition(pos)}>
                {pos.charAt(0).toUpperCase() + pos.slice(1)}
              </Pill>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* ── Section 3: Style ── */}
      <SectionCard title="Style" icon={Palette}>
        {/* Text Color */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-2 uppercase tracking-wide">Text Color</p>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { id: 'white', label: 'White', color: '#ffffff' },
              { id: 'black', label: 'Black', color: '#000000' },
            ].map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTextColorMode(opt.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  textColorMode === opt.id
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-600 hover:border-violet-400'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full border border-stone-300 dark:border-stone-500"
                  style={{ background: opt.color }}
                />
                {opt.label}
              </button>
            ))}
            {/* Custom color picker */}
            <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-all ${
              textColorMode === 'custom'
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-600 hover:border-violet-400'
            }`}>
              <span
                className="w-3 h-3 rounded-full border border-stone-300 dark:border-stone-500"
                style={{ background: customTextColor }}
              />
              Custom
              <input
                type="color"
                value={customTextColor}
                onChange={e => { setCustomTextColor(e.target.value); setTextColorMode('custom'); }}
                className="absolute opacity-0 w-0 h-0"
              />
            </label>
          </div>
        </div>

        {/* Overlay */}
        <div>
          <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-2 uppercase tracking-wide">Background Overlay</p>
          <div className="flex gap-2">
            {[
              { id: 'none', label: 'None' },
              { id: 'light', label: 'Light' },
              { id: 'dark', label: 'Dark' },
            ].map(opt => (
              <Pill key={opt.id} active={overlayStyle === opt.id} onClick={() => setOverlayStyle(opt.id)}>
                {opt.label}
              </Pill>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* ── Generate button ── */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isRendering}
        className={`w-full py-4 rounded-2xl text-white font-black text-base shadow-lg transition-all ${
          isRendering
            ? 'bg-violet-400 dark:bg-violet-700 cursor-not-allowed'
            : 'bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-700 hover:from-violet-700 hover:via-indigo-700 hover:to-violet-800 active:scale-[0.98]'
        }`}
      >
        {isRendering ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            {renderProgress || 'Working…'}
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Sparkles className="w-5 h-5" /> Generate Video
          </span>
        )}
      </button>

      {/* Render progress indicator */}
      {isRendering && (
        <div className="bg-violet-50 dark:bg-violet-900/20 rounded-xl border border-violet-200 dark:border-violet-700 px-4 py-3 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            {['Submitting…', 'Rendering…', 'Almost done…'].map((step, i) => {
              const active =
                (i === 0 && renderState === 'submitting') ||
                (i === 1 && renderState === 'rendering') ||
                (i === 2 && renderState === 'rendering' && renderId);
              return (
                <span key={step} className={`text-xs font-medium transition-all ${active ? 'text-violet-700 dark:text-violet-300' : 'text-stone-400'}`}>
                  {active && <Loader2 className="w-3 h-3 inline mr-1 animate-spin" />}
                  {step}
                </span>
              );
            })}
          </div>
          <p className="text-xs text-stone-400">Usually takes 15–60 seconds depending on your clip.</p>
        </div>
      )}

      {/* ── History ── */}
      <HistorySection history={history} setHistory={setHistory} open={historyOpen} setOpen={setHistoryOpen} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// History section
// ---------------------------------------------------------------------------
function HistorySection({ history, setHistory, open, setOpen }) {
  if (history.length === 0) return null;

  const clearHistory = () => {
    saveHistory([]);
    setHistory([]);
  };

  return (
    <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-stone-400" />
          <span className="text-sm font-bold text-stone-700 dark:text-stone-200">
            Recent Videos
          </span>
          <span className="bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-400 text-xs font-semibold px-2 py-0.5 rounded-full">
            {history.length}
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
      </button>

      {open && (
        <div className="border-t border-stone-100 dark:border-stone-700 px-5 pb-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
            {history.map(item => (
              <HistoryCard key={item.id} item={item} />
            ))}
          </div>
          <button
            onClick={clearHistory}
            className="mt-4 text-xs text-stone-400 hover:text-red-500 transition-colors"
          >
            Clear history
          </button>
        </div>
      )}
    </div>
  );
}

function HistoryCard({ item }) {
  const date = new Date(item.createdAt);
  const dateStr = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <div className="bg-stone-50 dark:bg-stone-700/50 rounded-xl overflow-hidden border border-stone-200 dark:border-stone-600">
      {/* Thumbnail */}
      <div className="aspect-[9/16] bg-black flex items-center justify-center overflow-hidden">
        <video
          src={item.url}
          className="w-full h-full object-cover"
          muted
          preload="metadata"
        />
      </div>
      {/* Info */}
      <div className="p-2">
        <p className="text-xs font-semibold text-stone-700 dark:text-stone-200 truncate">{item.headline || 'No headline'}</p>
        <p className="text-[10px] text-stone-400 truncate">{item.format}</p>
        <p className="text-[10px] text-stone-400">{dateStr}</p>
        <a
          href={item.url}
          download="kreativelync-video.mp4"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 flex items-center justify-center gap-1 w-full py-1.5 rounded-lg bg-violet-600 text-white text-[10px] font-bold hover:bg-violet-700 transition-colors"
        >
          <Download className="w-2.5 h-2.5" /> Download
        </a>
      </div>
    </div>
  );
}
