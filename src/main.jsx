import React, { Component } from 'react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      {key => <App key={key} />}
    </ErrorBoundary>
  </StrictMode>,
)
