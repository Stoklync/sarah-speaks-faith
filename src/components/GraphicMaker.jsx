import React, { useState, useRef, useEffect } from 'react';
import { Download, Sparkles, Loader2 } from 'lucide-react';
import { useStudio } from '../App';

const FORMATS = [
  { id: 'square', label: '⬜ Square',  w: 1080, h: 1080 },
  { id: 'story',  label: '📱 Story',   w: 1080, h: 1920 },
  { id: 'flyer',  label: '🗒️ Flyer',   w: 1080, h: 1350 },
];

// layout types: checklist | comparison | tips | quote | announcement | question
const TEMPLATES = [
  {
    id: 'checklist', label: '✅ Benefits Checklist', layout: 'checklist',
    bg: ['#071b3e','#0d3060'], accent: '#f59e0b', textColor: '#ffffff',
    headline: 'Why Choose Us?',
    subtext: 'Save money every month|Trusted by thousands|Easy to get started',
    cta: 'GET STARTED TODAY',
  },
  {
    id: 'myth_fact', label: '⚡ Myth vs Fact', layout: 'comparison',
    bg: ['#071b3e','#0d3060'], accent: '#f59e0b', textColor: '#ffffff',
    leftColor: '#b91c1c', rightColor: '#1d4ed8',
    headline: 'Know The Truth',
    subtext: "It's too expensive to start.|You can start for less than you think.",
    cta: '',
  },
  {
    id: 'tips', label: '💡 Tip List', layout: 'tips',
    bg: ['#0d2b1a','#0a3d22'], accent: '#22c55e', textColor: '#ffffff',
    headline: '3 Tips for This Week',
    subtext: 'Track every dollar you spend|Set a weekly savings goal|Cut one unused subscription',
    cta: 'Save This Post ↓',
  },
  {
    id: 'question', label: '❓ Bold Question', layout: 'question',
    bg: ['#0a0a1a','#1a1a3e'], accent: '#f59e0b', textColor: '#ffffff',
    leftColor: '#1d4ed8', rightColor: '#b91c1c',
    headline: 'WHICH WOULD YOU CHOOSE?',
    subtext: 'Option A — saves you money|Option B — costs you money',
    cta: '',
  },
  {
    id: 'quote', label: '✝️ Scripture / Quote', layout: 'quote',
    bg: ['#1a0800','#3d1500'], accent: '#f59e0b', textColor: '#ffffff',
    headline: '"For I know the plans I have for you"',
    subtext: '— Jeremiah 29:11',
    cta: '',
  },
  {
    id: 'announce', label: '📣 Announcement', layout: 'announcement',
    bg: ['#0f172a','#1e3a5f'], accent: '#38bdf8', textColor: '#ffffff',
    headline: 'New Episode Out Now!',
    subtext: 'Available on all major platforms',
    cta: 'Listen Now →',
  },
  {
    id: 'promo', label: '🛍️ Product Promo', layout: 'announcement',
    bg: ['#064e3b','#065f46'], accent: '#34d399', textColor: '#ffffff',
    headline: 'Now Available',
    subtext: 'Premium quality · Unbeatable price',
    cta: 'Order Now →',
  },
  {
    id: 'podcast', label: '🎙️ Podcast Drop', layout: 'announcement',
    bg: ['#1e0a3c','#2d0f5e'], accent: '#c084fc', textColor: '#ffffff',
    headline: 'Episode 12: Your Title Here',
    subtext: 'Drop a comment with your biggest takeaway',
    cta: '🎧 Listen Free',
  },
];

const LIST_LAYOUTS = new Set(['checklist', 'tips', 'comparison', 'question']);

// ─── Canvas helpers ───────────────────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y,         x + r, y,         r);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth) {
  const words = (text || '').split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function drawCheck(ctx, cx, cy, r, color) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = r * 0.22;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.42, cy + r * 0.02);
  ctx.lineTo(cx - r * 0.08, cy + r * 0.42);
  ctx.lineTo(cx + r * 0.44, cy - r * 0.34);
  ctx.stroke();
}

