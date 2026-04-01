import React, { useState, useRef, useEffect } from 'react';
import { Download, Sparkles, Loader2 } from 'lucide-react';
import { useStudio } from '../App';

const FORMATS = [
  { id: 'reel',   label: '📱 Reel',    w: 1080, h: 1920 },
  { id: 'square', label: '⬜ Square',   w: 1080, h: 1080 },
  { id: 'story',  label: '📖 Story',    w: 1080, h: 1920 },
  { id: 'flyer',  label: '🗒️ Flyer',    w: 1080, h: 1350 },
];

const TEMPLATES = [
  { id: 'quote',     label: 'Quote Card',          bg: ['#1e1b4b','#4c1d95'], accent: '#a78bfa', textColor: '#ffffff', headline: 'Your powerful quote goes here', subtext: '— Your Name', cta: '' },
  { id: 'announce',  label: 'Announcement',         bg: ['#0f172a','#1e3a5f'], accent: '#38bdf8', textColor: '#ffffff', headline: 'New Episode Out Now', subtext: 'Tap the link in bio to listen', cta: '🎙️ Listen Now' },
  { id: 'promo',     label: 'Product Promo',        bg: ['#064e3b','#065f46'], accent: '#34d399', textColor: '#ffffff', headline: 'Now Available', subtext: 'Wholesale prices for your business', cta: 'Shop Now →' },
  { id: 'scripture', label: 'Scripture',            bg: ['#78350f','#92400e'], accent: '#fcd34d', textColor: '#ffffff', headline: '"For I know the plans I have for you"', subtext: 'Jeremiah 29:11', cta: '' },
  { id: 'sale',      label: 'Sale / Offer',         bg: ['#7f1d1d','#991b1b'], accent: '#fca5a5', textColor: '#ffffff', headline: '20% OFF Today Only', subtext: 'Limited stock available', cta: 'Order Now →' },
  { id: 'tip',       label: 'Tip / Value Post',     bg: ['#1e3a2f','#14532d'], accent: '#86efac', textColor: '#ffffff', headline: '3 Tips to Save More This Month', subtext: 'Swipe to learn more ›', cta: '' },
  { id: 'podcast',   label: 'Podcast Episode',      bg: ['#2e1065','#3b0764'], accent: '#e879f9', textColor: '#ffffff', headline: 'Episode 12: Your Title Here', subtext: 'Her Stewardship Podcast', cta: '🎧 Out Now' },
  { id: 'minimal',   label: 'Clean / Minimal',      bg: ['#f8fafc','#f1f5f9'], accent: '#7c3aed', textColor: '#1e293b', headline: 'Your Message Here', subtext: 'Supporting line of text', cta: '' },
];

