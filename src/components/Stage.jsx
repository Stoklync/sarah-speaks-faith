/**
 * NLE Stage - Canvas composition renderer.
 * Renders active clips at playhead time. Driven by requestAnimationFrame when playing.
 * Supports Social Export presets: 9:16 (TikTok/Reels), 1:1 (Instagram), 16:9 (YouTube/Podcast).
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

export function Stage({ aspectPreset = '16:9', platforms, className = '', videoRef: externalVideoRef, selectedVideo, onPlayheadUpdate, qrCodeDataUrl }) {
  const canvasRef = useRef(null);
  const videoElRef = useRef(null);
  const overlayVideosRef = useRef(new Map());
  const mainVideosRef = useRef(new Map());
  const rafRef = useRef(null);
  const imageCacheRef = useRef(new Map());
  const qrCacheRef = useRef({ url: '', img: null });

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
          // PREVIEW: show full video (contain) — no cropping, letterbox if needed so you see everything
          const outAsp = outW / outH;
          let dX = 0, dY = 0, dW = outW, dH = outH;
          if (vAsp > outAsp) { dW = outH * vAsp; dH = outH; dX = (outW - dW) / 2; }
          else { dW = outW; dH = outW / vAsp; dY = (outH - dH) / 2; }
          try { ctx.drawImage(v, 0, 0, vw, vh, dX, dY, dW, dH); } catch (_) {}
        }
        ctx.restore();
      }
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
          const x = 0;
          const y = outH - h;
          ctx.drawImage(cached, x, y, w, h);
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
      const sourceTime = typeof onPlayheadUpdate === 'function' ? onPlayheadUpdate() : currentPlayhead;
      if (Math.abs(v.currentTime - sourceTime) > 0.15) v.currentTime = sourceTime;
      if (playing && v.paused) v.play().catch(() => {});
      if (!playing && !v.paused) v.pause();
      const vw = v.videoWidth || 1920;
      const vh = v.videoHeight || 1080;
      const vAsp = vw / vh;
      const outAsp = outW / outH;
      let dX = 0, dY = 0, dW = outW, dH = outH;
      if (vAsp > outAsp) { dW = outH * vAsp; dH = outH; dX = (outW - dW) / 2; }
      else { dW = outW; dH = outW / vAsp; dY = (outH - dH) / 2; }
      try { ctx.drawImage(v, 0, 0, vw, vh, dX, dY, dW, dH); } catch (_) {}
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
  }, [playing, assets, timelineTracks, selectedVideo, externalVideoRef, onPlayheadUpdate, qrCodeDataUrl]);

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
    <div className={`relative bg-stone-950 overflow-hidden flex items-center justify-center ${className}`} style={{ aspectRatio: aspect }}>
      <canvas ref={canvasRef} className="w-full h-full object-contain" style={{ maxWidth: '100%', maxHeight: '100%' }} />
    </div>
  );
}
