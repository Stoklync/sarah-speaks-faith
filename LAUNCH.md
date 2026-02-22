# Sarah Speaks Faith Studio — Launch Guide

## Quick Start

```bash
npm install    # if you haven't already
npm run dev    # starts at http://localhost:5173 (or 5180)
```

**Production build:**
```bash
npm run build
npm run preview   # test the production build locally
```

**Deploy to Vercel:**
```bash
vercel
```
Then add env vars in the Vercel dashboard. See `LAUNCH-BACKEND.md` for live social (YouTube) setup.

---

## What You Need to Connect

### AI Insights (optional — free)

For **Get AI insights** in Post Analytics, add a Gemini API key:
- Go to **App Settings** (sidebar) → paste your key
- Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — **no credit card required**

### Nothing else required

The app runs **fully in your browser**. No backend, no database.

| Feature | Storage | Notes |
|---------|---------|-------|
| **Theme, contact URL, marketing goal** | `localStorage` | Persists across sessions |
| **Markers, text overlays, custom cameras** | `localStorage` | Persists |
| **Post analytics** | `localStorage` | Persists |
| **Marketing store** (hooks, keywords) | `localStorage` (Zustand persist) | Persists |
| **Media library & timeline** | In-memory only | Lost on refresh (blob URLs can't be saved) |
| **Businesses** | `localStorage` | Persists across sessions |
| **IG posts, Pinterest pins** | In-memory only | Lost on refresh (images are blob URLs) |

---

## What Works Without Setup

- **Media Library** — Upload videos, images, audio (stored in memory for the session)
- **Classic Timeline** — Edit, split, layer clips
- **Photo & Pin Planner** — Upload and plan pins
- **Pro Content Toolkit** — Captions, hashtags, hooks, alt text
- **Post Analytics** — Track posts, log performance, **Get AI insights** (best times, next move, hook tips)
- **Connect accounts** — Backend required; see `LAUNCH-BACKEND.md` for OAuth setup
- **Camera Guide** — Setup tips
- **Brand kit** — Use Sarah, Her Stewardship, Stoklync presets

---

## Export / Deployment

To deploy to a static host (Vercel, Netlify, GitHub Pages, etc.):

1. Run `npm run build`
2. Upload the `dist/` folder
3. Ensure your host serves `index.html` for all routes (SPA fallback)

**FFmpeg note:** The editor uses FFmpeg.wasm in the browser. It loads on first use. No server required.

---

## If Something Doesn’t Work

- **Blank screen** — Check browser console (F12). Try a hard refresh.
- **Media won't load** — Ensure files are valid video/image/audio.
- **Export fails** — FFmpeg.wasm needs time to load; try again after the editor has been open a moment.
- **Data lost on refresh** — Media and timeline are session-only. Export your edits before closing.
