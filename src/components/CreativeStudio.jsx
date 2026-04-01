import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import * as fabric from 'fabric';
import {
  Pointer,
  Type,
  ImageIcon,
  Shapes,
  Palette,
  Download,
  Undo2,
  Redo2,
  Trash2,
  Sparkles,
  Plus,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Square,
  Circle,
  Triangle,
  Minus as LineIcon,
  ChevronDown,
  X,
  Loader2,
  Monitor,
} from 'lucide-react';
import { useStudio } from '../App';

// ── Constants ────────────────────────────────────────────────────────────────

const FORMATS = [
  { id: 'reel',      label: 'Reel / Story',       w: 1080, h: 1920 },
  { id: 'square',    label: 'Square Post',         w: 1080, h: 1080 },
  { id: 'flyer',     label: 'Flyer',               w: 1080, h: 1350 },
  { id: 'thumbnail', label: 'YouTube Thumbnail',   w: 1280, h: 720  },
];

const DISPLAY_WIDTH = 540; // px — canvas renders at half-res, exports at 2x

const FONTS = [
  'Inter',
  'Playfair Display',
  'Montserrat',
  'Oswald',
  'Lato',
  'Poppins',
  'Dancing Script',
  'Bebas Neue',
];

const BRAND_VIOLET = '#7c3aed';

// ── Templates ─────────────────────────────────────────────────────────────────

