import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, Loader2, Pencil, Plus, Trash2, MessageSquare, ChevronLeft } from 'lucide-react';

const WELCOME = "Hi! I'm KreativeLync AI 👋 I know your brands and your content. Ask me anything — content ideas, captions, strategy, what to post next.";

const MODEL_OPTIONS = [
  { id: 'auto',   label: '✨ Auto',     icon: '✨', desc: 'Best answer, automatically' },
  { id: 'claude', label: '🧠 Deep',     icon: '🧠', desc: 'Best for strategy & planning' },
  { id: 'gemini', label: '⚡ Fast',     icon: '⚡', desc: 'Quick answers & ideas' },
  { id: 'openai', label: '💡 Creative', icon: '💡', desc: 'Best for writing & captions' },
];

// ── Session helpers ──────────────────────────────────────────────────────────
const SESSIONS_KEY = (brandId) => `kreativelync-sessions-${brandId || 'default'}`;

const loadSessions = (brandId) => {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY(brandId));
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
};

const saveSessions = (brandId, sessions) => {
  try { localStorage.setItem(SESSIONS_KEY(brandId), JSON.stringify(sessions)); } catch {}
};

const newSession = (title = 'New chat') => ({
  id: 'sess-' + Date.now(),
  title,
  createdAt: Date.now(),
  messages: [{ role: 'assistant', text: WELCOME }],
});

