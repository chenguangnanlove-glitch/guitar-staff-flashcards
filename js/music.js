/**
 * music.js — 全部音乐计算的唯一来源。
 *
 * 规则（与 README 一致）：
 * 1. 标准调弦，实际音高：6弦 E2 / 5弦 A2 / 4弦 D3 / 3弦 G3 / 2弦 B3 / 1弦 E4。
 * 2. 吉他记谱比实际音高高八度：writtenMidi = actualMidi + 12。
 * 3. 题库只存「弦号 + 品位」，音名、唱名、谱上位置都从它们推算。
 * 4. 固定唱名：C=do, D=re, E=mi, F=fa, G=sol, A=la, B=si。
 *
 * 本文件不依赖 DOM，可直接在 Node 中做单元测试。
 */

export const STRINGS = Object.freeze([1, 2, 3, 4, 5, 6]);

/** 弦号 -> 空弦实际音高（MIDI）。1 弦为高音 E。 */
export const STRING_TUNING = Object.freeze({
  1: Object.freeze({ midi: 64, label: 'E4' }),
  2: Object.freeze({ midi: 59, label: 'B3' }),
  3: Object.freeze({ midi: 55, label: 'G3' }),
  4: Object.freeze({ midi: 50, label: 'D3' }),
  5: Object.freeze({ midi: 45, label: 'A2' }),
  6: Object.freeze({ midi: 40, label: 'E2' }),
});

/** 吉他谱上的音高 = 实际音高 + 12 个半音。 */
export const WRITTEN_OCTAVE_OFFSET = 12;

/** 高音谱表的五条线：E4(下第一线) 到 F5(上第五线)。 */
export const STAFF_BOTTOM_STEP = 30; // E4
export const STAFF_TOP_STEP = 38; // F5

