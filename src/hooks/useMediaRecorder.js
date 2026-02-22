import { useState, useCallback, useRef } from 'react';
import { useEditorStore } from '../stores/editorStore';

export function useMediaRecorder(opts) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const mrRef = useRef(null);
  const streamRef = useRef(null);
  const addAsset = useEditorStore((s) => s.addAsset);
  const setSelectedVideoId = useEditorStore((s) => s.setSelectedVideoId);
  const setSelectedAudioId = useEditorStore((s) => s.setSelectedAudioId);

  const start = useCallback(async (video = true, audio = true) => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: video ? { facingMode: 'user' } : false,
        audio: audio ? {} : false,
      });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2500000 });
      const chunks = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunks, { type: mime });
        const file = new File([blob], 'recording-' + Date.now() + '.webm', { type: blob.type });
        const id = addAsset(file, video ? 'video' : 'audio');
        if (id) video ? setSelectedVideoId(id) : setSelectedAudioId(id);
        opts?.onStop?.(blob, id);
      };
      rec.start(250);
      mrRef.current = rec;
      setIsRecording(true);
      opts?.onStart?.();
    } catch (err) {
      setError(err.message || 'Camera/mic access denied');
      opts?.onError?.(err);
    }
  }, [addAsset, setSelectedVideoId, setSelectedAudioId, opts]);

  const stop = useCallback(() => {
    if (mrRef.current?.state !== 'inactive') {
      mrRef.current.stop();
      mrRef.current = null;
    }
    setIsRecording(false);
  }, []);

  return { isRecording, error, start, stop };
}