function drawBg(ctx, w, h, bg) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, bg[0]);
  g.addColorStop(1, bg[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function topBar(ctx, w, accent) {
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, w, Math.round(w * 0.007));
}

function bottomBar(ctx, w, h, accent) {
  ctx.fillStyle = accent;
  ctx.fillRect(0, h - Math.round(w * 0.007), w, Math.round(w * 0.007));
}

function brandHeader(ctx, w, headerCenterY, bizName, accent, textColor) {
  const s = w / 1080;
  const fs = Math.round(s * 36);
  ctx.font = `900 ${fs}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const nameW = ctx.measureText(bizName.toUpperCase()).width;

  // Accent side lines
  const lineW = Math.max((w * 0.5 - nameW / 2 - s * 36) / 2, s * 20);
  const lineY = headerCenterY;
  ctx.fillStyle = accent + '99';
  ctx.fillRect(s * 40, lineY - s * 2, lineW, s * 4);
  ctx.fillRect(w - s * 40 - lineW, lineY - s * 2, lineW, s * 4);

  ctx.fillStyle = textColor;
  ctx.fillText(bizName.toUpperCase(), w / 2, headerCenterY);
}

function footerStrip(ctx, w, h, bizName, accent, textColor) {
  const s = w / 1080;
  const fh = Math.round(s * 58);
  const fy = h - fh;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, fy, w, fh);
  ctx.font = `600 ${Math.round(s * 22)}px Arial, Helvetica, sans-serif`;
  ctx.fillStyle = textColor + '99';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(bizName, w / 2, fy + fh / 2);
}

// ─── CHECKLIST ────────────────────────────────────────────────────────────────
function drawChecklist(ctx, { w, h, template, headline, items, cta, bizName, accent }) {
  const s = w / 1080;
  drawBg(ctx, w, h, template.bg);

  // Soft decorative blobs
  ctx.fillStyle = accent + '10';
  ctx.beginPath(); ctx.arc(w * 0.88, h * 0.1, w * 0.28, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w * 0.08, h * 0.93, w * 0.16, 0, Math.PI * 2); ctx.fill();

  topBar(ctx, w, accent);
  brandHeader(ctx, w, h * 0.072, bizName, accent, template.textColor);

  // Thin rule under brand
  ctx.fillStyle = accent + '50';
  ctx.fillRect(w * 0.28, h * 0.108, w * 0.44, s * 2);

  // Headline
  const hSize = Math.round(s * 60);
  ctx.font = `800 ${hSize}px Arial, Helvetica, sans-serif`;
  ctx.fillStyle = template.textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const hlLines = wrapText(ctx, headline, w * 0.82);
  const hlY0 = h * 0.175;
  const hlLH = hSize * 1.25;
  hlLines.forEach((l, i) => ctx.fillText(l, w / 2, hlY0 + i * hlLH));
  const afterHL = hlY0 + hlLines.length * hlLH + s * 14;

  // Accent underline
  ctx.fillStyle = accent;
  ctx.fillRect(w / 2 - s * 70, afterHL, s * 140, s * 4);

  // Item rows
  const itemH   = Math.round(h * 0.082);
  const itemGap = Math.round(h * 0.016);
  const itemX   = Math.round(s * 52);
  const itemW   = w - itemX * 2;
  const checkR  = Math.round(itemH * 0.28);
  const ifs     = Math.round(itemH * 0.37);
  const rowsStartY = afterHL + s * 28;

  items.slice(0, 4).forEach((item, i) => {
    const iy  = rowsStartY + i * (itemH + itemGap);
    const icY = iy + itemH / 2;

    roundRect(ctx, itemX, iy, itemW, itemH, s * 14);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fill();

    const checkX = itemX + checkR + s * 24;
    drawCheck(ctx, checkX, icY, checkR, accent);

    ctx.font = `600 ${ifs}px Arial, Helvetica, sans-serif`;
    ctx.fillStyle = template.textColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(item, checkX + checkR + s * 18, icY);
  });

  // CTA bar
  if (cta) {
    const cbH = Math.round(s * 72);
    const cbY = h - Math.round(s * 70) - cbH - Math.round(s * 58);
    roundRect(ctx, s * 52, cbY, w - s * 104, cbH, s * 12);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.font = `800 ${Math.round(s * 30)}px Arial, Helvetica, sans-serif`;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cta.toUpperCase(), w / 2, cbY + cbH / 2);
  }

  footerStrip(ctx, w, h, bizName, accent, template.textColor);
  bottomBar(ctx, w, h, accent);
}

// ─── COMPARISON (Myth vs Fact) ────────────────────────────────────────────────
function drawComparison(ctx, { w, h, template, headline, items, cta, bizName, accent }) {
  const s = w / 1080;
  drawBg(ctx, w, h, template.bg);
  topBar(ctx, w, accent);
  brandHeader(ctx, w, h * 0.072, bizName, accent, template.textColor);

  ctx.fillStyle = accent + '50';
  ctx.fillRect(w * 0.28, h * 0.108, w * 0.44, s * 2);

  // Headline
  const hSize = Math.round(s * 52);
  ctx.font = `800 ${hSize}px Arial, Helvetica, sans-serif`;
  ctx.fillStyle = template.textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const hlLines = wrapText(ctx, headline, w * 0.82);
  const hlY0 = h * 0.175;
  const hlLH = hSize * 1.25;
  hlLines.forEach((l, i) => ctx.fillText(l, w / 2, hlY0 + i * hlLH));
  const afterHL = hlY0 + hlLines.length * hlLH + s * 16;

  ctx.fillStyle = accent;
  ctx.fillRect(w / 2 - s * 55, afterHL, s * 110, s * 4);

  // Two panels
  const gap    = Math.round(s * 18);
  const panX   = Math.round(s * 40);
  const panW   = (w - panX * 2 - gap) / 2;
  const panY   = afterHL + s * 32;
  const panH   = Math.round(h * 0.44);
  const panR   = Math.round(s * 18);
  const lColor = template.leftColor  || '#b91c1c';
  const rColor = template.rightColor || '#1d4ed8';
  const labelFSize = Math.round(s * 44);
  const bodyFSize  = Math.round(s * 28);

  const drawPanel = (px, color, label, text) => {
    roundRect(ctx, px, panY, panW, panH, panR);
    ctx.fillStyle = color; ctx.fill();

    // Label
    ctx.font = `900 ${labelFSize}px Arial, Helvetica, sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, px + panW / 2, panY + s * 28);

    // Rule
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(px + s * 22, panY + s * 86, panW - s * 44, s * 2);

    // Body text
    ctx.font = `400 ${bodyFSize}px Arial, Helvetica, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textBaseline = 'top';
    const lines = wrapText(ctx, text || '', panW - s * 44);
    lines.forEach((l, i) => ctx.fillText(l, px + panW / 2, panY + s * 104 + i * bodyFSize * 1.4));
  };

  drawPanel(panX,              lColor, 'MYTH', items[0] || '');
  drawPanel(panX + panW + gap, rColor, 'FACT', items[1] || '');

  footerStrip(ctx, w, h, bizName, accent, template.textColor);
  bottomBar(ctx, w, h, accent);
}

// ─── TIPS ─────────────────────────────────────────────────────────────────────
function drawTips(ctx, { w, h, template, headline, items, cta, bizName, accent }) {
  const s = w / 1080;
  drawBg(ctx, w, h, template.bg);

  ctx.fillStyle = accent + '09';
  ctx.beginPath(); ctx.arc(w * 0.85, h * 0.1, w * 0.24, 0, Math.PI * 2); ctx.fill();

  topBar(ctx, w, accent);
  brandHeader(ctx, w, h * 0.072, bizName, accent, template.textColor);

  ctx.fillStyle = accent + '50';
  ctx.fillRect(w * 0.28, h * 0.108, w * 0.44, s * 2);

  // Headline in accent colour
  const hSize = Math.round(s * 58);
  ctx.font = `800 ${hSize}px Arial, Helvetica, sans-serif`;
  ctx.fillStyle = accent;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const hlLines = wrapText(ctx, headline, w * 0.82);
  const hlY0 = h * 0.175;
  const hlLH = hSize * 1.25;
  hlLines.forEach((l, i) => ctx.fillText(l, w / 2, hlY0 + i * hlLH));
  const afterHL = hlY0 + hlLines.length * hlLH + s * 14;

  ctx.fillStyle = template.textColor + '28';
  ctx.fillRect(s * 52, afterHL, w - s * 104, s * 2);

  const itemH   = Math.round(h * 0.086);
  const itemGap = Math.round(h * 0.016);
  const itemX   = Math.round(s * 52);
  const itemW   = w - itemX * 2;
  const numR    = Math.round(itemH * 0.3);
  const ifs     = Math.round(itemH * 0.36);
  const rowsY   = afterHL + s * 28;

  items.slice(0, 4).forEach((item, i) => {
    const iy  = rowsY + i * (itemH + itemGap);
    const icY = iy + itemH / 2;

    roundRect(ctx, itemX, iy, itemW, itemH, s * 14);
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill();

    const numX = itemX + numR + s * 24;
    ctx.beginPath();
    ctx.arc(numX, icY, numR, 0, Math.PI * 2);
    ctx.fillStyle = accent; ctx.fill();

    ctx.font = `900 ${Math.round(numR * 0.92)}px Arial, Helvetica, sans-serif`;
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${i + 1}`, numX, icY);

    ctx.font = `600 ${ifs}px Arial, Helvetica, sans-serif`;
    ctx.fillStyle = template.textColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(item, numX + numR + s * 18, icY);
  });

  if (cta) {
    ctx.font = `700 ${Math.round(s * 26)}px Arial, Helvetica, sans-serif`;
    ctx.fillStyle = accent + 'cc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cta, w / 2, h - Math.round(s * 100));
  }

  footerStrip(ctx, w, h, bizName, accent, template.textColor);
  bottomBar(ctx, w, h, accent);
}

