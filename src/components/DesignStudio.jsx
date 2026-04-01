import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Rect, Text, Image as KonvaImage, Transformer } from 'react-konva';
import {
  Sparkles, Download, Trash2, Type, Image as ImageIcon, Loader2,
  AlignLeft, AlignCenter, AlignRight, Bold, Italic, ChevronDown, ChevronRight, Square,
} from 'lucide-react';
import { useStudio } from '../App';

// ─── Platform Formats ────────────────────────────────────────────────────────
const FORMATS = [
  // Social
  { id: 'ig-post',       label: 'Instagram Post',      w: 1080, h: 1080,  cat: 'Social',    emoji: '📸' },
  { id: 'ig-story',      label: 'Instagram Story',     w: 1080, h: 1920,  cat: 'Social',    emoji: '📱' },
  { id: 'ig-landscape',  label: 'Instagram Landscape', w: 1080, h: 566,   cat: 'Social',    emoji: '🖼️' },
  { id: 'fb-post',       label: 'Facebook Post',       w: 1200, h: 630,   cat: 'Social',    emoji: '👥' },
  { id: 'fb-cover',      label: 'Facebook Cover',      w: 820,  h: 312,   cat: 'Social',    emoji: '🎯' },
  { id: 'tw-post',       label: 'Twitter/X Post',      w: 1200, h: 675,   cat: 'Social',    emoji: '🐦' },
  { id: 'tw-header',     label: 'Twitter/X Header',    w: 1500, h: 500,   cat: 'Social',    emoji: '🔝' },
  { id: 'li-post',       label: 'LinkedIn Post',       w: 1200, h: 627,   cat: 'Social',    emoji: '💼' },
  { id: 'li-cover',      label: 'LinkedIn Cover',      w: 1584, h: 396,   cat: 'Social',    emoji: '📋' },
  { id: 'tiktok',        label: 'TikTok Cover',        w: 1080, h: 1920,  cat: 'Social',    emoji: '🎵' },
  // YouTube
  { id: 'yt-thumb',      label: 'YouTube Thumbnail',   w: 1280, h: 720,   cat: 'YouTube',   emoji: '▶️' },
  { id: 'yt-banner',     label: 'YouTube Banner',      w: 2560, h: 1440,  cat: 'YouTube',   emoji: '🎬' },
  { id: 'yt-short',      label: 'YouTube Short',       w: 1080, h: 1920,  cat: 'YouTube',   emoji: '📲' },
  // Podcast
  { id: 'podcast',       label: 'Podcast Cover',       w: 3000, h: 3000,  cat: 'Podcast',   emoji: '🎙️' },
  { id: 'spotify',       label: 'Spotify Cover',       w: 3000, h: 3000,  cat: 'Podcast',   emoji: '🎧' },
  { id: 'apple-pod',     label: 'Apple Podcasts',      w: 3000, h: 3000,  cat: 'Podcast',   emoji: '🍎' },
  // Marketing
  { id: 'flyer-port',    label: 'Flyer Portrait',      w: 1080, h: 1350,  cat: 'Marketing', emoji: '📄' },
  { id: 'flyer-land',    label: 'Flyer Landscape',     w: 1920, h: 1080,  cat: 'Marketing', emoji: '🗓️' },
  { id: 'banner',        label: 'Website Banner',      w: 1920, h: 600,   cat: 'Marketing', emoji: '🏷️' },
  { id: 'email-header',  label: 'Email Header',        w: 600,  h: 200,   cat: 'Marketing', emoji: '📧' },
  { id: 'business-card', label: 'Business Card',       w: 1050, h: 600,   cat: 'Marketing', emoji: '💳' },
];

const FORMAT_CATS = ['Social', 'YouTube', 'Podcast', 'Marketing'];

// ─── Gradients ───────────────────────────────────────────────────────────────
const GRADIENTS = [
  { id: 'violet',  label: 'Violet',  colors: ['#7c3aed', '#4f46e5'] },
  { id: 'rose',    label: 'Rose',    colors: ['#e11d48', '#f97316'] },
  { id: 'emerald', label: 'Emerald', colors: ['#059669', '#0891b2'] },
  { id: 'gold',    label: 'Gold',    colors: ['#d97706', '#dc2626'] },
  { id: 'night',   label: 'Night',   colors: ['#0f172a', '#1e1b4b'] },
  { id: 'blush',   label: 'Blush',   colors: ['#fce7f3', '#ede9fe'] },
  { id: 'slate',   label: 'Slate',   colors: ['#334155', '#0f172a'] },
  { id: 'white',   label: 'White',   colors: ['#ffffff', '#f8fafc'] },
];

// ─── Fonts ───────────────────────────────────────────────────────────────────
const FONTS = [
  'Arial', 'Arial Black', 'Georgia', 'Verdana', 'Trebuchet MS',
  'Times New Roman', 'Courier New', 'Impact', 'Comic Sans MS',
  'Palatino', 'Garamond', 'Bookman', 'Tahoma', 'Helvetica',
  'Inter', 'Playfair Display', 'Montserrat', 'Oswald', 'Lato', 'Raleway', 'Merriweather',
];

