import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2, AlertCircle, RotateCcw } from 'lucide-react';

// Design format catalogue — maps to CCEverywhere v4 category IDs
const DESIGN_FORMATS = [
  { id: 'ig-post',    label: 'Instagram Post',    emoji: '📸', category: 'InstagramPost',      desc: '1080 × 1080' },
  { id: 'ig-story',  label: 'IG Story / Reel',   emoji: '📱', category: 'InstagramStory',     desc: '1080 × 1920' },
  { id: 'yt-thumb',  label: 'YouTube Thumb',     emoji: '▶️', category: 'YouTubeThumbnail',   desc: '1280 × 720' },
  { id: 'fb-cover',  label: 'Facebook Cover',    emoji: '📘', category: 'FacebookCover',      desc: '820 × 312' },
  { id: 'flyer',     label: 'Flyer / Poster',    emoji: '📄', category: 'Flyer',              desc: 'Print-ready' },
  { id: 'video',     label: 'Video',             emoji: '🎬', category: 'Video',              desc: 'Any length' },
  { id: 'logo',      label: 'Logo / Icon',       emoji: '🎨', category: 'Logo',               desc: '800 × 800' },
  { id: 'social',    label: 'Custom Design',     emoji: '✨', category: 'SocialMedia',        desc: 'Any size' },
];

export function AdobeExpressEditor({ onSave }) {
  const [clientId, setClientId] = useState(() => {
    try { return localStorage.getItem('kreativelync-adobe-client-id') || ''; } catch { return ''; }
  });
  const [draftId, setDraftId] = useState('');
  const [ccEverywhere, setCcEverywhere] = useState(null);
  const [loading, setLoading] = useState(false);
  const [launching, setLaunching] = useState(null); // format id being launched
  const [error, setError] = useState(null);
  const initialized = useRef(false);
  const containerRef = useRef(null);

  // Initialize Adobe CCEverywhere SDK when clientId is set
  useEffect(() => {
    if (!clientId || initialized.current) return;

    const init = async () => {
      setLoading(true);
      setError(null);
      try {
        const cc = await window.CCEverywhere.initialize({
          clientId,
          appName: 'KreativeLync',
          appVersion: { major: 1, minor: 0 },
          platformCategory: 'web',
        });
        setCcEverywhere(cc);
        initialized.current = true;
      } catch (e) {
        setError('Could not initialize Adobe Express. Double-check your Client ID.');
        initialized.current = false;
      } finally {
        setLoading(false);
      }
    };

    if (window.CCEverywhere) {
      init();
    } else {
      // SDK loads async from CDN — poll until ready
      const t = setInterval(() => {
        if (window.CCEverywhere) { clearInterval(t); init(); }
      }, 400);
      return () => clearInterval(t);
    }
  }, [clientId]);

  const openDesign = (format) => {
    if (!ccEverywhere || launching) return;
    setLaunching(format.id);

    const callbacks = {
      onPublish: (intent, exportButtonId, publishParams) => {
        setLaunching(null);
        if (onSave) onSave({ format, publishParams });
      },
      onError: (err) => {
        console.error('Adobe Express error:', err);
        setLaunching(null);
      },
      onClose: () => setLaunching(null),
    };

    try {
      ccEverywhere.createDesign({
        modalParams: { parentElementId: 'adobe-express-container' },
        callbacks,
        outputParams: { outputType: 'base64' },
        designConfig: { category: format.category },
      });
    } catch (e) {
      console.error(e);
      setLaunching(null);
    }
  };

  // ── No Client ID ──────────────────────────────────────────────
  if (!clientId) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-400 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg">
            <span className="text-white text-2xl font-black">Ae</span>
          </div>
          <h2 className="text-2xl font-black text-stone-800 dark:text-stone-100 mb-2">Connect Adobe Express</h2>
          <p className="text-stone-500 dark:text-stone-400 text-sm leading-relaxed">
            Adobe Express replaces the old Design Studio — professional templates, brand kits, and every format you need. One Client ID unlocks it all.
          </p>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            placeholder="Paste your Adobe Express Client ID..."
            className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl px-4 py-3 text-sm text-stone-800 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-red-400"
            onChange={e => {
              const v = e.target.value.trim();
              localStorage.setItem('kreativelync-adobe-client-id', v);
              setClientId(v);
            }}
          />
          <a
            href="https://developer.adobe.com/express/embed-sdk/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-gradient-to-r from-red-500 to-orange-400 text-white font-bold text-sm hover:from-red-400 hover:to-orange-300 transition-all shadow-md"
          >
            Get your free Adobe Client ID <ExternalLink size={14} />
          </a>
          <p className="text-xs text-center text-stone-400">Free tier available at developer.adobe.com/express</p>
        </div>

        {/* Preview the formats even without a key */}
        <div className="mt-10">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">What you'll be able to create</p>
          <div className="grid grid-cols-4 gap-2">
            {DESIGN_FORMATS.map(f => (
              <div key={f.id} className="flex flex-col items-center gap-1.5 p-3 bg-stone-50 dark:bg-stone-800 rounded-xl opacity-60">
                <span className="text-xl">{f.emoji}</span>
                <span className="text-[10px] text-stone-500 dark:text-stone-400 text-center leading-tight">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <Loader2 size={32} className="animate-spin text-red-500" />
        <p className="text-stone-500 dark:text-stone-400 text-sm">Connecting to Adobe Express...</p>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center p-8">
        <AlertCircle size={32} className="text-red-500" />
        <p className="text-stone-700 dark:text-stone-300 font-medium">{error}</p>
        <button
          onClick={() => {
            localStorage.removeItem('kreativelync-adobe-client-id');
            setClientId('');
            setError(null);
            initialized.current = false;
            setCcEverywhere(null);
          }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-sm font-semibold hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
        >
          <RotateCcw size={14} /> Reset &amp; try a different Client ID
        </button>
      </div>
    );
  }

  // ── Main Design Hub ───────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Hidden container Adobe Express attaches its modal to */}
      <div id="adobe-express-container" ref={containerRef} />

      <div>
        <h2 className="text-2xl font-black text-stone-800 dark:text-stone-100 mb-1">Design Studio</h2>
        <p className="text-stone-500 dark:text-stone-400 text-sm">Powered by Adobe Express — pick a format, create, and publish back here.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {DESIGN_FORMATS.map(format => (
          <button
            key={format.id}
            onClick={() => openDesign(format)}
            disabled={!ccEverywhere || launching === format.id}
            className="group relative flex flex-col items-center gap-3 p-5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl hover:border-red-300 dark:hover:border-red-700 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {launching === format.id && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-stone-800/80 rounded-2xl">
                <Loader2 size={20} className="animate-spin text-red-500" />
              </div>
            )}
            <span className="text-3xl">{format.emoji}</span>
            <div className="text-center">
              <p className="text-sm font-bold text-stone-800 dark:text-stone-100 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors leading-tight">{format.label}</p>
              <p className="text-[10px] text-stone-400 mt-0.5">{format.desc}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-stone-400 pt-2 border-t border-stone-100 dark:border-stone-800">
        <span>Powered by Adobe Express Embed SDK v4</span>
        <button
          onClick={() => {
            localStorage.removeItem('kreativelync-adobe-client-id');
            setClientId('');
            initialized.current = false;
            setCcEverywhere(null);
          }}
          className="hover:text-red-500 transition-colors"
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}