export const LETTER_NAMES = Object.freeze(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
export const LETTER_TO_PC = Object.freeze({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 });
export const PC_TO_LETTER = Object.freeze({ 0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A', 11: 'B' });
export const NATURAL_PITCH_CLASSES = Object.freeze([0, 2, 4, 5, 7, 9, 11]);
export const NATURAL_PC_SET = new Set(NATURAL_PITCH_CLASSES);

export const SHARP_NAMES = Object.freeze([
  'C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B',
]);
export const FLAT_NAMES = Object.freeze([
  'C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B',
]);
const SHARP_SOLFEGE = Object.freeze([
  'do', 'do♯', 're', 're♯', 'mi', 'fa', 'fa♯', 'sol', 'sol♯', 'la', 'la♯', 'si',
]);
const FLAT_SOLFEGE = Object.freeze([
  'do', 're♭', 're', 'mi♭', 'mi', 'fa', 'sol♭', 'sol', 'la♭', 'la', 'si♭', 'si',
]);
const NATURAL_SOLFEGE = Object.freeze({
  0: 'do', 2: 're', 4: 'mi', 5: 'fa', 7: 'sol', 9: 'la', 11: 'si',
});

export const CIRCLED_NUMBERS = Object.freeze({
  1: '①', 2: '②', 3: '③', 4: '④', 5: '⑤', 6: '⑥',
});

export const ACCIDENTAL_STYLES = Object.freeze(['sharp', 'flat']);

export function assertStringNumber(stringNumber) {
  if (!Number.isInteger(stringNumber) || stringNumber < 1 || stringNumber > 6) {
    throw new RangeError(`无效的弦号：${stringNumber}`);
  }
}

export function assertFret(fret, maxFret = 24) {
  if (!Number.isInteger(fret) || fret < 0 || fret > maxFret) {
    throw new RangeError(`无效的品位：${fret}`);
  }
}

export function pitchClassOf(midi) {
  return ((midi % 12) + 12) % 12;
}

export function octaveOfMidi(midi) {
  return Math.floor(midi / 12) - 1;
}

export function isNaturalPitchClass(pc) {
  return NATURAL_PC_SET.has(pitchClassOf(pc));
}

/** 弦号 + 品位 -> 实际音高（MIDI）。 */
export function actualMidiFor(stringNumber, fret) {
  assertStringNumber(stringNumber);
  assertFret(fret);
  return STRING_TUNING[stringNumber].midi + fret;
}

/** 弦号 + 品位 -> 谱面音高（MIDI）。吉他谱高八度记谱。 */
export function writtenMidiFor(stringNumber, fret) {
  return actualMidiFor(stringNumber, fret) + WRITTEN_OCTAVE_OFFSET;
}

/**
 * 将一个 MIDI 音高按指定升降号风格拼写。
 * 自然音永远不带升降号；变化音统一用升号或统一用降号。
 */
export function spellPitch(midi, accidentalStyle = 'sharp') {
  if (!Number.isFinite(midi)) throw new TypeError(`无效的 MIDI：${midi}`);
  const style = accidentalStyle === 'flat' ? 'flat' : 'sharp';
  const pc = pitchClassOf(midi);
  const octave = octaveOfMidi(midi);
  const natural = NATURAL_PC_SET.has(pc);

  let letter;
  let accidental = '';
  let name;
  let solfege;

  if (natural) {
    letter = PC_TO_LETTER[pc];
    name = letter;
    solfege = NATURAL_SOLFEGE[pc];
  } else if (style === 'flat') {
    name = FLAT_NAMES[pc];
    letter = name[0];
    accidental = 'b';
    solfege = FLAT_SOLFEGE[pc];
  } else {
    name = SHARP_NAMES[pc];
    letter = name[0];
    accidental = '#';
    solfege = SHARP_SOLFEGE[pc];
  }

  const diatonicStep = octave * 7 + LETTER_NAMES.indexOf(letter);
  const vexKey = `${letter.toLowerCase()}${accidental}/${octave}`;

  return {
    midi,
    pitchClass: pc,
    octave,
    letter,
    accidental,
    name,
    fullName: `${name}${octave}`,
    solfege,
    diatonicStep,
    vexKey,
    isNatural: natural,
  };
}

/** 谱面音高对应的自然音级步数：C0=0, D0=1, …，E4=30（下第一线）。 */
export function diatonicStepFor(midi, accidentalStyle = 'sharp') {
  return spellPitch(midi, accidentalStyle).diatonicStep;
}

/** VexFlow 的 line 编号：0=上第五线，4=下第一线，可为负数或大于 4。 */
export function staffLineForStep(step) {
  return (STAFF_TOP_STEP - step) / 2;
}

/**
 * 计算音符需要画出的加线。
 * @returns {{count:number, direction:'below'|'above'|'none', lines:number[]}}
 * lines 是加线所在的自然音级步数，按从谱表向外的顺序排列。
 */
export function ledgerLinesFor(step) {
  if (step < STAFF_BOTTOM_STEP) {
    const count = Math.floor((STAFF_BOTTOM_STEP - step) / 2);
    return {
      count,
      direction: 'below',
      lines: Array.from({ length: count }, (_, i) => STAFF_BOTTOM_STEP - 2 - 2 * i),
    };
  }
  if (step > STAFF_TOP_STEP) {
    const count = Math.floor((step - STAFF_TOP_STEP) / 2);
    return {
      count,
      direction: 'above',
      lines: Array.from({ length: count }, (_, i) => STAFF_TOP_STEP + 2 + 2 * i),
    };
  }
  return { count: 0, direction: 'none', lines: [] };
}

/** 把自然音级步数描述成中文谱面位置。 */
const CHINESE_NUMERALS = Object.freeze(['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']);

function chineseNumeral(value) {
  return CHINESE_NUMERALS[value] || String(value);
}

export function describeDiatonicStep(step) {
  if (step >= STAFF_BOTTOM_STEP && step <= STAFF_TOP_STEP) {
    const offset = step - STAFF_BOTTOM_STEP;
    return offset % 2 === 0
      ? `第${chineseNumeral(offset / 2 + 1)}线`
      : `第${chineseNumeral((offset + 1) / 2)}间`;
  }
  if (step < STAFF_BOTTOM_STEP) {
    const diff = STAFF_BOTTOM_STEP - step;
    if (diff === 1) return '第一线下方间';
    if (diff % 2 === 0) return `下加${chineseNumeral(diff / 2)}线`;
    return `下加${chineseNumeral((diff - 1) / 2)}线下方间`;
  }
  const diff = step - STAFF_TOP_STEP;
  if (diff === 1) return '第五线上方间';
  if (diff % 2 === 0) return `上加${chineseNumeral(diff / 2)}线`;
  return `上加${chineseNumeral((diff - 1) / 2)}间`;
}

export function describeStaffPosition(midi, accidentalStyle = 'sharp') {
  const pitch = spellPitch(midi, accidentalStyle);
  return describeDiatonicStep(pitch.diatonicStep);
}

export function positionKey(stringNumber, fret) {
  return `s${stringNumber}f${fret}`;
}

/** 学习进度按「谱面音高」记，而不是按位置记：同音异位是同一个音。 */
export function writtenPitchKey(writtenMidi) {
  return `w${writtenMidi}`;
}

export function parsePositionKey(key) {
  const match = /^s([1-6])f(\d{1,2})$/.exec(key);
  if (!match) throw new Error(`无效的位置键：${key}`);
  return { string: Number(match[1]), fret: Number(match[2]) };
}

export function positionLabel(stringNumber, fret) {
  assertStringNumber(stringNumber);
  return `${CIRCLED_NUMBERS[stringNumber]}弦 ${fret === 0 ? '空弦' : `${fret} 品`}`;
}

export function shortPositionLabel(stringNumber, fret) {
  return `${CIRCLED_NUMBERS[stringNumber]} · ${fret === 0 ? '空' : `${fret}品`}`;
}

/**
 * 从「弦号 + 品位」生成一个完整音符对象。
 * 这是题库卡片的唯一构造入口。
 */
export function makeNote(stringNumber, fret, accidentalStyle = 'sharp') {
  const actualMidi = actualMidiFor(stringNumber, fret);
  const writtenMidi = actualMidi + WRITTEN_OCTAVE_OFFSET;
  return {
    key: positionKey(stringNumber, fret),
    pitchKey: writtenPitchKey(writtenMidi),
    string: stringNumber,
    fret,
    actualMidi,
    writtenMidi,
    pitch: spellPitch(writtenMidi, accidentalStyle),
    positionLabel: positionLabel(stringNumber, fret),
    shortPosition: shortPositionLabel(stringNumber, fret),
  };
}

export function noteForPosition(stringNumber, fret, accidentalStyle = 'sharp') {
  return makeNote(stringNumber, fret, accidentalStyle);
}

export function rangeInclusive(from, to) {
  const out = [];
  for (let i = from; i <= to; i += 1) out.push(i);
  return out;
}

/**
 * 生成一个关卡范围内的所有位置。
 * @param {{strings?:number[], frets?:number[], naturalsOnly?:boolean, accidentalStyle?:string}} options
 */
export function buildPositions({
  strings = STRINGS,
  frets = rangeInclusive(0, 3),
  naturalsOnly = false,
  accidentalStyle = 'sharp',
} = {}) {
  const positions = [];
  for (const stringNumber of strings) {
    for (const fret of frets) {
      const note = makeNote(stringNumber, fret, accidentalStyle);
      if (naturalsOnly && !note.pitch.isNatural) continue;
      positions.push(note);
    }
  }
  return positions;
}

/** 在指定的弦/品范围内，找出所有与给定谱面音高相同的实际位置。 */
export function positionsForWrittenMidi(writtenMidi, {
  strings = STRINGS,
  frets = rangeInclusive(0, 12),
} = {}) {
  const targetActual = writtenMidi - WRITTEN_OCTAVE_OFFSET;
  const matches = [];
  for (const stringNumber of strings) {
    for (const fret of frets) {
      if (STRING_TUNING[stringNumber].midi + fret === targetActual) {
        matches.push({ string: stringNumber, fret, key: positionKey(stringNumber, fret) });
      }
    }
  }
  return matches;
}

/** 答题按钮的候选音级。自然音关只给 7 个，变化音关给 12 个。 */
export function pitchClassChoices(naturalsOnly = false, accidentalStyle = 'sharp') {
  const pcs = naturalsOnly ? NATURAL_PITCH_CLASSES : rangeInclusive(0, 11);
  return pcs.map((pc) => {
    const pitch = spellPitch(60 + pc, accidentalStyle);
    return {
      pitchClass: pc,
      label: pitch.name,
      solfege: pitch.solfege,
      accidental: pitch.accidental,
    };
  });
}

export function midiToFrequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  return `${(ms / 1000).toFixed(1)} 秒`;
}

export function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}