const TEMPLATES = [
  {
    id: 'blank',
    label: 'Blank',
    bg: '#ffffff',
    elements: [],
  },
  {
    id: 'dark',
    label: 'Dark Gradient',
    bg: { type: 'gradient', colors: ['#0f0c29', '#302b63', '#24243e'] },
    elements: [
      { type: 'text', text: 'YOUR HEADLINE', fontSize: 52, fontFamily: 'Montserrat', fontWeight: 'bold', fill: '#ffffff', left: 0.5, top: 0.45, textAlign: 'center' },
      { type: 'text', text: 'Subtext goes here', fontSize: 24, fontFamily: 'Inter', fill: '#cbd5e1', left: 0.5, top: 0.56, textAlign: 'center' },
    ],
  },
  {
    id: 'quote',
    label: 'Quote Card',
    bg: '#1e1b4b',
    elements: [
      { type: 'rect', left: 0.5, top: 0.08, width: 0.85, height: 0.004, fill: '#7c3aed' },
      { type: 'text', text: '"Your inspiring quote goes here.\nLet it speak to the soul."', fontSize: 34, fontFamily: 'Playfair Display', fontStyle: 'italic', fill: '#f1f5f9', left: 0.5, top: 0.44, textAlign: 'center' },
      { type: 'text', text: '— Author Name', fontSize: 20, fontFamily: 'Inter', fill: '#94a3b8', left: 0.5, top: 0.67, textAlign: 'center' },
      { type: 'rect', left: 0.5, top: 0.78, width: 0.85, height: 0.004, fill: '#7c3aed' },
    ],
  },
  {
    id: 'announcement',
    label: 'Announcement',
    bg: { type: 'gradient', colors: ['#6d28d9', '#4f46e5'] },
    elements: [
      { type: 'text', text: 'ANNOUNCEMENT', fontSize: 22, fontFamily: 'Oswald', fill: '#ddd6fe', left: 0.5, top: 0.3, textAlign: 'center', charSpacing: 200 },
      { type: 'text', text: 'Big News Title Here', fontSize: 56, fontFamily: 'Bebas Neue', fill: '#ffffff', left: 0.5, top: 0.42, textAlign: 'center' },
      { type: 'text', text: 'Add your details below — date, time, or a short description of what\'s happening.', fontSize: 22, fontFamily: 'Lato', fill: '#e0e7ff', left: 0.5, top: 0.58, textAlign: 'center' },
    ],
  },
  {
    id: 'scripture',
    label: 'Scripture Card',
    bg: '#fdf8f0',
    elements: [
      { type: 'text', text: '"For I know the plans I have for you,\ndeclares the Lord."', fontSize: 32, fontFamily: 'Playfair Display', fontStyle: 'italic', fill: '#78350f', left: 0.5, top: 0.38, textAlign: 'center' },
      { type: 'text', text: 'Jeremiah 29:11', fontSize: 20, fontFamily: 'Inter', fontWeight: 'bold', fill: '#92400e', left: 0.5, top: 0.62, textAlign: 'center' },
      { type: 'text', text: '@YourHandle', fontSize: 18, fontFamily: 'Inter', fill: '#b45309', left: 0.5, top: 0.84, textAlign: 'center' },
    ],
  },
  {
    id: 'promo',
    label: 'Product Promo',
    bg: '#f8fafc',
    elements: [
      { type: 'rect', left: 0.5, top: 0.14, width: 0.9, height: 0.25, fill: '#7c3aed', rx: 16 },
      { type: 'text', text: 'PRODUCT NAME', fontSize: 46, fontFamily: 'Bebas Neue', fill: '#ffffff', left: 0.5, top: 0.17, textAlign: 'center' },
      { type: 'text', text: 'The one-line value proposition that makes\npeople stop scrolling.', fontSize: 24, fontFamily: 'Poppins', fill: '#334155', left: 0.5, top: 0.46, textAlign: 'center' },
      { type: 'text', text: 'Shop Now →', fontSize: 26, fontFamily: 'Poppins', fontWeight: 'bold', fill: '#7c3aed', left: 0.5, top: 0.72, textAlign: 'center' },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const getDisplayHeight = (format) =>
  Math.round((DISPLAY_WIDTH * format.h) / format.w);

const scaleX = (val, displayW) => val * displayW;
const scaleY = (val, displayH) => val * displayH;

function makeGradientBg(colors, width, height) {
  const el = document.createElement('canvas');
  el.width = width;
  el.height = height;
  const ctx = el.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  colors.forEach((c, i) => grad.addColorStop(i / (colors.length - 1), c));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  return el.toDataURL();
}

// ── Main Component ────────────────────────────────────────────────────────────

export function CreativeStudio() {
  const { businesses, activeBusinessId } = useStudio();
  const activeBrand = (businesses || []).find(b => b?.id === activeBusinessId);

  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const historyRef = useRef({ stack: [], index: -1, paused: false });
  const fileInputRef = useRef(null);
  const bgFileInputRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [activeTool, setActiveTool] = useState('select');
  const [activeFormat, setActiveFormat] = useState(FORMATS[1]); // Square Post default
  const [selectedObj, setSelectedObj] = useState(null);
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showFormatMenu, setShowFormatMenu] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [bgColor, setBgColor] = useState('#ffffff');

  // Properties panel state (synced from selected object)
  const [props, setProps] = useState({
    fill: '#000000',
    stroke: '#000000',
    strokeWidth: 0,
    opacity: 1,
    fontFamily: 'Inter',
    fontSize: 32,
    fontWeight: 'normal',
    fontStyle: 'normal',
    textAlign: 'left',
  });

  const displayHeight = useMemo(() => getDisplayHeight(activeFormat), [activeFormat]);

  // ── Canvas init ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: DISPLAY_WIDTH,
      height: displayHeight,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
      selection: true,
    });

    fabricRef.current = canvas;

    // History helpers
    const saveHistory = () => {
      if (historyRef.current.paused) return;
      const json = canvas.toJSON();
      const { stack, index } = historyRef.current;
      const newStack = stack.slice(0, index + 1);
      newStack.push(json);
      historyRef.current = { stack: newStack, index: newStack.length - 1, paused: false };
    };

    canvas.on('object:added', saveHistory);
    canvas.on('object:modified', saveHistory);
    canvas.on('object:removed', saveHistory);

    canvas.on('selection:created', (e) => {
      const obj = e.selected?.[0];
      if (obj) syncPropsFromObject(obj);
      setSelectedObj(obj || null);
    });
    canvas.on('selection:updated', (e) => {
      const obj = e.selected?.[0];
      if (obj) syncPropsFromObject(obj);
      setSelectedObj(obj || null);
    });
    canvas.on('selection:cleared', () => setSelectedObj(null));

    // Keyboard shortcuts
    const handleKey = (e) => {
      const active = canvas.getActiveObject();
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redoAction(canvas);
        else undoAction(canvas);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && active && active.type !== 'i-text') {
        e.preventDefault();
        canvas.remove(active);
        canvas.discardActiveObject();
        canvas.renderAll();
      }
    };
    window.addEventListener('keydown', handleKey);

    // Save initial state
    saveHistory();
    setReady(true);

    return () => {
      window.removeEventListener('keydown', handleKey);
      canvas.dispose();
      fabricRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resize canvas when format changes
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !ready) return;
    canvas.setDimensions({ width: DISPLAY_WIDTH, height: displayHeight });
    canvas.renderAll();
  }, [displayHeight, ready]);

  // ── History ──────────────────────────────────────────────────────────────
  const undoAction = useCallback((canvas) => {
    const cvs = canvas || fabricRef.current;
    if (!cvs) return;
    const h = historyRef.current;
    if (h.index <= 0) return;
    const newIndex = h.index - 1;
    historyRef.current = { ...h, index: newIndex, paused: true };
    cvs.loadFromJSON(h.stack[newIndex], () => {
      cvs.renderAll();
      historyRef.current.paused = false;
    });
  }, []);

  const redoAction = useCallback((canvas) => {
    const cvs = canvas || fabricRef.current;
    if (!cvs) return;
    const h = historyRef.current;
    if (h.index >= h.stack.length - 1) return;
    const newIndex = h.index + 1;
    historyRef.current = { ...h, index: newIndex, paused: true };
    cvs.loadFromJSON(h.stack[newIndex], () => {
      cvs.renderAll();
      historyRef.current.paused = false;
    });
  }, []);

  // ── Sync props from selected object ──────────────────────────────────────
  const syncPropsFromObject = (obj) => {
    if (!obj) return;
    setProps({
      fill: obj.fill || '#000000',
      stroke: obj.stroke || '#000000',
      strokeWidth: obj.strokeWidth || 0,
      opacity: obj.opacity ?? 1,
      fontFamily: obj.fontFamily || 'Inter',
      fontSize: obj.fontSize || 32,
      fontWeight: obj.fontWeight || 'normal',
      fontStyle: obj.fontStyle || 'normal',
      textAlign: obj.textAlign || 'left',
    });
  };

  // Apply a prop change to the selected object
  const applyProp = useCallback((key, value) => {
    const canvas = fabricRef.current;
    const obj = canvas?.getActiveObject();
    if (!obj) return;
    obj.set(key, value);
    canvas.renderAll();
    setProps(prev => ({ ...prev, [key]: value }));
  }, []);

  // ── Tool actions ──────────────────────────────────────────────────────────
  const addText = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const text = new fabric.IText('Double-click to edit', {
      left: DISPLAY_WIDTH / 2,
      top: getDisplayHeight(activeFormat) / 2,
      originX: 'center',
      originY: 'center',
      fontFamily: 'Inter',
      fontSize: 32,
      fill: '#1e1b4b',
      editable: true,
      splitByGrapheme: false,
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
  }, [activeFormat]);

  const addShape = useCallback((type) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const dh = getDisplayHeight(activeFormat);
    const cx = DISPLAY_WIDTH / 2;
    const cy = dh / 2;
    let shape;
    const base = { left: cx, top: cy, originX: 'center', originY: 'center', fill: BRAND_VIOLET };
    if (type === 'rect') {
      shape = new fabric.Rect({ ...base, width: 160, height: 100, rx: 8, ry: 8 });
    } else if (type === 'circle') {
      shape = new fabric.Circle({ ...base, radius: 70 });
    } else if (type === 'triangle') {
      shape = new fabric.Triangle({ ...base, width: 140, height: 120 });
    } else if (type === 'line') {
      shape = new fabric.Line([cx - 80, cy, cx + 80, cy], { stroke: BRAND_VIOLET, strokeWidth: 4, originX: 'center', originY: 'center' });
    }
    if (shape) {
      canvas.add(shape);
      canvas.setActiveObject(shape);
      canvas.renderAll();
    }
    setShowShapeMenu(false);
  }, [activeFormat]);

  const handleImageUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      fabric.Image.fromURL(dataUrl, (img) => {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const dh = getDisplayHeight(activeFormat);
        const maxW = DISPLAY_WIDTH * 0.7;
        const maxH = dh * 0.7;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        img.set({
          left: DISPLAY_WIDTH / 2,
          top: dh / 2,
          originX: 'center',
          originY: 'center',
          scaleX: scale,
          scaleY: scale,
        });
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
      }, { crossOrigin: 'anonymous' });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [activeFormat]);

  const handleBgImageUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      const canvas = fabricRef.current;
      if (!canvas) return;
      canvas.setBackgroundImage(dataUrl, () => {
        canvas.backgroundImage?.set({
          scaleX: DISPLAY_WIDTH / canvas.backgroundImage.width,
          scaleY: getDisplayHeight(activeFormat) / canvas.backgroundImage.height,
        });
        canvas.renderAll();
      }, { crossOrigin: 'anonymous' });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [activeFormat]);

  const applyBgColor = useCallback((color) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.setBackgroundColor(color, () => {
      canvas.backgroundImage = null;
      canvas.renderAll();
    });
    setBgColor(color);
  }, []);

  const applyTemplate = useCallback((template) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    historyRef.current.paused = true;
    canvas.clear();
    const dh = getDisplayHeight(activeFormat);

    // Background
    if (typeof template.bg === 'string') {
      canvas.setBackgroundColor(template.bg, () => canvas.renderAll());
      setBgColor(template.bg);
    } else if (template.bg?.type === 'gradient') {
      const dataUrl = makeGradientBg(template.bg.colors, DISPLAY_WIDTH, dh);
      canvas.setBackgroundImage(dataUrl, () => {
        canvas.backgroundImage?.set({ scaleX: 1, scaleY: 1 });
        canvas.renderAll();
      });
    }

    // Elements
    template.elements.forEach((el) => {
      const cx = el.left * DISPLAY_WIDTH;
      const cy = el.top * dh;

      if (el.type === 'text') {
        const text = new fabric.IText(el.text || '', {
          left: cx,
          top: cy,
          originX: 'center',
          originY: 'center',
          fontFamily: el.fontFamily || 'Inter',
          fontSize: el.fontSize || 28,
          fontWeight: el.fontWeight || 'normal',
          fontStyle: el.fontStyle || 'normal',
          fill: el.fill || '#ffffff',
          textAlign: el.textAlign || 'center',
          charSpacing: el.charSpacing || 0,
          editable: true,
        });
        canvas.add(text);
      } else if (el.type === 'rect') {
        const rect = new fabric.Rect({
          left: cx,
          top: cy,
          originX: 'center',
          originY: 'center',
          width: el.width ? el.width * DISPLAY_WIDTH : 200,
          height: el.height ? el.height * dh : 20,
          fill: el.fill || BRAND_VIOLET,
          rx: el.rx || 0,
          ry: el.rx || 0,
          selectable: true,
        });
        canvas.add(rect);
      }
    });

    historyRef.current.paused = false;
    // save this as history
    const json = canvas.toJSON();
    historyRef.current = { stack: [json], index: 0, paused: false };
    canvas.renderAll();
    setShowTemplates(false);
    setSelectedObj(null);
  }, [activeFormat]);

  const clearCanvas = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (!window.confirm('Clear all elements from the canvas?')) return;
    canvas.clear();
    canvas.setBackgroundColor('#ffffff', canvas.renderAll.bind(canvas));
    setBgColor('#ffffff');
    setSelectedObj(null);
  }, []);

  const downloadPNG = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.discardActiveObject();
    canvas.renderAll();
    const dataURL = canvas.toDataURL({
      format: 'png',
      multiplier: 2,
      quality: 1,
    });
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = `kreativelync-${activeFormat.id}-${Date.now()}.png`;
    a.click();
  }, [activeFormat]);

  const deleteSelected = useCallback(() => {
    const canvas = fabricRef.current;
    const obj = canvas?.getActiveObject();
    if (!obj) return;
    canvas.remove(obj);
    canvas.discardActiveObject();
    canvas.renderAll();
    setSelectedObj(null);
  }, []);

  const bringForward = useCallback(() => {
    const canvas = fabricRef.current;
    const obj = canvas?.getActiveObject();
    if (!obj) return;
    canvas.bringForward(obj);
    canvas.renderAll();
  }, []);

  const sendBackward = useCallback(() => {
    const canvas = fabricRef.current;
    const obj = canvas?.getActiveObject();
    if (!obj) return;
    canvas.sendBackwards(obj);
    canvas.renderAll();
  }, []);

  // ── AI Text Generator ─────────────────────────────────────────────────────
  const generateAIText = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const brandName = activeBrand?.name || 'My Brand';
    const brandType = activeBrand?.type || 'business';
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'chat',
          topic: 'social media graphic text',
          brandName,
          brandType,
          brandDesc: activeBrand?.description || '',
          chatHistory: [
            {
              role: 'user',
              text: `Write a short, punchy headline (max 8 words) and a one-line subtext (max 15 words) for a social media graphic for ${brandName}. Format your response as:\nHEADLINE: [headline here]\nSUBTEXT: [subtext here]`,
            },
          ],
        }),
      });
      const data = await res.json();
      const text = data.result || data.text || data.message || '';
      const headlineMatch = text.match(/HEADLINE:\s*(.+)/i);
      const subtextMatch = text.match(/SUBTEXT:\s*(.+)/i);
      const headline = headlineMatch?.[1]?.trim() || 'Your Headline Here';
      const subtext = subtextMatch?.[1]?.trim() || 'Your subtext goes here';
      const dh = getDisplayHeight(activeFormat);

      const h = new fabric.IText(headline, {
        left: DISPLAY_WIDTH / 2, top: dh * 0.42,
        originX: 'center', originY: 'center',
        fontFamily: 'Montserrat', fontSize: 38,
        fontWeight: 'bold', fill: '#1e1b4b', textAlign: 'center',
      });
      const s = new fabric.IText(subtext, {
        left: DISPLAY_WIDTH / 2, top: dh * 0.54,
        originX: 'center', originY: 'center',
        fontFamily: 'Inter', fontSize: 22,
        fill: '#475569', textAlign: 'center',
      });
      canvas.add(h);
      canvas.add(s);
      canvas.setActiveObject(h);
      canvas.renderAll();
    } catch (err) {
      console.error('AI text gen failed:', err);
    } finally {
      setAiLoading(false);
    }
  }, [activeBrand, activeFormat]);

  // ── Change format ─────────────────────────────────────────────────────────
  const changeFormat = useCallback((fmt) => {
    setActiveFormat(fmt);
    setShowFormatMenu(false);
    // Canvas resize is handled by the useEffect watching displayHeight
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  const isText = selectedObj?.type === 'i-text' || selectedObj?.type === 'textbox';
  const isImage = selectedObj?.type === 'image';
  const isShape = selectedObj && !isText && !isImage;

  return (
    <div className="flex flex-col h-full min-h-0 bg-stone-100 dark:bg-stone-900">

      {/* Mobile guard */}
      <div className="flex md:hidden flex-col items-center justify-center flex-1 p-8 text-center">
        <Monitor size={48} className="text-violet-400 mb-4" />
        <h3 className="text-xl font-bold text-stone-700 dark:text-stone-200 mb-2">Creative Studio works best on desktop</h3>
        <p className="text-stone-500 dark:text-stone-400 text-sm">Please open KreativeLync on a desktop or laptop for the full creative experience.</p>
      </div>

      {/* Desktop layout */}
      <div className="hidden md:flex flex-col h-full min-h-0">

        {/* ── Top Toolbar ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-stone-800 border-b border-stone-200 dark:border-stone-700 shrink-0">

          {/* Format selector */}
          <div className="relative">
            <button
              onClick={() => setShowFormatMenu(p => !p)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-sm font-medium border border-violet-200 dark:border-violet-700 hover:bg-violet-100 transition-colors"
            >
              {activeFormat.label}
              <span className="text-[11px] text-violet-400">{activeFormat.w}×{activeFormat.h}</span>
              <ChevronDown size={13} />
            </button>
            {showFormatMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl shadow-xl z-50 py-1 min-w-[200px]">
                {FORMATS.map(f => (
                  <button key={f.id} onClick={() => changeFormat(f)}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-violet-50 dark:hover:bg-stone-700 flex justify-between items-center ${activeFormat.id === f.id ? 'text-violet-600 font-semibold' : 'text-stone-700 dark:text-stone-300'}`}>
                    <span>{f.label}</span>
                    <span className="text-xs text-stone-400">{f.w}×{f.h}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="h-5 w-px bg-stone-200 dark:bg-stone-700" />

          {/* Undo / Redo */}
          <button onClick={() => undoAction()} title="Undo (Ctrl+Z)" className="p-1.5 rounded-lg text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors">
            <Undo2 size={17} />
          </button>
          <button onClick={() => redoAction()} title="Redo (Ctrl+Shift+Z)" className="p-1.5 rounded-lg text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors">
            <Redo2 size={17} />
          </button>

          <div className="h-5 w-px bg-stone-200 dark:bg-stone-700" />

          {/* Templates */}
          <div className="relative">
            <button onClick={() => setShowTemplates(p => !p)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors">
              Templates
            </button>
            {showTemplates && (
              <div className="absolute top-full left-0 mt-1 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl shadow-xl z-50 py-1 min-w-[180px]">
                {TEMPLATES.map(t => (
                  <button key={t.id} onClick={() => applyTemplate(t)}
                    className="w-full text-left px-4 py-2.5 text-sm text-stone-700 dark:text-stone-300 hover:bg-violet-50 dark:hover:bg-stone-700">
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Clear */}
          <button onClick={clearCanvas} className="px-3 py-1.5 rounded-lg text-sm text-stone-500 dark:text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors">
            Clear
          </button>

          <div className="flex-1" />

          {/* Download */}
          <button onClick={downloadPNG}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors shadow-sm">
            <Download size={15} />
            Download PNG
          </button>
        </div>

        {/* ── Body ──────────────────────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0">

          {/* ── Left Panel — Tools ───────────────────────────────────────── */}
          <div className="w-[72px] flex flex-col items-center gap-1 py-4 bg-white dark:bg-stone-800 border-r border-stone-200 dark:border-stone-700 shrink-0">
            <ToolBtn icon={<Pointer size={18} />} label="Select" active={activeTool === 'select'}
              onClick={() => { setActiveTool('select'); setShowShapeMenu(false); }} />
            <ToolBtn icon={<Type size={18} />} label="Text" active={activeTool === 'text'}
              onClick={() => { setActiveTool('text'); addText(); setShowShapeMenu(false); }} />
            <ToolBtn icon={<ImageIcon size={18} />} label="Image" active={activeTool === 'image'}
              onClick={() => { setActiveTool('image'); fileInputRef.current?.click(); setShowShapeMenu(false); }} />

            {/* Shapes with sub-menu */}
            <div className="relative w-full flex justify-center">
              <ToolBtn icon={<Shapes size={18} />} label="Shapes" active={activeTool === 'shapes'}
                onClick={() => { setActiveTool('shapes'); setShowShapeMenu(p => !p); }} />
              {showShapeMenu && (
                <div className="absolute left-full ml-2 top-0 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl shadow-xl z-50 py-2 min-w-[130px]">
                  <ShapeMenuItem icon={<Square size={15} />} label="Rectangle" onClick={() => addShape('rect')} />
                  <ShapeMenuItem icon={<Circle size={15} />} label="Circle" onClick={() => addShape('circle')} />
                  <ShapeMenuItem icon={<Triangle size={15} />} label="Triangle" onClick={() => addShape('triangle')} />
                  <ShapeMenuItem icon={<LineIcon size={15} />} label="Line" onClick={() => addShape('line')} />
                </div>
              )}
            </div>

            {/* Background */}
            <div className="relative w-full flex flex-col items-center gap-0.5">
              <ToolBtn icon={<Palette size={18} />} label="BG" active={activeTool === 'bg'}
                onClick={() => { setActiveTool('bg'); setShowShapeMenu(false); }} />
              {activeTool === 'bg' && (
                <div className="flex flex-col items-center gap-1 py-1">
                  <input type="color" value={bgColor} onChange={e => applyBgColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0" title="Background color" />
                  <button onClick={() => bgFileInputRef.current?.click()}
                    className="text-[9px] text-violet-500 font-bold hover:text-violet-700 leading-tight text-center">
                    BG<br />IMG
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1" />

            {/* AI text gen */}
            <div className="flex flex-col items-center gap-0.5 w-full px-1">
              <button onClick={generateAIText} disabled={aiLoading}
                className="flex flex-col items-center gap-0.5 w-full py-2 rounded-xl text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors disabled:opacity-50">
                {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                <span className="text-[9px] font-bold leading-tight text-center">AI<br/>Text</span>
              </button>
            </div>
          </div>

          {/* ── Canvas Area ──────────────────────────────────────────────── */}
          <div className="flex-1 flex items-center justify-center bg-stone-200 dark:bg-stone-950 min-h-0 overflow-auto p-6">
            <div className="relative shadow-2xl rounded-sm" style={{ width: DISPLAY_WIDTH, height: displayHeight }}>
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center bg-white z-10 rounded-sm">
                  <Loader2 size={32} className="animate-spin text-violet-500" />
                </div>
              )}
              <canvas ref={canvasRef} className="block rounded-sm" />
            </div>
          </div>

          {/* ── Right Panel — Properties ─────────────────────────────────── */}
          <div className="w-[220px] bg-white dark:bg-stone-800 border-l border-stone-200 dark:border-stone-700 flex flex-col shrink-0 overflow-y-auto">
            {!selectedObj ? (
              <div className="flex flex-col items-center justify-center flex-1 p-4 text-center">
                <Pointer size={24} className="text-stone-300 dark:text-stone-600 mb-2" />
                <p className="text-xs text-stone-400 dark:text-stone-500 leading-relaxed">
                  Click an element on the canvas to edit its properties
                </p>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                    {isText ? 'Text' : isImage ? 'Image' : 'Shape'}
                  </p>
                  <button onClick={deleteSelected} className="p-1 rounded-lg text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* ── Text props ── */}
                {isText && (
                  <>
                    <PropRow label="Font">
                      <select value={props.fontFamily} onChange={e => applyProp('fontFamily', e.target.value)}
                        className="w-full text-xs bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-lg px-2 py-1.5">
                        {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </PropRow>
                    <PropRow label="Size">
                      <div className="flex items-center gap-1">
                        <button onClick={() => applyProp('fontSize', Math.max(8, props.fontSize - 2))} className="p-1 rounded bg-stone-100 dark:bg-stone-700 hover:bg-stone-200 dark:hover:bg-stone-600">
                          <Minus size={11} />
                        </button>
                        <input type="number" value={props.fontSize} min={8} max={200}
                          onChange={e => applyProp('fontSize', parseInt(e.target.value) || 16)}
                          className="w-12 text-center text-xs bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-lg py-1" />
                        <button onClick={() => applyProp('fontSize', props.fontSize + 2)} className="p-1 rounded bg-stone-100 dark:bg-stone-700 hover:bg-stone-200 dark:hover:bg-stone-600">
                          <Plus size={11} />
                        </button>
                      </div>
                    </PropRow>
                    <PropRow label="Style">
                      <div className="flex gap-1">
                        <StyleBtn active={props.fontWeight === 'bold'} onClick={() => applyProp('fontWeight', props.fontWeight === 'bold' ? 'normal' : 'bold')}>
                          <Bold size={13} />
                        </StyleBtn>
                        <StyleBtn active={props.fontStyle === 'italic'} onClick={() => applyProp('fontStyle', props.fontStyle === 'italic' ? 'normal' : 'italic')}>
                          <Italic size={13} />
                        </StyleBtn>
                      </div>
                    </PropRow>
                    <PropRow label="Align">
                      <div className="flex gap-1">
                        <StyleBtn active={props.textAlign === 'left'} onClick={() => applyProp('textAlign', 'left')}><AlignLeft size={13} /></StyleBtn>
                        <StyleBtn active={props.textAlign === 'center'} onClick={() => applyProp('textAlign', 'center')}><AlignCenter size={13} /></StyleBtn>
                        <StyleBtn active={props.textAlign === 'right'} onClick={() => applyProp('textAlign', 'right')}><AlignRight size={13} /></StyleBtn>
                      </div>
                    </PropRow>
                    <PropRow label="Color">
                      <input type="color" value={props.fill?.startsWith('#') ? props.fill : '#000000'}
                        onChange={e => applyProp('fill', e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border border-stone-200 dark:border-stone-600 p-0.5" />
                    </PropRow>
                  </>
                )}

                {/* ── Shape props ── */}
                {isShape && (
                  <>
                    <PropRow label="Fill">
                      <input type="color" value={typeof props.fill === 'string' && props.fill.startsWith('#') ? props.fill : '#7c3aed'}
                        onChange={e => applyProp('fill', e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border border-stone-200 dark:border-stone-600 p-0.5" />
                    </PropRow>
                    <PropRow label="Stroke">
                      <div className="flex items-center gap-2">
                        <input type="color" value={props.stroke?.startsWith('#') ? props.stroke : '#000000'}
                          onChange={e => applyProp('stroke', e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer border border-stone-200 dark:border-stone-600 p-0.5" />
                        <input type="number" value={props.strokeWidth} min={0} max={20}
                          onChange={e => applyProp('strokeWidth', parseInt(e.target.value) || 0)}
                          className="w-12 text-center text-xs bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-lg py-1" />
                      </div>
                    </PropRow>
                  </>
                )}

                {/* ── Common: Opacity + Layer order ── */}
                <PropRow label="Opacity">
                  <div className="flex items-center gap-2 w-full">
                    <input type="range" min={0} max={1} step={0.01} value={props.opacity}
                      onChange={e => applyProp('opacity', parseFloat(e.target.value))}
                      className="flex-1 accent-violet-500" />
                    <span className="text-xs text-stone-500 w-6 text-right">{Math.round(props.opacity * 100)}</span>
                  </div>
                </PropRow>

                <PropRow label="Layer">
                  <div className="flex gap-1">
                    <button onClick={bringForward} className="flex-1 text-xs py-1.5 rounded-lg bg-stone-100 dark:bg-stone-700 hover:bg-violet-100 dark:hover:bg-violet-900/30 text-stone-600 dark:text-stone-300 font-medium transition-colors">
                      Forward
                    </button>
                    <button onClick={sendBackward} className="flex-1 text-xs py-1.5 rounded-lg bg-stone-100 dark:bg-stone-700 hover:bg-violet-100 dark:hover:bg-violet-900/30 text-stone-600 dark:text-stone-300 font-medium transition-colors">
                      Back
                    </button>
                  </div>
                </PropRow>

                <button onClick={deleteSelected}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-500 text-xs font-semibold hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors">
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden inputs */}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
      <input ref={bgFileInputRef} type="file" accept="image/*" onChange={handleBgImageUpload} className="hidden" />

      {/* Click outside to close dropdowns */}
      {(showFormatMenu || showTemplates || showShapeMenu) && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowFormatMenu(false); setShowTemplates(false); setShowShapeMenu(false); }} />
      )}
    </div>
  );
}

// ── Small sub-components ──────────────────────────────────────────────────────

function ToolBtn({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`flex flex-col items-center gap-0.5 w-full py-2.5 px-1 rounded-xl transition-colors ${
        active
          ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400'
          : 'text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 hover:text-stone-700 dark:hover:text-stone-200'
      }`}>
      {icon}
      <span className="text-[9px] font-semibold leading-none">{label}</span>
    </button>
  );
}

function ShapeMenuItem({ icon, label, onClick }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-stone-700 dark:text-stone-300 hover:bg-violet-50 dark:hover:bg-stone-700 transition-colors">
      {icon} {label}
    </button>
  );
}

function PropRow({ label, children }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function StyleBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`p-1.5 rounded-lg transition-colors ${
        active
          ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400'
          : 'bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-600'
      }`}>
      {children}
    </button>
  );
}
