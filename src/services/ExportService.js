/**
 * ExportService - High-Res Export Workflow
 * 1. exportComposition() - Renders timeline to 1080x1920 or 1920x1080 canvas -> WebM
 * 2. FFmpeg encodes to MP4 (libx264) with metadata
 * 3. saveToDevice() - Mobile-friendly download (Save to Photos prompt on iOS/Android)
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';

let ffmpegInstance = null;
let ffmpegLoadPromise = null;

async function getFFmpeg() {
  if (ffmpegInstance) return ffmpegInstance;
  if (ffmpegLoadPromise) return ffmpegLoadPromise;
  ffmpegLoadPromise = (async () => {
    const ffmpeg = new FFmpeg();
    await ffmpeg.load();
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();
  return ffmpegLoadPromise;
}

const SIZE_PRESETS = {
  '9:16': { w: 1080, h: 1920 },
  '16:9': { w: 1920, h: 1080 },
  '1:1': { w: 1080, h: 1080 },
  '4:5': { w: 1080, h: 1350 },
};

const TEXT_STYLE = {
  sizeMap: { sm: 24, md: 36, lg: 56 },
  fontMap: { sans: 'Inter, sans-serif', serif: '"Playfair Display", Georgia, serif', mono: 'monospace', display: 'sans-serif' },
  colorMap: { white: '#fff', black: '#000', yellow: '#fef08a', rose: '#fda4af', cyan: '#67e8f9', lime: '#bef264', orange: '#fb923c', gold: '#fbbf24', amber: '#fbbf24', indigo: '#a5b4fc' },
};

/**
 * Renders a single frame to the canvas context.
 */
