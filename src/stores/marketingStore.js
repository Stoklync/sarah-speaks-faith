/**
 * MarketingStore - SEO & Marketing Intelligence.
 * Tracks Hooks, Keywords; suggests SEO Titles and Hashtags from caption + businesses.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const HOOK_KEYWORDS = [
  'faith', 'blessed', 'prayer', 'ministry', 'stewardship', 'her stewardship',
  'stoklync', 'skin', 'product', 'god', 'jesus', 'grace', 'peace', 'hope',
  'family', 'grandkid', 'love', 'trust', 'believe', 'scripture', 'bible',
];

const CTA_PHRASES = [
  'link in bio', 'link in description', 'contact', 'sign up', 'join',
  'dm me', 'comment below', 'visit', 'check out', 'learn more',
  'her stewardship', 'prayer request', 'stewardship signup',
];

const HASHTAG_POOL = {
  faith: ['#faith', '#blessed', '#ministry', '#prayer', '#grace', '#hope', '#jesus', '#godisgood', '#faithbased'],
  stewardship: ['#herstewardship', '#stewardship', '#faithbasedbusiness', '#ministry'],
  stoklync: ['#stoklync', '#skincare', '#natural', '#faithbased', '#smallbusiness'],
  skin: ['#skincare', '#natural', '#beauty', '#faithbased'],
  default: ['#faith', '#blessed', '#ministry', '#reels', '#christian', '#inspiration'],
};

/** Smart Tag Bundles — one-click apply for Ministry vs Business content */
export const TAG_BUNDLES = {
  ministry: {
    id: 'ministry',
    label: 'Ministry Bundle',
    tags: ['FaithOverFear', 'SarahSpeaksFaith', 'PrayerRequest', 'Stewardship'],
  },
  business: {
    id: 'business',
    label: 'Business Bundle',
    tags: ['Stoklync', 'SmallBizGrowth', 'ProductLaunch', 'MarketingStrategy'],
  },
};

function extractKeywords(text) {
  if (!text || typeof text !== 'string') return [];
  const lower = text.toLowerCase();
  return HOOK_KEYWORDS.filter((kw) => lower.includes(kw));
}

function hasCta(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  return CTA_PHRASES.some((phrase) => lower.includes(phrase));
}

function suggestHashtags(caption, businessId, max = 8) {
  const kws = extractKeywords(caption);
  const set = new Set();
  (HASHTAG_POOL[businessId] || HASHTAG_POOL.default).forEach((h) => set.add(h));
  HASHTAG_POOL.faith.forEach((h) => set.add(h));
  kws.forEach((kw) => {
    const pool = HASHTAG_POOL[kw] || [];
    pool.slice(0, 2).forEach((h) => set.add(h));
  });
  return [...set].slice(0, max);
}

function suggestTitle(caption, businessName) {
  if (!caption?.trim()) return businessName ? `${businessName} | Sarah Speaks Faith` : 'Sarah Speaks Faith';
  const first = caption.split(/[.!?]/)[0]?.trim().slice(0, 60);
  if (first) return first + (first.length >= 55 ? '…' : '');
  return businessName ? `${businessName} | Sarah Speaks Faith` : 'Sarah Speaks Faith';
}

export const useMarketingStore = create(
  persist(
    (set, get) => ({
      hooks: [],
      keywords: [],
      addHook: (hook) => set((s) => ({ hooks: [...new Set([...s.hooks, hook])].slice(-20) })),
      addKeyword: (kw) => set((s) => ({ keywords: [...new Set([...s.keywords, kw])].slice(-50) })),
      removeHook: (hook) => set((s) => ({ hooks: s.hooks.filter((h) => h !== hook) })),
      removeKeyword: (kw) => set((s) => ({ keywords: s.keywords.filter((k) => k !== kw) })),

      generateAltText: (businessName, customKeywords = []) => {
        const biz = businessName || 'Sarah Speaks Faith';
        const kws = ['stewardship', 'faith', 'ministry', ...customKeywords].filter(Boolean);
        return `${biz} — ${kws.slice(0, 3).join(', ')}. Faith-based content for Google Images.`;
      },

      getSuggestions: (caption, businessId, businessName) => {
        const kws = extractKeywords(caption);
        const hasCtaResult = hasCta(caption);
        const title = suggestTitle(caption, businessName);
        const hashtags = suggestHashtags(caption, businessId);
        const hooks = [...new Set([...get().hooks, ...kws])].slice(-10);
        return {
          suggestedTitle: title,
          suggestedHashtags: hashtags,
          hasCta: hasCtaResult,
          extractedKeywords: kws,
          hooks,
        };
      },
    }),
    { name: 'sarah-marketing' }
  )
);
