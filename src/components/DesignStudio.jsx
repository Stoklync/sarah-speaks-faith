import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Rect, Text, Image as KonvaImage, Transformer } from 'react-konva';
import { Sparkles, Download, Plus, Trash2, Type, Image as ImageIcon, Loader2, ChevronDown, AlignLeft, AlignCenter, AlignRight, Bold, Italic } from 'lucide-react';
import { useStudio } from '../App';

const FORMATS = [
  { id: 'square',    label: '⬜ Square',     w: 1080, h: 1080, desc: 'Feed post' },
  { id: 'story',     label: '📱 Story',      w: 1080, h: 1920, desc: 'Reels / Story' },
  { id: 'landscape', label: '🖥️ Landscape',  w: 1920, h: 1080, desc: 'YouTube thumb' },
  { id: 'portrait',  label: '📄 Portrait',   w: 1080, h: 1350, desc: 'Portrait feed' },
];

const GRADIENTS = [
  { id: 'violet',  label: 'Violet',    colors: ['#7c3aed', '#4f46e5'] },
  { id: 'rose',    label: 'Rose',      colors: ['#e11d48', '#f97316'] },
  { id: 'emerald', label: 'Emerald',   colors: ['#059669', '#0891b2'] },
  { id: 'gold',    label: 'Gold',      colors: ['#d97706', '#dc2626'] },
  { id: 'night',   label: 'Night',     colors: ['#0f172a', '#1e1b4b'] },
  { id: 'blush',   label: 'Blush',     colors: ['#fce7f3', '#ede9fe'] },
  { id: 'slate',   label: 'Slate',     colors: ['#334155', '#0f172a'] },
  { id: 'custom',  label: 'White',     colors: ['#ffffff', '#f8fafc'] },
];

const FONT_SIZES = [24, 32, 40, 48, 56, 64, 72, 80, 96, 120];
const FONTS = ['Arial', 'Georgia', 'Verdana', 'Trebuchet MS', 'Times New Roman', 'Courier New'];

const SCALE = 0.35; // canvas preview scale

function useImage(url) {
  const [image, setImage] = useState(null);
  useEffect(() => {
    if (!url) return;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setImage(img);
    img.src = url;
  }, [url]);
  return image;
}

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
        fontFamily={el.fontFamily}
        fontStyle={`${el.bold ? 'bold' : ''} ${el.italic ? 'italic' : ''}`.trim() || 'normal'}
        fill={el.color}
        align={el.align}
        width={el.width}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={e => onChange({ x: e.target.x(), y: e.target.y() })}
        onTransformEnd={() => {
          const node = ref.current;
          onChange({ x: node.x(), y: node.y(), width: node.width() * node.scaleX(), fontSize: el.fontSize * node.scaleY() });
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
          onChange({ x: node.x(), y: node.y(), width: node.width() * node.scaleX(), height: node.height() * node.scaleY() });
          node.scaleX(1); node.scaleY(1);
        }}
      />
      {isSelected && (
        <Transformer ref={trRef} boundBoxFunc={(old, newBox) => newBox.width < 20 ? old : newBox} />
      )}
    </>
  );
}

