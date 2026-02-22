/**
 * Background probe for video/audio duration and dimensions.
 * Called on addAsset to populate meta for NLE.
 */

export function probeAsset(url, type) {
  if (type === 'video') return probeVideo(url);
  if (type === 'audio') return probeAudio(url);
  if (type === 'image') return probeImage(url);
  return Promise.resolve({});
}

function probeVideo(url) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.playsInline = true;
    v.onloadedmetadata = () => {
      const duration = Number.isFinite(v.duration) ? v.duration : 0;
      const width = v.videoWidth || 0;
      const height = v.videoHeight || 0;
      v.src = '';
      v.load();
      resolve({ duration, width, height });
    };
    v.onerror = () => resolve({ duration: 0, width: 0, height: 0 });
    v.src = url;
  });
}

function probeAudio(url) {
  return new Promise((resolve) => {
    const a = new Audio();
    a.onloadedmetadata = () => {
      const duration = Number.isFinite(a.duration) ? a.duration : 0;
      a.src = '';
      resolve({ duration });
    };
    a.onerror = () => resolve({ duration: 0 });
    a.src = url;
  });
}

function probeImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth || 0, height: img.naturalHeight || 0 });
    };
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = url;
  });
}
