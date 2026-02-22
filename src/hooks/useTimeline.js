/**
 * useTimeline - Core engine logic for multi-track workflow.
 * Add extra videos, stack Stoklync products over podcast, drag logos onto layers.
 */

import { useCallback } from 'react';
import { useEditorStore } from '../stores/editorStore';

export function useTimeline() {
  const timelineTracks = useEditorStore(s => s.timelineTracks);
  const updateTrack = useEditorStore(s => s.updateTrack);
  const playhead = useEditorStore(s => s.playhead);
  const setPlayhead = useEditorStore(s => s.setPlayhead);

  const addClipToTimeline = useCallback((asset, trackIndex = 0, offset = null) => {
    const newClip = {
      id: `clip-${Date.now()}`,
      assetId: asset.id,
      startTime: 0,
      offset: offset ?? playhead,
      duration: asset.duration || 5,
      layer: trackIndex
    };
    return updateTrack(trackIndex, newClip);
  }, [updateTrack, playhead]);

  return {
    tracks: timelineTracks,
    addClipToTimeline,
    updateTrack,
    playhead,
    setPlayhead
  };
}