export function DesignStudio() {
  const { businesses, activeBusinessId } = useStudio();
  const activeBiz = (businesses || []).find(b => b?.id === activeBusinessId);
  const bizName = activeBiz?.name || 'Your Brand';
  const bizType = activeBiz?.type || 'faith';

  const [format, setFormat] = useState(FORMATS[0]);
  const [gradient, setGradient] = useState(GRADIENTS[0]);
  const [bgImage, setBgImage] = useState(null);
  const [elements, setElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const stageRef = useRef();
  const fileRef = useRef();

  const W = format.w * SCALE;
  const H = format.h * SCALE;

  const addText = () => {
    const id = 'text-' + Date.now();
    setElements(prev => [...prev, {
      id, type: 'text',
      text: 'Double-click to edit',
      x: format.w * SCALE * 0.1,
      y: format.h * SCALE * 0.4,
      fontSize: 32,
      fontFamily: 'Arial',
      color: '#ffffff',
      align: 'center',
      width: format.w * SCALE * 0.8,
      bold: false,
      italic: false,
    }]);
    setSelectedId(id);
  };

  const updateElement = (id, changes) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...changes } : el));
  };

  const deleteSelected = () => {
    setElements(prev => prev.filter(el => el.id !== selectedId));
    setSelectedId(null);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const id = 'img-' + Date.now();
    setElements(prev => [...prev, {
      id, type: 'image', src: url,
      x: 50, y: 50,
      width: format.w * SCALE * 0.5,
      height: format.w * SCALE * 0.5,
    }]);
    setSelectedId(id);
  };

  const aiFill = async () => {
    setAiLoading(true);
    try {
      // Generate AI text for the brand
      const r = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'chat',
          brandName: bizName,
          brandType: bizType,
          chatHistory: [{
            role: 'user',
            text: `Write 2 short lines of text for a social media graphic for ${bizName} (${bizType} brand). Line 1: a powerful headline (max 5 words). Line 2: a short subtext (max 8 words). Reply as JSON: {"headline": "...", "subtext": "..."}`
          }]
        })
      });
      const data = await r.json();
      let headline = bizName, subtext = 'Creating with purpose';
      try {
        const parsed = JSON.parse((data.reply || '').replace(/```json|```/g, '').trim());
        headline = parsed.headline || headline;
        subtext = parsed.subtext || subtext;
      } catch {}

      const cx = format.w * SCALE / 2;
      const cy = format.h * SCALE / 2;

      setElements([
        {
          id: 'headline-' + Date.now(), type: 'text',
          text: headline,
          x: cx * 0.1, y: cy * 0.6,
          fontSize: 48, fontFamily: 'Georgia',
          color: '#ffffff', align: 'center',
          width: format.w * SCALE * 0.8,
          bold: true, italic: false,
        },
        {
          id: 'subtext-' + Date.now(), type: 'text',
          text: subtext,
          x: cx * 0.1, y: cy * 0.9,
          fontSize: 24, fontFamily: 'Arial',
          color: 'rgba(255,255,255,0.85)', align: 'center',
          width: format.w * SCALE * 0.8,
          bold: false, italic: false,
        },
      ]);
      setSelectedId(null);
    } catch {}
    setAiLoading(false);
  };

  const exportImage = async () => {
    setExporting(true);
    setSelectedId(null);
    await new Promise(r => setTimeout(r, 100));
    try {
      const stage = stageRef.current;
      // Export at full resolution
      const dataUrl = stage.toDataURL({ pixelRatio: 1 / SCALE });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `kreativelync-design-${Date.now()}.png`;
      a.click();
    } catch {}
    setExporting(false);
  };

  const selected = elements.find(el => el.id === selectedId);

  // Gradient canvas background
  const GradientBg = useCallback(() => {
    const colors = gradient.colors;
    return (
      <Rect
        x={0} y={0} width={W} height={H}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: W, y: H }}
        fillLinearGradientColorStops={[0, colors[0], 1, colors[1]]}
      />
    );
  }, [gradient, W, H]);

  const BgImg = useCallback(() => {
    const image = useImage(bgImage);
    if (!image) return null;
    return <KonvaImage image={image} x={0} y={0} width={W} height={H} />;
  }, [bgImage, W, H]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-stone-800 dark:to-stone-800 border-2 border-violet-200 dark:border-violet-800 rounded-3xl p-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-1">🎨 Design Studio</h2>
          <p className="text-stone-500 dark:text-stone-400 text-sm">Create flyers, graphics, thumbnails & posts — drag, drop, and export at full resolution.</p>
        </div>
        <button onClick={aiFill} disabled={aiLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500 text-white text-sm font-bold hover:bg-violet-600 disabled:opacity-50">
          {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {aiLoading ? 'Generating…' : 'AI Fill'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* LEFT PANEL */}
        <div className="space-y-4">

          {/* Format */}
          <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-4">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Canvas Size</p>
            <div className="grid grid-cols-2 gap-1.5">
              {FORMATS.map(f => (
                <button key={f.id} onClick={() => { setFormat(f); setElements([]); setSelectedId(null); }}
                  className={`px-2 py-2 rounded-xl text-xs font-semibold text-left transition-all ${format.id === f.id ? 'bg-violet-500 text-white' : 'bg-stone-50 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-violet-50'}`}>
                  <span className="block">{f.label}</span>
                  <span className={`text-[10px] ${format.id === f.id ? 'text-violet-100' : 'text-stone-400'}`}>{f.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Background */}
          <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-4">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Background</p>
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {GRADIENTS.map(g => (
                <button key={g.id} onClick={() => { setGradient(g); setBgImage(null); }}
                  title={g.label}
                  className={`h-8 rounded-lg transition-all ${gradient.id === g.id && !bgImage ? 'ring-2 ring-violet-500 ring-offset-1' : ''}`}
                  style={{ background: `linear-gradient(135deg, ${g.colors[0]}, ${g.colors[1]})` }}
                />
              ))}
            </div>
            <button onClick={() => fileRef.current?.click()}
              className="w-full py-2 rounded-xl border-2 border-dashed border-stone-200 dark:border-stone-600 text-xs text-stone-500 hover:border-violet-400 hover:text-violet-500 transition-colors">
              + Upload background image
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setBgImage(URL.createObjectURL(f)); }} />
          </div>

          {/* Add elements */}
          <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-4">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Add Elements</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={addText}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-700 text-stone-600 dark:text-stone-300 text-xs font-semibold hover:bg-violet-50 hover:text-violet-600 transition-colors">
                <Type size={14} /> Add Text
              </button>
              <button onClick={() => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = handleImageUpload; inp.click(); }}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-700 text-stone-600 dark:text-stone-300 text-xs font-semibold hover:bg-violet-50 hover:text-violet-600 transition-colors">
                <ImageIcon size={14} /> Add Image
              </button>
            </div>
          </div>

          {/* Text properties */}
          {selected?.type === 'text' && (
            <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Text Style</p>

              <textarea
                value={selected.text}
                onChange={e => updateElement(selectedId, { text: e.target.value })}
                rows={3}
                className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-3 py-2 text-sm resize-none"
              />

              <div className="flex gap-2">
                <select value={selected.fontSize} onChange={e => updateElement(selectedId, { fontSize: Number(e.target.value) })}
                  className="flex-1 bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-lg px-2 py-1.5 text-xs">
                  {FONT_SIZES.map(s => <option key={s} value={s}>{s}px</option>)}
                </select>
                <input type="color" value={selected.color.startsWith('rgba') ? '#ffffff' : selected.color}
                  onChange={e => updateElement(selectedId, { color: e.target.value })}
                  className="w-10 h-8 rounded-lg border border-stone-200 cursor-pointer" />
              </div>

              <select value={selected.fontFamily} onChange={e => updateElement(selectedId, { fontFamily: e.target.value })}
                className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-lg px-2 py-1.5 text-xs">
                {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>

              <div className="flex gap-1.5">
                <button onClick={() => updateElement(selectedId, { bold: !selected.bold })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${selected.bold ? 'bg-violet-500 text-white' : 'bg-stone-50 dark:bg-stone-700 text-stone-600'}`}>
                  <Bold size={12} className="mx-auto" />
                </button>
                <button onClick={() => updateElement(selectedId, { italic: !selected.italic })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${selected.italic ? 'bg-violet-500 text-white' : 'bg-stone-50 dark:bg-stone-700 text-stone-600'}`}>
                  <Italic size={12} className="mx-auto" />
                </button>
                {['left','center','right'].map(a => (
                  <button key={a} onClick={() => updateElement(selectedId, { align: a })}
                    className={`flex-1 py-1.5 rounded-lg text-xs transition-colors ${selected.align === a ? 'bg-violet-500 text-white' : 'bg-stone-50 dark:bg-stone-700 text-stone-600'}`}>
                    {a === 'left' ? <AlignLeft size={12} className="mx-auto" /> : a === 'center' ? <AlignCenter size={12} className="mx-auto" /> : <AlignRight size={12} className="mx-auto" />}
                  </button>
                ))}
              </div>

              <button onClick={deleteSelected}
                className="w-full py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 text-xs font-semibold hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5">
                <Trash2 size={12} /> Delete
              </button>
            </div>
          )}

          {selected?.type === 'image' && (
            <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-4">
              <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Image</p>
              <button onClick={deleteSelected}
                className="w-full py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 text-xs font-semibold hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5">
                <Trash2 size={12} /> Delete
              </button>
            </div>
          )}

          {/* Export */}
          <button onClick={exportImage} disabled={exporting}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 shadow-lg shadow-violet-200 dark:shadow-none">
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {exporting ? 'Exporting…' : 'Export PNG'}
          </button>
        </div>

        {/* CANVAS */}
        <div className="lg:col-span-3 flex flex-col items-center">
          <div className="bg-stone-100 dark:bg-stone-900 rounded-2xl p-6 w-full flex items-center justify-center">
            <div className="shadow-2xl rounded-lg overflow-hidden" style={{ width: W, height: H }}>
              <Stage
                ref={stageRef}
                width={W}
                height={H}
                onClick={e => { if (e.target === e.target.getStage() || e.target.name() === 'bg') setSelectedId(null); }}
              >
                <Layer>
                  {!bgImage && <GradientBg />}
                  {bgImage && <BgImg />}
                  {elements.map(el =>
                    el.type === 'text' ? (
                      <TextNode key={el.id} el={el}
                        isSelected={selectedId === el.id}
                        onSelect={() => setSelectedId(el.id)}
                        onChange={changes => updateElement(el.id, changes)}
                      />
                    ) : (
                      <ImageNode key={el.id} el={el}
                        isSelected={selectedId === el.id}
                        onSelect={() => setSelectedId(el.id)}
                        onChange={changes => updateElement(el.id, changes)}
                      />
                    )
                  )}
                </Layer>
              </Stage>
            </div>
          </div>
          <p className="text-xs text-stone-400 mt-3">Click to select · Drag to move · Handles to resize · Exports at {format.w}×{format.h}px</p>
        </div>
      </div>
    </div>
  );
}
