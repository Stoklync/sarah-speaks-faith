import React, { Component, useState, useEffect } from 'react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { LoginScreen, verifySession } from './components/LoginScreen.jsx'

class ErrorBoundary extends Component {
  state = { hasError: false, error: null, mountKey: 0 }
  static getDerivedStateFromError(err) { return { hasError: true, error: err } }
  componentDidCatch(err, info) { console.error('App error:', err, info) }
  tryAgain = () => {
    try { localStorage.removeItem('faith-studio-timeline-text'); } catch (_) {}
    this.setState({ hasError: false, error: null, mountKey: this.state.mountKey + 1 });
  }
  render() {
    if (this.state.hasError) {
      const err = this.state.error;
      const msg = err?.message || String(err);
      const stack = err?.stack || '';
      return (
        <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 720 }}>
          <h2 style={{ color: '#dc2626' }}>Something went wrong</h2>
          <p style={{ fontWeight: 600, marginTop: 8 }}>{msg}</p>
          {stack && <pre style={{ background: '#f5f5f5', padding: 16, overflow: 'auto', fontSize: 11, maxHeight: 200 }}>{stack}</pre>}
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button onClick={this.tryAgain} style={{ padding: '8px 16px', cursor: 'pointer' }}>Try again</button>
            <button onClick={() => window.location.reload()} style={{ padding: '8px 16px', cursor: 'pointer' }}>Reload page</button>
          </div>
        </div>
      )
    }
    return this.props.children(this.state.mountKey)
  }
}

function Root() {
  // null = still checking, true = authed, false = show login
  const [authed, setAuthed] = useState(null);

  useEffect(() => {
    verifySession().then(valid => setAuthed(valid));
  }, []);

  if (authed === null) {
    // Checking session — show minimal splash to avoid flash
    return (
      <div style={{ minHeight: '100vh', background: '#1c1028', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid rgba(139,92,246,0.3)', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />;

  return (
    <ErrorBoundary>
      {key => <App key={key} />}
    </ErrorBoundary>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
