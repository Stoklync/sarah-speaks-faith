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

// Full analysis pipeline — returns { bpm, pattern, onsetCount, duration }
async function analyzeAudioBuffer(audioBuffer) {
  // Mix to mono, take first 10 seconds
  const sampleRate = audioBuffer.sampleRate;
  const maxSamples = Math.min(audioBuffer.length, sampleRate * 10);
  const mono = new Float32Array(maxSamples);
  const nCh = audioBuffer.numberOfChannels;
  for (let ch = 0; ch < nCh; ch++) {
    const chData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < maxSamples; i++) mono[i] += chData[i] / nCh;
  }

  const onsets = detectOnsets(mono, sampleRate);
  const bpm = estimateBPM(onsets);
  const classes = classifyOnsets(mono, onsets, sampleRate);

  // Find the densest bar (most onsets) as the representative beat
  const barDur = (60 / bpm) * 4;
  const numBars = Math.floor((maxSamples / sampleRate) / barDur);
  let bestBar = 0, bestCount = 0;
  for (let b = 0; b < Math.max(1, numBars); b++) {
    const barStart = b * barDur;
    const barEnd = barStart + barDur;
    const count = onsets.filter(t => t >= barStart && t < barEnd).length;
    if (count > bestCount) { bestCount = count; bestBar = b; }
  }
  const startTime = bestBar * barDur;
  const pattern = mapToGrid(onsets, classes, bpm, startTime);

  return { bpm, pattern, onsetCount: onsets.length, duration: maxSamples / sampleRate };
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
  const [analyzeResult, setAnalyzeResult] = useState(null);
  const [analyzeError, setAnalyzeError] = useState('');
  const [dragOver, setDragOver] = useState(false);
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

    setAnalyzing(true); setAnalyzeError(''); setAnalyzeResult(null);
    try {
      const ctx = getCtx(audioCtxRef);
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const result = await analyzeAudioBuffer(audioBuffer);
      setAnalyzeResult({ ...result, fileName: file.name });
    } catch (err) {
      setAnalyzeError('Could not decode this file. Try an MP3, WAV, or M4A audio file exported from CapCut.');
      console.error(err);
    } finally {
      setAnalyzing(false);
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
                <p className="text-violet-300 font-semibold">Listening to the rhythm…</p>
                <p className="text-stone-500 text-sm">Detecting beats, mapping to grid</p>
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
              <div className="flex items-center gap-3 flex-wrap">
                <div className="bg-violet-600/20 border border-violet-600/40 rounded-xl px-4 py-2 text-center">
                  <div className="text-2xl font-black text-violet-300">{analyzeResult.bpm}</div>
                  <div className="text-xs text-stone-400">BPM detected</div>
                </div>
                <div className="bg-stone-800 border border-stone-700 rounded-xl px-4 py-2 text-center">
                  <div className="text-2xl font-black text-white">{analyzeResult.onsetCount}</div>
                  <div className="text-xs text-stone-400">hits found</div>
                </div>
                <div className="bg-stone-800 border border-stone-700 rounded-xl px-4 py-2 text-center">
                  <div className="text-2xl font-black text-white">{Math.round(analyzeResult.duration)}s</div>
                  <div className="text-xs text-stone-400">analyzed</div>
                </div>
                <div className="text-stone-500 text-xs flex-1">
                  From: <span className="text-stone-300">{analyzeResult.fileName}</span>
                </div>
              </div>

              {/* Extracted pattern preview */}
              <div className="bg-stone-800 rounded-xl p-4 border border-stone-700 space-y-2">
                <div className="text-xs text-stone-400 font-medium mb-3">Extracted pattern — bones and flesh</div>

                {/* Beat labels */}
                <div className="flex items-center gap-2">
                  <div className="w-20 flex-shrink-0"/>
                  <div className="flex gap-0.5 flex-1">
                    {BEAT_LABELS.map((l,i) => (
                      <div key={i} className={`flex-1 text-center text-[8px] font-mono ${i%4===0?'text-stone-300 ml-0.5':'text-stone-700'}`}>
                        {i%4===0?l:'·'}
                      </div>
                    ))}
                  </div>
                </div>

                {TRACKS.map((track, ti) => {
                  const hasHits = analyzeResult.pattern[ti].some(Boolean);
                  return (
                    <div key={ti} className={`flex items-center gap-2 ${hasHits?'opacity-100':'opacity-25'}`}>
                      <div className="w-20 flex-shrink-0 text-right">
                        <span className="text-[10px] text-stone-400">{track.label}</span>
                        <span className="text-[9px] text-stone-600 block">{track.logicNote}</span>
                      </div>
                      <div className="flex gap-0.5 flex-1">
                        {analyzeResult.pattern[ti].map((s, si) => (
                          <div key={si} className={`flex-1 h-7 rounded-sm ${si%4===0?'ml-0.5':''} ${
                            s ? `${track.color}` : 'bg-stone-700'
                          }`}/>
                        ))}
                      </div>
                      <div className="w-6 text-[10px] text-stone-600 text-center">
                        {analyzeResult.pattern[ti].filter(Boolean).length}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Logic Pro mapping */}
              <div className="bg-stone-800/50 rounded-xl p-3 border border-stone-700">
                <div className="text-[10px] text-stone-400 font-semibold uppercase tracking-wide mb-1.5">Logic Pro — where to find each sound</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TRACKS.filter((_,i) => analyzeResult.pattern[i].some(Boolean)).map((track, _i) => {
                    const actualIdx = TRACKS.indexOf(track);
                    return (
                      <div key={actualIdx} className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${track.dot} flex-shrink-0`}/>
                        <span className="text-xs text-stone-400">{track.label}</span>
                        <span className="text-xs text-stone-600 font-mono ml-auto">{track.logicNote}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={applyAnalysisToGrid}
                  className="flex-1 bg-violet-600 hover:bg-violet-500 text-white rounded-xl py-3 font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                  <Zap className="w-4 h-4"/>
                  Apply to Sequencer — edit & play
                </button>
                <button onClick={() => { setAnalyzeResult(null); setAnalyzeError(''); }}
                  className="px-4 py-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 text-sm font-semibold border border-stone-700 transition-colors">
                  New
                </button>
              </div>

              <p className="text-stone-600 text-xs text-center">
                Not 100% perfect — AI beat detection is good but not magic. Use Sequence mode to fix any steps that are off.
              </p>
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
