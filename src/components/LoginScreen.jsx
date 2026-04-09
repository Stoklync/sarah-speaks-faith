import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock, User, LogIn, ShieldCheck } from 'lucide-react';

const SESSION_KEY = 'kl_auth_token';

// ─── Exported helpers ─────────────────────────────────────────────────────────

export function getStoredToken() {
  try { return localStorage.getItem(SESSION_KEY) || null; } catch { return null; }
}

export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

export async function verifySession() {
  const token = getStoredToken();
  if (!token) return false;
  try {
    const res = await fetch('/api/auth/verify', {
      headers: { 'x-auth-token': token },
    });
    const data = await res.json();
    if (!data.valid) clearSession();
    return data.valid === true;
  } catch {
    return false;
  }
}

export function logout() {
  clearSession();
  window.location.reload();
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass]  = useState(false);
  const [error,    setError]     = useState('');
  const [loading,  setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem(SESSION_KEY, data.token);
        onLogin();
      } else {
        setError(data.error || 'Invalid username or password.');
      }
    } catch {
      setError('Could not reach the server. Check your connection.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-900 via-violet-950 to-stone-900 flex items-center justify-center p-4">

      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-violet-600 opacity-10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-amber-500 opacity-8 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-600 shadow-xl shadow-violet-900/50 mb-4">
            <Lock size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">KreativeLync</h1>
          <p className="text-stone-400 text-sm mt-1">Brand Studio — Secure Admin Access</p>
        </div>

        {/* Card */}
        <div className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">

          <div className="flex items-center gap-2 mb-6">
            <ShieldCheck size={16} className="text-violet-400" />
            <h2 className="text-lg font-bold text-white">Sign in to your studio</h2>
          </div>

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
                  placeholder="Enter username"
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
                  placeholder="Enter password"
                  autoComplete="current-password"
                  required
                  className="w-full bg-black/40 border border-white/15 rounded-xl pl-10 pr-12 py-3 text-white placeholder-stone-500 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 transition-colors">
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
            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60 transition-all shadow-lg shadow-violet-900/40 mt-2">
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