const FONT_SIZES = [12, 16, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96, 120, 144, 160, 200];

// ─── Templates ───────────────────────────────────────────────────────────────
// All coordinates designed for 1080×1080; scaled when applied to other formats
const TEMPLATES = [
  // Quote
  {
    id: 'tpl-quote-1', name: 'Bold Quote', cat: 'Quote', formats: ['ig-post', 'podcast', 'flyer-port'],
    bg: '#0f172a',
    elements: [
      { type: 'rect',  x: 60,  y: 60,  width: 960, height: 960, fill: 'transparent', stroke: '#7c3aed', strokeWidth: 4, id: 'border' },
      { type: 'text',  x: 120, y: 350, text: '"Your powerful quote goes here"', fontSize: 64, color: '#ffffff', bold: true,  italic: false, align: 'center', width: 840, id: 'headline' },
      { type: 'text',  x: 120, y: 750, text: '— Brand Name',                   fontSize: 36, color: '#7c3aed', bold: false, italic: false, align: 'center', width: 840, id: 'sub' },
    ],
  },
  {
    id: 'tpl-quote-2', name: 'Minimal Quote', cat: 'Quote', formats: ['ig-post'],
    bg: '#ffffff',
    elements: [
      { type: 'text', x: 100, y: 400, text: '"Inspiring quote here"', fontSize: 56, color: '#1e1b4b', bold: true,  italic: true,  align: 'center', width: 880, id: 'q' },
      { type: 'text', x: 100, y: 700, text: 'Your Brand',             fontSize: 32, color: '#7c3aed', bold: false, italic: false, align: 'center', width: 880, id: 'brand' },
    ],
  },
  // Announcement
  {
    id: 'tpl-announce-1', name: 'New Announcement', cat: 'Announcement', formats: ['ig-post', 'fb-post'],
    bg: '#7c3aed',
    elements: [
      { type: 'text', x: 80, y: 150, text: 'EXCITING NEWS',              fontSize: 40, color: '#fbbf24', bold: true,  italic: false, align: 'center', width: 920, id: 'label'    },
      { type: 'text', x: 80, y: 380, text: 'Your big announcement here', fontSize: 72, color: '#ffffff', bold: true,  italic: false, align: 'center', width: 920, id: 'headline' },
      { type: 'text', x: 80, y: 800, text: 'Learn more — link in bio',   fontSize: 32, color: '#e9d5ff', bold: false, italic: false, align: 'center', width: 920, id: 'cta'      },
    ],
  },
  // YouTube
  {
    id: 'tpl-yt-1', name: 'YouTube Thumbnail', cat: 'YouTube', formats: ['yt-thumb'],
    bg: '#dc2626',
    elements: [
      { type: 'text', x: 40, y: 40,  text: 'SHOCKING',                       fontSize: 96, color: '#fbbf24', bold: true, italic: false, align: 'left', width: 800,  id: 'label' },
      { type: 'text', x: 40, y: 200, text: 'Title of your video goes here',   fontSize: 64, color: '#ffffff', bold: true, italic: false, align: 'left', width: 1100, id: 'title' },
    ],
  },
  {
    id: 'tpl-yt-2', name: 'Clean Thumbnail', cat: 'YouTube', formats: ['yt-thumb'],
    bg: '#0f172a',
    elements: [
      { type: 'text', x: 40, y: 280, text: 'How to',           fontSize: 48, color: '#7c3aed', bold: false, italic: false, align: 'left', width: 700,  id: 'pre'   },
      { type: 'text', x: 40, y: 360, text: 'Your Video Title', fontSize: 80, color: '#ffffff', bold: true,  italic: false, align: 'left', width: 1100, id: 'title' },
    ],
  },
  // Podcast
  {
    id: 'tpl-podcast-1', name: 'Podcast Cover', cat: 'Podcast', formats: ['podcast', 'spotify', 'apple-pod'],
    bg: '#1e1b4b',
    elements: [
      { type: 'text', x: 200, y: 800,  text: 'YOUR PODCAST',             fontSize: 160, color: '#ffffff', bold: true,  italic: false, align: 'center', width: 2600, id: 'name'    },
      { type: 'text', x: 200, y: 1050, text: 'with Your Name',           fontSize: 100, color: '#a78bfa', bold: false, italic: false, align: 'center', width: 2600, id: 'host'    },
      { type: 'text', x: 200, y: 2300, text: 'FAITH · FINANCE · FREEDOM',fontSize: 80,  color: '#7c3aed', bold: false, italic: false, align: 'center', width: 2600, id: 'tagline' },
    ],
  },
  // Marketing
  {
    id: 'tpl-promo-1', name: 'Event Flyer', cat: 'Marketing', formats: ['flyer-port', 'ig-post'],
    bg: '#fef9c3',
    elements: [
      { type: 'text', x: 80, y: 100, text: "YOU'RE INVITED",         fontSize: 48, color: '#d97706', bold: true,  italic: false, align: 'center', width: 920, id: 'top'     },
      { type: 'text', x: 80, y: 350, text: 'Event Name Here',        fontSize: 80, color: '#1c1917', bold: true,  italic: false, align: 'center', width: 920, id: 'title'   },
      { type: 'text', x: 80, y: 650, text: 'Date · Time · Location', fontSize: 40, color: '#57534e', bold: false, italic: false, align: 'center', width: 920, id: 'details' },
      { type: 'text', x: 80, y: 900, text: 'Register at yourwebsite.com', fontSize: 32, color: '#d97706', bold: false, italic: false, align: 'center', width: 920, id: 'link' },
    ],
  },
  {
    id: 'tpl-b2b-1', name: 'B2B Professional', cat: 'Marketing', formats: ['li-post', 'fb-post', 'tw-post'],
    bg: '#0f172a',
    elements: [
      { type: 'text', x: 80, y: 100, text: 'THE RESULT:',                   fontSize: 40, color: '#64748b', bold: false, italic: false, align: 'left', width: 1040, id: 'label'    },
      { type: 'text', x: 80, y: 200, text: 'Your value proposition here',   fontSize: 72, color: '#ffffff', bold: true,  italic: false, align: 'left', width: 1040, id: 'headline' },
      { type: 'text', x: 80, y: 450, text: 'Your Company · yoursite.com',   fontSize: 32, color: '#7c3aed', bold: false, italic: false, align: 'left', width: 1040, id: 'brand'    },
    ],
  },
];

