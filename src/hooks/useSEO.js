/**
 * useSEO - Hook Analyzer for Marketing Intelligence.
 * Scans caption + tags. If the first 3 seconds (Hook) lack high-traffic keywords, triggers Growth Tip.
 */

import { useMemo } from 'react';

const HOOK_KEYWORDS = ['faith', 'stewardship', 'transformation', 'blessed', 'prayer', 'ministry', 'god', 'jesus', 'hope', 'grace'];

// ~3 seconds of speech ≈ 40–60 chars at normal pace. Use first 80 chars as "hook" text.
const HOOK_CHARS = 80;

function getHookText(caption, tags) {
  const captionStart = (caption || '').slice(0, HOOK_CHARS).toLowerCase();
  const tagStr = (tags || []).map((t) => `#${String(t).replace(/^#/, '')}`).join(' ').toLowerCase();
  return `${captionStart} ${tagStr}`.trim();
}

function hasHookKeyword(hookText) {
  if (!hookText) return false;
  const lower = hookText.toLowerCase();
  return HOOK_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * @param {{ caption: string, tags: string[] }} options
 * @returns {{ showGrowthTip: boolean, tip: string, hookText: string }}
 */
export function useSEO({ caption = '', tags = [] }) {
  return useMemo(() => {
    const hookText = getHookText(caption, tags);
    const hasKeyword = hasHookKeyword(hookText);

    if (!caption?.trim() && (!tags || tags.length === 0)) {
      return { showGrowthTip: false, tip: '', hookText };
    }

    if (hasKeyword) {
      return { showGrowthTip: false, tip: '', hookText };
    }

    return {
      showGrowthTip: true,
      tip: "Growth Tip: Add a high-traffic keyword like 'Faith', 'Stewardship', or 'Transformation' in your first 3 seconds (caption or tags) to improve reach.",
      hookText,
    };
  }, [caption, tags]);
}
