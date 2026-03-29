/**
 * NLE Editor Store - Multi-track timeline engine.
 * Replaces selectedVideoId with timelineTracks. Each track supports clips: { id, assetId, startOffset, duration, layerIndex }.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { probeAsset } from '../services/assetProbe';
import { idbSaveAsset, idbDeleteAsset, idbLoadAllAssets } from '../services/idbAssets';

const genId = () => `c${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const genTrackId = () => `t${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const useEditorStore = create(persist((set, get) => ({
  // expose on window so we can live-test in browser console
  __init: (() => { if (typeof window !== 'undefined') setTimeout(() => { window.__editorStore = useEditorStore; }, 0); })(),
  // Assets with probed meta (duration, width, height)
  assets: [],
  addAsset: (file, type) => {
    const id = Date.now();
    const url = URL.createObjectURL(file);
    const meta = { id, file, url, name: file.name, size: file.size, type, addedAt: new Date(), duration: 0, width: 0, height: 0 };
    if (file.type?.startsWith('video/')) meta.duration = 0;
    if (file.type?.startsWith('audio/')) meta.duration = 0;
    set(s => ({ assets: [...s.assets, meta] }));
    probeAsset(url, type).then(probe => {
      set(s => ({
        assets: s.assets.map(a => a.id === id ? { ...a, ...probe } : a)
      }));
    });
    // Persist to IndexedDB so asset survives page refresh
    idbSaveAsset(id, file, { name: file.name, mimeType: file.type, size: file.size, type, addedAt: Date.now() });
    return id;
  },
  updateAssetBlob: (id, blob) => {
    const a = get().assets.find(x => x.id === id);
    if (!a) return;
    if (a.url) URL.revokeObjectURL(a.url);
    const url = URL.createObjectURL(blob);
    set(s => ({
      assets: s.assets.map(x => x.id === id ? { ...x, url, file: blob, size: blob.size } : x),
    }));
    // Update IndexedDB with new blob
    idbSaveAsset(id, blob, { name: a.name, mimeType: blob.type, size: blob.size, type: a.type, addedAt: Date.now() });
  },
  removeAsset: (id) => {
    const a = get().assets.find(x => x.id === id);
    if (a?.url) URL.revokeObjectURL(a.url);
    // Remove from IndexedDB
    idbDeleteAsset(id);
    set(s => ({
      assets: s.assets.filter(x => x.id !== id),
      timelineTracks: s.timelineTracks.map(tr => ({
        ...tr,
        clips: (tr.clips || []).filter(c => c.assetId !== id)
      })),
      selectedVideoId: s.selectedVideoId === id ? null : s.selectedVideoId,
      selectedAudioId: s.selectedAudioId === id ? null : s.selectedAudioId,
      selectedImageId: s.selectedImageId === id ? null : s.selectedImageId,
    }));
  },

  /** Restore persisted assets from IndexedDB on app start */
  initAssetsFromIDB: async () => {
    try {
      const stored = await idbLoadAllAssets();
      if (!stored?.length) return;
      const restored = stored.map(entry => {
        const { id, file, meta } = entry;
        if (!file) return null;
        const url = URL.createObjectURL(file);
        return {
          id,
          file,
          url,
          name: meta?.name || file.name || 'asset',
          size: meta?.size || file.size || 0,
          type: meta?.type || (file.type?.startsWith('video') ? 'video' : file.type?.startsWith('audio') ? 'audio' : 'image'),
          addedAt: meta?.addedAt ? new Date(meta.addedAt) : new Date(),
          duration: 0,
          width: 0,
          height: 0,
        };
      }).filter(Boolean);
      if (!restored.length) return;
      // Only add assets that don't already exist (avoid duplication if called twice)
      set(s => {
        const existingIds = new Set(s.assets.map(a => a.id));
        const newAssets = restored.filter(a => !existingIds.has(a.id));
        if (!newAssets.length) return s;
        // Probe each restored asset asynchronously
        newAssets.forEach(a => {
          probeAsset(a.url, a.type).then(probe => {
            set(st => ({ assets: st.assets.map(x => x.id === a.id ? { ...x, ...probe } : x) }));
          });
        });
        return { assets: [...s.assets, ...newAssets] };
      });
    } catch (e) {
      console.warn('initAssetsFromIDB failed:', e);
    }
  },

  selectedVideoId: null,
  selectedAudioId: null,
  selectedImageId: null,
  setSelectedVideoId: (id) => set({ selectedVideoId: id }),
  setSelectedAudioId: (id) => set({ selectedAudioId: id }),
  setSelectedImageId: (id) => set({ selectedImageId: id }),

  // Layered Timeline: Track 1 (Main) = podcast, Track 2 (Overlay) = PiP grandkid, Track 3 (Logos) = watermarks
  // Each clip: { id, assetId, startOffset, duration, opacity, volume, pip?, overlayLayout?, transitionToNext? }
  timelineTracks: [
    { id: genTrackId(), type: 'video', label: 'Main', clips: [], zIndex: 0, locked: false, hidden: false },
    { id: genTrackId(), type: 'video', label: 'Overlay', clips: [], zIndex: 1, locked: false, hidden: false },
    { id: genTrackId(), type: 'image', label: 'Logos', clips: [], zIndex: 2, locked: false, hidden: false },
    { id: genTrackId(), type: 'audio', label: 'Audio', clips: [], zIndex: 3, locked: false, hidden: false }
  ],
  setTimelineTracks: (fn) => set(s => ({
    timelineTracks: typeof fn === 'function' ? fn(s.timelineTracks) : fn
  })),
  addTrack: (type = 'video') => set(s => ({
    timelineTracks: [...s.timelineTracks, { id: genTrackId(), type, clips: [] }]
  })),
  addClipToTrack: (trackId, assetId, startOffset, duration, layerIndex = 0, overlayLayout = null, opts = {}) => {
    const asset = get().assets.find(a => a.id === assetId);
    if (!asset) return null;
    const dur = duration ?? (asset.duration || 90);
    const clip = {
      id: genId(),
      assetId,
      startOffset: startOffset ?? 0,
      duration: dur,
      layerIndex,
      overlayLayout: overlayLayout ?? (asset.type === 'image' ? 'watermark' : null),
      opacity: opts.opacity ?? 1,
      volume: opts.volume ?? 1,
      pip: opts.pip ?? (asset.type === 'video' && opts.asOverlay ? { position: 'bottomRight', size: 0.3 } : null),
      transitionToNext: opts.transitionToNext ?? null,
    };
    set(s => ({
      timelineTracks: s.timelineTracks.map(t =>
        t.id === trackId ? { ...t, clips: [...(t.clips || []), clip].sort((a, b) => a.startOffset - b.startOffset) } : t
      )
    }));
    return clip.id;
  },
  insertClipAtPlayhead: (trackIndex, assetId, opts = {}) => {
    const state = get();
    const playhead = state.playhead;
    const trackId = state.timelineTracks[trackIndex]?.id;
    if (!trackId) return null;
    // Main track: when adding video sequentially (not PiP), place after last clip so clips don't overlap
    let insertAt = playhead;
    if (trackIndex === 0 && !opts.asOverlay) {
      const mainTrack = state.timelineTracks[0];
      const clips = mainTrack?.clips || [];
      if (clips.length > 0) {
        const lastEnd = Math.max(...clips.map(c => (c.startOffset || 0) + (c.duration || 0)));
        insertAt = Math.max(playhead, lastEnd);
      }
    }
    return get().addClipToTrack(trackId, assetId, insertAt, opts.duration, trackIndex, opts.overlayLayout, { ...opts, pip: opts.pip });
  },

  updateTrackMeta: (trackId, updates) => set(s => ({
    timelineTracks: s.timelineTracks.map(t =>
      t.id === trackId ? { ...t, ...updates } : t
    )
  })),
  reorderTrackZIndex: (trackId, direction) => set(s => {
    const tracks = [...s.timelineTracks];
    const i = tracks.findIndex(t => t.id === trackId);
    if (i < 0) return s;
    const j = direction === 'up' ? Math.min(tracks.length - 1, i + 1) : Math.max(0, i - 1);
    if (i === j) return s;
    [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
    return { timelineTracks: tracks.map((t, idx) => ({ ...t, zIndex: idx })) };
  }),

  setClipTransition: (trackId, clipId, transition) => set(s => ({
    timelineTracks: s.timelineTracks.map(t =>
      t.id === trackId ? { ...t, clips: (t.clips || []).map(c => c.id === clipId ? { ...c, transitionToNext: transition } : c) } : t
    )
  })),

  moveClipToTrack: (fromTrackId, clipId, toTrackIndex) => {
    const state = get();
    const fromTrack = state.timelineTracks.find(t => t.id === fromTrackId);
    const clip = fromTrack?.clips?.find(c => c.id === clipId);
    if (!clip) return false;
    set(s => ({
      timelineTracks: s.timelineTracks.map(t => {
        if (t.id === fromTrackId) return { ...t, clips: (t.clips || []).filter(c => c.id !== clipId) };
        if (s.timelineTracks.indexOf(t) === toTrackIndex) return { ...t, clips: [...(t.clips || []), { ...clip }].sort((a, b) => a.startOffset - b.startOffset) };
        return t;
      })
    }));
    return true;
  },

  removeClip: (trackId, clipId) => set(s => ({
    timelineTracks: s.timelineTracks.map(t =>
      t.id === trackId ? { ...t, clips: (t.clips || []).filter(c => c.id !== clipId) } : t
    )
  })),

  /** Delete clip and ripple: shift all clips after it left to close the gap */
  rippleDeleteClip: (trackId, clipId) => set(s => {
    const track = s.timelineTracks.find(t => t.id === trackId);
    if (!track) return s;
    const clip = track.clips.find(c => c.id === clipId);
    if (!clip) return s;
    const gapStart = clip.startOffset;
    const gapSize = clip.duration || 0;
    const newClips = track.clips
      .filter(c => c.id !== clipId)
      .map(c => c.startOffset >= gapStart ? { ...c, startOffset: Math.max(0, c.startOffset - gapSize) } : c)
      .sort((a, b) => a.startOffset - b.startOffset);
    return {
      timelineTracks: s.timelineTracks.map(t =>
        t.id === trackId ? { ...t, clips: newClips } : t
      )
    };
  }),

  /** Split a clip at the playhead on Main or Audio track. Returns the new second clip id if split succeeded, null otherwise. */
  splitClipAtPlayhead: (trackLabel = 'Main') => {
    const state = get();
    const playhead = state.playhead;
    const track = state.timelineTracks?.find(t => t.label === trackLabel);
    if (!track?.clips?.length) return null;
    const clip = track.clips.find(c =>
      playhead >= c.startOffset && playhead < c.startOffset + (c.duration || 0)
    );
    if (!clip) return null;
    const clipEnd = clip.startOffset + (clip.duration || 0);
    const splitAt = playhead;
    const minSegment = 0.5;
    if (splitAt - clip.startOffset < minSegment || clipEnd - splitAt < minSegment) return null;
    const trimAmt = splitAt - clip.startOffset;
    const first = { ...clip, duration: trimAmt };
    const secondId = genId();
    const second = {
      ...clip,
      id: secondId,
      startOffset: splitAt,
      duration: clipEnd - splitAt,
      trimStart: (clip.trimStart ?? 0) + trimAmt,
    };
    set(s => ({
      timelineTracks: s.timelineTracks.map(t =>
        t.id === track.id
          ? { ...t, clips: [...t.clips.filter(c => c.id !== clip.id), first, second].sort((a, b) => a.startOffset - b.startOffset) }
          : t
      )
    }));
    return secondId;
  },
  updateClip: (trackId, clipId, updates) => set(s => ({
    timelineTracks: s.timelineTracks.map(t =>
      t.id === trackId ? { ...t, clips: (t.clips || []).map(c => c.id === clipId ? { ...c, ...updates } : c) } : t
    )
  })),

  moveClip: (trackId, clipId, newStartOffset, snapEnabled = true) => {
    const state = get();
    const track = state.timelineTracks.find(t => t.id === trackId);
    const clip = track?.clips?.find(c => c.id === clipId);
    if (!clip) return false;
    let start = Math.max(0, newStartOffset);
    const duration = clip.duration ?? 0;
    const end = start + duration;
    if (snapEnabled) {
      const snapThreshold = 0.2;
      const others = (track.clips || []).filter(c => c.id !== clipId);
      const points = [0, state.duration, state.playhead, ...others.flatMap(c => [c.startOffset, c.startOffset + (c.duration || 0)])];
      const snap = (v) => {
        for (const p of points) {
          if (Math.abs(v - p) < snapThreshold) return p;
        }
        return v;
      };
      start = snap(start);
    }
    set(s => ({
      timelineTracks: s.timelineTracks.map(t =>
        t.id === trackId ? { ...t, clips: (t.clips || []).map(c => c.id === clipId ? { ...c, startOffset: start } : c).sort((a, b) => a.startOffset - b.startOffset) } : t
      )
    }));
    return true;
  },

  resizeClip: (trackId, clipId, edge, delta, assetDuration, snapEnabled = true) => {
    const state = get();
    const track = state.timelineTracks.find(t => t.id === trackId);
    const clip = track?.clips?.find(c => c.id === clipId);
    if (!clip) return false;
    const maxDur = assetDuration ?? clip.duration ?? 999;
    const snapThreshold = 0.2;
    const others = (track?.clips || []).filter(c => c.id !== clipId);
    const snapPoints = [0, state.duration, state.playhead, ...others.flatMap(c => [c.startOffset, c.startOffset + (c.duration || 0)])];
    const snap = (v) => { for (const p of snapPoints) { if (Math.abs(v - p) < snapThreshold) return p; } return v; };

    let startOffset = clip.startOffset;
    let duration = clip.duration ?? 0;

    if (edge === 'start') {
      let newStart = Math.max(0, Math.min(startOffset + duration - 0.5, startOffset + delta));
      if (snapEnabled) newStart = snap(newStart);
      startOffset = newStart;
      duration = (clip.startOffset + (clip.duration ?? 0)) - startOffset;
    } else if (edge === 'end') {
      let newEnd = Math.min(startOffset + maxDur, Math.max(startOffset + 0.5, startOffset + duration + delta));
      if (snapEnabled) newEnd = snap(newEnd);
      duration = newEnd - startOffset;
    }
    duration = Math.max(0.5, Math.min(maxDur, duration));
    set(s => ({
      timelineTracks: s.timelineTracks.map(t =>
        t.id === trackId ? { ...t, clips: (t.clips || []).map(c => c.id === clipId ? { ...c, startOffset, duration } : c).sort((a, b) => a.startOffset - b.startOffset) } : t
      )
    }));
    return true;
  },
  updateTrack: (trackIndex, clip) => {
    const tracks = get().timelineTracks;
    const track = tracks[trackIndex];
    if (!track) return null;
    const asset = get().assets.find(a => a.id === clip.assetId);
    const dur = clip.duration ?? asset?.duration ?? 5;
    const newClip = {
      id: clip.id || genId(),
      assetId: clip.assetId,
      startOffset: clip.offset ?? clip.startOffset ?? 0,
      duration: dur,
      layerIndex: clip.layer ?? clip.layerIndex ?? trackIndex,
      opacity: clip.opacity ?? 1,
      volume: clip.volume ?? 1,
      pip: clip.pip ?? null,
      overlayLayout: clip.overlayLayout ?? null,
      transitionToNext: clip.transitionToNext ?? null,
    };
    set(s => ({
      timelineTracks: s.timelineTracks.map((t, i) =>
        i === trackIndex ? { ...t, clips: [...(t.clips || []), newClip].sort((a, b) => a.startOffset - b.startOffset) } : t
      )
    }));
    return newClip.id;
  },

  playhead: 0,
  setPlayhead: (t) => set({ playhead: t }),

  duration: 90,
  setDuration: (d) => set({ duration: d }),

  // Legacy segments (for backward compat during migration)
  mainSegments: [{ id: 'seg0', start: 0, end: 90, transition: 'cut' }],
  setMainSegments: (fn) => set(s => ({ mainSegments: typeof fn === 'function' ? fn(s.mainSegments) : fn })),
  audioSegments: [{ id: 'a0', start: 0, end: 90 }],
  setAudioSegments: (fn) => set(s => ({ audioSegments: typeof fn === 'function' ? fn(s.audioSegments) : fn })),
  audioExtraTracks: [{ id: 't2', segments: [] }],
  setAudioExtraTracks: (fn) => set(s => ({ audioExtraTracks: typeof fn === 'function' ? fn(s.audioExtraTracks) : fn })),
  textClips: [],
  setTextClips: (fn) => set(s => ({ textClips: typeof fn === 'function' ? fn(s.textClips) : fn })),

  selectedSegmentId: null,
  selectedAudioSegmentId: null,
  selectedClipId: null,
  setSelectedSegmentId: (id) => set({ selectedSegmentId: id }),
  setSelectedAudioSegmentId: (id) => set({ selectedAudioSegmentId: id }),
  setSelectedClipId: (id) => set({ selectedClipId: id }),

  history: [],
  pushHistory: (snapshot) => set(s => ({ history: [...s.history.slice(-49), snapshot] })),
  popHistory: () => set(s => ({ history: s.history.slice(0, -1) })),

  playing: false,
  setPlaying: (v) => set({ playing: v }),
}), {
  name: 'faith-studio-editor',
  version: 2, // bumped to clear any corrupted stored state
  partialize: (s) => ({
    timelineTracks: s.timelineTracks,
    textClips: s.textClips,
    mainSegments: s.mainSegments,
    audioSegments: s.audioSegments,
    audioExtraTracks: s.audioExtraTracks,
    duration: s.duration,
  }),
}));

export const selectSelectedVideo = (s) => s.assets.find(a => a.id === s.selectedVideoId);
export const selectSelectedAudio = (s) => s.assets.find(a => a.id === s.selectedAudioId);
export const selectAsset = (s, id) => s.assets.find(a => a.id === id);
export const selectClipsAtPlayhead = (s) => {
  const t = s.playhead;
  const clips = [];
  const tracks = [...(s.timelineTracks || [])].filter(tr => !tr.hidden).sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  tracks.forEach((tr, idx) => {
    const origIdx = s.timelineTracks?.findIndex(x => x.id === tr.id) ?? idx;
    (tr.clips || []).forEach(c => {
      if (t >= c.startOffset && t < c.startOffset + c.duration) {
        const isOverlayTrack = tr.label === 'Overlay' || origIdx === 1;
        clips.push({ ...c, trackType: tr.type, trackId: tr.id, trackIndex: origIdx, isOverlayTrack });
      }
    });
  });
  return clips;
};
export const selectFilteredAssets = (s, filter, search) =>
  s.assets.filter(a => {
    const matchFilter = !filter || filter === 'all' || a.type === filter;
    const matchSearch = !search || a.name?.toLowerCase().includes(search?.toLowerCase());
    return matchFilter && matchSearch;
  });