function drawCanvas({ canvas, template, headline, subtext, cta, format, brandColor }) {
  const ctx = canvas.getContext('2d');
  const { w, h } = format;
  canvas.width = w;
  canvas.height = h;

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, template.bg[0]);
  grad.addColorStop(1, template.bg[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Accent bar at top
  ctx.fillStyle = brandColor || template.accent;
  ctx.fillRect(0, 0, w, Math.round(h * 0.008));

  // Accent bar at bottom
  ctx.fillRect(0, h - Math.round(h * 0.008), w, Math.round(h * 0.008));

  // Decorative circle (top right)
  ctx.beginPath();
  ctx.arc(w * 0.85, h * 0.15, w * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = (brandColor || template.accent) + '18';
  ctx.fill();

  // Decorative circle (bottom left)
  ctx.beginPath();
  ctx.arc(w * 0.15, h * 0.88, w * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = (brandColor || template.accent) + '12';
  ctx.fill();

  const centerX = w / 2;
  const isSquare = format.id === 'square' || format.id === 'flyer';
  const baseY = isSquare ? h * 0.38 : h * 0.42;
  const headlineSize = isSquare ? Math.round(w * 0.065) : Math.round(w * 0.072);
  const subtextSize  = isSquare ? Math.round(w * 0.038) : Math.round(w * 0.042);
  const ctaSize      = isSquare ? Math.round(w * 0.034) : Math.round(w * 0.038);
  const maxWidth = w * 0.82;

  // Helper: wrap text
  function wrapText(text, fontSize, fontWeight, maxW) {
    ctx.font = `${fontWeight} ${fontSize}px 'Arial', sans-serif`;
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  // Headline
  const hlLines = wrapText(headline || '', headlineSize, '800', maxWidth);
  const lineH = headlineSize * 1.3;
  let y = baseY - ((hlLines.length - 1) * lineH) / 2;

  ctx.fillStyle = template.textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  hlLines.forEach(line => {
    ctx.font = `800 ${headlineSize}px 'Arial', sans-serif`;
    ctx.fillText(line, centerX, y);
    y += lineH;
  });

  y += subtextSize * 0.8;

  // Accent divider
  if (subtext) {
    ctx.fillStyle = brandColor || template.accent;
    ctx.fillRect(centerX - w * 0.06, y, w * 0.12, Math.round(subtextSize * 0.18));
    y += subtextSize * 1.2;
  }

  // Subtext
  if (subtext) {
    const stLines = wrapText(subtext, subtextSize, '400', maxWidth);
    ctx.fillStyle = template.textColor + 'cc';
    stLines.forEach(line => {
      ctx.font = `400 ${subtextSize}px 'Arial', sans-serif`;
      ctx.fillText(line, centerX, y);
      y += subtextSize * 1.4;
    });
    y += ctaSize * 0.4;
  }

  // CTA pill
  if (cta) {
    ctx.font = `700 ${ctaSize}px 'Arial', sans-serif`;
    const ctaW = ctx.measureText(cta).width + ctaSize * 2.4;
    const ctaH = ctaSize * 2.2;
    const ctaX = centerX - ctaW / 2;
    const ctaY = y - ctaH / 2;
    const r = ctaH / 2;
    ctx.beginPath();
    ctx.moveTo(ctaX + r, ctaY);
    ctx.lineTo(ctaX + ctaW - r, ctaY);
    ctx.quadraticCurveTo(ctaX + ctaW, ctaY, ctaX + ctaW, ctaY + r);
    ctx.lineTo(ctaX + ctaW, ctaY + ctaH - r);
    ctx.quadraticCurveTo(ctaX + ctaW, ctaY + ctaH, ctaX + ctaW - r, ctaY + ctaH);
    ctx.lineTo(ctaX + r, ctaY + ctaH);
    ctx.quadraticCurveTo(ctaX, ctaY + ctaH, ctaX, ctaY + ctaH - r);
    ctx.lineTo(ctaX, ctaY + r);
    ctx.quadraticCurveTo(ctaX, ctaY, ctaX + r, ctaY);
    ctx.closePath();
    ctx.fillStyle = brandColor || template.accent;
    ctx.fill();
    ctx.fillStyle = template.bg[0];
    ctx.fillText(cta, centerX, y);
  }
}

export function GraphicMaker() {
  const { businesses, activeBusinessId } = useStudio();
  const activeBiz = (businesses || []).find(b => b?.id === activeBusinessId);
  const bizName = activeBiz?.name || 'Your Brand';

  const [template, setTemplate]   = useState(TEMPLATES[0]);
  const [format, setFormat]       = useState(FORMATS[0]);
  const [headline, setHeadline]   = useState(TEMPLATES[0].headline);
  const [subtext, setSubtext]     = useState(TEMPLATES[0].subtext);
  const [cta, setCta]             = useState(TEMPLATES[0].cta);
  const [brandColor, setBrandColor] = useState('#7c3aed');
  const [aiLoading, setAiLoading] = useState(false);

  const canvasRef = useRef(null);
  const previewRef = useRef(null);

  // Redraw whenever inputs change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawCanvas({ canvas, template, headline, subtext, cta, format, brandColor });
    // Update preview img
    if (previewRef.current) {
      previewRef.current.src = canvas.toDataURL('image/png');
    }
  }, [template, headline, subtext, cta, format, brandColor]);

  const pickTemplate = (t) => {
    setTemplate(t);
    setHeadline(t.headline);
    setSubtext(t.subtext);
    setCta(t.cta);
  };

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `kreativelync-graphic-${Date.now()}.png`;
    a.click();
  };

  const generateWithAI = async () => {
    setAiLoading(true);
    try {
      const bizType = activeBiz?.type || 'faith';
      const bizDesc = activeBiz?.description || '';
      const r = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'chat',
          brandName: bizName,
          brandType: bizType,
          chatHistory: [{
            role: 'user',
            text: `Create text for a social media graphic for ${bizName} (${bizType} brand). ${bizDesc ? `Brand info: ${bizDesc}` : ''}
Template style: ${template.label}.
Reply in this exact JSON format, nothing else:
{"headline":"short powerful headline max 8 words","subtext":"supporting line max 12 words","cta":"call to action max 4 words or empty string"}`
          }]
        })
      });
      const data = await r.json();
      const text = data.reply || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.headline) setHeadline(parsed.headline);
        if (parsed.subtext !== undefined) setSubtext(parsed.subtext);
        if (parsed.cta !== undefined) setCta(parsed.cta);
      }
    } catch (_) {}
    setAiLoading(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-violet-50 to-amber-50 dark:from-stone-800 dark:to-stone-800 border-2 border-violet-200 dark:border-violet-800 rounded-3xl p-6">
        <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-1">🎨 Graphic Maker</h2>
        <p className="text-stone-500 dark:text-stone-400 text-sm">Pick a template → edit the text → download. Done.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT — controls */}
        <div className="space-y-5">

          {/* Step 1 — Template */}
          <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-5">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">1 · Pick a Template</p>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => pickTemplate(t)}
                  className={`px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition-all ${template.id === t.id ? 'bg-violet-500 text-white shadow' : 'bg-stone-50 dark:bg-stone-700 text-stone-700 dark:text-stone-200 hover:bg-violet-50 dark:hover:bg-stone-600'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2 — Text */}
          <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">2 · Edit Text</p>
              <button onClick={generateWithAI} disabled={aiLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-xs font-bold hover:bg-violet-200 disabled:opacity-50">
                {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {aiLoading ? 'Writing…' : 'AI Write It'}
              </button>
            </div>
            <div>
              <label className="text-xs text-stone-500 font-medium block mb-1">Headline</label>
              <input value={headline} onChange={e => setHeadline(e.target.value)} maxLength={80}
                className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-3 py-2.5 text-sm text-stone-800 dark:text-stone-100" />
            </div>
            <div>
              <label className="text-xs text-stone-500 font-medium block mb-1">Subtext</label>
              <input value={subtext} onChange={e => setSubtext(e.target.value)} maxLength={100}
                className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-3 py-2.5 text-sm text-stone-800 dark:text-stone-100" />
            </div>
            <div>
              <label className="text-xs text-stone-500 font-medium block mb-1">Call to Action <span className="text-stone-400">(optional)</span></label>
              <input value={cta} onChange={e => setCta(e.target.value)} maxLength={50} placeholder="e.g. Follow for more"
                className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-3 py-2.5 text-sm text-stone-800 dark:text-stone-100" />
            </div>
          </div>

          {/* Step 3 — Format & Color */}
          <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-5 space-y-4">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">3 · Format & Color</p>
            <div className="flex flex-wrap gap-2">
              {FORMATS.map(f => (
                <button key={f.id} onClick={() => setFormat(f)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${format.id === f.id ? 'bg-violet-500 text-white' : 'bg-stone-50 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-violet-50'}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-stone-500 font-medium">Accent Color</label>
              <input type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)}
                className="w-10 h-10 rounded-xl border-2 border-stone-200 dark:border-stone-600 cursor-pointer" />
              <div className="flex gap-2">
                {['#7c3aed','#2563eb','#059669','#dc2626','#d97706','#db2777'].map(c => (
                  <button key={c} onClick={() => setBrandColor(c)}
                    className="w-7 h-7 rounded-lg border-2 border-white dark:border-stone-700 shadow hover:scale-110 transition-transform"
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>

          {/* Download */}
          <button onClick={download}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-500 to-violet-600 text-white font-bold text-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-lg shadow-violet-200 dark:shadow-none">
            <Download size={20} />
            Download Graphic
          </button>
        </div>

        {/* RIGHT — live preview */}
        <div className="flex flex-col items-center gap-3">
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest self-start">Live Preview</p>
          <div className="w-full flex justify-center">
            <img ref={previewRef} alt="Graphic preview"
              className="rounded-2xl shadow-xl border border-stone-100 dark:border-stone-700"
              style={{ maxHeight: '70vh', maxWidth: '100%', objectFit: 'contain' }} />
          </div>
          <p className="text-xs text-stone-400">{format.w} × {format.h}px · PNG</p>
        </div>
      </div>

      {/* Hidden canvas for rendering */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
