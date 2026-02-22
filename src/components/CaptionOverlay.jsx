import React from 'react';

const PRESETS = {
  faith: { fontWeight: 'bold', textAlign: 'center', fontSize: 'clamp(1.25rem, 5vw, 2.5rem)', color: '#ffffff', textShadow: '0 2px 8px rgba(0,0,0,0.9)', fontFamily: 'Georgia' },
  minimal: { fontWeight: 'normal', textAlign: 'center', fontSize: 'clamp(1rem, 4vw, 1.5rem)', color: '#ffffff', fontFamily: 'sans-serif' },
};

export function CaptionOverlay(props) {
  const text = props.text;
  const preset = props.preset || 'faith';
  if (!text || !String(text).trim()) return null;
  const s = PRESETS[preset] || PRESETS.faith;
  return (
    <div className="absolute inset-x-0 bottom-[12%] flex justify-center items-center px-4 pointer-events-none z-20">
      <span style={{ fontWeight: s.fontWeight, textAlign: s.textAlign, fontSize: s.fontSize, color: s.color, textShadow: s.textShadow, fontFamily: s.fontFamily, maxWidth: '90%', lineHeight: 1.3 }}>{text}</span>
    </div>
  );
}

export const CAPTION_PRESETS = PRESETS;
