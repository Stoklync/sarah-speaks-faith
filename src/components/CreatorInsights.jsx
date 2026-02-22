/**
 * CreatorInsights - Content Audit sidebar.
 * Analyzes Hook (first 3 sec), flags missing CTA for contact/product links.
 */

import React from 'react';
import { useMarketingStore } from '../stores/marketingStore';
import { AlertCircle, CheckCircle2, Target } from 'lucide-react';

export function CreatorInsights({ caption, hookTranscript, businessName, businessId, contactPageUrl, setContactPageUrl, marketingGoal, setMarketingGoal }) {
  const { getSuggestions } = useMarketingStore();
  const suggestions = caption ? getSuggestions(caption, businessId, businessName) : null;

  const hasCta = suggestions?.hasCta ?? false;
  const hookText = (hookTranscript || caption?.slice(0, 150) || '').trim();
  const hookHasSubstance = hookText.length > 20;
  const hasContactLink = !!contactPageUrl?.trim();

  return (
    <div className="space-y-4 p-4 bg-stone-800/60 rounded-xl border border-stone-700">
      <h4 className="font-bold text-stone-100 flex items-center gap-2">
        <Target size={16} className="text-rose-400" />
        Creator Insights
      </h4>

      {/* Hook (first 3 sec) */}
      <div>
        <p className="text-[10px] font-bold uppercase text-stone-400 mb-1">Hook (first 3 sec)</p>
        {hookHasSubstance ? (
          <div className="flex items-start gap-2 text-xs text-stone-300">
            <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
            <span>Hook has content. Consider a strong opener to retain viewers.</span>
          </div>
        ) : (
          <div className="flex items-start gap-2 text-xs text-amber-300">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>Add a compelling hook in the first 3 seconds to improve retention.</span>
          </div>
        )}
      </div>

      {/* CTA check */}
      <div>
        <p className="text-[10px] font-bold uppercase text-stone-400 mb-1">Call to Action</p>
        {hasCta ? (
          <div className="flex items-start gap-2 text-xs text-emerald-300">
            <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
            <span>Caption includes a CTA. Good for engagement.</span>
          </div>
        ) : (
          <div className="flex items-start gap-2 text-xs text-amber-300">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>Add a CTA: "link in bio", "contact page", "sign up", or "comment below".</span>
          </div>
        )}
      </div>

      {/* Marketing Goal & Contact Page */}
      <div>
        <p className="text-[10px] font-bold uppercase text-stone-400 mb-1">Marketing Goal</p>
        {setMarketingGoal ? (
          <select value={marketingGoal || ''} onChange={(e) => setMarketingGoal(e.target.value)} className="w-full text-xs bg-stone-700 border border-stone-600 rounded-lg px-3 py-2 text-stone-100 mb-2">
            <option value="">None</option>
            <option value="growth">Growth (Contact)</option>
            <option value="sales">Sales (Stoklync)</option>
            <option value="prayer">Prayer Request (Her Stewardship)</option>
          </select>
        ) : null}
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase text-stone-400 mb-1">Contact Page</p>
        {setContactPageUrl ? (
          <input type="url" value={contactPageUrl || ''} onChange={(e) => setContactPageUrl(e.target.value)} placeholder="https://linktr.ee/... or Google Form" className="w-full text-xs bg-stone-700 border border-stone-600 rounded-lg px-3 py-2 text-stone-100 placeholder-stone-500 mb-2" />
        ) : null}
        <p className={`text-xs ${hasContactLink ? 'text-emerald-300' : 'text-amber-300'}`}>
          {hasContactLink ? 'Contact URL set. QR code overlay available.' : 'Set Contact Page URL (Linktree, form) for QR overlay.'}
        </p>
      </div>

      {/* Suggested title */}
      {suggestions?.suggestedTitle && (
        <div>
          <p className="text-[10px] font-bold uppercase text-stone-400 mb-1">Suggested SEO Title</p>
          <p className="text-xs text-stone-200">{suggestions.suggestedTitle}</p>
        </div>
      )}

      {/* Suggested hashtags */}
      {suggestions?.suggestedHashtags?.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase text-stone-400 mb-1">Suggested Hashtags</p>
          <div className="flex flex-wrap gap-1">
            {suggestions.suggestedHashtags.map((h) => (
              <span key={h} className="text-[10px] bg-stone-700 text-rose-300 px-2 py-0.5 rounded">
                {h}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
