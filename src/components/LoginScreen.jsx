import React, { useState } from 'react';
import { Eye, EyeOff, Lock, User, LogIn } from 'lucide-react';

const ADMIN_USER  = import.meta.env.VITE_ADMIN_USER     || 'admin';
const ADMIN_PASS  = import.meta.env.VITE_ADMIN_PASSWORD || 'kreativelync2024';
const SESSION_KEY = 'kl_auth_session';

export function isAuthenticated() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const { token, expires } = JSON.parse(raw);
    if (Date.now() > expires) { localStorage.removeItem(SESSION_KEY); return false; }
    return token === btoa(ADMIN_USER + ':' + ADMIN_PASS);
  } catch { return false; }
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
  window.location.reload();
}

export function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass]  = useState(false);
  const [error, setError]        = useState('');
  const [loading, setLoading]    = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      if (username.trim() === ADMIN_USER && password === ADMIN_PASS) {
        const session = {
          token:   btoa(ADMIN_USER + ':' + ADMIN_PASS),
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        onLogin();
      } else {
        setError('Incorrect username or password.');
      }
      setLoading(false);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-900 via-violet-950 to-stone-900 flex items-center justify-center p-4">

      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-violet-600 opacity-10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-amber-500 opacity-8 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">

        {/* Logo / brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-600 shadow-xl shadow-violet-900/50 mb-4">
            <Lock size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">KreativeLync</h1>
          <p className="text-stone-400 text-sm mt-1">Brand Studio — Admin Access</p>
        </div>

        {/* Card */}
        <div className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">

          <h2 className="text-lg font-bold text-white mb-6">Sign in to your studio</h2>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Username */}
            <div>
              <label className="text-xs font-semibold text-stone-400 uppercase tracking-widest block mb-1.5">
                Username
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="admin"
                  autoComplete="username"
                  required
                  className="w-full bg-black/40 border border-white/15 rounded-xl pl-10 pr-4 py-3 text-white placeholder-stone-500 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-semibold text-stone-400 uppercase tracking-widest block mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full bg-black/40 border border-white/15 rounded-xl pl-10 pr-12 py-3 text-white placeholder-stone-500 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-500/15 border border-red-500/30 rounded-xl px-4 py-2.5 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60 transition-all shadow-lg shadow-violet-900/40 mt-2"
            >
              {loading
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <LogIn size={16} />}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

        </div>

        <p className="text-center text-stone-600 text-xs mt-6">
          KreativeLync Studio · Private Access Only
        </p>
      </div>
    </div>
  );
}
