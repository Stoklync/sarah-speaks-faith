import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Download, Loader2, Plus, Trash2, ChevronDown, ChevronRight, BookOpen, FileText, Edit3, Check, X, Wand2, AlignLeft } from 'lucide-react';
import { useStudio } from '../App';

const BOOK_TYPES = [
  { id: 'devotional',  label: '✝️ Devotional',     desc: '7, 21 or 30-day faith journey' },
  { id: 'ebook',       label: '📖 eBook',           desc: 'Guide, how-to, or teaching' },
  { id: 'workbook',    label: '📝 Workbook',        desc: 'Interactive exercises + prompts' },
  { id: 'journal',     label: '📔 Journal',         desc: 'Guided reflection prompts' },
  { id: 'course',      label: '🎓 Course Guide',    desc: 'Lesson-by-lesson curriculum' },
  { id: 'brand',       label: '💼 Brand Playbook',  desc: 'Strategy doc for your business' },
];

// ── Persist book state per brand ──────────────────────────────────────────
const BOOK_KEY = (brandId) => `kreativelync-book-${brandId || 'default'}`;

const loadBook = (brandId) => {
  try {
    const raw = localStorage.getItem(BOOK_KEY(brandId));
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
};

const saveBook = (brandId, data) => {
  try { localStorage.setItem(BOOK_KEY(brandId), JSON.stringify(data)); } catch {}
};

export function BookCreator() {
  const { businesses, activeBusinessId } = useStudio();
  const activeBiz = (businesses || []).find(b => b?.id === activeBusinessId);
  const bizName = activeBiz?.name || 'Your Brand';
  const bizType = activeBiz?.type || 'faith';
  const bizDesc = activeBiz?.description || '';

  // Load saved state for this brand on mount / brand switch
  const saved = loadBook(activeBusinessId);

  const [step, setStep] = useState(saved?.step || 'setup');
  const [bookType, setBookType] = useState(saved?.bookType || 'devotional');
  const [title, setTitle] = useState(saved?.title || '');
  const [subtitle, setSubtitle] = useState(saved?.subtitle || '');
  const [topic, setTopic] = useState(saved?.topic || '');
  const [audience, setAudience] = useState(saved?.audience || '');
  const [chapters, setChapters] = useState(saved?.chapters || []);
  const [activeChapter, setActiveChapter] = useState(saved?.activeChapter || 0);
  const [loading, setLoading] = useState(false);
  const [writingChapter, setWritingChapter] = useState(null);
  const [editingTitle, setEditingTitle] = useState(null);
  const [editTitleVal, setEditTitleVal] = useState('');
  const [exporting, setExporting] = useState(false);
  const [grammarLoading, setGrammarLoading] = useState(false);
  const [paraphraseLoading, setParaphraseLoading] = useState(false);

  const previewRef = useRef();

  // Reload book state when switching brands
  const prevBrandId = useRef(activeBusinessId);
  useEffect(() => {
    if (prevBrandId.current === activeBusinessId) return;
    prevBrandId.current = activeBusinessId;
    const s = loadBook(activeBusinessId);
    setStep(s?.step || 'setup');
    setBookType(s?.bookType || 'devotional');
    setTitle(s?.title || '');
    setSubtitle(s?.subtitle || '');
    setTopic(s?.topic || '');
    setAudience(s?.audience || '');
    setChapters(s?.chapters || []);
    setActiveChapter(s?.activeChapter || 0);
  }, [activeBusinessId]);

  // Auto-save whenever anything important changes
  useEffect(() => {
    saveBook(activeBusinessId, { step, bookType, title, subtitle, topic, audience, chapters, activeChapter });
  }, [activeBusinessId, step, bookType, title, subtitle, topic, audience, chapters, activeChapter]);

  const ai = async (userPrompt) => {
    const r = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'chat',
        brandName: bizName,
        brandType: bizType,
        brandDesc: bizDesc,
        chatHistory: [{ role: 'user', text: userPrompt }],
      }),
    });
    const d = await r.json();
    return d.reply || '';
  };

  const generateOutline = async () => {
    if (!title.trim() || !topic.trim()) return;
    setLoading(true);
    try {
      // Use dedicated 'outline' mode — bypasses plain-text rules, returns pure JSON array
      const r = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'outline',
          bookTitle: title,
          bookSubtitle: subtitle,
          bookTopic: topic,
          bookAudience: audience,
          bookType: bookType,
          brandName: bizName,
          brandType: bizType,
        }),
      });
      const d = await r.json();
      const reply = d.reply || '';

      let parsed = [];
      try {
        const match = reply.match(/\[[\s\S]*\]/);
        if (match) parsed = JSON.parse(match[0]);
      } catch {}

      if (parsed.length === 0) {
        // Fallback structure
        parsed = [
          { title: 'Introduction', subtitle: 'Setting the foundation', keyPoints: ['Why this matters', 'What you will learn', 'How to use this book'] },
          { title: 'Chapter 1', subtitle: topic, keyPoints: ['Key point 1', 'Key point 2', 'Key point 3'] },
          { title: 'Conclusion', subtitle: 'Moving forward', keyPoints: ['Summary', 'Next steps', 'Call to action'] },
        ];
      }

      setChapters(parsed.map((ch, i) => ({ ...ch, id: i, content: '', status: 'empty' })));
      setStep('outline');
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const writeChapter = async (index) => {
    const ch = chapters[index];
    if (!ch) return;
    setWritingChapter(index);
    try {
      const bookTypeLabel = BOOK_TYPES.find(b => b.id === bookType)?.label || bookType;
      const content = await ai(
        `Write the full content for this chapter of "${title}" (${bookTypeLabel}) for ${bizName}.

Chapter: "${ch.title}" — ${ch.subtitle}
Key points to cover: ${ch.keyPoints?.join(', ')}
Audience: ${audience || 'general'}
Tone: ${bizType === 'faith' ? 'warm, biblically grounded, encouraging, real — no prosperity gospel framing' : bizType === 'stewardship' ? 'practical, faith-rooted, honest about money struggles' : 'professional, direct, actionable'}

Write 400-600 words. Structure it naturally with short paragraphs. ${bizType === 'faith' || bizType === 'stewardship' ? 'Include a relevant scripture reference where natural.' : ''} ${bookType === 'workbook' || bookType === 'journal' ? 'End with 2-3 reflection questions or exercises.' : bookType === 'devotional' ? 'End with a short prayer (2-3 sentences).' : 'End with a clear takeaway or action step.'}

Write the content only — no JSON, no headings, no chapter title repeated.`
      );

      setChapters(prev => prev.map((c, i) => i === index ? { ...c, content, status: content?.trim() ? 'written' : 'empty' } : c));
      setActiveChapter(index);
      if (step === 'outline') setStep('write');
    } catch (e) {
      console.error(e);
    }
    setWritingChapter(null);
  };

  const writeAllChapters = async () => {
    for (let i = 0; i < chapters.length; i++) {
      await writeChapter(i);
    }
  };

  const checkGrammar = async () => {
    const ch = chapters[activeChapter];
    if (!ch?.content?.trim()) return;
    setGrammarLoading(true);
    try {
      const fixed = await ai(
        `Fix the grammar, spelling, and punctuation in the text below. Keep the same voice, tone, and meaning — just clean it up. Return ONLY the corrected text with no commentary, no explanation, no quotation marks around the full text.

---
${ch.content}
---`
      );
      if (fixed?.trim()) {
        setChapters(prev => prev.map((c, i) => i === activeChapter ? { ...c, content: fixed.trim() } : c));
      }
    } catch (e) { console.error(e); }
    setGrammarLoading(false);
  };

  const paraphraseChapter = async () => {
    const ch = chapters[activeChapter];
    if (!ch?.content?.trim()) return;
    setParaphraseLoading(true);
    try {
      const improved = await ai(
        `Rewrite and improve the text below. Make it flow better, be more engaging, and feel more polished — while keeping the same core message, tone, and meaning. Return ONLY the improved text with no commentary, no explanation.

---
${ch.content}
---`
      );
      if (improved?.trim()) {
        setChapters(prev => prev.map((c, i) => i === activeChapter ? { ...c, content: improved.trim() } : c));
      }
    } catch (e) { console.error(e); }
    setParaphraseLoading(false);
  };

  const deleteChapter = (index) => {
    setChapters(prev => prev.filter((_, i) => i !== index));
    setActiveChapter(prev => Math.max(0, prev >= index ? prev - 1 : prev));
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentW = pageW - margin * 2;

      // Cover page
      doc.setFillColor(124, 58, 237);
      doc.rect(0, 0, pageW, pageH, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(28);
      doc.setFont('helvetica', 'bold');
      const titleLines = doc.splitTextToSize(title, contentW);
      doc.text(titleLines, pageW / 2, 80, { align: 'center' });
      if (subtitle) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.text(subtitle, pageW / 2, 80 + titleLines.length * 12 + 8, { align: 'center' });
      }
      doc.setFontSize(12);
      doc.text(bizName, pageW / 2, pageH - 30, { align: 'center' });

      // Chapters
      for (const ch of chapters) {
        if (!ch.content) continue;
        doc.addPage();

        // Chapter header
        doc.setFillColor(245, 243, 255);
        doc.rect(0, 0, pageW, 35, 'F');
        doc.setTextColor(109, 40, 217);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(title.toUpperCase(), margin, 12);
        doc.setTextColor(30, 30, 30);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text(ch.title, margin, 26);

        if (ch.subtitle) {
          doc.setFontSize(11);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(100, 100, 100);
          doc.text(ch.subtitle, margin, 33);
        }

        // Content
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 40, 40);
        const lines = doc.splitTextToSize(ch.content, contentW);
        let y = 48;
        for (const line of lines) {
          if (y > pageH - margin) {
            doc.addPage();
            y = margin;
          }
          doc.text(line, margin, y);
          y += 6;
        }
      }

      doc.save(`${title.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`);
    } catch (e) {
      // fallback: print
      window.print();
    }
    setExporting(false);
  };

  // ── SETUP STEP ──
  if (step === 'setup') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-stone-800 dark:to-stone-800 border-2 border-violet-200 dark:border-violet-800 rounded-3xl p-6">
          <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-1">📚 Book Creator</h2>
          <p className="text-stone-500 dark:text-stone-400 text-sm">Create a devotional, ebook, workbook, or brand guide — AI writes every chapter. Export as PDF and sell it.</p>
        </div>

        {/* Book type */}
        <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-5">
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">What are you creating?</p>
          <div className="grid grid-cols-2 gap-2">
            {BOOK_TYPES.map(bt => (
              <button key={bt.id} onClick={() => setBookType(bt.id)}
                className={`px-3 py-3 rounded-xl text-left transition-all ${bookType === bt.id ? 'bg-violet-500 text-white shadow' : 'bg-stone-50 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-violet-50'}`}>
                <span className="block text-sm font-semibold">{bt.label}</span>
                <span className={`text-[11px] ${bookType === bt.id ? 'text-violet-100' : 'text-stone-400'}`}>{bt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Title + details */}
        <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-1.5">Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Walking in Faith Every Day"
              className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-4 py-3 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-1.5">Subtitle (optional)</label>
            <input value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="e.g. A 7-Day Devotional for Christian Women"
              className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-4 py-3 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-1.5">What is it about? *</label>
            <textarea value={topic} onChange={e => setTopic(e.target.value)} rows={3}
              placeholder="e.g. Learning to trust God's timing when life feels uncertain. Covering prayer, waiting seasons, and faith through doubt."
              className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-4 py-3 text-sm resize-none" />
          </div>
          <div>
            <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-1.5">Who is it for?</label>
            <input value={audience} onChange={e => setAudience(e.target.value)} placeholder="e.g. Christian women navigating uncertainty and waiting seasons"
              className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-4 py-3 text-sm" />
          </div>
        </div>

        <button onClick={generateOutline} disabled={loading || !title.trim() || !topic.trim()}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-bold text-lg flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 shadow-lg shadow-violet-200 dark:shadow-none">
          {loading ? <><Loader2 size={20} className="animate-spin" /> Building your outline…</> : <><Sparkles size={20} /> Generate Outline</>}
        </button>
      </div>
    );
  }

  // ── OUTLINE + WRITE STEP ──
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-stone-800 dark:to-stone-800 border-2 border-violet-200 dark:border-violet-800 rounded-3xl p-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs text-violet-500 font-bold uppercase">{BOOK_TYPES.find(b => b.id === bookType)?.label}</span>
            <span className="text-xs text-stone-400">· {bizName}</span>
          </div>
          <h2 className="text-xl font-bold text-stone-800 dark:text-stone-100 truncate">{title}</h2>
          {subtitle && <p className="text-stone-400 text-sm">{subtitle}</p>}
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <button onClick={() => setStep('setup')}
            className="px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-700 text-stone-500 text-xs font-semibold hover:bg-stone-200">
            Edit Setup
          </button>
          <button
            onClick={() => {
              if (!window.confirm('Start a new book? Your current book will be saved — go to Edit Setup to come back to it, or clear it from there.')) return;
              // Save current then reset
              const blank = { step: 'setup', bookType: 'devotional', title: '', subtitle: '', topic: '', audience: '', chapters: [], activeChapter: 0 };
              setStep('setup'); setBookType('devotional'); setTitle(''); setSubtitle(''); setTopic(''); setAudience(''); setChapters([]); setActiveChapter(0);
            }}
            className="px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-700 text-stone-500 text-xs font-semibold hover:bg-stone-200 flex items-center gap-1">
            <Plus size={11} /> New Book
          </button>
          <button onClick={exportPDF} disabled={exporting || chapters.every(c => !c.content)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-500 text-white text-xs font-bold hover:bg-violet-600 disabled:opacity-40">
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            Export PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chapter list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Chapters ({chapters.length})</p>
            <button onClick={writeAllChapters} disabled={writingChapter !== null}
              className="text-xs text-violet-500 font-bold hover:text-violet-600 disabled:opacity-40 flex items-center gap-1">
              <Sparkles size={11} /> Write All
            </button>
          </div>
          {chapters.map((ch, i) => (
            <div key={ch.id}
              onClick={() => setActiveChapter(i)}
              className={`rounded-2xl border p-4 cursor-pointer transition-all group/card ${activeChapter === i ? 'border-violet-400 bg-violet-50 dark:bg-violet-900/20' : 'border-stone-100 dark:border-stone-700 bg-white dark:bg-stone-800 hover:border-violet-200'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {editingTitle === i ? (
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <input value={editTitleVal} onChange={e => setEditTitleVal(e.target.value)}
                        className="flex-1 bg-white dark:bg-stone-700 border border-violet-300 rounded-lg px-2 py-0.5 text-sm" autoFocus />
                      <button onClick={() => { setChapters(p => p.map((c, ci) => ci === i ? { ...c, title: editTitleVal } : c)); setEditingTitle(null); }}
                        className="p-1 text-violet-500"><Check size={13} /></button>
                      <button onClick={() => setEditingTitle(null)} className="p-1 text-stone-400"><X size={13} /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 group">
                      <p className="text-sm font-semibold text-stone-700 dark:text-stone-200 truncate">{ch.title}</p>
                      <button onClick={e => { e.stopPropagation(); setEditingTitle(i); setEditTitleVal(ch.title); }}
                        className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-violet-500 transition-opacity">
                        <Edit3 size={11} />
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-stone-400 truncate mt-0.5">{ch.subtitle}</p>
                </div>
                <div className="shrink-0 flex items-center gap-1">
                  {writingChapter === i ? (
                    <Loader2 size={14} className="animate-spin text-violet-400" />
                  ) : ch.status === 'written' ? (
                    <span className="text-[10px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full font-bold">Done</span>
                  ) : (
                    <button onClick={e => { e.stopPropagation(); writeChapter(i); }}
                      className="text-[10px] bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full font-bold hover:bg-violet-200">
                      Write
                    </button>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); deleteChapter(i); }}
                    className="opacity-0 group-hover/card:opacity-100 p-1 text-stone-300 hover:text-red-400 transition-all"
                    title="Delete chapter">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              {ch.keyPoints?.length > 0 && (
                <div className="mt-2 space-y-0.5">
                  {ch.keyPoints.map((kp, ki) => (
                    <p key={ki} className="text-[10px] text-stone-400 flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-violet-300 shrink-0" />{kp}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}

          <button onClick={() => setChapters(p => [...p, { id: Date.now(), title: `Chapter ${p.length + 1}`, subtitle: '', keyPoints: [], content: '', status: 'empty' }])}
            className="w-full py-2 rounded-xl border-2 border-dashed border-stone-200 dark:border-stone-700 text-xs text-stone-400 hover:border-violet-300 hover:text-violet-500 transition-colors flex items-center justify-center gap-1.5">
            <Plus size={13} /> Add Chapter
          </button>
        </div>

        {/* Chapter content editor */}
        <div className="lg:col-span-2">
          {chapters[activeChapter] ? (
            <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl overflow-hidden">
              {/* Chapter header */}
              <div className="bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-stone-800 border-b border-violet-100 dark:border-stone-700 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-violet-500 font-bold uppercase mb-0.5">Chapter {activeChapter + 1}</p>
                    <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100">{chapters[activeChapter].title}</h3>
                    <p className="text-stone-400 text-sm">{chapters[activeChapter].subtitle}</p>
                  </div>
                  {chapters[activeChapter].status !== 'written' && (
                    <button onClick={() => writeChapter(activeChapter)} disabled={writingChapter === activeChapter}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-500 text-white text-sm font-bold hover:bg-violet-600 disabled:opacity-50">
                      {writingChapter === activeChapter ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      {writingChapter === activeChapter ? 'Writing…' : 'Write Chapter'}
                    </button>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="p-5">
                {writingChapter === activeChapter ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Loader2 size={32} className="animate-spin text-violet-400" />
                    <p className="text-stone-400 text-sm">Writing your chapter…</p>
                  </div>
                ) : chapters[activeChapter].content ? (
                  <textarea
                    value={chapters[activeChapter].content}
                    onChange={e => setChapters(prev => prev.map((c, i) => i === activeChapter ? { ...c, content: e.target.value } : c))}
                    className="w-full bg-transparent text-stone-700 dark:text-stone-200 text-sm leading-relaxed resize-none outline-none min-h-[400px] font-serif"
                    style={{ fontFamily: 'Georgia, serif', lineHeight: '1.8' }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                    <FileText size={40} className="text-violet-200" />
                    <div>
                      <p className="text-stone-400 font-medium">This chapter hasn't been written yet</p>
                      <p className="text-stone-300 dark:text-stone-600 text-sm mt-1">Hit "Write Chapter" and the AI will write the full content</p>
                    </div>
                    <button onClick={() => writeChapter(activeChapter)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-500 text-white font-bold hover:bg-violet-600">
                      <Sparkles size={16} /> Write This Chapter
                    </button>
                  </div>
                )}
              </div>

              {/* Footer stats + AI tools */}
              {chapters[activeChapter].content && (
                <div className="border-t border-stone-100 dark:border-stone-700 px-5 py-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-stone-400">
                      {chapters[activeChapter].content.split(/\s+/).filter(Boolean).length} words
                    </p>
                    <button onClick={() => writeChapter(activeChapter)} disabled={writingChapter === activeChapter}
                      className="text-xs text-violet-500 hover:text-violet-600 font-semibold disabled:opacity-40 flex items-center gap-1">
                      <Sparkles size={11} /> Rewrite
                    </button>
                  </div>
                  {/* AI writing tools */}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={checkGrammar}
                      disabled={grammarLoading || paraphraseLoading || writingChapter !== null}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 text-xs font-semibold hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:text-violet-600 dark:hover:text-violet-300 disabled:opacity-40 transition-colors">
                      {grammarLoading ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                      Fix Grammar
                    </button>
                    <button
                      onClick={paraphraseChapter}
                      disabled={grammarLoading || paraphraseLoading || writingChapter !== null}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 text-xs font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 dark:hover:text-emerald-300 disabled:opacity-40 transition-colors">
                      {paraphraseLoading ? <Loader2 size={11} className="animate-spin" /> : <AlignLeft size={11} />}
                      Improve Writing
                    </button>
                    <p className="text-[10px] text-stone-300 dark:text-stone-600 self-center ml-auto">You can edit freely — AI suggestions replace your current text</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-stone-400">
              <BookOpen size={40} className="mr-3 text-violet-200" />
              Select a chapter to view or write
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
