/**
 * Layered Timeline - CapCut-style tracks: Main (bottom), Overlay (PiP), Logos (top).
 * Long-press on mobile to pick up clip and move to another track.
 * Clips show video/image thumbnails so you can see what's where.
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Video, Image as ImageIcon, Music, Trash2, Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import { useEditorStore } from '../stores/editorStore';

const secToTimecode = (s) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
};

const TRANSITION_OPTIONS = [
  { id: null, label: 'Cut' },
  { id: 'crossfade', label: 'Cross-Fade' },
  { id: 'wipe', label: 'Wipe' },
  { id: 'zoom', label: 'Zoom' },
];

const FRAME_COUNT = 6;

/** CapCut-style filmstrip: multiple video frames along the clip */
function FilmstripThumbnail({ asset, clip, minWidth = 24 }) {
  const trimStart = clip?.trimStart ?? 0;
  const dur = clip?.duration ?? 60;
  const times = [...Array(FRAME_COUNT)].map((_, i) => trimStart + (i / (FRAME_COUNT - 1 || 1)) * dur);

  if (!asset?.url || asset.type !== 'video') return <div className="flex-1 min-w-0 h-full bg-stone-600" style={{ minWidth }} />;
  return (
    <div className="flex-1 min-w-0 h-full flex overflow-hidden bg-stone-700" style={{ minWidth }}>
      {times.map((t, i) => (
        <FilmstripFrame key={i} url={asset.url} seekTime={Math.min(t, 300)} />
      ))}
    </div>
  );
}

function FilmstripFrame({ url, seekTime }) {
  const ref = useRef(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const go = () => { v.currentTime = seekTime; };
    v.addEventListener('loadeddata', go);
    if (v.readyState >= 2) go();
    return () => v.removeEventListener('loadeddata', go);
  }, [url, seekTime]);
  return (
    <div className="flex-1 min-w-0 h-full relative overflow-hidden border-r border-stone-600/50 last:border-r-0">
      <video ref={ref} src={url} muted playsInline preload="metadata" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
    </div>
  );
}

/** Audio waveform for timeline — CapCut-style green bars */
function AudioWaveformBar({ audioUrl, className = '' }) {
  const canvasRef = useRef(null);
  const peaksRef = useRef(null);
  const [ready, setReady] = useState(0);
  const draw = useCallback((peaks, w, h) => {
    const c = canvasRef.current;
    if (!c || !peaks?.length) return;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(40, w || c.offsetWidth);
    const height = Math.max(16, h || c.offsetHeight);
    c.width = width * dpr;
    c.height = height * dpr;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    g.clearRect(0, 0, width, height);
    const mid = height / 2;
    const samples = peaks.length;
    const barW = Math.max(1, (width / samples) * 0.9);
    peaks.forEach((p, i) => {
      const x = i * (width / samples);
      const barH = Math.max(1, p * mid * 0.25);
      g.fillStyle = 'rgba(34, 197, 94, 0.9)';
      g.fillRect(x, mid - barH / 2, barW, barH);
    });
  }, []);
  useEffect(() => {
    if (!audioUrl) return;
    let cancelled = false;
    const fallback = [...Array(80)].map(() => 0.2 + Math.random() * 0.6);
    peaksRef.current = fallback;
    setReady(r => r + 1);
    (async () => {
      try {
        const res = await fetch(audioUrl);
        const buf = await res.arrayBuffer();
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await ctx.decodeAudioData(buf);
        if (cancelled) return;
        const ch = audioBuffer.getChannelData(0);
        const len = ch.length;
        const samples = 80;
        const step = Math.floor(len / samples);
        const peaks = [];
        for (let i = 0; i < samples; i++) {
          let max = 0;
          for (let j = i * step; j < Math.min((i + 1) * step, len); j++) {
            max = Math.max(max, Math.abs(ch[j]));
          }
          peaks.push(max);
        }
        peaksRef.current = peaks;
        setReady(r => r + 1);
      } catch (_) {
        peaksRef.current = fallback;
        setReady(r => r + 1);
      }
    })();
    return () => { cancelled = true; };
  }, [audioUrl]);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const run = () => {
      if (!peaksRef.current) return;
      const rect = c.getBoundingClientRect();
      if (rect.width > 0) draw(peaksRef.current, rect.width, rect.height);
    };
    const t = setTimeout(run, 50);
    const ro = new ResizeObserver(run);
    ro.observe(c);
    return () => { clearTimeout(t); ro.disconnect(); };
  }, [draw, ready, audioUrl]);
  if (!audioUrl) return null;
  return <canvas ref={canvasRef} className={`absolute inset-0 w-full h-full pointer-events-none rounded ${className}`} style={{ opacity: 1 }} />;
}