function drawFrame(ctx, outW, outH, frameState) {
  const { video, vw, vh, sourceTime, textClips, qrImg, timelineToSource } = frameState;
  ctx.fillStyle = '#0c0a09';
  ctx.fillRect(0, 0, outW, outH);

  const inSegment = frameState.inSegment !== false;
  if (video && inSegment && sourceTime != null && sourceTime >= 0) {
    const vAsp = vw / vh;
    const outAsp = outW / outH;
    let sx = 0, sy = 0, sW = vw, sH = vh;
    if (vAsp > outAsp) {
      sW = vh * outAsp;
      sx = (vw - sW) / 2;
    } else {
      sH = vw / outAsp;
      sy = (vh - sH) / 2;
    }
    try {
      ctx.drawImage(video, sx, sy, sW, sH, 0, 0, outW, outH);
    } catch (_) {}
  }

  const scale = Math.min(outW, outH) / 1080;
  (textClips || []).forEach((c) => {
    const start = c.start ?? 0;
    const end = c.end ?? start + 5;
    const srcT = frameState.sourceTime ?? 0;
    if (!c.text || srcT < start || srcT >= end) return;
    ctx.fillStyle = (c.color && String(c.color).startsWith('#')) ? c.color : (TEXT_STYLE.colorMap[c.color] || '#fff');
    ctx.font = `${c.bold ? 'bold' : ''} ${Math.round((TEXT_STYLE.sizeMap[c.size] || 36) * scale)}px ${TEXT_STYLE.fontMap[c.font] || 'sans-serif'}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const x = ((c.x ?? 50) / 100) * outW;
    const y = ((c.y ?? 50) / 100) * outH;
    ctx.fillText(c.text, x, y);
  });

  if (qrImg && qrImg.complete) {
    const qrSize = Math.min(outW, outH) * 0.2;
    const pad = 16;
    ctx.drawImage(qrImg, outW - qrSize - pad, outH - qrSize - pad, qrSize, qrSize);
  }
}

/**
 * Renders the current timeline composition to a WebM blob.
 * @param {Object} options
 * @param {string} options.videoUrl - Source video URL
 * @param {Array} options.mainSegments - Main timeline segments
 * @param {Array} options.textClips - Text overlay clips
 * @param {number} options.duration - Source video duration
 * @param {Function} options.getMainTimelineRanges - (segs) => [{ seg, tlStart, tlEnd }]
 * @param {Function} options.timelineToSource - (t) => sourceTime
 * @param {string} [options.qrCodeDataUrl] - QR code data URL
 * @param {string} [options.exportFormat] - '9:16' | '16:9' | '1:1' | '4:5'
 * @param {number} [options.fps] - Frame rate (default 30)
 * @param {Function} [options.onProgress] - (pct) => {}
 */
export async function exportComposition(options) {
  const {
    videoUrl,
    mainSegments = [],
    textClips = [],
    duration = 90,
    getMainTimelineRanges,
    timelineToSource,
    qrCodeDataUrl,
    exportFormat = '9:16',
    fps = 30,
    onProgress,
  } = options;

  const preset = SIZE_PRESETS[exportFormat] || SIZE_PRESETS['9:16'];
  const outW = preset.w;
  const outH = preset.h;

  const ranges = getMainTimelineRanges ? getMainTimelineRanges(mainSegments) : [];
  const timelineDuration = ranges.reduce((s, r) => s + (r.tlEnd - r.tlStart), 0) || duration;
  const getMainSegmentAt = (t) => {
    const r = ranges.find((rr) => t >= rr.tlStart - 0.001 && t < rr.tlEnd + 0.001);
    return r?.seg ?? null;
  };

  const video = document.createElement('video');
  video.src = videoUrl;
  video.muted = false;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  await new Promise((res, rej) => {
    video.onloadedmetadata = res;
    video.onerror = rej;
  });
  const vw = video.videoWidth || 1920;
  const vh = video.videoHeight || 1080;

  let qrImg = null;
  if (qrCodeDataUrl) {
    qrImg = new Image();
    await new Promise((res, rej) => {
      qrImg.onload = res;
      qrImg.onerror = rej;
      qrImg.src = qrCodeDataUrl;
    });
  }

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');

  const stream = canvas.captureStream(fps);
  const videoTrack = stream.getVideoTracks()[0];
  if (videoTrack) {
    const settings = videoTrack.getSettings?.() || {};
    if (settings.width !== outW || settings.height !== outH) {
      stream.removeTrack(videoTrack);
      stream.addTrack(canvas.captureStream(fps).getVideoTracks()[0]);
    }
  }

  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioSource = audioCtx.createMediaElementSource(video);
    const dest = audioCtx.createMediaStreamDestination();
    audioSource.connect(dest);
    audioSource.connect(audioCtx.destination);
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  } catch (_) {}

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : MediaRecorder.isTypeSupported('video/webm')
      ? 'video/webm'
      : 'video/mp4';
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 5000000,
    audioBitsPerSecond: 128000,
  });

  const chunks = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  const blobPromise = new Promise((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  recorder.start(100);

  const frameInterval = 1 / fps;
  let timelineT = 0;
  const totalFrames = Math.ceil(timelineDuration * fps);

  await new Promise((r) => { video.onseeked = r; });
  video.currentTime = 0;

  let frameCount = 0;

  const driveFrame = () => {
    if (timelineT >= timelineDuration) {
      recorder.stop();
      return;
    }

    const sourceTime = timelineToSource ? timelineToSource(timelineT) : timelineT;
    const targetTime = Math.max(0, Math.min(sourceTime, duration - 0.02));

    video.onseeked = () => {
      const inSeg = !!getMainSegmentAt(timelineT);
      drawFrame(ctx, outW, outH, {
        video,
        vw,
        vh,
        sourceTime: targetTime,
        textClips,
        qrImg,
        inSegment: inSeg,
      });
      frameCount++;
      onProgress?.(Math.min(0.95, (frameCount / totalFrames) * 0.9));
      timelineT += frameInterval;
      requestAnimationFrame(driveFrame);
    };
    video.currentTime = targetTime;
  };

  driveFrame();

  const webmBlob = await blobPromise;
  onProgress?.(1);
  return webmBlob;
}

/**
 * Encodes WebM (or video blob) to MP4 using FFmpeg.wasm with libx264.
 * Injects SEO metadata (title, tags) for social algorithms.
 */
export async function encodeToMp4WithMetadata(videoBlob, metadata = {}) {
  const ffmpeg = await getFFmpeg();
  const data = await videoBlob.arrayBuffer();
  const isMp4 = videoBlob.type?.includes('mp4');
  const inputName = isMp4 ? 'input.mp4' : 'input.webm';
  await ffmpeg.writeFile(inputName, new Uint8Array(data));

  const title = (metadata.title || 'Sarah Speaks Faith').replace(/"/g, "'");
  let comment = (metadata.tags || []).length
    ? `Tags: ${(metadata.tags || []).join(', ')}`
    : 'Sarah Speaks Faith | Ministry | Stoklync';
  if (metadata.appendContactUrl && metadata.contactUrl) {
    comment += ` | ${String(metadata.contactUrl).trim()}`;
  }

  const metaArgs = ['-metadata', `title=${title}`, '-metadata', `comment=${comment}`, '-movflags', '+faststart', '-y', 'output.mp4'];

  if (isMp4) {
    try {
      await ffmpeg.exec(['-i', inputName, '-c', 'copy', ...metaArgs]);
    } catch (e) {
      try {
        await ffmpeg.exec(['-i', inputName, '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', ...metaArgs]);
      } catch (e2) {
        throw new Error('FFmpeg metadata injection failed.');
      }
    }
  } else {
    const args = [
      '-i', inputName,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      ...metaArgs,
    ];
    try {
      await ffmpeg.exec(args);
    } catch (e) {
      try {
        await ffmpeg.exec([
          '-i', inputName,
          '-c:v', 'mpeg4',
          '-q:v', '5',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-metadata', `title=${title}`,
          '-metadata', `comment=${comment}`,
          '-y',
          'output.mp4',
        ]);
      } catch (e2) {
        throw new Error('FFmpeg encoding failed. Try exporting without overlays.');
      }
    }
  }

  const out = await ffmpeg.readFile('output.mp4');
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile('output.mp4');

  return new Blob([out], { type: 'video/mp4' });
}

/**
 * Triggers download with mobile-friendly behavior.
 * - Desktop: <a download> + URL.createObjectURL
 * - Mobile: tries Web Share API first (Save to Photos on iOS), then fallback to download link
 */
export async function saveToDevice(blob, filename) {
  const file = new File([blob], filename, { type: blob.type });

  if (navigator.share && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
    try {
      await navigator.share({
        files: [file],
        title: filename.replace(/\.[^.]+$/, ''),
        text: 'Sarah Speaks Faith export',
      });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 500);
}
