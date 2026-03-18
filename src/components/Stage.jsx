/**
 * NLE Stage - Canvas composition renderer.
 * Renders active clips at playhead time. Driven by requestAnimationFrame when playing.
 * Supports Social Export presets: 9:16 (TikTok/Reels), 1:1 (Instagram), 16:9 (YouTube/Podcast).
 * Supports canvas-blended transitions: crossfade, fade, dip-black, dip-white, zoom-in, zoom-out, slide, wipe.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { useEditorStore, selectClipsAtPlayhead } from '../stores/editorStore';

export const EXPORT_PRESETS = {
  '9:16': { w: 1080, h: 1920, label: 'Reels / Shorts' },
  '1:1': { w: 1080, h: 1080, label: 'Feed' },
  '16:9': { w: 1920, h: 1080, label: 'YouTube / Podcast' }
};

export function derivePresetFromPlatforms(platforms = {}) {
  if (platforms.tiktok || platforms.instagram) return '9:16';
  if (platforms.youtube || platforms.facebook) return '16:9';
  return '1:1';
}

// How long (in seconds) each transition lasts
const TRANSITION_DURATION = 0.45;

// PiP positions: topLeft, topRight, bottomLeft, bottomRight; size 0.2–0.5
function getPiPRect(outW, outH, pip = { position: 'bottomRight', size: 0.3 }) {
  const s = Math.min(1, Math.max(0.15, pip.size ?? 0.3));
  const w = outW * s;
  const h = outH * s;
  const pad = 12;
  const pos = pip.position || 'bottomRight';
  let x = 0, y = 0;
  if (pos === 'topLeft') { x = pad; y = pad; }
  else if (pos === 'topRight') { x = outW - w - pad; y = pad; }
  else if (pos === 'bottomLeft') { x = pad; y = outH - h - pad; }
  else { x = outW - w - pad; y = outH - h - pad; }
  return { x, y, w, h };
}

// Ease in-out for smooth transitions
function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

export function Stage({ aspectPreset = '16:9', platforms, className = '', videoRef: externalVideoRef, selectedVideo, onPlayheadUpdate, qrCodeDataUrl, transitionSegments }) {
  const canvasRef = useRef(null);
  const videoElRef = useRef(null);
  const overlayVideosRef = useRef(new Map());
  const mainVideosRef = useRef(new Map());
  const rafRef = useRef(null);
  const imageCacheRef = useRef(new Map());
  const qrCacheRef = useRef({ url: '', img: null });
  // Secondary video element for transition B-frame (seamless cuts)
  const transVideoRef = useRef(null);

  const playhead = useEditorStore(s => s.playhead);
  const playing = useEditorStore(s => s.playing);
  const setPlayhead = useEditorStore(s => s.setPlayhead);
  const duration = useEditorStore(s => s.duration);
  const assets = useEditorStore(s => s.assets);
  const timelineTracks = useEditorStore(s => s.timelineTracks);

  const preset = EXPORT_PRESETS[aspectPreset] || EXPORT_PRESETS['16:9'];
  const aspect = preset.w / preset.h;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.floor(rect.width * dpr);
    const h = Math.floor(rect.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }

    const outW = rect.width;
    const outH = rect.height;
    ctx.fillStyle = '#0c0a09';
    ctx.fillRect(0, 0, outW, outH);

    const state = useEditorStore.getState();
    const currentPlayhead = state.playhead;
    const clips = selectClipsAtPlayhead(state);
    const mainClips = clips.filter(c => c.trackType === 'video' && !c.isOverlayTrack);
    const overlayClips = clips.filter(c => c.trackType === 'video' && c.isOverlayTrack);
    const imageClips = clips.filter(c => c.trackType === 'image');

    const drawVideoFrame = (asset, sourceTime, clip, forOverlay = false) => {
      if (!asset?.url) return;
      let v;
      if (forOverlay) {
        v = overlayVideosRef.current.get(asset.id);
        if (!v || v.src !== asset.url) {
          v = document.createElement('video');
          v.src = asset.url;
          v.muted = true;
          v.playsInline = true;
          v.preload = 'auto';
          overlayVideosRef.current.set(asset.id, v);
        }
      } else {
        const extV = externalVideoRef?.current;
        if (extV?.tagName === 'VIDEO' && extV.src === asset.url) {
          v = extV;
        } else {
          v = mainVideosRef.current.get(asset.id);
          if (!v || v.src !== asset.url) {
            v = document.createElement('video');
            v.src = asset.url;
            v.muted = true;
            v.playsInline = true;
            v.preload = 'auto';
            mainVideosRef.current.set(asset.id, v);
          }
        }
      }
      if (v?.tagName === 'VIDEO') {
        if (Math.abs(v.currentTime - sourceTime) > 0.15) v.currentTime = sourceTime;
        if (playing && v.paused) v.play().catch(() => {});
        if (!playing && !v.paused) v.pause();
        const vw = v.videoWidth || 1920;
        const vh = v.videoHeight || 1080;
        const vAsp = vw / vh;
        const alpha = clip?.opacity ?? 1;
        ctx.save();
        if (alpha < 1) ctx.globalAlpha = alpha;
        if (forOverlay) {
          const pip = clip?.pip ?? { position: 'bottomRight', size: 0.3 };
          const { x, y, w, h } = getPiPRect(outW, outH, pip);
          const outAsp = w / h;
          let sx = 0, sy = 0, sW = vw, sH = vh;
          if (vAsp > outAsp) { sW = vh * outAsp; sx = (vw - sW) / 2; }
          else { sH = vw / outAsp; sy = (vh - sH) / 2; }
          try { ctx.drawImage(v, sx, sy, sW, sH, x, y, w, h); } catch (_) {}
        } else {
          const outAsp = outW / outH;
          let dX = 0, dY = 0, dW = outW, dH = outH;
          if (vAsp > outAsp) { dW = outH * vAsp; dH = outH; dX = (outW - dW) / 2; }
          else { dW = outW; dH = outW / vAsp; dY = (outH - dH) / 2; }
          try { ctx.drawImage(v, 0, 0, vw, vh, dX, dY, dW, dH); } catch (_) {}
        }
        ctx.restore();
      }
    };

    // Draw a video element at specific time to canvas region, with optional transform
    const drawVideoAt = (v, outW, outH, alpha, transform) => {
      if (!v || v.tagName !== 'VIDEO') return;
      const vw = v.videoWidth || 1920;
      const vh = v.videoHeight || 1080;
      const vAsp = vw / vh;
      const outAsp = outW / outH;
      let dX = 0, dY = 0, dW = outW, dH = outH;
      if (vAsp > outAsp) { dW = outH * vAsp; dH = outH; dX = (outW - dW) / 2; }
      else { dW = outW; dH = outW / vAsp; dY = (outH - dH) / 2; }
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      if (transform) transform(ctx, outW, outH, dX, dY, dW, dH);
      try { ctx.drawImage(v, 0, 0, vw, vh, dX, dY, dW, dH); } catch (_) {}
      ctx.restore();
    };

    const drawImageFrame = (asset, clip) => {
      if (!asset?.url) return;
      const cached = imageCacheRef.current.get(asset.url);
      if (cached && cached.complete) {
        const alpha = clip?.opacity ?? 1;
        ctx.save();
        if (alpha < 1) ctx.globalAlpha = alpha;
        const layout = clip?.overlayLayout || 'watermark';
        const iAsp = cached.naturalWidth / cached.naturalHeight;
        if (layout === 'watermark') {
          const size = Math.min(outW, outH) * 0.15;
          const pad = 12;
          ctx.drawImage(cached, outW - size - pad, pad, size, size);
        } else if (layout === 'lowerThird') {
          const h = outH * 0.2;
          const w = outW * 0.35;
          ctx.drawImage(cached, 0, outH - h, w, h);
        } else {
          const outAsp = outW / outH;
          let dx = 0, dy = 0, dW = outW, dH = outH;
          if (iAsp > outAsp) { dW = outH * iAsp; dx = (outW - dW) / 2; }
          else { dH = outW / iAsp; dy = (outH - dH) / 2; }
          ctx.drawImage(cached, dx, dy, dW, dH);
        }
        ctx.restore();
      } else {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => { imageCacheRef.current.set(asset.url, img); };
        img.src = asset.url;
      }
    };

    const hasNewTracks = timelineTracks?.length > 0 && timelineTracks.some(t => (t.clips || []).length > 0);
    if (hasNewTracks && (mainClips.length > 0 || overlayClips.length > 0 || imageClips.length > 0)) {
      const sourceTime = (clip) => (currentPlayhead - clip.startOffset) + (clip.trimStart ?? 0);
      mainClips.forEach(clip => {
        const asset = assets.find(a => a.id === clip.assetId);
        if (asset?.type === 'video') drawVideoFrame(asset, sourceTime(clip), clip, false);
      });
      overlayClips.forEach(clip => {
        const asset = assets.find(a => a.id === clip.assetId);
        if (asset?.type === 'video') drawVideoFrame(asset, sourceTime(clip), clip, true);
      });
      if (mainClips.length === 0 && overlayClips.length > 0) {
        const clip = overlayClips[0];
        const asset = assets.find(a => a.id === clip.assetId);
        if (asset?.type === 'video') drawVideoFrame(asset, sourceTime(clip), { ...clip, pip: null }, false);
      }
      imageClips.forEach(clip => {
        const asset = assets.find(a => a.id === clip.assetId);
        if (asset?.type === 'image') drawImageFrame(asset, clip);
      });
    } else if (selectedVideo?.url && externalVideoRef?.current) {
      const v = externalVideoRef.current;
      const vw = v.videoWidth || 1920;
      const vh = v.videoHeight || 1080;
      const vAsp = vw / vh;
      const outAsp = outW / outH;
      let dX = 0, dY = 0, dW = outW, dH = outH;
      if (vAsp > outAsp) { dW = outH * vAsp; dH = outH; dX = (outW - dW) / 2; }
      else { dW = outW; dH = outW / vAsp; dY = (outH - dH) / 2; }

      // Detect transition zone using segment info
      const segs = transitionSegments;
      let txActive = false;
      if (segs && segs.length > 1) {
        for (let i = 0; i < segs.length - 1; i++) {
          const curr = segs[i];
          const next = segs[i + 1];
          const txType = curr.seg.transition || 'cut';
          if (txType === 'cut') continue; // hard cut, no blend needed
          const txDur = TRANSITION_DURATION;
          const txStart = curr.tlEnd - txDur;
          const txEnd = curr.tlEnd;

          if (currentPlayhead >= txStart && currentPlayhead <= txEnd + 0.05) {
            txActive = true;
            const rawT = (currentPlayhead - txStart) / (txEnd - txStart || 0.001);
            const t = Math.max(0, Math.min(1, rawT));
            const eased = easeInOut(t);

            // "A" frame = current video (already positioned)
            const sourceA = curr.seg.start + (currentPlayhead - curr.tlStart);
            if (Math.abs(v.currentTime - sourceA) > 0.15) v.currentTime = sourceA;
            if (playing && v.paused) v.play().catch(() => {});
            if (!playing && !v.paused) v.pause();

            // "B" frame = next segment start + how far into transition
            const sourceB = next.seg.start + (currentPlayhead - next.tlStart);
            let transV = transVideoRef.current;
            if (!transV) {
              transV = document.createElement('video');
              transV.muted = true;
              transV.playsInline = true;
              transV.preload = 'auto';
              transVideoRef.current = transV;
            }
            if (transV.src !== selectedVideo.url) {
              transV.src = selectedVideo.url;
            }
            if (Math.abs(transV.currentTime - sourceB) > 0.2) transV.currentTime = sourceB;

            // Render transition based on type
            if (txType === 'cross') {
              // Crossfade: A fades out, B fades in simultaneously
              drawVideoAt(v, outW, outH, 1 - eased, null);
              drawVideoAt(transV, outW, outH, eased, null);
            } else if (txType === 'fade') {
              // Fade to black then in
              const half = 0.5;
              if (eased < half) {
                // Fade A to black
                drawVideoAt(v, outW, outH, 1 - eased / half, null);
              } else {
                // Fade B from black
                drawVideoAt(transV, outW, outH, (eased - half) / half, null);
              }
            } else if (txType === 'dip-black') {
              const half = 0.5;
              if (eased < half) {
                drawVideoAt(v, outW, outH, 1 - eased / half, null);
              } else {
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, outW, outH);
                drawVideoAt(transV, outW, outH, (eased - half) / half, null);
              }
            } else if (txType === 'dip-white') {
              const half = 0.5;
              if (eased < half) {
                drawVideoAt(v, outW, outH, 1 - eased / half, null);
                ctx.fillStyle = `rgba(255,255,255,${eased / half})`;
                ctx.fillRect(0, 0, outW, outH);
              } else {
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, outW, outH);
                drawVideoAt(transV, outW, outH, (eased - half) / half, null);
              }
            } else if (txType === 'blur') {
              // Simulate blur with opacity + scale
              const peak = eased < 0.5 ? eased * 2 : (1 - eased) * 2;
              drawVideoAt(v, outW, outH, 1 - eased, (ctx2, w2, h2, dx2, dy2, dw2, dh2) => {
                const s = 1 + peak * 0.04;
                ctx2.translate(w2 / 2, h2 / 2);
                ctx2.scale(s, s);
                ctx2.translate(-w2 / 2, -h2 / 2);
              });
              drawVideoAt(transV, outW, outH, eased, (ctx2, w2, h2, dx2, dy2, dw2, dh2) => {
                const s = 1 + (1 - eased) * 0.04;
                ctx2.translate(w2 / 2, h2 / 2);
                ctx2.scale(s, s);
                ctx2.translate(-w2 / 2, -h2 / 2);
              });
            } else if (txType === 'zoom-in') {
              // A scales up and fades, B appears at normal size
              drawVideoAt(v, outW, outH, 1 - eased, (ctx2, w2, h2) => {
                const s = 1 + eased * 0.15;
                ctx2.translate(w2 / 2, h2 / 2);
                ctx2.scale(s, s);
                ctx2.translate(-w2 / 2, -h2 / 2);
              });
              drawVideoAt(transV, outW, outH, eased, null);
            } else if (txType === 'zoom-out') {
              // A normal, B scales from large
              drawVideoAt(v, outW, outH, 1 - eased, null);
              drawVideoAt(transV, outW, outH, eased, (ctx2, w2, h2) => {
                const s = 1.15 - eased * 0.15;
                ctx2.translate(w2 / 2, h2 / 2);
                ctx2.scale(s, s);
                ctx2.translate(-w2 / 2, -h2 / 2);
              });
            } else if (txType === 'slide-l') {
              // A slides left out, B slides from right
              drawVideoAt(v, outW, outH, 1, (ctx2, w2) => {
                ctx2.translate(-w2 * eased, 0);
              });
              drawVideoAt(transV, outW, outH, 1, (ctx2, w2) => {
                ctx2.translate(w2 * (1 - eased), 0);
              });
            } else if (txType === 'slide-r') {
              // A slides right out, B slides from left
              drawVideoAt(v, outW, outH, 1, (ctx2, w2) => {
                ctx2.translate(w2 * eased, 0);
              });
              drawVideoAt(transV, outW, outH, 1, (ctx2, w2) => {
                ctx2.translate(-w2 * (1 - eased), 0);
              });
            } else if (txType === 'wipe') {
              // Wipe from left: reveal B under A
              drawVideoAt(transV, outW, outH, 1, null);
              ctx.save();
              ctx.beginPath();
              ctx.rect(outW * eased, 0, outW * (1 - eased), outH);
              ctx.clip();
              drawVideoAt(v, outW, outH, 1, null);
              ctx.restore();
            } else {
              // Fallback: crossfade
              drawVideoAt(v, outW, outH, 1 - eased, null);
              drawVideoAt(transV, outW, outH, eased, null);
            }
            break;
          }
        }
      }

      if (!txActive) {
        // Normal playback: single video frame
        const sourceTime = typeof onPlayheadUpdate === 'function' ? onPlayheadUpdate() : currentPlayhead;
        if (Math.abs(v.currentTime - sourceTime) > 0.15) v.currentTime = sourceTime;
        if (playing && v.paused) v.play().catch(() => {});
        if (!playing && !v.paused) v.pause();
        try { ctx.drawImage(v, 0, 0, vw, vh, dX, dY, dW, dH); } catch (_) {}
      }
    }

    if (qrCodeDataUrl) {
      const cache = qrCacheRef.current;
      if (cache.url !== qrCodeDataUrl) {
        cache.url = qrCodeDataUrl;
        cache.img = null;
        const img = new Image();
        img.onload = () => { cache.img = img; };
        img.src = qrCodeDataUrl;
      }
      const qrImg = cache.img;
      if (qrImg && qrImg.complete && qrImg.naturalWidth) {
        const qrSize = Math.min(outW, outH) * 0.2;
        const pad = 16;
        ctx.drawImage(qrImg, outW - qrSize - pad, outH - qrSize - pad, qrSize, qrSize);
      }
    }
  }, [playing, assets, timelineTracks, selectedVideo, externalVideoRef, onPlayheadUpdate, qrCodeDataUrl, transitionSegments]);

  useEffect(() => {
    let last = 0;
    const loop = (ts) => {
      rafRef.current = requestAnimationFrame(loop);
      const state = useEditorStore.getState();
      if (state.playing) {
        const dt = last > 0 ? (ts - last) / 1000 : 0;
        last = ts;
        const next = Math.min(state.playhead + dt, state.duration);
        useEditorStore.getState().setPlayhead(next);
        if (next >= state.duration) useEditorStore.getState().setPlaying(false);
      } else last = 0;
      draw();
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [draw]);

  return (
    <div className={`relative bg-stone-950 overflow-hidden w-full h-full flex items-center justify-center ${className}`}>
      <canvas ref={canvasRef} className="w-full h-full" style={{ display: 'block' }} />
    </div>
  );
}
