/**
 * useEditor - processVideo, processImage, play/pause wired to canvas render loop, cleanup.
 */

import { useCallback, useRef, useEffect } from 'react';
import { trimVideo, applyImageFilters } from '../services/MediaEngine';
import { useEditorStore } from '../stores/editorStore';

const revokedUrls = new Set();

export function useEditor() {
  const urlsCreated = useRef([]);

  const revoke = useCallback((url) => {
    if (url && !revokedUrls.has(url)) {
      try { URL.revokeObjectURL(url); } catch (_) {}
      revokedUrls.add(url);
    }
  }, []);

  const cleanup = useCallback(() => {
    urlsCreated.current.forEach(revoke);
    urlsCreated.current = [];
  }, [revoke]);

  useEffect(() => () => cleanup(), [cleanup]);

  const createAndTrack = useCallback((blob) => {
    const url = URL.createObjectURL(blob);
    urlsCreated.current.push(url);
    return url;
  }, []);

  const processVideo = useCallback(async (id, startTime, endTime) => {
    const asset = useEditorStore.getState().assets.find(a => a.id === id);
    if (!asset || asset.type !== 'video') throw new Error('Video asset not found');
    const blob = await trimVideo(asset.url ?? asset.file, startTime, endTime);
    const url = createAndTrack(blob);
    return { blob, url };
  }, [createAndTrack]);

  const processImage = useCallback(async (id, filters = {}) => {
    const asset = useEditorStore.getState().assets.find(a => a.id === id);
    if (!asset || asset.type !== 'image') throw new Error('Image asset not found');
    const blob = await applyImageFilters(asset.url ?? asset.file, filters);
    const url = createAndTrack(blob);
    return { blob, url };
  }, [createAndTrack]);

  const togglePlayPause = useCallback(() => {
    const state = useEditorStore.getState();
    useEditorStore.setState({ playing: !state.playing });
    return !state.playing;
  }, []);

  const setPlaying = useCallback((v) => {
    useEditorStore.setState({ playing: v });
  }, []);

  return {
    processVideo,
    processImage,
    revoke,
    cleanup,
    togglePlayPause,
    setPlaying,
  };
}
