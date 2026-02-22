/**
 * MediaEngine - handles video trimming (FFmpeg.wasm) and photo filters (Canvas API).
 * Data flow: asset → process → blob → URL.createObjectURL (caller manages cleanup).
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpegInstance = null;
let loadPromise = null;

async function getFFmpeg() {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const ffmpeg = new FFmpeg();
    await ffmpeg.load();
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();
  return loadPromise;
}

/**
 * Trim video to [startTime, endTime]. Returns blob.
 * @param {Blob|string} input - Video blob or object URL
 * @param {number} startTime - Start in seconds
 * @param {number} endTime - End in seconds
 * @returns {Promise<Blob>}
 */
export async function trimVideo(input, startTime, endTime) {
  const ffmpeg = await getFFmpeg();
  const data = typeof input === 'string' 
    ? await fetch(input).then(r => r.arrayBuffer()) 
    : await input.arrayBuffer();
  
  await ffmpeg.writeFile('input.mp4', new Uint8Array(data));
  const ss = formatFFmpegTime(startTime);
  const t = endTime - startTime;
  await ffmpeg.exec(['-i', 'input.mp4', '-ss', ss, '-t', String(t), '-c', 'copy', 'output.mp4']);
  const out = await ffmpeg.readFile('output.mp4');
  await ffmpeg.deleteFile('input.mp4');
  await ffmpeg.deleteFile('output.mp4');
  return new Blob([out], { type: 'video/mp4' });
}

function formatFFmpegTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${s.toFixed(2)}`;
}

const CINEMATIC_GRADE = { brightness: 95, contrast: 115, saturation: 90 };
const AI_UPSCALE_PRESET = { brightness: 102, contrast: 108, saturation: 105 };

/**
 * Apply filters to an image. Returns blob.
 * @param {Blob|string} input - Image blob or object URL
 * @param {{ brightness?: number, contrast?: number, saturation?: number, cinematicGrade?: boolean, aiUpscale?: boolean }} filters - 0-200 typical
 * @returns {Promise<Blob>}
 */
export async function applyImageFilters(input, filters = {}) {
  const img = await loadImage(input);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2d not available');

  let { brightness = 100, contrast = 100, saturation = 100, cinematicGrade, aiUpscale } = filters;
  if (cinematicGrade) { brightness = CINEMATIC_GRADE.brightness; contrast = CINEMATIC_GRADE.contrast; saturation = CINEMATIC_GRADE.saturation; }
  if (aiUpscale) { brightness = AI_UPSCALE_PRESET.brightness; contrast = AI_UPSCALE_PRESET.contrast; saturation = AI_UPSCALE_PRESET.saturation; }
  ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
  ctx.drawImage(img, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob failed'));
    }, 'image/png', 0.95);
  });
}

function loadImage(input) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let tempUrl = null;
    img.onload = () => {
      if (tempUrl) URL.revokeObjectURL(tempUrl);
      resolve(img);
    };
    img.onerror = () => {
      if (tempUrl) URL.revokeObjectURL(tempUrl);
      reject(new Error('Image load failed'));
    };
    img.src = typeof input === 'string' ? input : (tempUrl = URL.createObjectURL(input));
  });
}