const TPL_CATS = [...new Set(TEMPLATES.map(t => t.cat))];

// ─── Image hook ──────────────────────────────────────────────────────────────
function useImage(url) {
  const [image, setImage] = useState(null);
  useEffect(() => {
    if (!url) { setImage(null); return; }
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setImage(img);
    img.src = url;
  }, [url]);
  return image;
}

// ─── Canvas Nodes ─────────────────────────────────────────────────────────────
function TextNode({ el, isSelected, onSelect, onChange }) {
  const ref = useRef();
  const trRef = useRef();

  useEffect(() => {
    if (isSelected && trRef.current && ref.current) {
      trRef.current.nodes([ref.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <Text
        ref={ref}
        x={el.x} y={el.y}
        text={el.text}
        fontSize={el.fontSize}
        fontFamily={el.fontFamily || 'Arial'}
        fontStyle={`${el.bold ? 'bold' : ''} ${el.italic ? 'italic' : ''}`.trim() || 'normal'}
        fill={el.color}
        align={el.align || 'left'}
        width={el.width}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={e => onChange({ x: e.target.x(), y: e.target.y() })}
        onTransformEnd={() => {
          const node = ref.current;
          onChange({
            x: node.x(), y: node.y(),
            width: node.width() * node.scaleX(),
            fontSize: Math.round(el.fontSize * node.scaleY()),
          });
          node.scaleX(1); node.scaleY(1);
        }}
      />
      {isSelected && (
        <Transformer ref={trRef} boundBoxFunc={(old, newBox) => newBox.width < 50 ? old : newBox} />
      )}
    </>
  );
}

function ImageNode({ el, isSelected, onSelect, onChange }) {
  const image = useImage(el.src);
  const ref = useRef();
  const trRef = useRef();

  useEffect(() => {
    if (isSelected && trRef.current && ref.current) {
      trRef.current.nodes([ref.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  if (!image) return null;
  return (
    <>
      <KonvaImage
        ref={ref}
        image={image}
        x={el.x} y={el.y}
        width={el.width} height={el.height}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={e => onChange({ x: e.target.x(), y: e.target.y() })}
        onTransformEnd={() => {
          const node = ref.current;
          onChange({
            x: node.x(), y: node.y(),
            width: node.width() * node.scaleX(),
            height: node.height() * node.scaleY(),
          });
          node.scaleX(1); node.scaleY(1);
        }}
      />
      {isSelected && (
        <Transformer ref={trRef} boundBoxFunc={(old, newBox) => newBox.width < 20 ? old : newBox} />
      )}
    </>
  );
}

function ShapeNode({ el, isSelected, onSelect, onChange }) {
  const ref = useRef();
  const trRef = useRef();

  useEffect(() => {
    if (isSelected && trRef.current && ref.current) {
      trRef.current.nodes([ref.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <Rect
        ref={ref}
        x={el.x} y={el.y}
        width={el.width} height={el.height}
        fill={el.fill || '#7c3aed'}
        stroke={el.stroke || undefined}
        strokeWidth={el.strokeWidth || 0}
        cornerRadius={el.cornerRadius || 0}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={e => onChange({ x: e.target.x(), y: e.target.y() })}
        onTransformEnd={() => {
          const node = ref.current;
          onChange({
            x: node.x(), y: node.y(),
            width: node.width() * node.scaleX(),
            height: node.height() * node.scaleY(),
          });
          node.scaleX(1); node.scaleY(1);
        }}
      />
      {isSelected && (
        <Transformer ref={trRef} boundBoxFunc={(old, newBox) => newBox.width < 20 ? old : newBox} />
      )}
    </>
  );
}

// ─── Collapsible Section ─────────────────────────────────────────────────────
function CollapsibleSection({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-stone-400 uppercase tracking-widest hover:bg-stone-50 dark:hover:bg-stone-700/50 transition-colors"
      >
        {title}
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function DesignStudio() {
  const { businesses, activeBusinessId } = useStudio();
  const activeBiz = (businesses || []).find(b => b?.id === activeBusinessId);
  const bizName    = activeBiz?.name      || 'Your Brand';
  const bizType    = activeBiz?.type      || 'faith';
  const brandColor = activeBiz?.brandColor || '#7c3aed';

  // ── Canvas state ──
  const [format,     setFormat]     = useState(FORMATS[0]);
  const [bgType,     setBgType]     = useState('gradient');   // 'gradient' | 'solid' | 'image'
  const [gradient,   setGradient]   = useState(GRADIENTS[0]);
  const [bgColor,    setBgColor]    = useState('#0f172a');
  const [bgImage,    setBgImage]    = useState(null);
  const [elements,   setElements]   = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  // ── UI state ──
  const [formatCat,   setFormatCat]   = useState('Social');
  const [aiLoading,   setAiLoading]   = useState(false);
  const [exporting,   setExporting]   = useState(false);
  const [removingBg,  setRemovingBg]  = useState(false);
  const [bgFileKey,   setBgFileKey]   = useState(0); // reset file input

  const stageRef  = useRef();
  const fileRef   = useRef();   // for background upload
  const imgRef    = useRef();   // for element image upload

  // ── Scale ──
  const SCALE = Math.min(550 / format.h, 800 / format.w, 0.5);
  const W = format.w * SCALE;
  const H = format.h * SCALE;

  // ── Delete key ──
  useEffect(() => {
    const handler = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') &&
          e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'INPUT') {
        if (selectedId) {
          setElements(prev => prev.filter(el => el.id !== selectedId));
          setSelectedId(null);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId]);

  // ── Helpers ──
  const updateElement = (id, changes) =>
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...changes } : el));

  const deleteSelected = () => {
    setElements(prev => prev.filter(el => el.id !== selectedId));
    setSelectedId(null);
  };

  const selected = elements.find(el => el.id === selectedId);

  // ── Add elements ──
  const addText = () => {
    const id = 'text-' + Date.now();
    setElements(prev => [...prev, {
      id, type: 'text',
      text: 'Your text here',
      x: Math.round(format.w * 0.1),
      y: Math.round(format.h * 0.4),
      fontSize: 48,
      fontFamily: 'Arial',
      color: '#ffffff',
      align: 'center',
      width: Math.round(format.w * 0.8),
      bold: false,
      italic: false,
    }]);
    setSelectedId(id);
  };

  const addShape = () => {
    const id = 'shape-' + Date.now();
    setElements(prev => [...prev, {
      id, type: 'shape',
      x: Math.round(format.w * 0.25),
      y: Math.round(format.h * 0.25),
      width: Math.round(format.w * 0.5),
      height: Math.round(format.h * 0.2),
      fill: brandColor,
      stroke: '',
      strokeWidth: 0,
      cornerRadius: 16,
    }]);
    setSelectedId(id);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const id   = 'img-' + Date.now();
    setElements(prev => [...prev, {
      id, type: 'image', src: url,
      x: 0, y: 0,
      width:  Math.round(format.w * 0.5),
      height: Math.round(format.h * 0.5),
    }]);
    setSelectedId(id);
    // reset input
    e.target.value = '';
  };

  // ── Apply template ──
  const applyTemplate = (tpl) => {
    const BASE = 1080;
    const scaleX = format.w / BASE;
    const scaleY = format.h / BASE;
    const scaled = tpl.elements.map(el => {
      const base = {
        ...el,
        id: el.id + '-' + Date.now(),
        x: Math.round(el.x * scaleX),
        y: Math.round(el.y * scaleY),
        width: el.width ? Math.round(el.width * scaleX) : undefined,
      };
      if (el.type === 'text') {
        base.fontSize = Math.round(el.fontSize * Math.min(scaleX, scaleY));
        base.fontFamily = base.fontFamily || 'Arial';
      }
      if (el.type === 'rect' || el.type === 'shape') {
        base.height = el.height ? Math.round(el.height * scaleY) : undefined;
        base.type = 'shape';
      }
      return base;
    });
    setElements(scaled);
    setBgColor(tpl.bg);
    setBgType('solid');
    setBgImage(null);
    setSelectedId(null);
  };

  // ── Remove background ──
  const removeBackground = async () => {
    if (!selected || selected.type !== 'image') return;
    setRemovingBg(true);
    try {
      const r = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaType: 'remove-bg', imageUrl: selected.src }),
      });
      const data = await r.json();
      if (data.url) {
        updateElement(selectedId, { src: data.url });
      }
    } catch {}
    setRemovingBg(false);
  };

  // ── AI Fill ──
  const aiFill = async () => {
    setAiLoading(true);
    try {
      const r = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'chat',
          brandName: bizName,
          brandType: bizType,
          chatHistory: [{
            role: 'user',
            text: `Write 2 short lines of text for a social media graphic for ${bizName} (${bizType} brand). Line 1: a powerful headline (max 5 words). Line 2: a short subtext (max 8 words). Reply as JSON: {"headline":"...","subtext":"..."}`,
          }],
        }),
      });
      const data = await r.json();
      let headline = bizName, subtext = 'Creating with purpose';
      try {
        const raw = (data.reply || '').replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(raw);
        headline = parsed.headline || headline;
        subtext  = parsed.subtext  || subtext;
      } catch {}

      const stamp = Date.now();
      setElements([
        {
          id: 'headline-' + stamp, type: 'text',
          text: headline,
          x: Math.round(format.w * 0.1),
          y: Math.round(format.h * 0.38),
          fontSize: Math.round(format.w * 0.055),
          fontFamily: 'Georgia',
          color: '#ffffff', align: 'center',
          width: Math.round(format.w * 0.8),
          bold: true, italic: false,
        },
        {
          id: 'subtext-' + stamp, type: 'text',
          text: subtext,
          x: Math.round(format.w * 0.1),
          y: Math.round(format.h * 0.6),
          fontSize: Math.round(format.w * 0.025),
          fontFamily: 'Arial',
          color: 'rgba(255,255,255,0.85)', align: 'center',
          width: Math.round(format.w * 0.8),
          bold: false, italic: false,
        },
      ]);
      setSelectedId(null);
    } catch {}
    setAiLoading(false);
  };

  // ── Export ──
  const exportImage = async () => {
    setExporting(true);
    setSelectedId(null);
    await new Promise(r => setTimeout(r, 150));
    try {
      const dataUrl = stageRef.current.toDataURL({ pixelRatio: 1 / SCALE });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `design-${format.id}-${Date.now()}.png`;
      a.click();
    } catch {}
    setExporting(false);
  };

  // ── Gradient background (memoised) ──
  const GradientBg = useCallback(() => {
    const cols = gradient.colors;
    return (
      <Rect
        x={0} y={0} width={W} height={H}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: W, y: H }}
        fillLinearGradientColorStops={[0, cols[0], 1, cols[1]]}
        name="bg"
      />
    );
  }, [gradient, W, H]);

  // ── Solid color background ──
  const SolidBg = useCallback(() => (
    <Rect x={0} y={0} width={W} height={H} fill={bgColor} name="bg" />
  ), [bgColor, W, H]);

  // ── Image background ──
  function BgImg() {
    const img = useImage(bgImage);
    if (!img) return null;
    return <KonvaImage image={img} x={0} y={0} width={W} height={H} name="bg" />;
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-screen-xl mx-auto space-y-4 px-2">

      {/* Header */}
      <div className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-stone-800 dark:to-stone-800 border-2 border-violet-200 dark:border-violet-800 rounded-3xl p-5 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-1">Design Studio</h2>
          <p className="text-stone-500 dark:text-stone-400 text-sm">Create graphics for any platform — drag, resize, and export at full resolution.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={aiFill} disabled={aiLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500 text-white text-sm font-bold hover:bg-violet-600 disabled:opacity-50">
            {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {aiLoading ? 'Generating…' : 'AI Fill'}
          </button>
          <button onClick={exportImage} disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 shadow-lg shadow-violet-200 dark:shadow-none">
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {exporting ? 'Exporting…' : `Export PNG (${format.w}×${format.h})`}
          </button>
        </div>
      </div>

      {/* Three-column layout */}
      <div className="flex gap-4 items-start">

        {/* ── LEFT PANEL (280px) ── */}
        <div className="flex-none w-[280px] space-y-3 max-h-[75vh] overflow-y-auto pr-1">

          {/* Format Picker */}
          <CollapsibleSection title="Canvas Size" defaultOpen>
            {/* Category tabs */}
            <div className="flex gap-1 mb-3 flex-wrap">
              {FORMAT_CATS.map(cat => (
                <button key={cat} onClick={() => setFormatCat(cat)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${formatCat === cat ? 'bg-violet-500 text-white' : 'bg-stone-100 dark:bg-stone-700 text-stone-500 hover:bg-violet-50'}`}>
                  {cat}
                </button>
              ))}
            </div>
            {/* Formats in selected category */}
            <div className="space-y-1">
              {FORMATS.filter(f => f.cat === formatCat).map(f => (
                <button key={f.id}
                  onClick={() => { setFormat(f); setElements([]); setSelectedId(null); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all ${format.id === f.id ? 'bg-violet-500 text-white' : 'bg-stone-50 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-violet-50 dark:hover:bg-stone-600'}`}>
                  <span className="text-base">{f.emoji}</span>
                  <div>
                    <div>{f.label}</div>
                    <div className={`text-[10px] ${format.id === f.id ? 'text-violet-100' : 'text-stone-400'}`}>{f.w}×{f.h}</div>
                  </div>
                </button>
              ))}
            </div>
          </CollapsibleSection>

          {/* Templates */}
          <CollapsibleSection title="Templates" defaultOpen={false}>
            {TPL_CATS.map(cat => (
              <div key={cat} className="mb-3">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">{cat}</p>
                <div className="space-y-1">
                  {TEMPLATES.filter(t => t.cat === cat).map(tpl => (
                    <button key={tpl.id}
                      onClick={() => applyTemplate(tpl)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-left bg-stone-50 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-violet-50 dark:hover:bg-stone-600 transition-all">
                      <div className="w-8 h-8 rounded-lg flex-none shadow-sm"
                        style={{ background: tpl.bg.startsWith('#') ? tpl.bg : '#1e1b4b' }} />
                      <span>{tpl.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </CollapsibleSection>

          {/* Background */}
          <CollapsibleSection title="Background" defaultOpen>
            {/* Type tabs */}
            <div className="flex gap-1 mb-3">
              {[['gradient', 'Gradient'], ['solid', 'Solid'], ['image', 'Image']].map(([val, lbl]) => (
                <button key={val} onClick={() => setBgType(val)}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all ${bgType === val ? 'bg-violet-500 text-white' : 'bg-stone-100 dark:bg-stone-700 text-stone-500 hover:bg-violet-50'}`}>
                  {lbl}
                </button>
              ))}
            </div>

            {bgType === 'gradient' && (
              <div className="grid grid-cols-4 gap-1.5">
                {GRADIENTS.map(g => (
                  <button key={g.id} onClick={() => setGradient(g)}
                    title={g.label}
                    className={`h-9 rounded-lg transition-all ${gradient.id === g.id ? 'ring-2 ring-violet-500 ring-offset-1' : 'hover:scale-105'}`}
                    style={{ background: `linear-gradient(135deg, ${g.colors[0]}, ${g.colors[1]})` }}
                  />
                ))}
              </div>
            )}

            {bgType === 'solid' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input type="color" value={bgColor}
                    onChange={e => setBgColor(e.target.value)}
                    className="w-10 h-9 rounded-lg border border-stone-200 cursor-pointer flex-none" />
                  <input type="text" value={bgColor}
                    onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setBgColor(e.target.value); }}
                    className="flex-1 bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-lg px-2 py-1.5 text-xs font-mono" />
                </div>
                {/* Brand color swatch */}
                <button onClick={() => setBgColor(brandColor)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-600 text-xs hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors">
                  <div className="w-5 h-5 rounded-md flex-none border border-stone-200" style={{ background: brandColor }} />
                  <span className="text-stone-500">Your Brand Color</span>
                </button>
              </div>
            )}

            {bgType === 'image' && (
              <div>
                <button onClick={() => { setBgImage(null); setBgFileKey(k => k + 1); fileRef.current?.click(); }}
                  className="w-full py-2 rounded-xl border-2 border-dashed border-stone-200 dark:border-stone-600 text-xs text-stone-500 hover:border-violet-400 hover:text-violet-500 transition-colors">
                  {bgImage ? '↻ Change background image' : '+ Upload background image'}
                </button>
                <input key={bgFileKey} ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setBgImage(URL.createObjectURL(f)); }} />
                {bgImage && (
                  <button onClick={() => setBgImage(null)}
                    className="w-full mt-1 py-1.5 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 text-xs hover:bg-red-100 transition-colors">
                    Remove background image
                  </button>
                )}
              </div>
            )}
          </CollapsibleSection>
        </div>

        {/* ── CENTER: Canvas ── */}
        <div className="flex-1 flex flex-col items-center min-w-0">
          <div className="bg-stone-100 dark:bg-stone-900 rounded-2xl p-6 w-full flex items-center justify-center">
            <div className="shadow-2xl rounded-lg overflow-hidden flex-none"
              style={{ width: Math.round(W), height: Math.round(H) }}>
              <Stage
                ref={stageRef}
                width={Math.round(W)}
                height={Math.round(H)}
                onClick={e => {
                  const name = e.target.name?.();
                  if (e.target === e.target.getStage() || name === 'bg') setSelectedId(null);
                }}
              >
                <Layer>
                  {bgType === 'gradient' && <GradientBg />}
                  {bgType === 'solid'    && <SolidBg />}
                  {bgType === 'image'    && bgImage && <BgImg />}
                  {bgType === 'image'    && !bgImage && <SolidBg />}
                  {elements.map(el => {
                    const props = {
                      key: el.id,
                      el: { ...el, x: Math.round(el.x * SCALE), y: Math.round(el.y * SCALE) },
                      isSelected: selectedId === el.id,
                      onSelect: () => setSelectedId(el.id),
                      onChange: changes => {
                        // Convert back from canvas coords to real coords
                        const realChanges = { ...changes };
                        if ('x' in changes) realChanges.x = Math.round(changes.x / SCALE);
                        if ('y' in changes) realChanges.y = Math.round(changes.y / SCALE);
                        if ('width' in changes) realChanges.width = Math.round(changes.width / SCALE);
                        if ('height' in changes) realChanges.height = Math.round(changes.height / SCALE);
                        // fontSize scales by scaleY, keep real value
                        updateElement(el.id, realChanges);
                      },
                    };
                    if (el.type === 'text') {
                      return (
                        <TextNode {...props} el={{
                          ...el,
                          x: Math.round(el.x * SCALE),
                          y: Math.round(el.y * SCALE),
                          fontSize: Math.round(el.fontSize * SCALE),
                          width: el.width ? Math.round(el.width * SCALE) : undefined,
                        }} onChange={changes => {
                          const realChanges = { ...changes };
                          if ('x' in changes) realChanges.x = Math.round(changes.x / SCALE);
                          if ('y' in changes) realChanges.y = Math.round(changes.y / SCALE);
                          if ('width' in changes) realChanges.width = Math.round(changes.width / SCALE);
                          if ('fontSize' in changes) realChanges.fontSize = Math.round(changes.fontSize / SCALE);
                          updateElement(el.id, realChanges);
                        }} />
                      );
                    }
                    if (el.type === 'image') {
                      return (
                        <ImageNode {...props} el={{
                          ...el,
                          x: Math.round(el.x * SCALE),
                          y: Math.round(el.y * SCALE),
                          width: Math.round(el.width * SCALE),
                          height: Math.round(el.height * SCALE),
                        }} onChange={changes => {
                          const realChanges = { ...changes };
                          if ('x' in changes) realChanges.x = Math.round(changes.x / SCALE);
                          if ('y' in changes) realChanges.y = Math.round(changes.y / SCALE);
                          if ('width' in changes) realChanges.width = Math.round(changes.width / SCALE);
                          if ('height' in changes) realChanges.height = Math.round(changes.height / SCALE);
                          updateElement(el.id, realChanges);
                        }} />
                      );
                    }
                    if (el.type === 'shape') {
                      return (
                        <ShapeNode {...props} el={{
                          ...el,
                          x: Math.round(el.x * SCALE),
                          y: Math.round(el.y * SCALE),
                          width: Math.round(el.width * SCALE),
                          height: Math.round(el.height * SCALE),
                        }} onChange={changes => {
                          const realChanges = { ...changes };
                          if ('x' in changes) realChanges.x = Math.round(changes.x / SCALE);
                          if ('y' in changes) realChanges.y = Math.round(changes.y / SCALE);
                          if ('width' in changes) realChanges.width = Math.round(changes.width / SCALE);
                          if ('height' in changes) realChanges.height = Math.round(changes.height / SCALE);
                          updateElement(el.id, realChanges);
                        }} />
                      );
                    }
                    return null;
                  })}
                </Layer>
              </Stage>
            </div>
          </div>
          <p className="text-xs text-stone-400 mt-2">
            Click to select · Drag to move · Handles to resize · Exports at {format.w}×{format.h}px · Delete key removes selected
          </p>
        </div>

        {/* ── RIGHT PANEL (260px) ── */}
        <div className="flex-none w-[260px] space-y-3 max-h-[75vh] overflow-y-auto pl-1">

          {/* Add Elements */}
          <CollapsibleSection title="Add Elements" defaultOpen>
            <div className="space-y-2">
              <button onClick={addText}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-700 text-stone-600 dark:text-stone-300 text-xs font-semibold hover:bg-violet-50 hover:text-violet-600 dark:hover:bg-stone-600 transition-colors">
                <Type size={14} /> Add Text
              </button>
              <button onClick={() => imgRef.current?.click()}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-700 text-stone-600 dark:text-stone-300 text-xs font-semibold hover:bg-violet-50 hover:text-violet-600 dark:hover:bg-stone-600 transition-colors">
                <ImageIcon size={14} /> Upload Image
              </button>
              <button onClick={addShape}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-700 text-stone-600 dark:text-stone-300 text-xs font-semibold hover:bg-violet-50 hover:text-violet-600 dark:hover:bg-stone-600 transition-colors">
                <Square size={14} /> Add Shape
              </button>
              <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </div>
          </CollapsibleSection>

          {/* Element Properties */}
          {selected?.type === 'text' && (
            <CollapsibleSection title="Text Properties" defaultOpen>
              {/* Text content */}
              <textarea
                value={selected.text}
                onChange={e => updateElement(selectedId, { text: e.target.value })}
                rows={3}
                className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-3 py-2 text-sm resize-none mb-2"
              />

              {/* Font family */}
              <select value={selected.fontFamily || 'Arial'}
                onChange={e => updateElement(selectedId, { fontFamily: e.target.value })}
                className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-lg px-2 py-1.5 text-xs mb-2">
                {FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
              </select>

              {/* Size + color */}
              <div className="flex gap-2 mb-2">
                <select value={selected.fontSize}
                  onChange={e => updateElement(selectedId, { fontSize: Number(e.target.value) })}
                  className="flex-1 bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-lg px-2 py-1.5 text-xs">
                  {FONT_SIZES.map(s => <option key={s} value={s}>{s}px</option>)}
                </select>
                <input type="color"
                  value={selected.color?.startsWith('rgba') ? '#ffffff' : (selected.color || '#ffffff')}
                  onChange={e => updateElement(selectedId, { color: e.target.value })}
                  className="w-10 h-8 rounded-lg border border-stone-200 cursor-pointer flex-none" />
              </div>

              {/* Brand color shortcut */}
              <button onClick={() => updateElement(selectedId, { color: brandColor })}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-600 text-xs hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors mb-2">
                <div className="w-4 h-4 rounded flex-none border border-stone-200" style={{ background: brandColor }} />
                <span className="text-stone-500">Apply Brand Color</span>
              </button>

              {/* Bold / Italic / Align */}
              <div className="flex gap-1 mb-2">
                <button onClick={() => updateElement(selectedId, { bold: !selected.bold })}
                  title="Bold"
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${selected.bold ? 'bg-violet-500 text-white' : 'bg-stone-50 dark:bg-stone-700 text-stone-600'}`}>
                  <Bold size={12} className="mx-auto" />
                </button>
                <button onClick={() => updateElement(selectedId, { italic: !selected.italic })}
                  title="Italic"
                  className={`flex-1 py-1.5 rounded-lg text-xs transition-colors ${selected.italic ? 'bg-violet-500 text-white' : 'bg-stone-50 dark:bg-stone-700 text-stone-600'}`}>
                  <Italic size={12} className="mx-auto" />
                </button>
                {[['left', <AlignLeft size={12} className="mx-auto" />], ['center', <AlignCenter size={12} className="mx-auto" />], ['right', <AlignRight size={12} className="mx-auto" />]].map(([a, icon]) => (
                  <button key={a} onClick={() => updateElement(selectedId, { align: a })}
                    className={`flex-1 py-1.5 rounded-lg text-xs transition-colors ${selected.align === a ? 'bg-violet-500 text-white' : 'bg-stone-50 dark:bg-stone-700 text-stone-600'}`}>
                    {icon}
                  </button>
                ))}
              </div>

              <button onClick={deleteSelected}
                className="w-full py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 text-xs font-semibold hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5">
                <Trash2 size={12} /> Delete Element
              </button>
            </CollapsibleSection>
          )}

          {selected?.type === 'image' && (
            <CollapsibleSection title="Image Properties" defaultOpen>
              <div className="space-y-2">
                <button onClick={removeBackground} disabled={removingBg}
                  className="w-full py-2 rounded-xl bg-violet-50 dark:bg-violet-900/20 text-violet-600 text-xs font-semibold hover:bg-violet-100 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50">
                  {removingBg ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  {removingBg ? 'Removing BG…' : 'Remove Background'}
                </button>
                <button onClick={deleteSelected}
                  className="w-full py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 text-xs font-semibold hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5">
                  <Trash2 size={12} /> Delete Element
                </button>
              </div>
            </CollapsibleSection>
          )}

          {selected?.type === 'shape' && (
            <CollapsibleSection title="Shape Properties" defaultOpen>
              <div className="space-y-2">
                {/* Fill color */}
                <div className="flex items-center gap-2">
                  <input type="color" value={selected.fill || '#7c3aed'}
                    onChange={e => updateElement(selectedId, { fill: e.target.value })}
                    className="w-10 h-8 rounded-lg border border-stone-200 cursor-pointer flex-none" />
                  <span className="text-xs text-stone-500">Fill Color</span>
                </div>
                {/* Brand color */}
                <button onClick={() => updateElement(selectedId, { fill: brandColor })}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-600 text-xs hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors">
                  <div className="w-4 h-4 rounded flex-none border border-stone-200" style={{ background: brandColor }} />
                  <span className="text-stone-500">Apply Brand Color</span>
                </button>
                {/* Corner radius */}
                <div>
                  <label className="text-[10px] text-stone-400 uppercase tracking-wider">Corner Radius: {selected.cornerRadius || 0}px</label>
                  <input type="range" min={0} max={100}
                    value={selected.cornerRadius || 0}
                    onChange={e => updateElement(selectedId, { cornerRadius: Number(e.target.value) })}
                    className="w-full mt-1" />
                </div>
                <button onClick={deleteSelected}
                  className="w-full py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 text-xs font-semibold hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5">
                  <Trash2 size={12} /> Delete Element
                </button>
              </div>
            </CollapsibleSection>
          )}

          {/* No selection hint */}
          {!selected && (
            <div className="bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-4 text-center">
              <p className="text-xs text-stone-400">Click an element on the canvas to edit its properties.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
