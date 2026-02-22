/**
 * useEditorSync - Frame-by-frame playhead sync for tactile scrubbing.
 * The Stage reads playhead from getState() inside its RAF loop to avoid
 * stale closures from React batching. This hook initializes sync behavior.
 */
export function useEditorSync() {
  return {};
}
