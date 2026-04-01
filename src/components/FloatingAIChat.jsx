import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Sparkles, Loader2, Pencil } from 'lucide-react';

export function FloatingAIChat({ businesses = [], activeBusinessId, onAction }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hi! I'm KreativeLync AI 👋 I know your brands and your content. Ask me anything — content ideas, captions, strategy, what to post next. I'm here to help." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  const activeBiz = businesses.find(b => b?.id === activeBusinessId);
  const brandName = activeBiz?.name || 'Your brand';
  const brandType = activeBiz?.type || 'faith';
  const brandDesc = activeBiz?.description || '';

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const userMsg = { role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = messages.slice(-10).map(m => ({ role: m.role, text: m.text }));
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
        }),
      });
      const data = await res.json();
      const reply = data.reply || data.result || data.text || data.caption || "I'm here — try asking again!";
      const action = data.action || null;
      const model = data.model || null;
      setMessages(prev => [...prev, { role: 'assistant', text: reply, action, model }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: "Something went wrong. Try again!" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-4 z-50 w-80 md:w-[420px] bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-violet-100 dark:border-stone-700 flex flex-col overflow-hidden" style={{ height: '80vh', maxHeight: 700 }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-white" />
              <span className="text-white font-bold text-sm">KreativeLync AI</span>
              <span className="text-violet-200 text-xs">· {brandName}</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white">
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-violet-500 text-white rounded-br-sm'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-100 rounded-bl-sm'
                }`}>
                  {m.text}
                </div>
                {m.role === 'assistant' && m.model && (
                  <div className="mt-0.5 ml-1 text-[9px] text-stone-400 dark:text-stone-500 font-mono">
                    {m.model === 'Gemini' ? '✦ Gemini 2.0 Flash' : m.model === 'Groq' ? '⚡ Groq / Llama' : '◆ Claude'}
                  </div>
                )}
                {m.role === 'assistant' && m.actionApplied && (
                  <div className="mt-1 ml-1 flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400 font-semibold">
                    <span>✓ Applied to Brand Kit</span>
                  </div>
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
                      <button
                        onClick={() => {
                          onAction && onAction(m.action);
                          setMessages(prev => prev.map((msg, idx) => idx === i ? { ...msg, action: null, actionApplied: true } : msg));
                        }}
                        className="flex-1 py-1 rounded-lg bg-violet-500 text-white font-bold hover:bg-violet-600 transition-colors"
                      >
                        Apply ✓
                      </button>
                      <button
                        onClick={() => setMessages(prev => prev.map((msg, idx) => idx === i ? { ...msg, action: null } : msg))}
                        className="px-3 py-1 rounded-lg border border-stone-200 dark:border-stone-600 text-stone-500 font-semibold hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                      >
                        Dismiss
                      </button>
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
          <div className="p-3 border-t border-stone-100 dark:border-stone-700 flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Ask anything about your content..."
              className="flex-1 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-400"
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="p-2 rounded-xl bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-40"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg hover:scale-110 transition-transform flex items-center justify-center"
        title="KreativeLync AI"
      >
        {open ? <X size={22} /> : <Sparkles size={22} />}
      </button>
    </>
  );
}
