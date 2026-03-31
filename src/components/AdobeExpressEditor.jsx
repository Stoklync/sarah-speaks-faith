import React, { useEffect, useRef, useState } from 'react';

const ADOBE_CLIENT_ID = localStorage.getItem('kreativelync-adobe-client-id') || '';

export function AdobeExpressEditor({ mode = 'design', onSave }) {
  const [clientId, setClientId] = useState(() => localStorage.getItem('kreativelync-adobe-client-id') || '');
  const [ccEverywhere, setCcEverywhere] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!clientId || initialized.current) return;
    const init = async () => {
      try {
        setLoading(true);
        const cc = await window.CCEverywhere.initialize({
          clientId,
          appName: 'KreativeLync',
        });
        setCcEverywhere(cc);
        initialized.current = true;
      } catch (e) {
        setError('Failed to initialize Adobe Express. Check your Client ID.');
      } finally {
        setLoading(false);
      }
    };
    if (window.CCEverywhere) {
      init();
    } else {
      const interval = setInterval(() => {
        if (window.CCEverywhere) {
          clearInterval(interval);
          init();
        }
      }, 500);
    }
  }, [clientId]);

  const openEditor = (type) => {
    if (!ccEverywhere) return;
    const callbacks = {
      onPublish: (intent, exportButtonId, publishParams) => {
        if (onSave) onSave(publishParams);
      },
    };
    if (type === 'image') {
      ccEverywhere.createDesign({
        modalParams: { parentElementId: 'adobe-express-root' },
        callbacks,
        outputParams: { outputType: 'base64' },
        designConfig: { category: 'SocialMedia' },
      });
    } else if (type === 'video') {
      ccEverywhere.createDesign({
        modalParams: { parentElementId: 'adobe-express-root' },
        callbacks,
        outputParams: { outputType: 'base64' },
        designConfig: { category: 'Video' },
      });
    } else if (type === 'flyer') {
      ccEverywhere.createDesign({
        modalParams: { parentElementId: 'adobe-express-root' },
        callbacks,
        outputParams: { outputType: 'base64' },
        designConfig: { category: 'Flyer' },
      });
    } else if (type === 'post') {
      ccEverywhere.createDesign({
        modalParams: { parentElementId: 'adobe-express-root' },
        callbacks,
        outputParams: { outputType: 'base64' },
        designConfig: { category: 'InstagramPost' },
      });
    }
  };

  // No client ID — show setup screen
  if (!clientId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-400 rounded-2xl flex items-center justify-center mb-6">
          <span className="text-white text-2xl font-black">A</span>
        </div>
        <h2 className="text-2xl font-black text-stone-800 dark:text-stone-100 mb-2">Connect Adobe Express</h2>
        <p className="text-stone-500 dark:text-stone-400 mb-8 max-w-md">
          Adobe Express gives you a professional photo and video editor right inside KreativeLync. One Client ID unlocks everything.
        </p>
        <div className="w-full max-w-sm space-y-3">
          <input
            type="text"
            placeholder="Paste your Adobe Client ID..."
            className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-4 py-3 text-sm"
            onChange={(e) => {
              localStorage.setItem('kreativelync-adobe-client-id', e.target.value);
              setClientId(e.target.value);
            }}
          />
          <a
            href="https://developer.adobe.com/express/embed-sdk/"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-400 text-white font-bold text-sm text-center"
          >
            Get Adobe Client ID →
          </a>
          <p className="text-xs text-stone-400">
            Free to get started at developer.adobe.com/express
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-stone-500">Loading Adobe Express...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={() => { localStorage.removeItem('kreativelync-adobe-client-id'); setClientId(''); setError(null); initialized.current = false; }}
          className="px-6 py-2 rounded-xl bg-stone-100 dark:bg-stone-700 text-stone-700 dark:text-stone-200 text-sm font-medium"
        >
          Reset Client ID
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <div id="adobe-express-root" />

      {/* Launch buttons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { type: 'post', label: 'Instagram Post', emoji: '📸', color: 'from-pink-500 to-rose-500' },
          { type: 'video', label: 'Video', emoji: '🎬', color: 'from-violet-500 to-indigo-500' },
          { type: 'flyer', label: 'Flyer / Poster', emoji: '📄', color: 'from-emerald-500 to-teal-500' },
          { type: 'image', label: 'Custom Design', emoji: '🎨', color: 'from-orange-500 to-amber-500' },
        ].map(({ type, label, emoji, color }) => (
          <button
            key={type}
            onClick={() => openEditor(type)}
            className={`flex flex-col items-center gap-3 p-6 rounded-2xl bg-gradient-to-br ${color} text-white font-bold shadow-lg hover:scale-105 transition-transform`}
          >
            <span className="text-3xl">{emoji}</span>
            <span className="text-sm">{label}</span>
          </button>
        ))}
      </div>

      <p className="text-xs text-center text-stone-400">
        Powered by Adobe Express — professional quality, your brand, your content.
      </p>
    </div>
  );
}
