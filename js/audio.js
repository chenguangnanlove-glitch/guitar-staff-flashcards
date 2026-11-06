/**
 * audio.js — 用 Web Audio 振荡器合成柔和的吉他音色。
 * 不加载任何音频文件；只在用户点击「听一下」时播放实际音高。
 */

import { midiToFrequency } from './music.js';

let audioContext = null;
let active = null;

function getContext() {
  if (audioContext) return audioContext;
  const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Context) return null;
  audioContext = new Context();
  return audioContext;
}

function stopActive() {
  if (!active) return;
  const { nodes, gain, ctx } = active;
  const now = ctx.currentTime;
  try {
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(0.0001, now, 0.02);
  } catch {
    // 忽略已停止的节点
  }
  for (const node of nodes) {
    try {
      node.stop(now + 0.08);
    } catch {
      // 已经停止
    }
  }
  active = null;
}

/**
 * 生成一小段带衰减的白噪声，用作拨弦瞬态。
 * 不引入任何音频文件；每次播放现算。
 */
function createPluckNoise(ctx, seconds = 0.014) {
  const length = Math.max(32, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    const envelope = (1 - i / length) ** 3;
    data[i] = (Math.random() * 2 - 1) * envelope;
  }
  return buffer;
}

/**
 * 播放实际音高（不是谱面高八度音高）。
 * 正弦基频 + 少量谐波，再叠一层极短的噪声瞬态模拟拨片触弦。
 * @param {number} actualMidi 实际 MIDI，例如 6 弦空弦 E2 = 40
 * @param {{duration?:number, volume?:number}} options
 */
export function playMidi(actualMidi, { duration = 1.25, volume = 0.16 } = {}) {
  const ctx = getContext();
  if (!ctx) return Promise.resolve(false);
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  stopActive();

  const frequency = midiToFrequency(actualMidi);
  const start = ctx.currentTime + 0.015;
  const end = start + duration;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, start);
  master.gain.exponentialRampToValueAtTime(volume, start + 0.018);
  master.gain.exponentialRampToValueAtTime(volume * 0.42, start + 0.22);
  master.gain.exponentialRampToValueAtTime(0.0001, end);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.min(4200, Math.max(1000, frequency * 12)), start);
  filter.Q.value = 0.5;

  const fundamental = ctx.createOscillator();
  fundamental.type = 'sine';
  fundamental.frequency.value = frequency;

  const second = ctx.createOscillator();
  second.type = 'triangle';
  second.frequency.value = frequency * 2;
  const secondGain = ctx.createGain();
  secondGain.gain.value = 0.11;

  const third = ctx.createOscillator();
  third.type = 'sine';
  third.frequency.value = frequency * 3;
  const thirdGain = ctx.createGain();
  thirdGain.gain.value = 0.04;

  // 拨弦瞬态：14ms 噪声，带通在基频的 4 倍附近，绕过起音包络直接进滤波器。
  const pluck = ctx.createBufferSource();
  pluck.buffer = createPluckNoise(ctx);
  const pluckFilter = ctx.createBiquadFilter();
  pluckFilter.type = 'bandpass';
  pluckFilter.frequency.value = Math.min(6000, Math.max(400, frequency * 4));
  pluckFilter.Q.value = 0.9;
  const pluckGain = ctx.createGain();
  pluckGain.gain.value = 0.09;

  fundamental.connect(master);
  second.connect(secondGain).connect(master);
  third.connect(thirdGain).connect(master);
  master.connect(filter).connect(ctx.destination);
  pluck.connect(pluckFilter).connect(pluckGain).connect(filter);

  fundamental.start(start);
  second.start(start);
  third.start(start);
  pluck.start(start);
  fundamental.stop(end + 0.05);
  second.stop(end + 0.05);
  third.stop(end + 0.05);

  active = {
    ctx,
    gain: master,
    nodes: [fundamental, second, third, pluck],
  };
  fundamental.addEventListener('ended', () => {
    if (active && active.nodes.includes(fundamental)) active = null;
  });

  return new Promise((resolve) => {
    setTimeout(() => resolve(true), Math.round(duration * 1000));
  });
}

/** 只用于用户点击「听一下」时，播放该题的实际音高。 */
export function playNote(note, options = {}) {
  return playMidi(note.actualMidi, options);
}

export function stopAudio() {
  stopActive();
}
