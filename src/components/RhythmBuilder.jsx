import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, ChevronRight, Grid, Zap, Eye, BookOpen, Mic, Upload, Loader } from 'lucide-react';

// ─── Tracks ──────────────────────────────────────────────────────────────────
const TRACKS = [
  { id: 'kick',    label: 'Kick',      color: 'bg-violet-500', dot: 'bg-violet-400',  logicNote: 'C1',  desc: 'The heartbeat — anchors the groove' },
  { id: 'snare',   label: 'Snare',     color: 'bg-rose-500',   dot: 'bg-rose-400',    logicNote: 'D1',  desc: 'The backbeat — creates tension & release' },
  { id: 'hihat',   label: 'Hi-Hat ↓',  color: 'bg-amber-400',  dot: 'bg-amber-300',   logicNote: 'F#1', desc: 'Closed hi-hat — drives the pulse' },
  { id: 'openhat', label: 'Hi-Hat ↑',  color: 'bg-orange-400', dot: 'bg-orange-300',  logicNote: 'A#1', desc: 'Open hi-hat — adds air and space' },
  { id: 'clap',    label: 'Clap',      color: 'bg-pink-400',   dot: 'bg-pink-300',    logicNote: 'D#1', desc: 'Accent — emphasizes key moments' },
  { id: 'tom',     label: 'Tom',       color: 'bg-cyan-500',   dot: 'bg-cyan-400',    logicNote: 'A1',  desc: 'Fill & movement layer' },
  { id: 'bass',    label: 'Bass / 808',color: 'bg-emerald-500',dot: 'bg-emerald-400', logicNote: 'B0',  desc: 'Sub bass — locks with the kick' },
  { id: 'perc',    label: 'Perc',      color: 'bg-indigo-400', dot: 'bg-indigo-300',  logicNote: 'C#2', desc: 'Texture — shakers, cowbell, rim' },
];

const BEAT_LABELS = ['1','e','&','a','2','e','&','a','3','e','&','a','4','e','&','a'];