/** Thumbnail for timeline clips — filmstrip for video, waveform for audio, image for images */
function ClipThumbnail({ asset, clip, trackLabel, minWidth = 24 }) {
  if (!asset?.url) return <div className="flex-1 min-w-0 h-full bg-stone-600" />;
  if (asset.type === 'image') {
    return (
      <div className="flex-1 min-w-0 h-full relative overflow-hidden" style={{ minWidth }}>
        <img src={asset.url} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      </div>
    );
  }
  if (asset.type === 'video') {
    return <FilmstripThumbnail asset={asset} clip={clip} minWidth={minWidth} />;
  }
  if (asset.type === 'audio') {
    return (
      <div className="flex-1 min-w-0 h-full relative overflow-hidden bg-emerald-900/30" style={{ minWidth }}>
        <AudioWaveformBar audioUrl={asset.url} />
        <Music size={14} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-400/60 pointer-events-none" />
      </div>
    );
  }
  return <div className="flex-1 min-w-0 h-full bg-stone-600" style={{ minWidth }} />;
}

const TRACK_ACCENT = {
  Main: 'border-l-rose-500/80',
  Overlay: 'border-l-cyan-500/80',
  Logos: 'border-l-amber-500/80',
  Audio: 'border-l-emerald-500/80',
};