// ─── QUESTION (two option cards) ──────────────────────────────────────────────
function drawQuestion(ctx, { w, h, template, headline, items, bizName, accent }) {
  const s = w / 1080;
  drawBg(ctx, w, h, template.bg);
  topBar(ctx, w, accent);
  brandHeader(ctx, w, h * 0.072, bizName, accent, template.textColor);

  ctx.fillStyle = accent + '50';
  ctx.fillRect(w * 0.28, h * 0.108, w * 0.44, s * 2);

  // Headline
  const hSize = Math.round(s * 60);
  ctx.font = `900 ${hSize}px Arial, Helvetica, sans-serif`;
  ctx.fillStyle = template.textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const hlLines = wrapText(ctx, headline, w * 0.82);
  const hlY0 = h * 0.2;
  const hlLH = hSize * 1.2;
  hlLines.forEach((l, i) => ctx.fillText(l, w / 2, hlY0 + i * hlLH));
  const afterHL = hlY0 + hlLines.length * hlLH + s * 18;

  ctx.fillStyle = accent;
  ctx.fillRect(w / 2 - s * 50, afterHL, s * 100, s * 4);

  // Two cards
  const cardGap = Math.round(s * 20);
  const cardX   = Math.round(s * 40);
  const cardW   = (w - cardX * 2 - cardGap) / 2;
  const cardY   = afterHL + s * 38;
  const cardH   = Math.round(h * 0.32);
  const lColor  = template.leftColor  || '#1d4ed8';
  const rColor  = template.rightColor || '#b91c1c';
  const cfs     = Math.round(s * 30);

  const drawCard = (cx, color, text) => {
    roundRect(ctx, cx, cardY, cardW, cardH, s * 20);
    ctx.fillStyle = color; ctx.fill();

    ctx.font = `700 ${cfs}px Arial, Helvetica, sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = wrapText(ctx, text || '', cardW - s * 40);
    lines.forEach((l, i) => {
      ctx.fillText(l, cx + cardW / 2, cardY + cardH / 2 + (i - (lines.length - 1) / 2) * cfs * 1.4);
    });
  };

  drawCard(cardX,              lColor, items[0] || 'Option A');
  drawCard(cardX + cardW + cardGap, rColor, items[1] || 'Option B');

  // "OR" badge
  ctx.beginPath();
  ctx.arc(w / 2, cardY + cardH / 2, Math.round(s * 28), 0, Math.PI * 2);
  ctx.fillStyle = accent; ctx.fill();
  ctx.font = `900 ${Math.round(s * 20)}px Arial, Helvetica, sans-serif`;
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('OR', w / 2, cardY + cardH / 2);

  footerStrip(ctx, w, h, bizName, accent, template.textColor);
  bottomBar(ctx, w, h, accent);
}

// ─── QUOTE / SCRIPTURE ────────────────────────────────────────────────────────
function drawQuote(ctx, { w, h, template, headline, subtext, bizName, accent }) {
  const s = w / 1080;
  drawBg(ctx, w, h, template.bg);

  // Large decorative quote mark
  ctx.font = `900 ${Math.round(s * 300)}px Georgia, serif`;
  ctx.fillStyle = accent + '16';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('\u201C', s * -8, s * 10);

  topBar(ctx, w, accent);
  brandHeader(ctx, w, h * 0.08, bizName, accent, template.textColor);

  // Quote text — italic serif
  const qSize = Math.round(s * 58);
  ctx.font = `italic 700 ${qSize}px Georgia, serif`;
  ctx.fillStyle = template.textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const qLines = wrapText(ctx, headline, w * 0.8);
  const qLH = qSize * 1.3;
  const qY0 = h * 0.44 - ((qLines.length - 1) * qLH) / 2;
  qLines.forEach((l, i) => ctx.fillText(l, w / 2, qY0 + i * qLH));
  const afterQ = qY0 + qLines.length * qLH + s * 28;

  // Accent rule
  ctx.fillStyle = accent;
  ctx.fillRect(w / 2 - s * 55, afterQ, s * 110, s * 4);

  // Attribution
  if (subtext) {
    ctx.font = `400 ${Math.round(s * 34)}px Georgia, serif`;
    ctx.fillStyle = accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(subtext, w / 2, afterQ + s * 44);
  }

  footerStrip(ctx, w, h, bizName, accent, template.textColor);
  bottomBar(ctx, w, h, accent);
}

// ─── ANNOUNCEMENT ─────────────────────────────────────────────────────────────
function drawAnnouncement(ctx, { w, h, template, headline, subtext, cta, bizName, accent }) {
  const s = w / 1080;
  drawBg(ctx, w, h, template.bg);

  // Decorative blobs
  ctx.fillStyle = accent + '12';
  ctx.beginPath(); ctx.arc(w * 0.82, h * 0.18, w * 0.32, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w * 0.12, h * 0.78, w * 0.2, 0, Math.PI * 2); ctx.fill();

  // Diagonal accent stripe
  ctx.save();
  ctx.fillStyle = accent + '08';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.55); ctx.lineTo(w, h * 0.35);
  ctx.lineTo(w, h * 0.44); ctx.lineTo(0, h * 0.64);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  topBar(ctx, w, accent);
  brandHeader(ctx, w, h * 0.08, bizName, accent, template.textColor);

  // Big headline
  const hSize = Math.round(s * 72);
  ctx.font = `900 ${hSize}px Arial, Helvetica, sans-serif`;
  ctx.fillStyle = template.textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const hlLines = wrapText(ctx, headline, w * 0.84);
  const hlLH = hSize * 1.2;
  const hlTH = hlLines.length * hlLH;
  const hlY0 = h * 0.44 - hlTH / 2;
  hlLines.forEach((l, i) => ctx.fillText(l, w / 2, hlY0 + i * hlLH + hlLH / 2));
  const afterHL = hlY0 + hlTH + s * 18;

  // Divider
  ctx.fillStyle = accent;
  ctx.fillRect(w / 2 - s * 60, afterHL, s * 120, s * 4);

  // Subtext
  if (subtext) {
    ctx.font = `400 ${Math.round(s * 34)}px Arial, Helvetica, sans-serif`;
    ctx.fillStyle = template.textColor + 'cc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const stLines = wrapText(ctx, subtext, w * 0.75);
    stLines.forEach((l, i) => ctx.fillText(l, w / 2, afterHL + s * 32 + i * s * 44));
  }

  // CTA pill
  if (cta) {
    const cfs = Math.round(s * 36);
    ctx.font = `700 ${cfs}px Arial, Helvetica, sans-serif`;
    const ctaW = ctx.measureText(cta).width + s * 80;
    const ctaH = cfs * 1.8;
    const ctaX = w / 2 - ctaW / 2;
    const ctaY = h - Math.round(s * 58) - ctaH - s * 80;
    roundRect(ctx, ctaX, ctaY, ctaW, ctaH, ctaH / 2);
    ctx.fillStyle = accent; ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cta, w / 2, ctaY + ctaH / 2);
  }

  footerStrip(ctx, w, h, bizName, accent, template.textColor);
  bottomBar(ctx, w, h, accent);
}

// ─── Router ───────────────────────────────────────────────────────────────────
function drawCanvas({ canvas, template, headline, subtext, cta, format, brandColor, bizName }) {
  const ctx = canvas.getContext('2d');
  const { w, h } = format;
  canvas.width  = w;
  canvas.height = h;

  const accent = brandColor || template.accent;
  const items  = (subtext || '').split('|').map(s => s.trim()).filter(Boolean);
  const args   = { w, h, template, headline, subtext, items, cta, bizName, accent };

  switch (template.layout) {
    case 'checklist':   drawChecklist(ctx, args);   break;
    case 'comparison':  drawComparison(ctx, args);  break;
    case 'tips':        drawTips(ctx, args);         break;
    case 'question':    drawQuestion(ctx, args);    break;
    case 'quote':       drawQuote(ctx, args);        break;
    case 'announcement':
    default:            drawAnnouncement(ctx, args); break;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export function GraphicMaker() {
  const { businesses, activeBusinessId } = useStudio();
  const activeBiz = (businesses || []).find(b => b?.id === activeBusinessId);
  const bizName   = activeBiz?.name || 'Your Brand';

  const [template,   setTemplate]   = useState(TEMPLATES[0]);
  const [format,     setFormat]     = useState(FORMATS[0]);
  const [headline,   setHeadline]   = useState(TEMPLATES[0].headline);
  const [subtext,    setSubtext]    = useState(TEMPLATES[0].subtext);
  const [cta,        setCta]        = useState(TEMPLATES[0].cta);
  const [brandColor, setBrandColor] = useState('#f59e0b');
  const [aiLoading,  setAiLoading]  = useState(false);

  const canvasRef  = useRef(null);
  const previewRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawCanvas({ canvas, template, headline, subtext, cta, format, brandColor, bizName });
    if (previewRef.current) previewRef.current.src = canvas.toDataURL('image/png');
  }, [template, headline, subtext, cta, format, brandColor, bizName]);

  const pickTemplate = (t) => {
    setTemplate(t);
    setHeadline(t.headline);
    setSubtext(t.subtext);
    setCta(t.cta);
  };

  const download = () => {
    const a = document.createElement('a');
    a.href = canvasRef.current.toDataURL('image/png');
    a.download = `kreativelync-graphic-${Date.now()}.png`;
    a.click();
  };

  const generateWithAI = async () => {
    setAiLoading(true);
    try {
      const isList = LIST_LAYOUTS.has(template.layout);
      const r = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'chat',
          brandName: bizName,
          brandType: activeBiz?.type || 'business',
          chatHistory: [{
            role: 'user',
            text: `Create social media graphic text for ${bizName}.
Template: ${template.label} (layout: ${template.layout}).
${isList ? 'The subtext field must be 3 pipe-separated items, e.g. "Item one|Item two|Item three".' : ''}
Reply ONLY in this JSON format:
{"headline":"max 8 words","subtext":"${isList ? '3 items separated by | max 6 words each' : 'supporting line max 12 words'}","cta":"call to action max 5 words or empty string"}`
          }]
        })
      });
      const data = await r.json();
      const match = (data.reply || '').match(/\{[\s\S]*\}/);
      if (match) {
        const p = JSON.parse(match[0]);
        if (p.headline)          setHeadline(p.headline);
        if (p.subtext !== undefined) setSubtext(p.subtext);
        if (p.cta    !== undefined) setCta(p.cta);
      }
    } catch (_) {}
    setAiLoading(false);
  };

  const isList = LIST_LAYOUTS.has(template.layout);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-violet-50 to-amber-50 dark:from-stone-800 dark:to-stone-800 border-2 border-violet-200 dark:border-violet-800 rounded-3xl p-6">
        <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-1">🎨 Graphic Maker</h2>
        <p className="text-stone-500 dark:text-stone-400 text-sm">Pick a layout → edit text → download. Your brand name is shown automatically.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="space-y-5">

          {/* Step 1 — Template */}
          <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-5">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">1 · Choose a Layout</p>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => pickTemplate(t)}
                  className={`px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition-all ${template.id === t.id ? 'bg-violet-500 text-white shadow' : 'bg-stone-50 dark:bg-stone-700 text-stone-700 dark:text-stone-200 hover:bg-violet-50 dark:hover:bg-stone-600'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2 — Text */}
          <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">2 · Edit Text</p>
              <button onClick={generateWithAI} disabled={aiLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-xs font-bold hover:bg-violet-200 disabled:opacity-50">
                {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {aiLoading ? 'Writing…' : 'AI Write It'}
              </button>
            </div>
            <div>
              <label className="text-xs text-stone-500 font-medium block mb-1">Headline</label>
              <input value={headline} onChange={e => setHeadline(e.target.value)} maxLength={100}
                className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-3 py-2.5 text-sm text-stone-800 dark:text-stone-100" />
            </div>
            <div>
              <label className="text-xs text-stone-500 font-medium block mb-1">
                {isList ? 'List Items' : 'Subtext'}
                {isList && <span className="text-stone-400 ml-1">(separate with |)</span>}
              </label>
              <input value={subtext} onChange={e => setSubtext(e.target.value)} maxLength={200}
                placeholder={isList ? 'Item one|Item two|Item three' : 'Supporting line of text'}
                className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-3 py-2.5 text-sm text-stone-800 dark:text-stone-100" />
              {isList && (
                <p className="text-xs text-stone-400 mt-1">Each item separated by a pipe | becomes a row</p>
              )}
            </div>
            <div>
              <label className="text-xs text-stone-500 font-medium block mb-1">Call to Action <span className="text-stone-400">(optional)</span></label>
              <input value={cta} onChange={e => setCta(e.target.value)} maxLength={50} placeholder="e.g. Get Started Today"
                className="w-full bg-stone-50 dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-xl px-3 py-2.5 text-sm text-stone-800 dark:text-stone-100" />
            </div>
          </div>

          {/* Step 3 — Format & Color */}
          <div className="bg-white dark:bg-stone-800 border border-violet-100 dark:border-stone-700 rounded-2xl p-5 space-y-4">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">3 · Format & Accent Color</p>
            <div className="flex flex-wrap gap-2">
              {FORMATS.map(f => (
                <button key={f.id} onClick={() => setFormat(f)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${format.id === f.id ? 'bg-violet-500 text-white' : 'bg-stone-50 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-violet-50'}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-stone-500 font-medium">Accent Color</label>
              <input type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)}
                className="w-10 h-10 rounded-xl border-2 border-stone-200 dark:border-stone-600 cursor-pointer" />
              <div className="flex gap-2 flex-wrap">
                {['#f59e0b','#22c55e','#3b82f6','#ef4444','#ec4899','#a855f7','#ffffff'].map(c => (
                  <button key={c} onClick={() => setBrandColor(c)}
                    className="w-7 h-7 rounded-lg border-2 border-white dark:border-stone-700 shadow hover:scale-110 transition-transform"
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>

          {/* Download */}
          <button onClick={download}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-500 to-violet-600 text-white font-bold text-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-lg shadow-violet-200 dark:shadow-none">
            <Download size={20} />
            Download Graphic
          </button>
        </div>

        {/* Live preview */}
        <div className="flex flex-col items-center gap-3">
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest self-start">Live Preview</p>
          <div className="w-full flex justify-center">
            <img ref={previewRef} alt="Graphic preview"
              className="rounded-2xl shadow-xl border border-stone-100 dark:border-stone-700"
              style={{ maxHeight: '70vh', maxWidth: '100%', objectFit: 'contain' }} />
          </div>
          <p className="text-xs text-stone-400">{format.w} × {format.h}px · PNG</p>
        </div>
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