// ─── Presets ─────────────────────────────────────────────────────────────────
const PRESETS = [
  {
    name: 'Standard 4/4', genre: 'Pop / Rock',    emoji: '🎸', bpm: 120,
    feel: 'Straight, powerful, universal. The backbone of most pop and rock music.',
    buildSteps: [
      { track: 0, label: 'Kick on beats 1 and 3',      tip: 'Strong beats. Every pattern starts here.' },
      { track: 1, label: 'Snare on beats 2 and 4',     tip: 'The backbeat — creates head-nodding tension.' },
      { track: 2, label: 'Hi-hat on every 8th note',   tip: 'Every other step — drives the groove forward.' },
      { track: 4, label: 'Clap doubling the snare',    tip: 'Layer on snare for extra punch on 2 & 4.' },
    ],
    pattern: [
      [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
      [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    ],
  },
  {
    name: 'Boom Bap', genre: 'Hip-Hop', emoji: '🎤', bpm: 90,
    feel: 'Heavy kick, swinging hi-hats. Classic NYC hip-hop — every hit lands with weight.',
    buildSteps: [
      { track: 0, label: 'Kick on 1 and the "and" of 2', tip: 'Syncopated — hits where you don\'t expect it.' },
      { track: 1, label: 'Snare hard on 2 and 4',         tip: 'The "bap" — hit it hard, this is the soul.' },
      { track: 2, label: 'Hi-hat on every 16th note',     tip: 'All 16 steps active — rapid hi-hat density.' },
      { track: 3, label: 'Open hat on the "and" of 4',    tip: 'Creates a breath before beat 1 repeats.' },
    ],
    pattern: [
      [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
      [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,1,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    ],
  },
  {
    name: 'Trap', genre: 'Trap / Rap', emoji: '🔥', bpm: 140,
    feel: 'Rapid hi-hat rolls, sparse kick. Everything lives in the space between the beats.',
    buildSteps: [
      { track: 0, label: 'Kick sparse on 1 and 3',       tip: 'Minimal kick — fewer hits, each one harder.' },
      { track: 1, label: 'Snare on beat 3 only',          tip: 'Half-time snare — one hit per bar, heavy.' },
      { track: 2, label: 'Hi-hat on all 16 steps',        tip: 'Signature trap density — all steps hit.' },
      { track: 3, label: 'Open hat roll on beat 4',       tip: 'Steps 13-15 — the trap open hat roll.' },
    ],
    pattern: [
      [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
      [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
      [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 1,1,1,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    ],
  },
  {
    name: 'Gospel Groove', genre: 'Gospel', emoji: '🙌', bpm: 100,
    feel: 'Shuffling hi-hats, powerful snare, busy kick. The church sound — feeling it in your chest.',
    buildSteps: [
      { track: 0, label: 'Kick on 1, 2-and, and 4',       tip: 'Gospel kick is busy — fills space to drive worship.' },
      { track: 1, label: 'Snare with ghost notes on 2 & 4',tip: 'Main hits plus lighter "ghost" notes around them.' },
      { track: 2, label: 'Hi-hat shuffling 8th notes',     tip: 'Swing the hi-hat — slightly behind the beat.' },
      { track: 4, label: 'Clap on strong snare hits',      tip: 'Congregation clap — locks with snare for lift.' },
    ],
    pattern: [
      [1,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,0],
      [0,0,0,1, 1,0,0,1, 0,0,0,1, 1,0,0,0],
      [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,1,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    ],
  },
  {
    name: 'Afrobeats', genre: 'Afrobeats', emoji: '🥁', bpm: 100,
    feel: 'Multi-layered percussion. No single hit carries it — many voices talking at once.',
    buildSteps: [
      { track: 0, label: 'Kick weaving across the bar',   tip: 'Afrobeat kick converses with the bass — melodic.' },
      { track: 1, label: 'Light snare on 2 and 4',        tip: 'Snare is lighter — groove lives in the percussion.' },
      { track: 2, label: 'Hi-hat driving all 16th notes', tip: 'Constant 16th hi-hat is the clock.' },
      { track: 7, label: 'Perc on every upbeat',          tip: '"And" of each beat — the African polyrhythm layer.' },
    ],
    pattern: [
      [1,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,0],
      [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,1],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [1,0,1,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
      [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
    ],
  },
  {
    name: 'Dancehall', genre: 'Caribbean', emoji: '🌴', bpm: 115,
    feel: 'Syncopated kick, skipping hi-hats. The groove is OFF the beat — that\'s the magic.',
    buildSteps: [
      { track: 0, label: 'Kick anticipates beat 2',       tip: 'Lands early — pulls forward instead of sitting on the beat.' },
      { track: 1, label: 'Snare displaced around 2 & 4',  tip: 'Snare falls slightly off — Caribbean bounce.' },
      { track: 2, label: 'Hi-hat skipping 8th notes',     tip: 'Gaps create the swing. Space is as important as the hit.' },
      { track: 7, label: 'Perc on every upbeat',          tip: 'The "and" positions — soca bubble texture.' },
    ],
    pattern: [
      [1,0,0,0, 0,1,0,0, 1,0,0,0, 0,0,0,0],
      [0,0,0,0, 1,0,0,0, 0,0,0,1, 0,0,0,0],
      [1,0,1,0, 0,0,1,0, 1,0,1,0, 0,0,1,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1],
    ],
  },
  {
    name: 'UK Drill', genre: 'UK Drill', emoji: '🇬🇧', bpm: 140,
    feel: 'Sliding kick, dark sparse atmosphere. Kick rolls and slides — never lands where you expect.',
    buildSteps: [
      { track: 0, label: 'Kick rolling across the bar',    tip: 'UK drill kick slides — hits, then hits early again.' },
      { track: 1, label: 'Snare on beat 3 (half-time)',    tip: 'One snare per bar — heavy and rare.' },
      { track: 2, label: 'Hi-hat 16th notes, some missing',tip: 'Not all 16 — dropped steps create the drill feel.' },
      { track: 3, label: 'Open hat accent once per bar',   tip: 'One open hat adds air, makes the loop breathe.' },
    ],
    pattern: [
      [1,0,0,1, 0,0,1,0, 0,1,0,0, 1,0,0,0],
      [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
      [1,1,0,1, 1,0,1,1, 0,1,1,0, 1,1,0,1],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,1,0,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    ],
  },
  {
    name: 'Reggaeton', genre: 'Latin', emoji: '💃', bpm: 95,
    feel: 'Dembow rhythm — "boom-ch". Two hits that repeat and lock into a hypnotic loop.',
    buildSteps: [
      { track: 0, label: 'Kick on beat 1 and "and" of 2', tip: 'The "boom" of dembow — steps 1 and 6.' },
      { track: 1, label: 'Snare on "and" of 2 and beat 4', tip: 'The "ch" of dembow — steps 6 and 13.' },
      { track: 2, label: 'Hi-hat on every 8th note',       tip: 'Straight 8th notes drive Latin momentum.' },
      { track: 7, label: 'Perc clave pattern',             tip: '3-2 clave over 16 steps — heart of Latin rhythm.' },
    ],
    pattern: [
      [1,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,0],
      [0,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,0],
      [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [1,0,0,1, 0,0,1,0, 0,1,0,0, 1,0,0,0],
    ],
  },
  {
    name: 'Reggae', genre: 'Reggae', emoji: '🌿', bpm: 80,
    feel: 'Drop beat 1 — silence where you expect sound. The space IS the rhythm.',
    buildSteps: [
      { track: 0, label: 'Kick only on beat 3',               tip: '"One-drop" = beat 1 is empty. Beat 3 carries all weight.' },
      { track: 1, label: 'Snare doubles kick on beat 3',       tip: 'One powerful, unexpected combined hit.' },
      { track: 2, label: 'Hi-hat upbeats only (the "and"s)',   tip: 'Only "and" positions — never downbeats. This IS reggae.' },
      { track: 4, label: 'Clap on beat 1 (marks the silence)', tip: 'Where the kick is NOT — negative space becomes musical.' },
    ],
    pattern: [
      [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
      [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
      [0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    ],
  },
  {
    name: 'Funk Pocket', genre: 'Funk / R&B', emoji: '🕺', bpm: 105,
    feel: 'Ghost snares, syncopated kick. Funk lives in micro-timing — just off the beat.',
    buildSteps: [
      { track: 0, label: 'Kick syncopated across beats',      tip: 'Hits before and after the beat — anticipates tension.' },
      { track: 1, label: 'Snare on 2 & 4 plus ghost hits',    tip: 'Ghost hits fill the 16th grid — felt, not heard.' },
      { track: 2, label: 'Hi-hat 16th notes, accent upbeats', tip: 'All 16 but accent the "and" positions — funky swing.' },
      { track: 6, label: 'Bass locks with kick',              tip: 'Bass hits same steps as kick — one low-end voice.' },
    ],
    pattern: [
      [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
      [0,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,0,1],
      [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    ],
  },
  {
    name: 'EDM / House', genre: 'Electronic', emoji: '⚡', bpm: 128,
    feel: '4-on-the-floor kick, offbeat open hat. Simple, hypnotic, relentless — the club grid.',
    buildSteps: [
      { track: 0, label: 'Kick on every beat (1,2,3,4)',      tip: '"4-on-the-floor" — kick never stops. Foundation of club.' },
      { track: 3, label: 'Open hat on every offbeat',         tip: 'Lands on "and" of every beat — the house bounce.' },
      { track: 1, label: 'Snare or clap on 2 and 4',          tip: 'Simple backbeat over the kick grid.' },
      { track: 2, label: 'Hi-hat fills between kicks',        tip: '16th notes between kick hits — tightens the groove.' },
    ],
    pattern: [
      [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
      [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    ],
  },
  {
    name: 'Blank Canvas', genre: 'Custom', emoji: '✨', bpm: 100,
    feel: 'Start from nothing. Every step is yours to place.',
    buildSteps: [
      { track: 0, label: 'Try the kick first',   tip: 'Put it on step 1 and hear how it anchors everything.' },
      { track: 1, label: 'Add the snare',        tip: 'Try step 5 (beat 2) or step 13 (beat 4).' },
      { track: 2, label: 'Lay down the hi-hat',  tip: 'Every other step (1,3,5,7...) is a starting point.' },
      { track: 7, label: 'Add a perc texture',   tip: 'Fill the gaps — whatever step feels empty, try it.' },
    ],
    pattern: Array(8).fill(null).map(() => Array(16).fill(0)),
  },
];

// ─── Audio Synthesis ─────────────────────────────────────────────────────────
function getCtx(ref) {
  if (!ref.current) ref.current = new (window.AudioContext || window.webkitAudioContext)();
  if (ref.current.state === 'suspended') ref.current.resume();
  return ref.current;
}
function playKick(ctx, t) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.frequency.setValueAtTime(150,t); o.frequency.exponentialRampToValueAtTime(0.001,t+0.5);
  g.gain.setValueAtTime(1,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.5);
  o.start(t); o.stop(t+0.5);
}
function playSnare(ctx,t,v=1) {
  const buf=ctx.createBuffer(1,ctx.sampleRate*0.2,ctx.sampleRate);
  const d=buf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*v;
  const n=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();
  n.buffer=buf; f.type='bandpass'; f.frequency.value=3000;
  n.connect(f); f.connect(g); g.connect(ctx.destination);
  g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.2);
  n.start(t); n.stop(t+0.2);
}
function playHihat(ctx,t,open=false) {
  const dur=open?0.4:0.1;
  const buf=ctx.createBuffer(1,ctx.sampleRate*dur,ctx.sampleRate);
  const d=buf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
  const n=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();
  n.buffer=buf; f.type='highpass'; f.frequency.value=open?7000:10000;
  n.connect(f); f.connect(g); g.connect(ctx.destination);
  g.gain.setValueAtTime(open?0.7:0.4,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  n.start(t); n.stop(t+dur);
}
function playClap(ctx,t) {
  const buf=ctx.createBuffer(1,ctx.sampleRate*0.15,ctx.sampleRate);
  const d=buf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
  const n=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();
  n.buffer=buf; f.type='bandpass'; f.frequency.value=1200; f.Q.value=0.5;
  n.connect(f); f.connect(g); g.connect(ctx.destination);
  g.gain.setValueAtTime(0.9,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.15);
  n.start(t); n.stop(t+0.15);
}
function playTom(ctx,t) {
  const o=ctx.createOscillator(),g=ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.frequency.setValueAtTime(200,t); o.frequency.exponentialRampToValueAtTime(60,t+0.3);
  g.gain.setValueAtTime(0.8,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.3);
  o.start(t); o.stop(t+0.3);
}
function playBass(ctx,t) {
  const o=ctx.createOscillator(),g=ctx.createGain();
  o.type='triangle'; o.connect(g); g.connect(ctx.destination);
  o.frequency.setValueAtTime(80,t);
  g.gain.setValueAtTime(0.8,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.25);
  o.start(t); o.stop(t+0.25);
}
function playPerc(ctx,t) {
  const o=ctx.createOscillator(),g=ctx.createGain();
  o.type='square'; o.connect(g); g.connect(ctx.destination);
  o.frequency.setValueAtTime(600,t); o.frequency.exponentialRampToValueAtTime(200,t+0.08);
  g.gain.setValueAtTime(0.4,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.08);
  o.start(t); o.stop(t+0.08);
}
function playClick(ctx,t) {
  const o=ctx.createOscillator(),g=ctx.createGain();
  o.frequency.value=1000; o.connect(g); g.connect(ctx.destination);
  g.gain.setValueAtTime(0.3,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.03);
  o.start(t); o.stop(t+0.03);
}
const PLAY_FNS=[playKick,playSnare,(c,t)=>playHihat(c,t,false),(c,t)=>playHihat(c,t,true),playClap,playTom,playBass,playPerc];

// ─── Audio Analysis Engine ────────────────────────────────────────────────────

// ── Pitch / Key detection via chroma features ────────────────────────────────
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// Compute chroma vector from a slice of mono PCM using FFT via OfflineAudioContext
async function computeChroma(mono, sampleRate) {
  const fftSize = 4096;
  const hopSize = 2048;
  const chroma = new Float32Array(12).fill(0);
  let frames = 0;

  for (let start = 0; start + fftSize < mono.length; start += hopSize) {
    // Use Web Audio AnalyserNode on tiny offline context
    try {
      const ctx = new OfflineAudioContext(1, fftSize, sampleRate);
      const buf = ctx.createBuffer(1, fftSize, sampleRate);
      buf.getChannelData(0).set(mono.slice(start, start + fftSize));
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = fftSize;
      src.connect(analyser); analyser.connect(ctx.destination);
      src.start(0);
      await ctx.startRendering();
      const freqData = new Float32Array(analyser.frequencyBinCount);
      analyser.getFloatFrequencyData(freqData);

      // Map FFT bins to chroma bins
      for (let bin = 1; bin < freqData.length; bin++) {
        const freq = bin * sampleRate / fftSize;
        if (freq < 60 || freq > 4000) continue;
        const mag = Math.pow(10, freqData[bin] / 20);
        const midiNote = Math.round(12 * Math.log2(freq / 440) + 69);
        const chromaIdx = ((midiNote % 12) + 12) % 12;
        chroma[chromaIdx] += mag;
      }
      frames++;
    } catch (_) { break; }
    if (frames >= 8) break; // enough frames
  }

  // Normalize
  const max = Math.max(...chroma, 1e-6);
  return chroma.map(v => v / max);
}

// Detect key from chroma using Krumhansl-Schmuckler profiles
function detectKey(chroma) {
  const majorProfile = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
  const minorProfile = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];

  let bestKey = 'C', bestMode = 'major', bestScore = -Infinity;

  for (let root = 0; root < 12; root++) {
    // Major
    let scoreM = 0;
    for (let i = 0; i < 12; i++) scoreM += chroma[(i + root) % 12] * majorProfile[i];
    if (scoreM > bestScore) { bestScore = scoreM; bestKey = NOTE_NAMES[root]; bestMode = 'major'; }
    // Minor
    let scoreN = 0;
    for (let i = 0; i < 12; i++) scoreN += chroma[(i + root) % 12] * minorProfile[i];
    if (scoreN > bestScore) { bestScore = scoreN; bestKey = NOTE_NAMES[root]; bestMode = 'minor'; }
  }
  return { key: bestKey, mode: bestMode, full: `${bestKey} ${bestMode}` };
}

// ── Energy by frequency band ──────────────────────────────────────────────────
function analyzeEnergyBands(mono, sampleRate) {
  const bands = { subBass: [20,80], bass: [80,250], lowMid: [250,500], mid: [500,2000], highMid: [2000,4000], high: [4000,16000] };
  const fftSize = 2048;
  const freqRes = sampleRate / fftSize;
  const energy = {};

  // Take middle section of audio
  const startSample = Math.floor(mono.length * 0.2);
  const slice = mono.slice(startSample, startSample + fftSize * 4);

  // Simple DFT magnitude per band (approx)
  for (const [name, [lo, hi]] of Object.entries(bands)) {
    const loBin = Math.floor(lo / freqRes);
    const hiBin = Math.min(Math.floor(hi / freqRes), fftSize / 2 - 1);
    let sum = 0, count = 0;
    for (let bin = loBin; bin <= hiBin; bin++) {
      // Goertzel-like: just use windowed samples as proxy
      let re = 0, im = 0;
      const k = bin;
      for (let n = 0; n < Math.min(fftSize, slice.length); n++) {
        const angle = 2 * Math.PI * k * n / fftSize;
        re += slice[n] * Math.cos(angle);
        im += slice[n] * Math.sin(angle);
      }
      sum += Math.sqrt(re * re + im * im);
      count++;
    }
    energy[name] = count > 0 ? sum / count : 0;
  }

  // Normalize to 0-1
  const maxE = Math.max(...Object.values(energy), 1e-6);
  const norm = {};
  for (const k of Object.keys(energy)) norm[k] = energy[k] / maxE;
  return norm;
}

// ── Song structure detection (intro/verse/chorus/outro) ──────────────────────
function detectStructure(mono, sampleRate, bpm) {
  const barDur = (60 / bpm) * 4;
  const barSamples = Math.floor(barDur * sampleRate);
  const numBars = Math.floor(mono.length / barSamples);
  if (numBars < 2) return [{ section: 'Full Song', bars: '1-' + numBars }];

  const barEnergy = [];
  for (let b = 0; b < numBars; b++) {
    const start = b * barSamples;
    let sum = 0;
    for (let i = start; i < start + barSamples && i < mono.length; i++) sum += mono[i] ** 2;
    barEnergy.push(Math.sqrt(sum / barSamples));
  }

  const avgE = barEnergy.reduce((a, b) => a + b, 0) / barEnergy.length;
  const sections = [];
  let currentSection = null, sectionStart = 0;

  barEnergy.forEach((e, b) => {
    const isHigh = e > avgE * 1.15;
    const label = isHigh ? 'Chorus / Drop' : b < 2 ? 'Intro' : b >= numBars - 2 ? 'Outro' : 'Verse / Bridge';
    if (label !== currentSection) {
      if (currentSection) sections.push({ section: currentSection, bars: `${sectionStart + 1}–${b}` });
      currentSection = label; sectionStart = b;
    }
  });
  if (currentSection) sections.push({ section: currentSection, bars: `${sectionStart + 1}–${numBars}` });
  return sections;
}

// ── Instrument presence heuristics ───────────────────────────────────────────
function detectInstruments(energyBands, pattern) {
  const instruments = [];
  const hasDrums = pattern.flat().some(Boolean);
  const { subBass, bass, lowMid, mid, highMid, high } = energyBands;

  if (hasDrums) instruments.push({ name: 'Drums / Percussion', confidence: 'high', logicTool: 'Drum Machine Designer or Drummer' });
  if (subBass > 0.3) instruments.push({ name: '808 / Sub Bass', confidence: subBass > 0.6 ? 'high' : 'medium', logicTool: 'ES2 or Retro Synth — triangle wave, pitch envelope' });
  if (bass > 0.4 && subBass < 0.5) instruments.push({ name: 'Bass Guitar / Synth Bass', confidence: 'medium', logicTool: 'Bass Amp Designer or Retro Synth' });
  if (mid > 0.5 && lowMid > 0.4) instruments.push({ name: 'Chord Pads / Keys', confidence: 'medium', logicTool: 'Alchemy or ES2 — pad preset, sustain long' });
  if (highMid > 0.5) instruments.push({ name: 'Lead Melody / Synth Lead', confidence: 'medium', logicTool: 'Retro Synth or Alchemy — saw or square wave' });
  if (high > 0.4) instruments.push({ name: 'Hi-Hats / Cymbals / Strings', confidence: 'medium', logicTool: 'Drummer or EXS24 string samples' });
  if (mid > 0.6 && highMid > 0.6) instruments.push({ name: 'Vocals / Vocal Chops', confidence: 'medium', logicTool: 'Audio track — record or drag in sample' });

  return instruments;
}

// ── Call AI backend for full production breakdown ─────────────────────────────
async function getAIProductionGuide(features) {
  const { bpm, keyInfo, energyBands, instruments, structure, pattern, duration, fileName } = features;

  const activeDrumLayers = ['Kick','Snare','Hi-Hat','Open Hat','Clap','Tom','Bass/808','Perc']
    .filter((_, i) => pattern[i]?.some(Boolean));

  const presetOptions = ['Standard 4/4','Boom Bap','Trap','Gospel Groove','Afrobeats','Dancehall','UK Drill','Reggaeton','Reggae','Funk Pocket','EDM / House','Blank Canvas'];

  const prompt = `You are a music producer and Logic Pro expert. A student uploaded a song called "${fileName}" and wants to understand exactly how it was produced so she can recreate it in Logic Pro. She is a beginner — explain everything in plain, simple words like you're talking to a friend, not a textbook.

Here is what the audio analysis detected:

BPM: ${bpm}
Key: ${keyInfo.full}
Duration analyzed: ${Math.round(duration)}s
Song structure: ${structure.map(s => `${s.section} (bars ${s.bars})`).join(', ')}

Frequency energy (0=silent, 1=full):
- Sub-bass (20-80Hz): ${energyBands.subBass?.toFixed(2)}
- Bass (80-250Hz): ${energyBands.bass?.toFixed(2)}
- Low-mid (250-500Hz): ${energyBands.lowMid?.toFixed(2)}
- Mid (500-2kHz): ${energyBands.mid?.toFixed(2)}
- High-mid (2-4kHz): ${energyBands.highMid?.toFixed(2)}
- High (4kHz+): ${energyBands.high?.toFixed(2)}

Detected instruments: ${instruments.map(i => i.name).join(', ')}
Drum layers with hits: ${activeDrumLayers.join(', ')}

Structure your response exactly like this:

## Genre & Style
Name the genre and sub-genre (e.g. "Afrobeats", "Trap Gospel", "Dancehall", "R&B Soul", "Gospel Funk"). Describe the vibe in 2-3 sentences — what makes this style sound the way it does, what culture/tradition it comes from, and why people feel it in their body.

## Start Here — Copy This Preset
From this list of presets in the Rhythm Builder tool: ${presetOptions.join(', ')}
Pick the ONE preset that is the closest match to this song's groove. Name it exactly as it appears in the list. Then explain what 2-3 specific changes to make to that preset to get it closer to this song (e.g. "move the kick from step 1 to step 3", "add a hi-hat on every 16th note", "remove the open hat").

## What This Song Uses (Every Layer)
List every instrument/sound layer in the song. For each one say: what it is, what job it does in the mix, and which Logic Pro tool/plugin to use to make it.

## The Groove — How the Rhythm Works
Explain the rhythm in plain words. Where does the kick land? Where does the snare land? What are the hi-hats doing? What gives this specific groove its feel? Use the beat position names (beat 1, beat 2, "the and of 2", etc.).

## Key & Chords to Play
Key is ${keyInfo.full}. Give a 2-4 chord progression that fits. For each chord give: the chord name, whether it's major/minor, and the exact notes to press on a piano keyboard (e.g. "C minor = C, Eb, G").

## Build It in Logic Pro — Step by Step
Number every step starting from scratch. Include: create project, set BPM, which plugin to open for each sound, basic settings, and the order to build the layers. Keep steps short and clear.

## Second Chorus — Make It Bigger
Exactly what to add or change so the second chorus hits harder than the first. Give 3-5 specific ideas.

## 3 Things to Learn Next
The 3 most important Logic Pro skills to study next, based specifically on what this song uses.

Keep it warm and encouraging. She has great instincts and is just beginning her journey.`;

  try {
    const res = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'custom', prompt }),
    });
    if (!res.ok) throw new Error('AI request failed');
    const data = await res.json();
    return data.result || data.text || '';
  } catch (err) {
    console.error('AI guide error:', err);
    return null;
  }
}

// Simple IIR low-pass filter on raw PCM
function iirLowPass(samples, cutoff, sampleRate) {
  const alpha = Math.min(0.999, 1 / (1 + sampleRate / (2 * Math.PI * cutoff)));
  const out = new Float32Array(samples.length);
  out[0] = samples[0];
  for (let i = 1; i < samples.length; i++) out[i] = alpha * samples[i] + (1 - alpha) * out[i - 1];
  return out;
}

// Detect onset times (seconds) from mono PCM data
function detectOnsets(samples, sampleRate) {
  const windowMs = 20, hopMs = 10;
  const winSamples = Math.floor(sampleRate * windowMs / 1000);
  const hopSamples = Math.floor(sampleRate * hopMs / 1000);
  const hopDur = hopMs / 1000;

  // RMS energy per hop
  const energy = [];
  for (let i = 0; i + winSamples < samples.length; i += hopSamples) {
    let sum = 0;
    for (let j = 0; j < winSamples; j++) sum += samples[i + j] ** 2;
    energy.push(Math.sqrt(sum / winSamples));
  }

  // Onset = positive energy flux above adaptive local mean
  const onsets = [];
  const minGapFrames = Math.ceil(50 / hopMs); // min 50ms between onsets
  let lastFrame = -minGapFrames;

  for (let i = 2; i < energy.length - 2; i++) {
    const flux = Math.max(0, energy[i] - energy[i - 1]);
    const localSlice = energy.slice(Math.max(0, i - 12), i);
    const localMean = localSlice.reduce((a, b) => a + b, 0) / (localSlice.length || 1);
    if (flux > localMean * 1.4 + 0.008 && i - lastFrame > minGapFrames) {
      onsets.push(i * hopDur);
      lastFrame = i;
    }
  }
  return onsets;
}

// Estimate BPM from onset times using IOI histogram
function estimateBPM(onsets) {
  if (onsets.length < 4) return 120;
  const iois = onsets.slice(1).map((t, i) => t - onsets[i]).filter(d => d >= 0.15 && d <= 2.0);
  if (!iois.length) return 120;

  const binSize = 0.005; // 5ms bins
  const bins = {};
  iois.forEach(ioi => {
    const bin = Math.round(ioi / binSize);
    bins[bin] = (bins[bin] || 0) + 1;
    // also score half/double tempo
    [bin * 2, Math.round(bin / 2)].forEach(b => { if (b > 0) bins[b] = (bins[b] || 0) + 0.4; });
  });

  let best = null, bestScore = 0;
  Object.entries(bins).forEach(([bin, score]) => {
    if (score > bestScore) { bestScore = score; best = Number(bin); }
  });
  if (!best) return 120;
  const bpm = Math.round(60 / (best * binSize));
  // clamp to musical range
  let result = bpm;
  while (result < 70) result *= 2;
  while (result > 180) result /= 2;
  return Math.round(result);
}

// Classify onset by frequency content (kick=0, snare=1, hihat=2, perc=7)
function classifyOnsets(samples, onsets, sampleRate) {
  const low = iirLowPass(samples, 150, sampleRate);   // kick bass
  const mid = iirLowPass(samples, 2500, sampleRate);  // snare

  return onsets.map(t => {
    const start = Math.floor(t * sampleRate);
    const end = Math.min(start + Math.floor(sampleRate * 0.08), samples.length);
    let lowE = 0, midE = 0, highE = 0;
    for (let i = start; i < end; i++) {
      lowE += Math.abs(low[i]);
      midE += Math.abs(mid[i] - low[i]);
      highE += Math.abs(samples[i] - mid[i]);
    }
    const total = lowE + midE + highE + 1e-6;
    const lr = lowE / total, hr = highE / total;
    if (lr > 0.38) return 0;      // Kick
    if (hr > 0.45) return 2;      // Hi-Hat
    if (lr > 0.2 && hr < 0.35) return 1; // Snare
    return 7;                      // Perc
  });
}

// Map onset times + their track IDs to 8×16 pattern grid
function mapToGrid(onsets, classes, bpm, startTime) {
  const stepDur = 60 / bpm / 4;
  const barDur = stepDur * 16;
  const pattern = Array(8).fill(null).map(() => Array(16).fill(0));

  onsets.forEach((t, i) => {
    const rel = t - startTime;
    if (rel < 0 || rel >= barDur * 2) return; // use first 2 bars, then fold
    const barPos = rel % barDur;
    const stepIdx = Math.min(15, Math.round(barPos / stepDur) % 16);
    const trackIdx = classes[i];
    if (trackIdx >= 0 && trackIdx < 8) pattern[trackIdx][stepIdx] = 1;
  });
  return pattern;
}

// Full analysis pipeline — returns complete song breakdown
async function analyzeAudioBuffer(audioBuffer, fileName, onProgress) {
  const sampleRate = audioBuffer.sampleRate;
  // Use up to 45 seconds for structure, 10s for chroma
  const maxSamples = Math.min(audioBuffer.length, sampleRate * 45);
  const mono = new Float32Array(maxSamples);
  const nCh = audioBuffer.numberOfChannels;
  for (let ch = 0; ch < nCh; ch++) {
    const chData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < maxSamples; i++) mono[i] += chData[i] / nCh;
  }

  onProgress?.('Detecting beats & BPM…');
  const shortMono = mono.slice(0, sampleRate * 10);
  const onsets = detectOnsets(shortMono, sampleRate);
  const bpm = estimateBPM(onsets);
  const classes = classifyOnsets(shortMono, onsets, sampleRate);

  // Best representative bar
  const barDur = (60 / bpm) * 4;
  const numBars = Math.floor((shortMono.length / sampleRate) / barDur);
  let bestBar = 0, bestCount = 0;
  for (let b = 0; b < Math.max(1, numBars); b++) {
    const barStart = b * barDur, barEnd = barStart + barDur;
    const count = onsets.filter(t => t >= barStart && t < barEnd).length;
    if (count > bestCount) { bestCount = count; bestBar = b; }
  }
  const pattern = mapToGrid(onsets, classes, bpm, bestBar * barDur);

  onProgress?.('Detecting key & chords…');
  const chroma = await computeChroma(shortMono, sampleRate);
  const keyInfo = detectKey(chroma);

  onProgress?.('Analysing frequency layers…');
  const energyBands = analyzeEnergyBands(mono, sampleRate);

  onProgress?.('Mapping song structure…');
  const structure = detectStructure(mono, sampleRate, bpm);
  const instruments = detectInstruments(energyBands, pattern);

  onProgress?.('Asking AI for production guide…');
  const aiGuide = await getAIProductionGuide({ bpm, keyInfo, energyBands, instruments, structure, pattern, duration: maxSamples / sampleRate, fileName: fileName || 'your song' });

  return {
    bpm, pattern, onsetCount: onsets.length,
    duration: maxSamples / sampleRate,
    keyInfo, energyBands, instruments, structure, aiGuide,
  };
}

// ─── DNA Analysis ─────────────────────────────────────────────────────────────
function analyzePattern(pattern) {
  const totalHits = pattern.flat().reduce((a,b) => a+b, 0);
  const density = Math.round((totalHits / (8*16)) * 100);
  const downbeats=[0,4,8,12], upbeats=[2,6,10,14];
  let onBeat=0, offBeat=0;
  pattern.forEach(t => t.forEach((s,i) => { if(!s) return; if(downbeats.includes(i)) onBeat++; else if(upbeats.includes(i)) offBeat++; }));
  const activeTracks = pattern.filter(t => t.some(Boolean)).length;
  const kick=pattern[0], snare=pattern[1];
  let groove = kick[0] ? (snare[4]&&snare[12] ? 'Backbeat' : snare[8] ? 'Half-time' : 'Straight') : 'Syncopated';
  return { density, onBeat, offBeat, activeTracks, groove };
}

// ─── Sound Library ───────────────────────────────────────────────────────────
// Per-genre sound recommendations for every track
const SOUND_LIBRARY = {
  default: [
    {
      track: 'Kick', emoji: '🥁',
      role: 'The foundation. Every other sound in the mix is built around the kick.',
      sounds: [
        { name: 'Big Room Kick', where: 'Logic → Drum Machine Designer → Browse → "Kick" → Big Room Kick 01', tip: 'Best all-purpose kick. Punchy low-end, works for pop, gospel, R&B.' },
        { name: 'Vintage Room Kick', where: 'Drum Machine Designer → Browse → "Kick" → Vintage Room Kick', tip: 'Warmer, old-school feel. Good for gospel and funk.' },
        { name: '808 Kick (pitched)', where: 'ES2 plugin → Init → Oscillator: Sine → add pitch envelope (fast decay)', tip: 'The deep chest-punch 808 kick. Tune it to the root note of your key.' },
      ],
      logicPath: 'Drum Machine Designer → Pad 1 (C1) → Browse Samples',
      settings: 'Volume: 0dB. Add a Compressor (Ratio 4:1, Attack 10ms, Release 50ms) on the kick channel to make it punch through.',
      freeSource: 'Looperman.com → Drum Samples → Kicks (free download)',
    },
    {
      track: 'Snare', emoji: '🪘',
      role: 'The backbeat — this is what makes people nod their heads and clap along.',
      sounds: [
        { name: 'Tight Snare', where: 'Drum Machine Designer → Browse → "Snare" → Tight Snare 01', tip: 'Sharp and cutting. Works for trap, hip-hop, pop.' },
        { name: 'Fat Snare', where: 'Drum Machine Designer → Browse → "Snare" → Fat Snare', tip: 'Big gospel/R&B snare with body. Hits hard on beat 2 and 4.' },
        { name: 'Clap + Snare layered', where: 'Use TWO pads — one snare + one clap on the same step', tip: 'Layer a clap on top of the snare for that church/pop snap.' },
      ],
      logicPath: 'Drum Machine Designer → Pad 2 (D1) → Browse Samples',
      settings: 'Add a short Reverb (Room size: Small, Wet: 15%) to give it air without muddying the mix.',
      freeSource: 'splice.com free samples → "snare" search',
    },
    {
      track: 'Hi-Hat (Closed)', emoji: '🎩',
      role: 'The pulse — hi-hats are what keep the groove moving forward between the kicks and snares.',
      sounds: [
        { name: 'Tight Closed Hat', where: 'Drum Machine Designer → Browse → "Hi-Hat" → Tight Closed Hat', tip: 'Standard hi-hat. Put it on every 8th note (steps 1,3,5,7,9,11,13,15) to start.' },
        { name: 'Vintage Closed Hat', where: 'Drum Machine Designer → Browse → "Hi-Hat" → Vintage Closed Hat', tip: 'Has a slight swing — good for gospel and funk.' },
      ],
      logicPath: 'Drum Machine Designer → Pad 3 (F#1) → Browse Samples',
      settings: 'Lower the velocity of off-beat hi-hats slightly (80 vs 100) — makes them feel human and not robotic.',
      freeSource: 'Any free drum pack — hi-hats are the most common free sample',
    },
    {
      track: 'Hi-Hat (Open)', emoji: '🔔',
      role: 'Adds air and space — the open hat breathes in between the closed hats.',
      sounds: [
        { name: 'Open Hi-Hat', where: 'Drum Machine Designer → Browse → "Hi-Hat" → Open Hi-Hat 01', tip: 'Use sparingly — 1-2 hits per bar. Put it on the "and" of beat 4 for a natural breath.' },
      ],
      logicPath: 'Drum Machine Designer → Pad 4 (A#1) → Browse Samples',
      settings: 'Keep velocity around 70-80. Too loud and it drowns everything.',
      freeSource: 'Same drum packs as closed hat — usually come together',
    },
    {
      track: 'Clap', emoji: '👏',
      role: 'Accent and attitude. The clap emphasises key moments and adds a human feel.',
      sounds: [
        { name: 'Stadium Clap', where: 'Drum Machine Designer → Browse → "Clap" → Stadium Clap', tip: 'Big, wide clap — great for gospel and uplifting moments.' },
        { name: 'Tight Clap', where: 'Drum Machine Designer → Browse → "Clap" → Tight Clap 01', tip: 'Sharp pop clap. Good for trap and hip-hop.' },
        { name: 'Hand Clap (real)', where: 'Drum Machine Designer → Browse → "Clap" → Hand Clap', tip: 'Sounds like a real congregation clapping — perfect for gospel and worship.' },
      ],
      logicPath: 'Drum Machine Designer → Pad 5 (D#1) → Browse Samples',
      settings: 'Add a tiny Delay (1/16 note, 10-15% wet) to give it width across the stereo field.',
      freeSource: 'Splice free tier → "gospel clap" or "hand clap"',
    },
    {
      track: 'Tom', emoji: '🪗',
      role: 'Movement and drama — toms create fills that signal a section change is coming.',
      sounds: [
        { name: 'Floor Tom', where: 'Drum Machine Designer → Browse → "Tom" → Floor Tom 01', tip: 'Low, deep tom. Use at the end of a bar to signal the chorus.' },
        { name: 'Mid Tom', where: 'Drum Machine Designer → Browse → "Tom" → Mid Tom', tip: 'Classic fill tom. Go Floor → Mid → Snare for a 3-hit fill.' },
      ],
      logicPath: 'Drum Machine Designer → Pad 6 (A1) → Browse Samples',
      settings: 'Use toms in fills only — last 2 steps of bar 4 before the chorus hits.',
      freeSource: 'GarageBand (free on Mac) has excellent tom samples',
    },
    {
      track: 'Bass / 808', emoji: '🔊',
      role: 'The lowest sound in the mix. The bass is what you feel in your chest. It locks with the kick.',
      sounds: [
        { name: 'ES2 Sub Bass (Logic synth)', where: 'New Software Instrument track → ES2 → Preset: "Sub Bass" or "808 Bass"', tip: 'Tune the bass note to match your key. If key is A minor, bass root note = A.' },
        { name: 'Retro Synth Bass', where: 'New Software Instrument track → Retro Synth → Wave: Sawtooth → turn filter down', tip: 'More growly, moving bass. Good for funk and R&B.' },
        { name: 'Alchemy 808', where: 'New Software Instrument → Alchemy → Search "808" → pick 808 Bass', tip: 'Best Logic 808. Has the pitch slide built in. Tune to your key.' },
      ],
      logicPath: 'Create NEW Software Instrument track (not in Drum Machine Designer)',
      settings: 'Pan: Center. Add a Low Cut EQ at 30Hz. Sidechain compress the bass to duck slightly when the kick hits.',
      freeSource: 'Logic Pro ships with excellent 808 presets in Alchemy — no download needed',
    },
    {
      track: 'Perc', emoji: '🪇',
      role: 'Texture and groove — shakers, tambourines, cowbells, and rim shots fill the spaces the drums leave.',
      sounds: [
        { name: 'Shaker', where: 'Drum Machine Designer → Browse → "Percussion" → Shaker 01', tip: 'Put shaker on every "and" (steps 3,7,11,15) for a constant forward motion.' },
        { name: 'Tambourine', where: 'Drum Machine Designer → Browse → "Percussion" → Tambourine', tip: 'Gospel essential. Put on beats 2 and 4 — same as snare — for church feel.' },
        { name: 'Cowbell / Rim', where: 'Drum Machine Designer → Browse → "Percussion" → Rim Shot or Cowbell', tip: 'Afrobeats and Latin use cowbell on specific offbeats for polyrhythm texture.' },
      ],
      logicPath: 'Drum Machine Designer → Pad 8 (C#2) → Browse Samples → Percussion folder',
      settings: 'Keep perc at 60-70 velocity — it should sit under the main drums, not compete.',
      freeSource: 'Logic Pro has a full Percussion folder with shakers, tambourines, congas, cowbells included free',
    },
  ],
  // Genre overrides — these replace/extend the default for specific presets
  trap: [
    { track: 'Kick', override: true, sounds: [
      { name: 'TR-808 Kick (pitched down)', where: 'Drum Machine Designer → Browse → "Kick" → 808 Kick → lower pitch to -5 semitones', tip: 'Trap kick is deep and boomy. Pitch it down for extra weight.' },
      { name: 'Vinyl Kick', where: 'Drum Machine Designer → Browse → "Kick" → Vinyl Kick', tip: 'Has the distorted trap character built in.' },
    ]},
    { track: 'Hi-Hat (Closed)', override: true, sounds: [
      { name: 'Trap Hi-Hat', where: 'Drum Machine Designer → Browse → "Hi-Hat" → Trap Hi-Hat or Hi-Hat Tight', tip: 'Put on ALL 16 steps for the signature trap density.' },
      { name: 'Hi-Hat Roll', where: 'Same hi-hat — in the sequencer, put 3-4 hits close together at the end of the bar', tip: 'Steps 13,14,15 together = the trap hi-hat roll.' },
    ]},
  ],
  gospel: [
    { track: 'Snare', override: true, sounds: [
      { name: 'Gospel Snare (layered)', where: 'Use TWO pads: Fat Snare + Hand Clap on same steps', tip: 'Gospel snare is THICK. Always layer a real clap on the snare.' },
      { name: 'Ghost Snare', where: 'Same snare sample, but drag velocity down to 30-40 on in-between steps', tip: 'Ghost hits are what give gospel drums that human shuffle feel.' },
    ]},
    { track: 'Perc', override: true, sounds: [
      { name: 'Tambourine (gospel)', where: 'Drum Machine Designer → Browse → Percussion → Tambourine → on beats 2 & 4', tip: 'Tambourine is the most iconic gospel percussion sound. Essential.' },
      { name: 'Shaker (16th notes)', where: 'Drum Machine Designer → Shaker on every 16th note step', tip: 'Running shaker under everything holds the gospel groove together.' },
    ]},
  ],
};

function getSoundsForPreset(presetName) {
  const name = presetName.toLowerCase();
  const overrides = name.includes('trap') || name.includes('drill') ? SOUND_LIBRARY.trap
    : name.includes('gospel') ? SOUND_LIBRARY.gospel
    : [];

  return SOUND_LIBRARY.default.map(trackSounds => {
    const override = overrides.find(o => o.track === trackSounds.track);
    if (override?.override) return { ...trackSounds, sounds: override.sounds };
    return trackSounds;
  });
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function RhythmBuilder() {
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [pattern, setPattern] = useState(() => PRESETS[0].pattern.map(t => [...t]));
  const [bpm, setBpm] = useState(PRESETS[0].bpm);
  const [playing, setPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [mode, setMode] = useState('analyze');
  const [buildStep, setBuildStep] = useState(0);
  const [builtTracks, setBuiltTracks] = useState(new Set());
  const [mutedTracks, setMutedTracks] = useState(new Set());

  // Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState('');
  const [analyzeResult, setAnalyzeResult] = useState(null);
  const [analyzeError, setAnalyzeError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [guideTab, setGuideTab] = useState('guide');
  const fileInputRef = useRef(null);

  // Tap mode state
  const [tapTrack, setTapTrack] = useState(0);
  const [tapActive, setTapActive] = useState(false);
  const [tapCountdown, setTapCountdown] = useState(0);
  const [tapTimes, setTapTimes] = useState([]);
  const [tapBpmTaps, setTapBpmTaps] = useState([]);
  const [tapPattern, setTapPattern] = useState(Array(16).fill(0));
  const [showTapResult, setShowTapResult] = useState(false);
  const tapStartRef = useRef(null);
  const tapCountdownRef = useRef(null);
  const tapMetronomeRef = useRef(null);

  const audioCtxRef = useRef(null);
  const intervalRef = useRef(null);
  const stepRef = useRef(0);
  const patternRef = useRef(pattern);
  const bpmRef = useRef(bpm);
  const mutedRef = useRef(mutedTracks);
  patternRef.current = pattern;
  bpmRef.current = bpm;
  mutedRef.current = mutedTracks;

  const stopPlayback = useCallback(() => {
    clearInterval(intervalRef.current);
    setPlaying(false); setCurrentStep(-1); stepRef.current = 0;
  }, []);

  const startPlayback = useCallback(() => {
    const ctx = getCtx(audioCtxRef);
    stepRef.current = 0;
    const tick = () => {
      const step = stepRef.current;
      const now = ctx.currentTime;
      patternRef.current.forEach((track, ti) => { if (mutedRef.current.has(ti)) return; if (track[step]) PLAY_FNS[ti](ctx, now); });
      setCurrentStep(step);
      stepRef.current = (step + 1) % 16;
    };
    tick();
    intervalRef.current = setInterval(tick, (60 / bpmRef.current / 4) * 1000);
    setPlaying(true);
  }, []);

  useEffect(() => {
    if (playing) {
      clearInterval(intervalRef.current);
      const ctx = audioCtxRef.current;
      const ms = (60 / bpm / 4) * 1000;
      intervalRef.current = setInterval(() => {
        const step = stepRef.current;
        const now = ctx.currentTime;
        patternRef.current.forEach((track, ti) => { if (mutedRef.current.has(ti)) return; if (track[step]) PLAY_FNS[ti](ctx, now); });
        setCurrentStep(step); stepRef.current = (step + 1) % 16;
      }, ms);
    }
  }, [bpm]);

  useEffect(() => () => { clearInterval(intervalRef.current); clearInterval(tapMetronomeRef.current); clearTimeout(tapCountdownRef.current); }, []);

  const loadPreset = (idx) => {
    stopPlayback();
    const p = PRESETS[idx];
    setSelectedPreset(idx); setPattern(p.pattern.map(t => [...t]));
    setBpm(p.bpm); setBuildStep(0); setBuiltTracks(new Set()); setMutedTracks(new Set());
    setShowTapResult(false); setTapTimes([]); setTapPattern(Array(16).fill(0)); setTapActive(false);
  };

  const toggleStep = (ti, si) => setPattern(prev => { const n = prev.map(t=>[...t]); n[ti][si]^=1; return n; });
  const toggleMute = (ti) => setMutedTracks(prev => { const n=new Set(prev); n.has(ti)?n.delete(ti):n.add(ti); return n; });

  // ── File Analysis ───────────────────────────────────────────────────────────
  const handleFile = async (file) => {
    if (!file) return;
    const isAudioVideo = file.type.startsWith('audio/') || file.type.startsWith('video/');
    if (!isAudioVideo) { setAnalyzeError('Please upload an audio or video file (MP4, MOV, MP3, WAV, M4A…)'); return; }

    setAnalyzing(true); setAnalyzeError(''); setAnalyzeResult(null); setAnalyzeProgress('Loading audio…');
    try {
      const ctx = getCtx(audioCtxRef);
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const result = await analyzeAudioBuffer(audioBuffer, file.name, setAnalyzeProgress);
      setAnalyzeResult({ ...result, fileName: file.name });
    } catch (err) {
      setAnalyzeError('Could not decode this file. Try an MP3, WAV, or M4A audio file exported from CapCut.');
      console.error(err);
    } finally {
      setAnalyzing(false); setAnalyzeProgress('');
    }
  };

  const applyAnalysisToGrid = () => {
    if (!analyzeResult) return;
    stopPlayback();
    setPattern(analyzeResult.pattern.map(t => [...t]));
    setBpm(analyzeResult.bpm);
    setMode('sequence');
  };

  // ── Tap BPM ─────────────────────────────────────────────────────────────────
  const tapTempo = () => {
    const now = performance.now();
    setTapBpmTaps(prev => {
      const recent = [...prev, now].filter(t => now - t < 3000).slice(-8);
      if (recent.length >= 2) {
        const diffs = recent.slice(1).map((t,i) => t - recent[i]);
        setBpm(Math.max(60, Math.min(200, Math.round(60000 / (diffs.reduce((a,b) => a+b,0)/diffs.length)))));
      }
      return recent;
    });
  };

  // ── Tap Recording ───────────────────────────────────────────────────────────
  const startTapSession = () => {
    const ctx = getCtx(audioCtxRef);
    setTapActive(true); setTapTimes([]); setShowTapResult(false); setTapCountdown(4);
    let count = 3;
    const beatMs = (60 / bpm) * 1000;
    playClick(ctx, ctx.currentTime);
    tapCountdownRef.current = setInterval(() => {
      playClick(ctx, ctx.currentTime);
      if (count <= 0) {
        clearInterval(tapCountdownRef.current);
        setTapCountdown(0);
        tapStartRef.current = performance.now();
        let clicks = 0;
        tapMetronomeRef.current = setInterval(() => {
          playClick(ctx, ctx.currentTime);
          if (++clicks >= 4) { clearInterval(tapMetronomeRef.current); finishTapSession(); }
        }, beatMs);
      } else { setTapCountdown(count); count--; }
    }, beatMs);
  };

  const finishTapSession = () => {
    setTapActive(false);
    setTapTimes(prev => {
      if (!prev.length) return prev;
      const barMs = (60 / bpm) * 4 * 1000;
      const stepMs = barMs / 16;
      const mapped = Array(16).fill(0);
      prev.forEach(t => {
        const stepIdx = Math.round((t - tapStartRef.current) / stepMs) % 16;
        if (stepIdx >= 0 && stepIdx < 16) mapped[stepIdx] = 1;
      });
      setTapPattern(mapped);
      setShowTapResult(true);
      return prev;
    });
  };

  const recordTap = () => {
    if (!tapActive || tapCountdown > 0) return;
    const ctx = getCtx(audioCtxRef);
    PLAY_FNS[tapTrack](ctx, ctx.currentTime);
    setTapTimes(prev => [...prev, performance.now()]);
  };

  const applyTapToGrid = () => { setPattern(prev => { const n=prev.map(t=>[...t]); n[tapTrack]=[...tapPattern]; return n; }); setShowTapResult(false); setMode('sequence'); };
  const mergeTapToGrid = () => { setPattern(prev => { const n=prev.map(t=>[...t]); tapPattern.forEach((s,i) => { if(s) n[tapTrack][i]=1; }); return n; }); setShowTapResult(false); setMode('sequence'); };

  const dna = analyzePattern(pattern);
  const preset = PRESETS[selectedPreset];
  const buildInstruction = preset.buildSteps[Math.min(buildStep, preset.buildSteps.length-1)];

  const advanceBuild = () => {
    setBuiltTracks(prev => { const n=new Set(prev); n.add(buildInstruction.track); return n; });
    setBuildStep(s => Math.min(s+1, preset.buildSteps.length-1));
    setMutedTracks(prev => { const n=new Set(prev); n.delete(buildInstruction.track); return n; });
  };

  return (
    <div className="min-h-screen bg-stone-950 text-white p-4 md:p-6 space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-violet-400">♩</span> Rhythm Builder
          </h1>
          <p className="text-stone-400 text-sm mt-0.5">Upload your CapCut video → AI extracts the pattern → you see the sequence and learn it</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id:'analyze',  icon:Upload,   label:'Analyze' },
            { id:'tap',      icon:Mic,      label:'Tap' },
            { id:'build',    icon:BookOpen, label:'Build' },
            { id:'sequence', icon:Grid,     label:'Sequence' },
            { id:'sounds',   icon:Zap,      label:'Sounds' },
            { id:'dna',      icon:Eye,      label:'DNA' },
          ].map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setMode(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                mode===id ? 'bg-violet-600 text-white' : 'bg-stone-800 text-stone-400 hover:bg-stone-700 hover:text-white'
              }`}>
              <Icon className="w-3.5 h-3.5"/>{label}
            </button>
          ))}
        </div>
      </div>

      {/* Preset Selector */}
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1.5">
        {PRESETS.map((p,i) => (
          <button key={i} onClick={() => loadPreset(i)}
            className={`flex flex-col items-center gap-0.5 px-1.5 py-2 rounded-xl border text-center transition-all ${
              selectedPreset===i ? 'border-violet-500 bg-violet-500/10 text-white' : 'border-stone-700 bg-stone-900 text-stone-400 hover:border-stone-500 hover:text-white'
            }`}>
            <span className="text-sm">{p.emoji}</span>
            <span className="text-[9px] font-semibold leading-tight">{p.name}</span>
          </button>
        ))}
      </div>

      {/* ── ANALYZE MODE ─────────────────────────────────────────────────── */}
      {mode==='analyze' && (
        <div className="bg-stone-900 rounded-2xl border border-stone-800 p-5 space-y-5">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2 mb-1">
              <Upload className="w-4 h-4 text-violet-400"/>
              Upload Your Beat
            </h2>
            <p className="text-stone-400 text-sm">
              Export your CapCut video (or just the audio), upload it here — the AI will listen, detect the rhythm, and map every hit onto the 16-step grid so you can see exactly what's happening in the pattern.
            </p>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
              dragOver ? 'border-violet-400 bg-violet-900/20' : analyzing ? 'border-stone-700 bg-stone-800/50' : 'border-stone-700 hover:border-violet-600 hover:bg-violet-900/10'
            }`}>
            <input ref={fileInputRef} type="file" accept="audio/*,video/*" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
            {analyzing ? (
              <>
                <Loader className="w-8 h-8 text-violet-400 animate-spin"/>
                <p className="text-violet-300 font-semibold">{analyzeProgress || 'Analysing…'}</p>
                <p className="text-stone-500 text-sm">Detecting beats, key, instruments, and building your Logic Pro guide</p>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-stone-500"/>
                <p className="text-stone-300 font-semibold">Drop your video or audio here</p>
                <p className="text-stone-500 text-sm">MP4, MOV, MP3, WAV, M4A — anything from CapCut</p>
              </>
            )}
          </div>

          {analyzeError && (
            <div className="bg-rose-900/30 border border-rose-800 rounded-xl px-4 py-3 text-rose-300 text-sm">{analyzeError}</div>
          )}

          {/* Analysis Result */}
          {analyzeResult && !analyzing && (
            <div className="space-y-4">
              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-violet-600/20 border border-violet-600/40 rounded-xl px-3 py-2 text-center">
                  <div className="text-2xl font-black text-violet-300">{analyzeResult.bpm}</div>
                  <div className="text-xs text-stone-400">BPM</div>
                </div>
                <div className="bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-center">
                  <div className="text-xl font-black text-white">{analyzeResult.keyInfo?.full || '—'}</div>
                  <div className="text-xs text-stone-400">Key</div>
                </div>
                <div className="bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-center">
                  <div className="text-2xl font-black text-white">{Math.round(analyzeResult.duration)}s</div>
                  <div className="text-xs text-stone-400">Duration</div>
                </div>
                <div className="bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-center">
                  <div className="text-2xl font-black text-white">{analyzeResult.onsetCount}</div>
                  <div className="text-xs text-stone-400">Hits detected</div>
                </div>
              </div>

              {/* Song structure */}
              {analyzeResult.structure?.length > 0 && (
                <div className="bg-stone-800 rounded-xl p-3 border border-stone-700">
                  <div className="text-[10px] text-stone-400 font-semibold uppercase tracking-wide mb-2">Song Structure</div>
                  <div className="flex flex-wrap gap-2">
                    {analyzeResult.structure.map((s, i) => (
                      <div key={i} className="flex items-center gap-1.5 bg-stone-900 rounded-lg px-2.5 py-1 border border-stone-700">
                        <span className="text-xs text-white font-medium">{s.section}</span>
                        <span className="text-[10px] text-stone-500">bars {s.bars}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Instruments detected */}
              {analyzeResult.instruments?.length > 0 && (
                <div className="bg-stone-800 rounded-xl p-3 border border-stone-700">
                  <div className="text-[10px] text-stone-400 font-semibold uppercase tracking-wide mb-2">Instruments Detected</div>
                  <div className="space-y-1.5">
                    {analyzeResult.instruments.map((inst, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${inst.confidence === 'high' ? 'bg-emerald-400' : 'bg-amber-400'}`}/>
                        <div>
                          <span className="text-xs text-white font-medium">{inst.name}</span>
                          <span className="text-[10px] text-stone-500 ml-2">→ Logic Pro: {inst.logicTool}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Frequency energy bars */}
              {analyzeResult.energyBands && (
                <div className="bg-stone-800 rounded-xl p-3 border border-stone-700">
                  <div className="text-[10px] text-stone-400 font-semibold uppercase tracking-wide mb-2">Frequency Layers</div>
                  <div className="space-y-1">
                    {[
                      { key: 'subBass',  label: 'Sub Bass (808/Kick body)', color: 'bg-violet-500' },
                      { key: 'bass',     label: 'Bass (bass guitar/synth)', color: 'bg-emerald-500' },
                      { key: 'lowMid',   label: 'Low Mids (chords/pads)', color: 'bg-blue-400' },
                      { key: 'mid',      label: 'Mids (vocals/keys/melody)', color: 'bg-amber-400' },
                      { key: 'highMid',  label: 'High Mids (synth lead/guitar)', color: 'bg-orange-400' },
                      { key: 'high',     label: 'Highs (hi-hats/strings/air)', color: 'bg-rose-400' },
                    ].map(({ key, label, color }) => (
                      <div key={key} className="flex items-center gap-2">
                        <div className="text-[10px] text-stone-500 w-40 flex-shrink-0">{label}</div>
                        <div className="flex-1 bg-stone-700 rounded-full h-2">
                          <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${Math.round((analyzeResult.energyBands[key] || 0) * 100)}%` }}/>
                        </div>
                        <div className="text-[10px] text-stone-500 w-8 text-right">{Math.round((analyzeResult.energyBands[key] || 0) * 100)}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Genre + preset callout — extracted from AI guide */}
              {analyzeResult.aiGuide && (() => {
                const genreMatch = analyzeResult.aiGuide.match(/## Genre & Style\n([\s\S]*?)(?=\n##)/);
                const presetMatch = analyzeResult.aiGuide.match(/## Start Here.*?\n([\s\S]*?)(?=\n##)/);
                if (!genreMatch && !presetMatch) return null;
                const genreText = genreMatch?.[1]?.trim().split('\n')[0] || '';
                const presetLine = presetMatch?.[1]?.trim().split('\n')[0] || '';
                return (
                  <div className="bg-violet-900/30 border border-violet-700/50 rounded-xl p-4 space-y-2">
                    {genreText && (
                      <div className="flex items-center gap-2">
                        <span className="text-violet-400 text-lg">🎵</span>
                        <span className="text-white font-bold text-sm">{genreText}</span>
                      </div>
                    )}
                    {presetLine && (
                      <div className="flex items-start gap-2">
                        <span className="text-amber-400 text-lg flex-shrink-0">👆</span>
                        <div>
                          <span className="text-amber-300 font-semibold text-sm">Click this preset to start copying: </span>
                          <span className="text-white text-sm">{presetLine}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Tabs: AI Guide | Drum Grid */}
              <div className="flex gap-2 border-b border-stone-700 pb-0">
                {[
                  { id: 'guide', label: '🎛 Full Production Guide' },
                  { id: 'grid',  label: '🥁 Drum Grid' },
                ].map(({ id, label }) => (
                  <button key={id} onClick={() => setGuideTab(id)}
                    className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-all ${
                      guideTab === id ? 'bg-stone-800 text-white border border-b-transparent border-stone-700' : 'text-stone-500 hover:text-stone-300'
                    }`}>{label}</button>
                ))}
              </div>

              {/* AI Production Guide */}
              {guideTab === 'guide' && (
                <div className="bg-stone-800 rounded-xl p-4 border border-stone-700">
                  {analyzeResult.aiGuide ? (
                    <div className="prose prose-invert prose-sm max-w-none text-stone-300 space-y-3">
                      {analyzeResult.aiGuide.split('\n').map((line, i) => {
                        if (line.startsWith('## ')) return <h3 key={i} className="text-violet-300 font-bold text-sm mt-4 mb-1 first:mt-0">{line.replace('## ', '')}</h3>;
                        if (line.match(/^\d+\./)) return <p key={i} className="text-stone-300 text-sm pl-2 border-l-2 border-violet-800">{line}</p>;
                        if (line.startsWith('- ')) return <p key={i} className="text-stone-400 text-sm pl-2">• {line.slice(2)}</p>;
                        if (!line.trim()) return null;
                        return <p key={i} className="text-stone-300 text-sm">{line}</p>;
                      })}
                    </div>
                  ) : (
                    <p className="text-stone-500 text-sm">AI guide could not be generated. Check your API connection.</p>
                  )}
                </div>
              )}

              {/* Drum Grid */}
              {guideTab === 'grid' && (
                <div className="bg-stone-800 rounded-xl p-4 border border-stone-700 space-y-2">
                  <div className="text-xs text-stone-400 font-medium mb-2">Drum pattern — extracted from audio</div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 flex-shrink-0"/>
                    <div className="flex gap-0.5 flex-1">
                      {BEAT_LABELS.map((l,i) => (
                        <div key={i} className={`flex-1 text-center text-[8px] font-mono ${i%4===0?'text-stone-300 ml-0.5':'text-stone-700'}`}>{i%4===0?l:'·'}</div>
                      ))}
                    </div>
                  </div>
                  {TRACKS.map((track, ti) => {
                    const hasHits = analyzeResult.pattern[ti].some(Boolean);
                    return (
                      <div key={ti} className={`flex items-center gap-2 ${hasHits?'opacity-100':'opacity-25'}`}>
                        <div className="w-20 flex-shrink-0 text-right">
                          <span className="text-[10px] text-stone-400">{track.label}</span>
                          <span className="text-[9px] text-stone-600 block font-mono">{track.logicNote}</span>
                        </div>
                        <div className="flex gap-0.5 flex-1">
                          {analyzeResult.pattern[ti].map((s, si) => (
                            <div key={si} className={`flex-1 h-7 rounded-sm ${si%4===0?'ml-0.5':''} ${s?track.color:'bg-stone-700'}`}/>
                          ))}
                        </div>
                        <div className="w-6 text-[10px] text-stone-600 text-center">{analyzeResult.pattern[ti].filter(Boolean).length}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={applyAnalysisToGrid}
                  className="flex-1 bg-violet-600 hover:bg-violet-500 text-white rounded-xl py-3 font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                  <Zap className="w-4 h-4"/> Apply drum grid to Sequencer
                </button>
                <button onClick={() => { setAnalyzeResult(null); setAnalyzeError(''); }}
                  className="px-4 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 text-sm font-semibold border border-stone-700 transition-colors">
                  New
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAP MODE ─────────────────────────────────────────────────────── */}
      {mode==='tap' && (
        <div className="bg-stone-900 rounded-2xl border border-stone-800 p-5 space-y-5">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2 mb-1">
              <Mic className="w-4 h-4 text-violet-400"/>
              Tap Your Rhythm
            </h2>
            <p className="text-stone-400 text-sm">
              Play your reference track in CapCut or anywhere. Select which sound you're tapping (kick, snare, etc.), set BPM, then tap along. Each tap gets mapped to the exact 16th note position.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-48">
              <span className="text-xs text-stone-500 font-mono w-10">{bpm}</span>
              <input type="range" min={60} max={200} value={bpm} onChange={e => setBpm(Number(e.target.value))} className="flex-1 accent-violet-500"/>
              <span className="text-xs text-stone-500 w-8">BPM</span>
            </div>
            <button onClick={tapTempo} className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-white text-sm font-semibold border border-stone-700 transition-colors">
              Tap BPM
            </button>
          </div>

          <div>
            <div className="text-xs text-stone-500 font-medium mb-2">Which sound are you tapping?</div>
            <div className="flex flex-wrap gap-2">
              {TRACKS.map((t,i) => (
                <button key={i} onClick={() => setTapTrack(i)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    tapTrack===i ? `${t.color} border-transparent text-white` : 'bg-stone-800 border-stone-700 text-stone-400 hover:text-white'
                  }`}>{t.label}</button>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center gap-4">
            {!tapActive && !showTapResult && (
              <button onClick={startTapSession}
                className="w-full max-w-sm h-24 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-lg transition-all active:scale-95 flex flex-col items-center justify-center gap-1 shadow-lg shadow-violet-900/40">
                <Mic className="w-6 h-6"/>
                Start — I'll count you in
              </button>
            )}
            {tapActive && tapCountdown > 0 && (
              <div className="w-full max-w-sm h-24 rounded-2xl bg-stone-800 border-2 border-violet-500 flex flex-col items-center justify-center">
                <div className="text-5xl font-black text-violet-400">{tapCountdown}</div>
                <div className="text-xs text-stone-400">counting in…</div>
              </div>
            )}
            {tapActive && tapCountdown===0 && (
              <button onClick={recordTap}
                className="w-full max-w-sm h-24 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-lg transition-all active:scale-95 flex flex-col items-center justify-center gap-1 shadow-lg shadow-rose-900/40 select-none">
                <div className="w-4 h-4 rounded-full bg-white animate-pulse"/>
                TAP — {tapTimes.length} hits
              </button>
            )}
            {showTapResult && (
              <div className="w-full space-y-4">
                <div className="bg-stone-800 rounded-xl p-4 border border-stone-700">
                  <div className="text-xs text-stone-400 font-medium mb-2">Your {TRACKS[tapTrack].label} pattern — {tapTimes.length} taps</div>
                  <div className="flex gap-0.5">
                    {tapPattern.map((s,i) => (
                      <div key={i} className={`flex-1 h-10 rounded-sm ${i%4===0?'ml-0.5':''} ${s?`${TRACKS[tapTrack].color}`:'bg-stone-700'}`}/>
                    ))}
                  </div>
                  <div className="flex gap-0.5 mt-0.5">
                    {BEAT_LABELS.map((l,i) => (
                      <div key={i} className={`flex-1 text-center text-[8px] font-mono ${i%4===0?'text-stone-400 ml-0.5':'text-stone-700'}`}>{i%4===0?l:''}</div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={applyTapToGrid} className="px-3 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors">Replace layer</button>
                  <button onClick={mergeTapToGrid} className="px-3 py-2.5 rounded-xl bg-stone-700 hover:bg-stone-600 text-white text-sm font-semibold transition-colors">Merge in</button>
                  <button onClick={() => { setShowTapResult(false); setTapTimes([]); }} className="px-3 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-sm font-semibold border border-stone-700 transition-colors">Try again</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── BUILD MODE ───────────────────────────────────────────────────── */}
      {mode==='build' && (
        <div className="bg-stone-900 rounded-2xl border border-stone-800 p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{preset.emoji}</span>
                <h2 className="text-lg font-bold">{preset.name}</h2>
                <span className="text-xs bg-stone-800 text-stone-400 px-2 py-0.5 rounded-full">{preset.genre}</span>
              </div>
              <p className="text-stone-400 text-sm">{preset.feel}</p>
            </div>
            <button onClick={() => { setBuildStep(0); setBuiltTracks(new Set()); }} className="text-stone-500 hover:text-stone-300 p-1.5 rounded-lg hover:bg-stone-800 transition-colors flex-shrink-0">
              <RotateCcw className="w-4 h-4"/>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {preset.buildSteps.map((_,i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full ${i<buildStep?'bg-violet-500':i===buildStep?'bg-violet-400 animate-pulse':'bg-stone-700'}`}/>
            ))}
          </div>

          <div className="bg-stone-800 rounded-xl p-4 border border-stone-700">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-3 h-3 rounded-full ${TRACKS[buildInstruction.track].dot}`}/>
              <span className="text-xs font-semibold text-stone-400 uppercase tracking-wide">
                Step {Math.min(buildStep, preset.buildSteps.length-1)+1} of {preset.buildSteps.length} — {TRACKS[buildInstruction.track].label}
              </span>
            </div>
            <p className="text-white font-semibold text-base mb-1">{buildInstruction.label}</p>
            <p className="text-stone-400 text-sm">{buildInstruction.tip}</p>
          </div>

          <div className="space-y-2">
            {TRACKS.map((track, ti) => {
              const isActive = ti===buildInstruction.track, isBuilt = builtTracks.has(ti), show = isActive||isBuilt;
              return (
                <div key={ti} className={`flex items-center gap-2 transition-all ${show?'opacity-100':'opacity-15'}`}>
                  <div className={`text-xs font-medium w-16 text-right flex-shrink-0 ${isActive?'text-white':'text-stone-500'}`}>{track.label}</div>
                  <div className="flex gap-0.5 flex-1">
                    {pattern[ti].map((s,si) => (
                      <div key={si} className={`flex-1 h-6 rounded-sm transition-all ${si%4===0?'ml-0.5':''} ${
                        s&&show ? isActive?`${track.color} shadow-lg`:`${track.color} opacity-60` : 'bg-stone-800'
                      } ${currentStep===si&&playing&&show&&s?'scale-y-125 brightness-125':''}`}/>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <button onClick={advanceBuild}
            disabled={buildStep>=preset.buildSteps.length-1&&builtTracks.has(buildInstruction.track)}
            className="w-full bg-violet-600 hover:bg-violet-500 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-40">
            {buildStep<preset.buildSteps.length-1 ? <><ChevronRight className="w-4 h-4"/>Add Layer</> : <><Zap className="w-4 h-4"/>Full Pattern — Play It</>}
          </button>
        </div>
      )}

      {/* ── SEQUENCE MODE ────────────────────────────────────────────────── */}
      {mode==='sequence' && (
        <div className="bg-stone-900 rounded-2xl border border-stone-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Grid className="w-4 h-4 text-violet-400"/>
              Step Sequencer
            </h2>
            <span className="text-stone-500 text-xs">Click step = toggle • Track name = mute</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-20 flex-shrink-0"/>
            <div className="flex gap-0.5 flex-1">
              {BEAT_LABELS.map((l,i) => (
                <div key={i} className={`flex-1 text-center text-[9px] font-mono ${i%4===0?'text-stone-300 ml-0.5':'text-stone-600'}`}>{i%4===0?l:'·'}</div>
              ))}
            </div>
            <div className="w-10 flex-shrink-0"/>
          </div>

          <div className="space-y-1.5">
            {TRACKS.map((track, ti) => (
              <div key={ti} className="flex items-center gap-2">
                <button onClick={() => toggleMute(ti)}
                  className={`text-[10px] font-medium w-20 text-right flex-shrink-0 leading-tight transition-colors ${
                    mutedTracks.has(ti)?'text-stone-600 line-through':'text-stone-300 hover:text-white'
                  }`}>
                  {track.label}<span className="block text-stone-600 font-mono">{track.logicNote}</span>
                </button>
                <div className="flex gap-0.5 flex-1">
                  {pattern[ti].map((s,si) => (
                    <button key={si} onClick={() => toggleStep(ti,si)}
                      className={`flex-1 h-8 rounded-sm transition-all active:scale-95 ${si%4===0?'ml-0.5':''} ${
                        s
                          ? `${track.color} opacity-90 hover:opacity-100 ${currentStep===si&&playing?'scale-y-125 brightness-150':''}`
                          : `${currentStep===si&&playing?'bg-stone-600':'bg-stone-800'} hover:bg-stone-700`
                      }`}/>
                  ))}
                </div>
                <div className="w-6 text-[10px] text-stone-600 text-center">{pattern[ti].filter(Boolean).length}</div>
              </div>
            ))}
          </div>

          <div className="bg-stone-800/50 rounded-xl p-3 border border-stone-700 text-xs text-stone-400">
            <span className="text-stone-300 font-semibold">Logic Pro: </span>
            Steps 1–16 = one bar of 16th notes. Beat 1 = step 1, beat 2 = step 5, beat 3 = step 9, beat 4 = step 13. The Logic note column shows which MIDI note triggers each drum sound in Drum Machine Designer.
          </div>
        </div>
      )}

      {/* ── SOUNDS MODE ──────────────────────────────────────────────────── */}
      {mode==='sounds' && (
        <div className="bg-stone-900 rounded-2xl border border-stone-800 p-5 space-y-5">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-violet-400"/>
              Sound Library — {preset.name}
            </h2>
            <p className="text-stone-400 text-sm">
              Every sound you need to build this rhythm. Where to find it in Logic Pro, how to set it up, and where to download it if you need more options.
            </p>
          </div>

          {/* Where to get sounds — paid & free */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: '✅ Built into Logic Pro', desc: 'Logic ships with thousands of free sounds. Everything listed below is available right now — no download needed.', tag: 'FREE', tagColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-700/50' },
              { label: '🎧 Splice', desc: 'The biggest sample store. $7.99/mo gets you credits to download any sound — kicks, 808s, hi-hats, pads, vocals, everything.', tag: 'PAID', tagColor: 'bg-amber-500/20 text-amber-300 border-amber-700/50' },
              { label: '🆓 Looperman', desc: 'Free drum samples, loops, one-shots. Search by genre. No signup needed to download. Great for extra kicks and percs.', tag: 'FREE', tagColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-700/50' },
              { label: '🎹 Splice Sounds', desc: 'Specific packs: "808 Mafia Drum Kit", "Gospel Drum Kit Vol 2", "Afrobeats Essential Drums". Search by genre on Splice.', tag: 'PAID', tagColor: 'bg-amber-500/20 text-amber-300 border-amber-700/50' },
              { label: '📦 Native Instruments', desc: 'Battery 4 and Maschine packs — professional producer-grade drums used on major label records. Expensive but industry standard.', tag: 'PAID', tagColor: 'bg-amber-500/20 text-amber-300 border-amber-700/50' },
              { label: '🎸 Sample Focus', desc: 'Free one-shots and loops. High quality. You can filter by BPM, key, genre. samplefocus.com', tag: 'FREE', tagColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-700/50' },
            ].map(({ label, desc, tag, tagColor }) => (
              <div key={label} className="bg-stone-800 rounded-xl p-3 border border-stone-700">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-white">{label}</span>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${tagColor}`}>{tag}</span>
                </div>
                <p className="text-stone-400 text-xs">{desc}</p>
              </div>
            ))}
          </div>

          {/* Per-track sound guide */}
          <div className="space-y-4">
            {getSoundsForPreset(preset.name).map((trackSound, i) => (
              <div key={i} className="bg-stone-800 rounded-xl border border-stone-700 overflow-hidden">
                {/* Track header */}
                <div className={`flex items-center gap-3 px-4 py-3 ${TRACKS[i].color} bg-opacity-20`} style={{background: 'rgba(0,0,0,0.3)'}}>
                  <span className="text-xl">{trackSound.emoji}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-sm">{trackSound.track}</span>
                      <span className={`w-2 h-2 rounded-full ${TRACKS[i].dot}`}/>
                      <span className="text-stone-400 text-xs font-mono">Logic note: {TRACKS[i].logicNote}</span>
                    </div>
                    <p className="text-stone-400 text-xs">{trackSound.role}</p>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  {/* Sound options */}
                  <div className="space-y-2">
                    {trackSound.sounds.map((s, si) => (
                      <div key={si} className="bg-stone-900 rounded-lg p-3 border border-stone-700">
                        <div className="flex items-start gap-2">
                          <span className="text-violet-400 font-bold text-xs mt-0.5 flex-shrink-0">#{si + 1}</span>
                          <div className="flex-1">
                            <p className="text-white font-semibold text-sm">{s.name}</p>
                            <p className="text-violet-300 text-xs mt-0.5 font-mono">{s.where}</p>
                            <p className="text-stone-400 text-xs mt-1">{s.tip}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Settings */}
                  <div className="bg-stone-950/50 rounded-lg p-3 border border-stone-700/50">
                    <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wide">Logic Pro settings: </span>
                    <span className="text-stone-300 text-xs">{trackSound.settings}</span>
                  </div>

                  {/* Where to load it */}
                  <div className="bg-stone-950/50 rounded-lg p-3 border border-stone-700/50">
                    <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wide">How to load: </span>
                    <span className="text-stone-300 text-xs font-mono">{trackSound.logicPath}</span>
                  </div>

                  {/* Free source */}
                  <div className="bg-stone-950/50 rounded-lg p-3 border border-stone-700/50">
                    <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-wide">Free download: </span>
                    <span className="text-stone-300 text-xs">{trackSound.freeSource}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* How to add a downloaded sound */}
          <div className="bg-violet-900/20 border border-violet-800/40 rounded-xl p-4">
            <p className="text-violet-300 text-sm font-semibold mb-2">How to load a downloaded sound into Logic Pro</p>
            <ol className="space-y-1 text-stone-400 text-sm">
              <li>1. Download the .wav or .mp3 file to your Mac</li>
              <li>2. Open Logic Pro → open your Drum Machine Designer</li>
              <li>3. Click the pad you want to change (e.g. the Kick pad)</li>
              <li>4. In the top-left of the pad: click the waveform icon → "Load Sample"</li>
              <li>5. Navigate to your downloaded file → click Open</li>
              <li>6. Done — that pad now plays your custom sound</li>
            </ol>
          </div>
        </div>
      )}

      {/* ── DNA MODE ─────────────────────────────────────────────────────── */}
      {mode==='dna' && (
        <div className="bg-stone-900 rounded-2xl border border-stone-800 p-5 space-y-5">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Eye className="w-4 h-4 text-violet-400"/>
            Rhythm DNA — Bones & Flesh
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label:'Groove Type',   value:dna.groove,              sub:'kick/snare placement' },
              { label:'Density',       value:`${dna.density}%`,       sub:'steps that hit' },
              { label:'Active Layers', value:`${dna.activeTracks}/8`, sub:'instruments in use' },
              { label:'On vs Off',     value:`${dna.onBeat}:${dna.offBeat}`, sub:'downbeats vs upbeats' },
            ].map(({ label, value, sub }) => (
              <div key={label} className="bg-stone-800 rounded-xl p-3 border border-stone-700">
                <div className="text-xs text-stone-500 mb-1">{label}</div>
                <div className="text-xl font-bold">{value}</div>
                <div className="text-[10px] text-stone-600 mt-0.5">{sub}</div>
              </div>
            ))}
          </div>

          {/* Heatmap */}
          <div>
            <div className="text-xs text-stone-400 font-medium mb-2">Heatmap — density per 16th note</div>
            <div className="flex gap-0.5">
              {Array.from({length:16},(_,si) => {
                const hits = pattern.filter(t=>t[si]).length;
                return (
                  <div key={si} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-sm" style={{height:`${Math.max(4,(hits/8)*60)}px`, background:`rgba(139,92,246,${0.15+(hits/8)*0.85})`}}/>
                    <span className={`text-[9px] font-mono ${si%4===0?'text-stone-300':'text-stone-700'}`}>{si%4===0?si/4+1:'·'}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Layer breakdown — bones vs flesh */}
          <div>
            <div className="text-xs text-stone-400 font-medium mb-2">Bones → Flesh — layer by layer</div>
            <div className="space-y-1.5">
              {[
                { label:'BONES', tracks:[0,1], desc:'Kick + Snare — the skeleton. Everything else is optional.' },
                { label:'FLESH', tracks:[2,3,4,5,6,7], desc:'Hi-hats, bass, clap, perc — the body and texture.' },
              ].map(({ label, tracks, desc }) => (
                <div key={label}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[9px] font-black tracking-widest ${label==='BONES'?'text-violet-400':'text-rose-400'}`}>{label}</span>
                    <span className="text-[10px] text-stone-600">{desc}</span>
                  </div>
                  {tracks.map(ti => {
                    const hits = pattern[ti].filter(Boolean).length;
                    if (!hits) return null;
                    return (
                      <div key={ti} className="flex items-center gap-3 mb-1">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${TRACKS[ti].dot}`}/>
                        <div className="w-20 text-[10px] text-stone-400 flex-shrink-0">{TRACKS[ti].label}</div>
                        <div className="flex gap-0.5 flex-1">
                          {pattern[ti].map((s,si) => (
                            <div key={si} className={`flex-1 h-4 rounded-sm ${si%4===0?'ml-0.5':''} ${s?TRACKS[ti].color:'bg-stone-800'}`}/>
                          ))}
                        </div>
                        <div className="text-[10px] text-stone-600 w-6 text-center">{hits}</div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-stone-800/60 rounded-xl p-4 border border-stone-700">
            <div className="text-xs font-semibold text-violet-400 uppercase tracking-wide mb-1">What makes this pattern work</div>
            <p className="text-stone-300 text-sm">{preset.feel}</p>
          </div>
        </div>
      )}

      {/* ── Transport ────────────────────────────────────────────────────── */}
      <div className="bg-stone-900 rounded-2xl border border-stone-800 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <button onClick={playing?stopPlayback:startPlayback}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
              playing?'bg-stone-700 text-white hover:bg-stone-600':'bg-violet-600 text-white hover:bg-violet-500'
            }`}>
            {playing?<Pause className="w-4 h-4"/>:<Play className="w-4 h-4"/>}
            {playing?'Stop':'Play Pattern'}
          </button>
          <div className="flex items-center gap-3 flex-1 min-w-48">
            <span className="text-xs text-stone-500 font-mono w-8">{bpm}</span>
            <input type="range" min={60} max={200} value={bpm} onChange={e => setBpm(Number(e.target.value))} className="flex-1 accent-violet-500"/>
            <span className="text-xs text-stone-500 w-8">BPM</span>
          </div>
          <div className="flex gap-0.5 ml-auto">
            {Array.from({length:16},(_,i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${currentStep===i&&playing?'bg-violet-400 scale-150':'bg-stone-700'}`}/>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