export function LayeredTimelineTracks({
  timelineTracks,
  assets,
  playhead,
  playheadPct,
  timelineDuration,
  timelineZoom,
  selectedClipId,
  setSelectedClipId,
  onSeek,
  onClipClick,
  removeClip,
  updateClip,
  moveClip,
  resizeClip,
  moveClipToTrack,
  setClipTransition,
  insertClipAtPlayhead,
  handlePlayheadDrag,
  setDraggingPlayhead,
  snapEnabled = true,
  onPushHistory,
  updateTrackMeta,
}) {
  const longPressRef = useRef({ timer: null, clipId: null, trackId: null });
  const [draggingClip, setDraggingClip] = useState(null);
  const [transitionPopup, setTransitionPopup] = useState(null);
  const dragRef = useRef({ mode: null, clipId: null, trackId: null, startX: 0, lastX: 0, startOffset: 0, startDuration: 0, didPush: false });

  const handleLongPressStart = useCallback((e, clipId, trackId) => {
    longPressRef.current.clipId = clipId;
    longPressRef.current.trackId = trackId;
    longPressRef.current.timer = setTimeout(() => {
      setDraggingClip({ clipId, trackId });
    }, 500);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    if (longPressRef.current.timer) {
      clearTimeout(longPressRef.current.timer);
      longPressRef.current.timer = null;
    }
    setDraggingClip(null);
  }, []);

  const handlePointerDown = useCallback((e, clipId, trackId) => {
    if ('ontouchstart' in window) {
      handleLongPressStart(e, clipId, trackId);
    }
  }, [handleLongPressStart]);

  const handlePointerUp = useCallback((e, toTrackIndex) => {
    if (draggingClip && toTrackIndex != null) {
      const fromIdx = timelineTracks?.findIndex(t => t.id === draggingClip.trackId);
      if (fromIdx >= 0 && fromIdx !== toTrackIndex && moveClipToTrack) {
        moveClipToTrack(draggingClip.trackId, draggingClip.clipId, toTrackIndex);
      }
    }
    handleLongPressEnd();
  }, [handleLongPressEnd, draggingClip, timelineTracks, moveClipToTrack]);

  const handlePointerLeave = useCallback(() => {
    handleLongPressEnd();
  }, [handleLongPressEnd]);

  const handleTrackPointerUp = useCallback((trackIndex) => (e) => {
    handlePointerUp(e, trackIndex);
  }, [handlePointerUp]);

  const handleTrackDrop = useCallback((e, toTrackIndex) => {
    e.preventDefault();
    const { clipId, trackId } = draggingClip || longPressRef.current;
    if (!clipId || !trackId || !moveClipToTrack) return;
    const fromTrack = timelineTracks?.find(t => t.id === trackId);
    const toTrack = timelineTracks?.[toTrackIndex];
    if (!fromTrack || !toTrack || fromTrack.id === toTrack.id) return;
    moveClipToTrack(trackId, clipId, toTrackIndex);
    setDraggingClip(null);
  }, [draggingClip, timelineTracks, moveClipToTrack]);

  const seekTo = useCallback((t) => {
    if (typeof onSeek === 'function') onSeek(t);
  }, [onSeek]);

  const pxToTime = useCallback((px, el) => {
    if (!el || timelineDuration <= 0) return 0;
    const rect = el.getBoundingClientRect();
    const laneWidth = rect.width;
    const pct = Math.max(0, Math.min(1, px / laneWidth));
    return pct * timelineDuration;
  }, [timelineDuration]);

  const handleClipPointerDown = useCallback((e, clip, track, edge) => {
    if (track.locked) return;
    const mode = edge || 'move';
    const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const laneEl = e.currentTarget?.closest?.('[data-timeline-lane]') ?? e.currentTarget?.parentElement;
    const laneWidth = laneEl?.getBoundingClientRect?.()?.width || (500 * 1);
    dragRef.current = {
      mode,
      clipId: clip.id,
      trackId: track.id,
      startX: x,
      lastX: x,
      startOffset: clip.startOffset,
      startDuration: clip.duration,
      assetDuration: assets?.find(a => a.id === clip.assetId)?.duration,
      laneWidth,
      didPush: false,
    };
  }, [assets]);

  useEffect(() => {
    const onMove = (e) => {
      const dr = dragRef.current;
      if (!dr.mode || !moveClip || !resizeClip) return;
      if (!dr.didPush) { dr.didPush = true; onPushHistory?.(); }
      const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      const deltaPx = x - dr.lastX;
      dr.lastX = x;
      const laneWidth = dr.laneWidth || 500 * (typeof timelineZoom === 'number' ? timelineZoom : 1);
      const deltaTime = laneWidth > 0 ? (deltaPx / laneWidth) * timelineDuration : 0;

      if (dr.mode === 'move') {
        const cur = useEditorStore.getState().timelineTracks?.find(t => t.id === dr.trackId)?.clips?.find(c => c.id === dr.clipId);
        const curStart = cur?.startOffset ?? dr.startOffset;
        moveClip(dr.trackId, dr.clipId, curStart + deltaTime, snapEnabled);
      } else if (dr.mode === 'start') {
        resizeClip(dr.trackId, dr.clipId, 'start', deltaTime, dr.assetDuration, snapEnabled);
      } else if (dr.mode === 'end') {
        resizeClip(dr.trackId, dr.clipId, 'end', deltaTime, dr.assetDuration, snapEnabled);
      }
    };
    const onUp = () => { dragRef.current.mode = null; };
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);
    window.addEventListener('touchcancel', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      window.removeEventListener('touchcancel', onUp);
    };
  }, [moveClip, resizeClip, snapEnabled, timelineDuration, timelineZoom, onPushHistory]);

  // Show Main + Audio always; only show Overlay/Logos when they have clips (less clutter)
  const visibleTracks = (timelineTracks || []).filter(t => {
    if (!['Main', 'Overlay', 'Logos', 'Audio'].includes(t.label)) return false;
    if (t.label === 'Main' || t.label === 'Audio') return true;
    return (t.clips || []).length > 0;
  });

  if (visibleTracks.length === 0) return null;

  return (
    <>
      {visibleTracks.map((track, trackIndex) => (
        <div
          key={track.id}
          className="flex items-center shrink-0 relative"
          style={{ height: 56 }}
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
          onDrop={e => handleTrackDrop(e, trackIndex)}
        >
          <div className="w-24 shrink-0 flex items-center gap-1 text-stone-300 text-xs">
            {track.type === 'video' && <Video size={14} />}
            {track.type === 'image' && <ImageIcon size={14} />}
            {track.type === 'audio' && <Music size={14} />}
            <span className="flex-1 truncate" title={track.label === 'Main' ? 'Main video track' : track.label === 'Audio' ? 'Audio track' : track.label}>
              {track.label === 'Main' ? 'Video' : track.label === 'Audio' ? 'Audio' : track.label}
            </span>
            <button onClick={() => updateTrackMeta?.(track.id, { hidden: !track.hidden })} className="p-1 rounded hover:bg-stone-600 text-stone-400" title={track.hidden ? 'Show layer' : 'Hide layer'}>
              {track.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
            <button onClick={() => updateTrackMeta?.(track.id, { locked: !track.locked })} className={`p-1 rounded hover:bg-stone-600 ${track.locked ? 'text-rose-400' : 'text-stone-400'}`} title={track.locked ? 'Unlock layer' : 'Lock layer'}>
              {track.locked ? <Lock size={12} /> : <Unlock size={12} />}
            </button>
          </div>
          <div
            data-timeline-lane
            onMouseDown={(e) => {
              // Move playhead when clicking empty track space (not on a clip or resize handle)
              if (!e.target.closest('[data-clip]') && !e.target.closest('.resize-handle')) {
                e.preventDefault();
                handlePlayheadDrag?.(e);
                setDraggingPlayhead?.(true);
              }
            }}
            onTouchStart={(e) => {
              if (!e.target.closest('[data-clip]') && !e.target.closest('.resize-handle')) {
                e.preventDefault();
                handlePlayheadDrag?.(e);
                setDraggingPlayhead?.(true);
              }
            }}
            className={`flex-1 h-full relative overflow-hidden cursor-grab active:cursor-grabbing rounded touch-none ${TRACK_ACCENT[track.label] || ''} border-l-2 bg-stone-700/70`}
            style={{ userSelect: 'none', minWidth: `${500 * timelineZoom}px` }}
            onPointerUp={handleTrackPointerUp(trackIndex)}
            onPointerLeave={handlePointerLeave}
            onPointerCancel={handleTrackPointerUp(trackIndex)}
          >
            {(track.clips || []).map((clip, clipIdx) => {
              const asset = assets?.find(a => a.id === clip.assetId);
              const left = timelineDuration > 0 ? (clip.startOffset / timelineDuration) * 100 : 0;
              const w = timelineDuration > 0 ? Math.max(2, (clip.duration / timelineDuration) * 100) : 10;
              const isSelected = selectedClipId === clip.id;
              const isDragging = draggingClip?.clipId === clip.id;
              const showThumb = w > 3;

              const isDragActive = dragRef.current.mode && dragRef.current.clipId === clip.id;
              return (
                <div
                  key={clip.id}
                  data-clip
                  className={`absolute h-[calc(100%-4px)] top-0.5 flex items-stretch group rounded overflow-hidden cursor-move select-none ${isSelected ? 'ring-2 ring-rose-400 ring-offset-1' : ''} ${isDragging ? 'opacity-80 z-20 ring-2 ring-white' : ''} ${isDragActive ? 'z-30' : ''}`}
                  style={{ left: `${left}%`, width: `${w}%` }}
                  onClick={(e) => { e.stopPropagation(); if (draggingClip || dragRef.current.mode) return; onClipClick?.(clip, track); setSelectedClipId?.(clip.id); seekTo?.(clip.startOffset); }}
                  onPointerDown={(e) => handlePointerDown(e, clip.id, track.id)}
                  onMouseDown={(e) => { if (e.target.closest('.resize-handle')) return; e.stopPropagation(); handleClipPointerDown(e, clip, track, 'move'); }}
                  onTouchStart={(e) => { if (e.target.closest('.resize-handle')) return; e.stopPropagation(); handleClipPointerDown(e, clip, track, 'move'); }}
                  onDoubleClick={(e) => { e.stopPropagation(); onClipClick?.(clip, track); }}
                >
                  <div onMouseDown={(e) => { e.stopPropagation(); handleClipPointerDown(e, clip, track, 'start'); }} onTouchStart={(e) => { e.stopPropagation(); handleClipPointerDown(e, clip, track, 'start'); }} className="resize-handle w-1.5 flex-shrink-0 h-full cursor-ew-resize bg-stone-500/50 hover:bg-rose-500/70 z-10" title="Drag to trim start" />
                  <div className="flex-1 min-w-0 h-full flex relative overflow-hidden rounded border border-stone-500/50 hover:border-stone-400/60 bg-stone-600/90">
                    {showThumb ? (
                      <ClipThumbnail asset={asset} clip={clip} trackLabel={track.label} minWidth={28} />
                    ) : (
                      <div className="flex-1 min-w-0 h-full bg-stone-600 flex items-center justify-center">
                        {asset?.type === 'video' && <Video size={14} className="text-stone-400" />}
                        {asset?.type === 'image' && <ImageIcon size={14} className="text-stone-400" />}
                        {asset?.type === 'audio' && <Music size={14} className="text-emerald-400" />}
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 to-transparent px-2 py-1">
                      <span className="text-[9px] font-mono text-white drop-shadow-sm">
                        {secToTimecode(clip.startOffset)} – {secToTimecode(clip.startOffset + clip.duration)}
                      </span>
                    </div>
                    <span className="absolute top-1 left-2 text-[9px] text-white/90 truncate max-w-[80%] drop-shadow" title={asset?.name}>
                      {asset?.name?.replace(/\.[^.]+$/, '') || `Clip`}
                    </span>
                  </div>
                  <div onMouseDown={(e) => { e.stopPropagation(); handleClipPointerDown(e, clip, track, 'end'); }} onTouchStart={(e) => { e.stopPropagation(); handleClipPointerDown(e, clip, track, 'end'); }} className="resize-handle w-1.5 flex-shrink-0 h-full cursor-ew-resize bg-stone-500/50 hover:bg-rose-500/70 z-10" title="Drag to trim end" />
                  <button
                    onClick={(e) => { e.stopPropagation(); removeClip?.(track.id, clip.id); }}
                    className="p-1 rounded bg-red-900/80 text-red-300 hover:bg-red-700 opacity-0 group-hover:opacity-100 shrink-0 self-center"
                    title="Remove"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
            {/* Transition zones at junctions between adjacent clips */}
            {(track.clips || []).slice(0, -1).map((clip, clipIdx) => {
              const nextClip = (track.clips || [])[clipIdx + 1];
              if (!nextClip) return null;
              const junction = clip.startOffset + clip.duration;
              const left = timelineDuration > 0 ? Math.max(0, (junction / timelineDuration) * 100 - 0.5) : 0;
              const w = 1.5;
              const isPopup = transitionPopup?.clipId === clip.id && transitionPopup?.trackId === track.id;
              return (
                <div
                  key={`gap-${clip.id}`}
                  className={`absolute h-[calc(100%-4px)] top-0.5 flex items-center justify-center cursor-pointer z-10 ${isPopup ? 'bg-rose-600/60' : 'bg-stone-600/40 hover:bg-rose-500/40'}`}
                  style={{ left: `${left}%`, width: `${w}%`, minWidth: 8 }}
                  onClick={(e) => { e.stopPropagation(); setTransitionPopup(isPopup ? null : { clipId: clip.id, trackId: track.id }); }}
                  title="Click to add transition"
                >
                  {(clip.transitionToNext || isPopup) && (
                    <span className="text-[8px] font-bold text-white truncate">{clip.transitionToNext || 'Cut'}</span>
                  )}
                  {isPopup && (
                    <div className="absolute left-0 top-full mt-1 z-50 flex flex-col bg-stone-800 border border-stone-600 rounded shadow-xl py-1 min-w-[100px]" onClick={e => e.stopPropagation()}>
                      {TRANSITION_OPTIONS.map(opt => (
                        <button key={opt.id || 'cut'} className="px-2 py-1 text-left text-xs hover:bg-stone-600" onClick={() => { setClipTransition?.(track.id, clip.id, opt.id); setTransitionPopup(null); }}>{opt.label}</button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div
              className="absolute top-0 bottom-0 w-1 -ml-0.5 bg-amber-400 pointer-events-none z-40 shadow-[0_0_8px_rgba(251,191,36,0.9)]"
              style={{ left: `${playheadPct}%` }}
              title="Playhead"
            />
          </div>
        </div>
      ))}
    </>
  );
}
