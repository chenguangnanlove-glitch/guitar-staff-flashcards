/**
 * 随机抽取 5 个「弦号 + 品位」，打印完整推算链：
 * 实际音高 → 谱上音高（+12）→ 音名 / 固定唱名 → 五线谱位置 / 加线。
 *
 * 用法：npm run selfcheck
 */
import { randomInt } from 'node:crypto';
import {
  CIRCLED_NUMBERS,
  STRING_TUNING,
  describeDiatonicStep,
  ledgerLinesFor,
  makeNote,
  midiToFrequency,
  spellPitch,
} from '../js/music.js';

const positions = [];
for (let string = 1; string <= 6; string += 1) {
  for (let fret = 0; fret <= 12; fret += 1) positions.push({ string, fret });
}

const picked = [];
const pool = [...positions];
for (let index = 0; index < 5; index += 1) {
  const choice = randomInt(pool.length);
  picked.push(pool.splice(choice, 1)[0]);
}

console.log('吉他五线谱闪卡 · 随机自检（标准调弦，吉他谱高八度记谱）');
console.log('说明：实际音高 = 空弦实际音高 + 品位；谱上音高 = 实际音高 + 12 个半音。\n');

for (const { string, fret } of picked) {
  const note = makeNote(string, fret, 'sharp');
  const ledger = ledgerLinesFor(note.pitch.diatonicStep);
  const ledgerText = ledger.count
    ? `${ledger.count} 条${ledger.direction === 'below' ? '下' : '上'}加线（${ledger.lines.map((step) => describeDiatonicStep(step)).join('、')}）`
    : '无加线';
  console.log(
    `${CIRCLED_NUMBERS[string]}弦 ${fret === 0 ? '空弦' : `${fret} 品`}  →  ` +
    `实际 ${spellPitch(note.actualMidi).fullName} (MIDI ${note.actualMidi}, ${midiToFrequency(note.actualMidi).toFixed(1)} Hz)  →  ` +
    `谱上 ${note.pitch.fullName} (MIDI ${note.writtenMidi})  →  ` +
    `音名 ${note.pitch.name} / 唱名 ${note.pitch.solfege}  →  ` +
    `位置 ${describeDiatonicStep(note.pitch.diatonicStep)}，${ledgerText}`,
  );
  if (note.writtenMidi !== STRING_TUNING[string].midi + fret + 12) {
    throw new Error('谱上音高不等于实际音高 + 12');
  }
}

console.log('\n检查：以上 5 个位置均由「弦号 + 品位」推算，谱上音高全部等于实际音高 + 12。');