// ── Component ────────────────────────────────────────────────────────────────
export function FloatingAIChat({ businesses = [], activeBusinessId, onAction }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('chat'); // 'chat' | 'history'
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [preferredModel, setPreferredModel] = useState(() => {
    try { return localStorage.getItem('kreativelync-chat-model') || 'auto'; } catch { return 'auto'; }
  });

  const activeBiz = businesses.find(b => b?.id === activeBusinessId);
  const brandName = activeBiz?.name || 'Your brand';
  const brandType = activeBiz?.type || 'faith';
  const brandDesc = activeBiz?.description || '';

  const activeModel = MODEL_OPTIONS.find(m => m.id === preferredModel) || MODEL_OPTIONS[0];
  const bottomRef = useRef(null);

  // Sessions per brand
  const [sessions, setSessions] = useState(() => loadSessions(activeBusinessId));
  const [activeSessionId, setActiveSessionId] = useState(() => {
    const s = loadSessions(activeBusinessId);
    return s.length > 0 ? s[0].id : null;
  });

  // Reload sessions when brand changes
  useEffect(() => {
    const s = loadSessions(activeBusinessId);
    setSessions(s);
    setActiveSessionId(s.length > 0 ? s[0].id : null);
    setView('chat');
  }, [activeBusinessId]);

  const activeSession = sessions.find(s => s.id === activeSessionId) || null;
  const messages = activeSession?.messages || [{ role: 'assistant', text: WELCOME }];

  const persistSessions = (updated) => {
    setSessions(updated);
    saveSessions(activeBusinessId, updated);
  };

  const updateSessionMessages = (sessionId, msgs) => {
    persistSessions(sessions.map(s => s.id === sessionId ? { ...s, messages: msgs } : s));
  };

  const startNewChat = () => {
    const s = newSession('New chat');
    const updated = [s, ...sessions];
    persistSessions(updated);
    setActiveSessionId(s.id);
    setView('chat');
    setInput('');
  };

  const openSession = (id) => {
    setActiveSessionId(id);
    setView('chat');
  };

  const deleteSession = (id, e) => {
    e.stopPropagation();
    const updated = sessions.filter(s => s.id !== id);
    persistSessions(updated);
    if (activeSessionId === id) {
      setActiveSessionId(updated.length > 0 ? updated[0].id : null);
      setView('chat');
    }
  };

  const autoTitle = (text) => text.slice(0, 40) + (text.length > 40 ? '…' : '');

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    // Create session if none exists
    let sessionId = activeSessionId;
    let currentSessions = sessions;
    if (!sessionId) {
      const s = newSession(autoTitle(text));
      currentSessions = [s, ...sessions];
      persistSessions(currentSessions);
      setActiveSessionId(s.id);
      sessionId = s.id;
    }

    const userMsg = { role: 'user', text };
    const currentSession = currentSessions.find(s => s.id === sessionId);
    const currentMessages = currentSession?.messages || [{ role: 'assistant', text: WELCOME }];
    const newMessages = [...currentMessages, userMsg];

    // Auto-title from first user message
    const updatedTitle = currentSession?.title === 'New chat' ? autoTitle(text) : currentSession?.title;
    const updatedSessions = currentSessions.map(s =>
      s.id === sessionId ? { ...s, messages: newMessages, title: updatedTitle } : s
    );
    persistSessions(updatedSessions);
    setLoading(true);

    try {
      const history = currentMessages.slice(-8).map(m => ({ role: m.role, text: m.text }));
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'chat',
          topic: text,
          brandName,
          brandType,
          brandDesc,
          chatHistory: [...history, userMsg],
          preferredModel,
        }),
      });
      const data = await res.json();
      const reply = data.reply || data.result || data.text || "I'm here — try asking again!";
      const action = data.action || null;
      const model = data.model || null;
      const aiMsg = { role: 'assistant', text: reply, action, model };
      const finalMessages = [...newMessages, aiMsg];
      persistSessions(updatedSessions.map(s =>
        s.id === sessionId ? { ...s, messages: finalMessages } : s
      ));
    } catch {
      const errMsg = { role: 'assistant', text: 'Something went wrong. Try again!' };
      persistSessions(updatedSessions.map(s =>
        s.id === sessionId ? { ...s, messages: [...newMessages, errMsg] } : s
      ));
    }
    setLoading(false);
  };

  const pickModel = (id) => {
    setPreferredModel(id);
    setShowModelPicker(false);
    try { localStorage.setItem('kreativelync-chat-model', id); } catch {}
  };

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-4 z-50 w-80 md:w-[420px] bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-violet-100 dark:border-stone-700 flex flex-col overflow-hidden" style={{ height: '82vh', maxHeight: 720 }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 shrink-0">
            <div className="flex items-center gap-2">
              {view === 'history' && (
                <button onClick={() => setView('chat')} className="text-white/70 hover:text-white mr-1">
                  <ChevronLeft size={16} />
                </button>
              )}
              <Sparkles size={15} className="text-white" />
              <span className="text-white font-bold text-sm">KreativeLync AI</span>
              <span className="text-violet-200 text-xs truncate max-w-[80px]">· {brandName}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setView(v => v === 'history' ? 'chat' : 'history')}
                title="Chat history"
                className={`p-1 rounded-lg transition-colors ${view === 'history' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'}`}>
                <MessageSquare size={14} />
              </button>
              <button onClick={startNewChat} title="New chat"
                className="p-1 rounded-lg text-white/60 hover:text-white transition-colors">
                <Plus size={14} />
              </button>
              <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white ml-1">
                <X size={15} />
              </button>
            </div>
          </div>

          {/* ── HISTORY VIEW ── */}
          {view === 'history' && (
            <div className="flex-1 overflow-y-auto">
              <div className="p-3 border-b border-stone-100 dark:border-stone-700">
                <button onClick={startNewChat}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 text-sm font-bold hover:bg-violet-100 transition-colors">
                  <Plus size={15} /> New Chat
                </button>
              </div>
              {sessions.length === 0 ? (
                <div className="p-8 text-center text-stone-400 text-sm">No saved chats yet</div>
              ) : (
                <div className="p-2 space-y-1">
                  {sessions.map(s => (
                    <div key={s.id} onClick={() => openSession(s.id)}
                      className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${s.id === activeSessionId ? 'bg-violet-50 dark:bg-violet-900/20' : 'hover:bg-stone-50 dark:hover:bg-stone-800'}`}>
                      <MessageSquare size={13} className={s.id === activeSessionId ? 'text-violet-500' : 'text-stone-400'} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${s.id === activeSessionId ? 'text-violet-600 dark:text-violet-400 font-semibold' : 'text-stone-700 dark:text-stone-200'}`}>
                          {s.title}
                        </p>
                        <p className="text-[10px] text-stone-400">
                          {s.messages.filter(m => m.role === 'user').length} messages · {new Date(s.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button onClick={(e) => deleteSession(s.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── CHAT VIEW ── */}
          {view === 'chat' && (
            <>
              {/* Active session title */}
              {activeSession && activeSession.title !== 'New chat' && (
                <div className="px-4 py-1.5 border-b border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-900">
                  <p className="text-[11px] text-stone-400 truncate">{activeSession.title}</p>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.map((m, i) => (
                  <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-violet-500 text-white rounded-br-sm'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-100 rounded-bl-sm'
                    }`}>
                      {m.role === 'assistant'
                        ? m.text.split('\n').map((line, li) => (
                            <span key={li}>{li > 0 && <br />}{line}</span>
                          ))
                        : m.text}
                    </div>
                    {m.role === 'assistant' && m.model && (
                      <div className="mt-0.5 ml-1 text-[9px] text-stone-400 font-mono">✦ KreativeLync AI</div>
                    )}
                    {m.role === 'assistant' && m.actionApplied && (
                      <div className="mt-1 ml-1 text-[11px] text-green-600 font-semibold">✓ Applied to Brand Kit</div>
                    )}
                    {m.role === 'assistant' && m.action && !m.actionApplied && (
                      <div className="mt-1.5 w-[85%] bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700 rounded-xl p-2.5 text-xs">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Pencil size={11} className="text-violet-500" />
                          <span className="font-bold text-violet-700 dark:text-violet-300">Brand Kit Update</span>
                          <span className="text-violet-400">· {m.action.label}</span>
                        </div>
                        <p className="text-stone-600 dark:text-stone-300 mb-2 font-mono text-[10px] bg-white dark:bg-stone-800 rounded-lg px-2 py-1 truncate">
                          {Array.isArray(m.action.value) ? m.action.value.join(', ') : m.action.value}
                        </p>
                        <div className="flex gap-1.5">
                          <button onClick={() => {
                            onAction && onAction(m.action);
                            persistSessions(sessions.map(s =>
                              s.id === activeSessionId
                                ? { ...s, messages: s.messages.map((msg, idx) => idx === i ? { ...msg, action: null, actionApplied: true } : msg) }
                                : s
                            ));
                          }} className="flex-1 py-1 rounded-lg bg-violet-500 text-white font-bold hover:bg-violet-600">Apply ✓</button>
                          <button onClick={() => persistSessions(sessions.map(s =>
                            s.id === activeSessionId
                              ? { ...s, messages: s.messages.map((msg, idx) => idx === i ? { ...msg, action: null } : msg) }
                              : s
                          ))} className="px-3 py-1 rounded-lg border border-stone-200 dark:border-stone-600 text-stone-500 hover:bg-stone-50">Dismiss</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-stone-100 dark:bg-stone-800 px-3 py-2 rounded-2xl rounded-bl-sm">
                      <Loader2 size={14} className="animate-spin text-violet-500" />
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="border-t border-stone-100 dark:border-stone-700 shrink-0">
                <div className="relative px-3 pt-2">
                  <button onClick={() => setShowModelPicker(p => !p)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-stone-400 hover:text-violet-500 transition-colors">
                    <span>{activeModel.icon}</span>
                    <span>{activeModel.label}</span>
                    <span className="text-[9px] opacity-60">▾</span>
                  </button>
                  {showModelPicker && (
                    <div className="absolute bottom-7 left-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl shadow-xl overflow-hidden z-10 w-52">
                      {MODEL_OPTIONS.map(opt => (
                        <button key={opt.id} onClick={() => pickModel(opt.id)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-violet-50 dark:hover:bg-violet-900/20 ${preferredModel === opt.id ? 'bg-violet-50 dark:bg-violet-900/20' : ''}`}>
                          <span className="text-base">{opt.icon}</span>
                          <div>
                            <p className={`text-xs font-bold ${preferredModel === opt.id ? 'text-violet-600' : 'text-stone-700 dark:text-stone-200'}`}>{opt.label}</p>
                            <p className="text-[10px] text-stone-400">{opt.desc}</p>
                          </div>
                          {preferredModel === opt.id && <span className="ml-auto text-violet-500 text-xs">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 p-3 pt-1.5">
                  <input value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { setShowModelPicker(false); send(); } }}
                    onClick={() => setShowModelPicker(false)}
                    placeholder="Ask anything about your content..."
                    className="flex-1 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-400" />
                  <button onClick={send} disabled={loading || !input.trim()}
                    className="p-2 rounded-xl bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-40">
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Floating button */}
      <button onClick={() => setOpen(o => !o)}
        className="fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg hover:scale-110 transition-transform flex items-center justify-center"
        title="KreativeLync AI">
        {open ? <X size={22} /> : <Sparkles size={22} />}
      </button>
    </>
  );
}
