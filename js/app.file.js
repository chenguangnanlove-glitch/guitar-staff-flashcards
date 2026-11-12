/* 吉他五线谱闪卡 — file:// 兼容包（自动生成，请勿手改）
 * 源文件：js/*.js；生成命令：npm run build:file
 * HTTP/HTTPS 部署时 index.html 会改用 ES module，不加载此文件。
 */
(function () {
  'use strict';

// ---------- js/music.js ----------
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

const STRINGS = Object.freeze([1, 2, 3, 4, 5, 6]);

/** 弦号 -> 空弦实际音高（MIDI）。1 弦为高音 E。 */
const STRING_TUNING = Object.freeze({
  1: Object.freeze({ midi: 64, label: 'E4' }),
  2: Object.freeze({ midi: 59, label: 'B3' }),
  3: Object.freeze({ midi: 55, label: 'G3' }),
  4: Object.freeze({ midi: 50, label: 'D3' }),
  5: Object.freeze({ midi: 45, label: 'A2' }),
  6: Object.freeze({ midi: 40, label: 'E2' }),
});

/** 吉他谱上的音高 = 实际音高 + 12 个半音。 */
const WRITTEN_OCTAVE_OFFSET = 12;

/** 高音谱表的五条线：E4(下第一线) 到 F5(上第五线)。 */
const STAFF_BOTTOM_STEP = 30; // E4
const STAFF_TOP_STEP = 38; // F5

const LETTER_NAMES = Object.freeze(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
const LETTER_TO_PC = Object.freeze({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 });
const PC_TO_LETTER = Object.freeze({ 0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A', 11: 'B' });
const NATURAL_PITCH_CLASSES = Object.freeze([0, 2, 4, 5, 7, 9, 11]);
const NATURAL_PC_SET = new Set(NATURAL_PITCH_CLASSES);

const SHARP_NAMES = Object.freeze([
  'C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B',
]);
const FLAT_NAMES = Object.freeze([
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

const CIRCLED_NUMBERS = Object.freeze({
  1: '①', 2: '②', 3: '③', 4: '④', 5: '⑤', 6: '⑥',
});

const ACCIDENTAL_STYLES = Object.freeze(['sharp', 'flat']);

function assertStringNumber(stringNumber) {
  if (!Number.isInteger(stringNumber) || stringNumber < 1 || stringNumber > 6) {
    throw new RangeError(`无效的弦号：${stringNumber}`);
  }
}

function assertFret(fret, maxFret = 24) {
  if (!Number.isInteger(fret) || fret < 0 || fret > maxFret) {
    throw new RangeError(`无效的品位：${fret}`);
  }
}

function pitchClassOf(midi) {
  return ((midi % 12) + 12) % 12;
}

function octaveOfMidi(midi) {
  return Math.floor(midi / 12) - 1;
}

function isNaturalPitchClass(pc) {
  return NATURAL_PC_SET.has(pitchClassOf(pc));
}

/** 弦号 + 品位 -> 实际音高（MIDI）。 */
function actualMidiFor(stringNumber, fret) {
  assertStringNumber(stringNumber);
  assertFret(fret);
  return STRING_TUNING[stringNumber].midi + fret;
}

/** 弦号 + 品位 -> 谱面音高（MIDI）。吉他谱高八度记谱。 */
function writtenMidiFor(stringNumber, fret) {
  return actualMidiFor(stringNumber, fret) + WRITTEN_OCTAVE_OFFSET;
}

/**
 * 将一个 MIDI 音高按指定升降号风格拼写。
 * 自然音永远不带升降号；变化音统一用升号或统一用降号。
 */
function spellPitch(midi, accidentalStyle = 'sharp') {
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
function diatonicStepFor(midi, accidentalStyle = 'sharp') {
  return spellPitch(midi, accidentalStyle).diatonicStep;
}

/** VexFlow 的 line 编号：0=上第五线，4=下第一线，可为负数或大于 4。 */
function staffLineForStep(step) {
  return (STAFF_TOP_STEP - step) / 2;
}

/**
 * 计算音符需要画出的加线。
 * @returns {{count:number, direction:'below'|'above'|'none', lines:number[]}}
 * lines 是加线所在的自然音级步数，按从谱表向外的顺序排列。
 */
function ledgerLinesFor(step) {
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

function describeDiatonicStep(step) {
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

function describeStaffPosition(midi, accidentalStyle = 'sharp') {
  const pitch = spellPitch(midi, accidentalStyle);
  return describeDiatonicStep(pitch.diatonicStep);
}

function positionKey(stringNumber, fret) {
  return `s${stringNumber}f${fret}`;
}

/** 学习进度按「谱面音高」记，而不是按位置记：同音异位是同一个音。 */
function writtenPitchKey(writtenMidi) {
  return `w${writtenMidi}`;
}

function parsePositionKey(key) {
  const match = /^s([1-6])f(\d{1,2})$/.exec(key);
  if (!match) throw new Error(`无效的位置键：${key}`);
  return { string: Number(match[1]), fret: Number(match[2]) };
}

function positionLabel(stringNumber, fret) {
  assertStringNumber(stringNumber);
  return `${CIRCLED_NUMBERS[stringNumber]}弦 ${fret === 0 ? '空弦' : `${fret} 品`}`;
}

function shortPositionLabel(stringNumber, fret) {
  return `${CIRCLED_NUMBERS[stringNumber]} · ${fret === 0 ? '空' : `${fret}品`}`;
}

/**
 * 从「弦号 + 品位」生成一个完整音符对象。
 * 这是题库卡片的唯一构造入口。
 */
function makeNote(stringNumber, fret, accidentalStyle = 'sharp') {
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

function noteForPosition(stringNumber, fret, accidentalStyle = 'sharp') {
  return makeNote(stringNumber, fret, accidentalStyle);
}

function rangeInclusive(from, to) {
  const out = [];
  for (let i = from; i <= to; i += 1) out.push(i);
  return out;
}

/**
 * 生成一个关卡范围内的所有位置。
 * @param {{strings?:number[], frets?:number[], naturalsOnly?:boolean, accidentalStyle?:string}} options
 */
function buildPositions({
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
function positionsForWrittenMidi(writtenMidi, {
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
function pitchClassChoices(naturalsOnly = false, accidentalStyle = 'sharp') {
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

function midiToFrequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  return `${(ms / 1000).toFixed(1)} 秒`;
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

// ---------- js/levels.js ----------
/**
 * levels.js — 关卡配置与关卡范围计算。
 *
 * 关卡只声明「弦、品、是否只要自然音、显示弦号的概率」。
 * 具体有哪些音、音名和谱上位置，全部由 music.js 从弦号+品位推算。
 */

const LEVEL_GROUPS = Object.freeze([
  { id: 'first', title: '第一把位', subtitle: '0–3 品，先自然音，再升降号' },
  { id: 'positions', title: '把位扩展', subtitle: '第二到第五把位，每关 4 个品位' },
  { id: 'full', title: '全指板', subtitle: '0–12 品，最后来一次混合挑战' },
]);

const FIRST_POSITION_FRETS = Object.freeze(rangeInclusive(0, 3));

/**
 * stringHint:
 *   0 / 1       — 不显示 / 总是显示弦号
 *   0 < x < 1   — 每道题按此概率显示弦号
 */
const LEVELS = Object.freeze([
  {
    id: 'p1-upper',
    order: 1,
    group: 'first',
    title: '第一把位 · 1–3 弦',
    shortTitle: '1–3 弦',
    description: '高音三根弦，自然音，不显示弦号',
    rangeLabel: '①–③ 弦 · 0–3 品',
    strings: Object.freeze([1, 2, 3]),
    frets: FIRST_POSITION_FRETS,
    naturalsOnly: true,
    stringHint: 0,
    position: 1,
  },
  {
    id: 'p1-lower',
    order: 2,
    group: 'first',
    title: '第一把位 · 4–6 弦',
    shortTitle: '4–6 弦',
    description: '低音三根弦，自然音，注意下加线',
    rangeLabel: '④–⑥ 弦 · 0–3 品',
    strings: Object.freeze([4, 5, 6]),
    frets: FIRST_POSITION_FRETS,
    naturalsOnly: true,
    stringHint: 0,
    position: 1,
  },
  {
    id: 'p1-mixed',
    order: 3,
    group: 'first',
    title: '第一把位 · 六弦混合',
    shortTitle: '六弦混合',
    description: '六根弦的自然音混在一起',
    rangeLabel: '①–⑥ 弦 · 0–3 品',
    strings: STRINGS,
    frets: FIRST_POSITION_FRETS,
    naturalsOnly: true,
    stringHint: 0,
    position: 1,
  },
  {
    id: 'p1-chromatic',
    order: 4,
    group: 'first',
    title: '第一把位 · 含升降号',
    shortTitle: '第一把位升降号',
    description: '0–3 品的全部音，包含升降号',
    rangeLabel: '①–⑥ 弦 · 0–3 品',
    strings: STRINGS,
    frets: FIRST_POSITION_FRETS,
    naturalsOnly: false,
    stringHint: 0,
    position: 1,
  },
  {
    id: 'p2',
    order: 5,
    group: 'positions',
    title: '第二把位',
    shortTitle: '第二把位',
    description: '2–5 品，部分题会显示弦号',
    rangeLabel: '①–⑥ 弦 · 2–5 品',
    strings: STRINGS,
    frets: Object.freeze(rangeInclusive(2, 5)),
    naturalsOnly: false,
    stringHint: 0.35,
    position: 2,
  },
  {
    id: 'p3',
    order: 6,
    group: 'positions',
    title: '第三把位',
    shortTitle: '第三把位',
    description: '3–6 品，部分题会显示弦号',
    rangeLabel: '①–⑥ 弦 · 3–6 品',
    strings: STRINGS,
    frets: Object.freeze(rangeInclusive(3, 6)),
    naturalsOnly: false,
    stringHint: 0.45,
    position: 3,
  },
  {
    id: 'p4',
    order: 7,
    group: 'positions',
    title: '第四把位',
    shortTitle: '第四把位',
    description: '4–7 品，部分题会显示弦号',
    rangeLabel: '①–⑥ 弦 · 4–7 品',
    strings: STRINGS,
    frets: Object.freeze(rangeInclusive(4, 7)),
    naturalsOnly: false,
    stringHint: 0.55,
    position: 4,
  },
  {
    id: 'p5',
    order: 8,
    group: 'positions',
    title: '第五把位',
    shortTitle: '第五把位',
    description: '5–8 品，部分题会显示弦号',
    rangeLabel: '①–⑥ 弦 · 5–8 品',
    strings: STRINGS,
    frets: Object.freeze(rangeInclusive(5, 8)),
    naturalsOnly: false,
    stringHint: 0.65,
    position: 5,
  },
  {
    id: 'full-natural',
    order: 9,
    group: 'full',
    title: '全指板 · 自然音',
    shortTitle: '全指板自然音',
    description: '0–12 品自然音，每道题都显示弦号',
    rangeLabel: '①–⑥ 弦 · 0–12 品',
    strings: STRINGS,
    frets: Object.freeze(rangeInclusive(0, 12)),
    naturalsOnly: true,
    stringHint: 1,
    position: null,
  },
  {
    id: 'full-chromatic',
    order: 10,
    group: 'full',
    title: '全指板 · 含升降号',
    shortTitle: '全指板升降号',
    description: '0–12 品全部音，每道题都显示弦号',
    rangeLabel: '①–⑥ 弦 · 0–12 品',
    strings: STRINGS,
    frets: Object.freeze(rangeInclusive(0, 12)),
    naturalsOnly: false,
    stringHint: 1,
    position: null,
  },
  {
    id: 'mixed',
    order: 11,
    group: 'full',
    title: '混合挑战',
    shortTitle: '混合挑战',
    description: '全指板升降号，弦号提示随机出现',
    rangeLabel: '①–⑥ 弦 · 0–12 品',
    strings: STRINGS,
    frets: Object.freeze(rangeInclusive(0, 12)),
    naturalsOnly: false,
    stringHint: 0.5,
    position: null,
  },
]);

const LEVEL_BY_ID = Object.freeze(
  Object.fromEntries(LEVELS.map((level) => [level.id, level])),
);

function getLevel(levelId) {
  return LEVEL_BY_ID[levelId] || null;
}

function getNextLevel(levelId) {
  const index = LEVELS.findIndex((level) => level.id === levelId);
  return index >= 0 ? LEVELS[index + 1] || null : null;
}

/** 生成一个关卡的完整位置池（音名拼写会跟随设置）。 */
function getLevelPool(level, accidentalStyle = 'sharp') {
  return buildPositions({
    strings: level.strings,
    frets: level.frets,
    naturalsOnly: level.naturalsOnly,
    accidentalStyle,
  });
}

function getLevelIndex(levelId) {
  return LEVELS.findIndex((level) => level.id === levelId);
}

/** 该关是否有足够的音做一组 10 张不重复的题。 */
function getGroupSize(level, accidentalStyle = 'sharp') {
  const seenPitches = new Set(getLevelPool(level, accidentalStyle).map((note) => note.writtenMidi));
  return Math.min(10, seenPitches.size);
}

/**
 * 5 级熟练度里，达到第 3 级（熟悉）才算这个音掌握。
 * 旧版是 3 级制里的「2 级」，换算后正好也是第 3 级。
 */
const MASTERY_LEVEL = 3;
const MASTERY_ACCURACY = 0.9;

function getNoteProficiency(progress, noteKey) {
  return progress?.notes?.[noteKey]?.level || 1;
}

function getPositionProficiency(progress, writtenMidi, stringNumber) {
  if (!Number.isFinite(writtenMidi) || !Number.isInteger(stringNumber)) return 1;
  return progress?.positions?.[`w${writtenMidi}@${stringNumber}`]?.level || 1;
}

/**
 * 「掌握进度」：每个音从 1 级升到达标线（MASTERY_LEVEL）算满，超过达标线不再加分。
 * 没练过的音计 0，而不是按 1 级计入，所以 0% 就是「还没开始」，100% 就是「全部达标」。
 * 关卡卡片、首页圆环、结果页都用这一个口径，只是范围不同（本关 / 全指板）。
 */
function getProgressPercent(progress, keys) {
  if (!keys.length) return 0;
  const span = MASTERY_LEVEL - 1;
  const earned = keys.reduce((sum, key) => (
    sum + Math.min(span, Math.max(0, getNoteProficiency(progress, key) - 1))
  ), 0);
  return Math.round((earned / (keys.length * span)) * 100);
}

function countPracticed(progress, keys) {
  return keys.filter((key) => Boolean(progress?.notes?.[key]?.lastSeenAt)).length;
}

/** 关卡「完成度」按不同谱面音高计算，同音异位只算一个音。 */
function uniquePitchKeys(pool) {
  return [...new Set(pool.map((note) => note.pitchKey))];
}

function getLevelStatus(level, progress, settings) {
  const pool = getLevelPool(level, settings.accidentalStyle);
  const uniqueKeys = uniquePitchKeys(pool);
  const mastered = uniqueKeys.filter((key) => (
    getNoteProficiency(progress, key) >= MASTERY_LEVEL
  )).length;
  const levelProgress = progress?.levels?.[level.id] || null;
  const completed = Boolean(levelProgress?.completedAt);
  const lastGroup = levelProgress?.lastGroup || null;
  const levelSum = uniqueKeys.reduce((sum, key) => sum + getNoteProficiency(progress, key), 0);
  const avgLevel = uniqueKeys.length ? levelSum / uniqueKeys.length : 1;
  const toMastery = uniqueKeys.reduce((sum, key) => (
    sum + Math.max(0, MASTERY_LEVEL - getNoteProficiency(progress, key))
  ), 0);
  return {
    pool,
    total: uniqueKeys.length,
    mastered,
    avgLevel: Number(avgLevel.toFixed(1)),
    toMastery,
    percent: uniqueKeys.length ? Math.round((mastered / uniqueKeys.length) * 100) : 0,
    progressPercent: getProgressPercent(progress, uniqueKeys),
    practiced: countPracticed(progress, uniqueKeys),
    completed,
    lastGroup,
    lastAccuracy: lastGroup ? lastGroup.accuracy : null,
    groupSize: Math.min(10, new Set(pool.map((note) => note.writtenMidi)).size),
  };
}

function isLevelUnlocked(level, progress, settings) {
  const index = getLevelIndex(level.id);
  if (index <= 0) return true;
  if (settings.unlockAll) return true;
  const previous = LEVELS[index - 1];
  return Boolean(progress?.levels?.[previous.id]?.completedAt);
}

function getNextUnlockRequirement(level, progress, settings) {
  const status = getLevelStatus(level, progress, settings);
  const previous = progress?.levels?.[level.id] || null;
  const accuracy = previous?.lastGroup?.accuracy ?? null;
  return {
    mastered: status.mastered,
    total: status.total,
    allMastered: status.mastered >= status.total,
    accuracy,
    accuracyReady: accuracy !== null && accuracy >= MASTERY_ACCURACY,
    ready: status.mastered >= status.total
      && accuracy !== null
      && accuracy >= MASTERY_ACCURACY,
    masteryLevel: MASTERY_LEVEL,
  };
}

/** 全部 0–12 品位置（去重键）作为总进度分母。 */
function getOverallMastery(progress, settings) {
  const pool = getLevelPool(LEVEL_BY_ID['full-chromatic'], settings.accidentalStyle);
  const uniqueKeys = uniquePitchKeys(pool);
  const mastered = uniqueKeys.filter((key) => (
    getNoteProficiency(progress, key) >= MASTERY_LEVEL
  )).length;
  const levelSum = uniqueKeys.reduce((sum, key) => sum + getNoteProficiency(progress, key), 0);
  const avgLevel = uniqueKeys.length ? levelSum / uniqueKeys.length : 1;
  return {
    total: uniqueKeys.length,
    mastered,
    percent: Math.round((mastered / uniqueKeys.length) * 100),
    avgLevel: Number(avgLevel.toFixed(1)),
    avgPercent: Math.round((avgLevel / 5) * 100),
    progressPercent: getProgressPercent(progress, uniqueKeys),
    practiced: countPracticed(progress, uniqueKeys),
  };
}

/** 至少答过这么多次，才有资格被判为弱项；只答过一次的新音不算。 */
const WEAK_MIN_ATTEMPTS = 2;

/**
 * 真正的弱项：答过至少 2 次，并且
 * - 还没达标时：答错过，或者已经练了 4 次以上仍没达标；
 * - 已达标时：总正确率低于 70%（以前反复错、靠后来答对升上去的音）。
 * 刚练完第一组、一次都没错的音只是「还在学」，不算弱项。
 */
function isWeakEntry(entry) {
  if (!entry || !entry.lastSeenAt) return false;
  const correct = entry.correct || 0;
  const wrong = entry.wrong || 0;
  const attempts = correct + wrong;
  if (attempts < WEAK_MIN_ATTEMPTS) return false;
  const level = entry.level || 1;
  if (level < MASTERY_LEVEL) return wrong > 0 || attempts >= 4;
  return correct / attempts < 0.7;
}

/**
 * 找出练过但还不稳的音，用于「只练弱项」。
 * 排序：熟练度低的优先；同级时错误多的优先；再同级时更久没练的优先。
 *
 * @returns {Array<{pitchKey:string, writtenMidi:number, level:number,
 *   correct:number, wrong:number, accuracy:number, lastSeenAt:number, note:object}>}
 */
function getWeakestPitches(progress, settings, limit = 12) {
  const pool = getLevelPool(
    LEVEL_BY_ID['full-chromatic'] || LEVELS[LEVELS.length - 1],
    settings.accidentalStyle,
  );
  const seen = new Map();
  for (const note of pool) {
    if (seen.has(note.pitchKey)) continue;
    const entry = progress?.notes?.[note.pitchKey];
    if (!isWeakEntry(entry)) continue;
    const attempts = entry.correct + entry.wrong;
    seen.set(note.pitchKey, {
      pitchKey: note.pitchKey,
      writtenMidi: note.writtenMidi,
      level: entry.level,
      correct: entry.correct,
      wrong: entry.wrong,
      accuracy: attempts ? entry.correct / attempts : 0,
      lastSeenAt: entry.lastSeenAt,
      note,
    });
  }
  return [...seen.values()]
    .sort((a, b) => (
      a.level - b.level
      || b.wrong - a.wrong
      || a.accuracy - b.accuracy
      || a.lastSeenAt - b.lastSeenAt
    ))
    .slice(0, limit);
}

/** 首页 / 设置页展示用：练习过多少音、多少已掌握。 */
function getPracticeSummary(progress, settings) {
  const pool = getLevelPool(
    LEVEL_BY_ID['full-chromatic'] || LEVELS[LEVELS.length - 1],
    settings.accidentalStyle,
  );
  const seen = new Set();
  let practiced = 0;
  let mastered = 0;
  for (const note of pool) {
    if (seen.has(note.pitchKey)) continue;
    seen.add(note.pitchKey);
    const entry = progress?.notes?.[note.pitchKey];
    if (!entry || !entry.lastSeenAt) continue;
    practiced += 1;
    if (entry.level >= MASTERY_LEVEL) mastered += 1;
  }
  return { practiced, mastered, total: seen.size };
}

function groupLevels(levels = LEVELS) {
  return LEVEL_GROUPS.map((group) => ({
    ...group,
    levels: levels.filter((level) => level.group === group.id),
  })).filter((group) => group.levels.length > 0);
}

// ---------- js/storage.js ----------
/**
 * storage.js — 设置与学习进度的持久化。
 * 只使用 localStorage，没有后端；所有数据都留在用户设备上。
 *
 * 进度模型 v2：
 * - 熟练度 1–5 级，答对 +1、答错 -1（不再是答错归零）。
 * - 每个音 / 每个指板位置都有 dueAt（下次该复习的时间），
 *   出题时优先安排到期和过期的内容。
 * - notes 按「谱面音高」记录（w60），positions 按「音高 + 弦号」记录（w60@3）。
 *   v1 数据会在读取时自动迁移，不需要用户操作。
 */

const STORAGE_KEYS = Object.freeze({
  settings: 'gsf:settings:v1',
  progress: 'gsf:progress:v1',
});

const PROGRESS_VERSION = 2;
const PROFICIENCY_MAX = 5;
const PROFICIENCY_MIN = 1;

const DAY_MS = 24 * 60 * 60 * 1000;

/** 下标即熟练度：1 级当天再来，5 级隔 16 天。 */
const REVIEW_INTERVAL_DAYS = Object.freeze([0, 0, 1, 3, 7, 16]);

function reviewIntervalMs(level) {
  const days = REVIEW_INTERVAL_DAYS[Math.max(PROFICIENCY_MIN, Math.min(PROFICIENCY_MAX, level))] ?? 0;
  return days * DAY_MS;
}

const SETTINGS_VERSION = 2;

const DEFAULT_SETTINGS = Object.freeze({
  version: SETTINGS_VERSION,
  answerMode: 'solfege', // name | solfege | fretboard（v2 起默认唱名）
  display: 'both', // name | solfege | both
  accidentalStyle: 'sharp', // sharp | flat
  stringHint: 'auto', // auto | always | never
  primaryColor: '#3d6b5c',
  unlockAll: false,
});

const ANSWER_MODES = new Set(['name', 'solfege', 'fretboard']);
const DISPLAYS = new Set(['name', 'solfege', 'both']);
const ACCIDENTAL_STYLE_VALUES = new Set(['sharp', 'flat']);
const STRING_HINTS = new Set(['auto', 'always', 'never']);

const NOTE_KEY_RE = /^w\d{2,3}$/;
const POSITION_KEY_RE = /^w\d{2,3}@[1-6]$/;

const memoryStore = new Map();
let usingMemory = false;

function backend() {
  try {
    if (typeof localStorage !== 'undefined') {
      const probe = '__gsf_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return localStorage;
    }
    usingMemory = true;
  } catch {
    usingMemory = true;
  }
  return {
    getItem: (key) => (memoryStore.has(key) ? memoryStore.get(key) : null),
    setItem: (key, value) => memoryStore.set(key, String(value)),
    removeItem: (key) => memoryStore.delete(key),
  };
}

function isStorageAvailable() {
  backend();
  return !usingMemory;
}

function readJSON(key, fallback) {
  try {
    const raw = backend().getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    backend().setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function isHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

function normalizeSettings(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const sourceVersion = Number.isFinite(Number(source.version)) ? Number(source.version) : 1;
  let answerMode = ANSWER_MODES.has(source.answerMode)
    ? source.answerMode
    : DEFAULT_SETTINGS.answerMode;
  // v1 的默认是音名。升级到 v2 时，仍停留在旧默认的「音名」跟随新默认改为唱名；
  // 之后用户主动选音名会写入 version 2，不会被再次改掉。
  if (sourceVersion < SETTINGS_VERSION && answerMode === 'name') {
    answerMode = DEFAULT_SETTINGS.answerMode;
  }
  return {
    version: SETTINGS_VERSION,
    answerMode,
    display: DISPLAYS.has(source.display) ? source.display : DEFAULT_SETTINGS.display,
    accidentalStyle: ACCIDENTAL_STYLE_VALUES.has(source.accidentalStyle)
      ? source.accidentalStyle
      : DEFAULT_SETTINGS.accidentalStyle,
    stringHint: STRING_HINTS.has(source.stringHint)
      ? source.stringHint
      : DEFAULT_SETTINGS.stringHint,
    primaryColor: isHexColor(source.primaryColor)
      ? source.primaryColor.toLowerCase()
      : DEFAULT_SETTINGS.primaryColor,
    unlockAll: Boolean(source.unlockAll),
  };
}

function loadSettings() {
  return normalizeSettings(readJSON(STORAGE_KEYS.settings, null));
}

function saveSettings(settings) {
  return writeJSON(STORAGE_KEYS.settings, normalizeSettings(settings));
}

function createProgress() {
  return {
    version: PROGRESS_VERSION,
    notes: {},
    positions: {},
    levels: {},
    totals: { groups: 0, questions: 0, correct: 0, retries: 0 },
    history: [],
    createdAt: Date.now(),
  };
}

function clampLevel(value, fallback = PROFICIENCY_MIN) {
  if (!Number.isInteger(value)) return fallback;
  return Math.min(PROFICIENCY_MAX, Math.max(PROFICIENCY_MIN, value));
}

function normalizeNoteEntry(entry, now = Date.now()) {
  const source = entry && typeof entry === 'object' ? entry : {};
  const level = clampLevel(source.level);
  const lastSeenAt = Number(source.lastSeenAt) || 0;
  const hasDue = Number.isFinite(source.dueAt);
  // v1 没有 dueAt：按最后一次练习时间 + 当前级别的间隔推算，避免老用户一上来全是复习。
  const legacyDue = lastSeenAt ? lastSeenAt + reviewIntervalMs(level) : 0;
  return {
    level,
    correct: Math.max(0, Number(source.correct) || 0),
    wrong: Math.max(0, Number(source.wrong) || 0),
    firstSeenAt: Number(source.firstSeenAt) || (lastSeenAt || now),
    lastSeenAt,
    dueAt: hasDue ? Math.max(0, Number(source.dueAt)) : legacyDue,
    lastResult: source.lastResult === 'wrong' ? 'wrong' : source.lastResult === 'correct' ? 'correct' : null,
  };
}

function normalizeLevelEntry(entry) {
  const source = entry && typeof entry === 'object' ? entry : {};
  return {
    completedAt: Number(source.completedAt) || null,
    groupsPlayed: Math.max(0, Number(source.groupsPlayed) || 0),
    lastGroup: source.lastGroup && typeof source.lastGroup === 'object' ? {
      accuracy: Number(source.lastGroup.accuracy) || 0,
      avgMs: Number(source.lastGroup.avgMs) || 0,
      total: Number(source.lastGroup.total) || 0,
      attempts: Number(source.lastGroup.attempts) || 0,
      retries: Number(source.lastGroup.retries) || 0,
      at: Number(source.lastGroup.at) || 0,
      missed: Array.isArray(source.lastGroup.missed) ? source.lastGroup.missed.slice(0, 10) : [],
    } : null,
  };
}

function normalizeProgress(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const now = Date.now();
  const progress = createProgress();

  if (source.notes && typeof source.notes === 'object') {
    for (const [key, entry] of Object.entries(source.notes)) {
      if (!NOTE_KEY_RE.test(key)) continue;
      progress.notes[key] = normalizeNoteEntry(entry, now);
    }
  }

  if (source.positions && typeof source.positions === 'object') {
    for (const [key, entry] of Object.entries(source.positions)) {
      if (!POSITION_KEY_RE.test(key)) continue;
      progress.positions[key] = normalizeNoteEntry(entry, now);
    }
  }

  if (source.levels && typeof source.levels === 'object') {
    for (const [levelId, entry] of Object.entries(source.levels)) {
      if (!entry || typeof entry !== 'object') continue;
      progress.levels[levelId] = normalizeLevelEntry(entry);
    }
  }

  if (source.totals && typeof source.totals === 'object') {
    progress.totals = {
      groups: Math.max(0, Number(source.totals.groups) || 0),
      questions: Math.max(0, Number(source.totals.questions) || 0),
      correct: Math.max(0, Number(source.totals.correct) || 0),
      retries: Math.max(0, Number(source.totals.retries) || 0),
    };
  }

  if (Array.isArray(source.history)) {
    progress.history = source.history
      .filter((item) => item && typeof item === 'object')
      .slice(-30)
      .map((item) => ({
        levelId: String(item.levelId || ''),
        accuracy: Number(item.accuracy) || 0,
        at: Number(item.at) || 0,
      }));
  }

  progress.createdAt = Number(source.createdAt) || now;
  return progress;
}

function loadProgress() {
  return normalizeProgress(readJSON(STORAGE_KEYS.progress, null));
}

function saveProgress(progress) {
  return writeJSON(STORAGE_KEYS.progress, progress);
}

function ensureNote(progress, noteKey) {
  if (!progress.notes[noteKey]) {
    progress.notes[noteKey] = normalizeNoteEntry({ level: PROFICIENCY_MIN });
  }
  return progress.notes[noteKey];
}

function ensurePosition(progress, positionKey) {
  if (!progress.positions) progress.positions = {};
  if (!progress.positions[positionKey]) {
    progress.positions[positionKey] = normalizeNoteEntry({ level: PROFICIENCY_MIN });
  }
  return progress.positions[positionKey];
}

/** 只更新熟练度和到期时间，不改统计；供 notes / positions 共用。 */
function applyAnswer(entry, correct, at) {
  if (correct) {
    entry.level = clampLevel(entry.level + 1);
    entry.correct += 1;
    entry.lastResult = 'correct';
  } else {
    // 答错只降一级，不再归零；1 级时保持不变。
    entry.level = clampLevel(entry.level - 1);
    entry.wrong += 1;
    entry.lastResult = 'wrong';
  }
  entry.lastSeenAt = at;
  entry.dueAt = correct ? at + reviewIntervalMs(entry.level) : at;
  return entry;
}

/**
 * 记录一次音高作答（音名 / 唱名 / 指板题都会调用）。
 * 答对：1 → 2 → … → 5（最高 5）；答错：降一级，最低 1。
 */
function recordNoteAnswer(progress, noteKey, correct, at = Date.now()) {
  const note = ensureNote(progress, noteKey);
  return applyAnswer(note, correct, at);
}

/**
 * 记录一次指板位置作答。
 * 这是独立于音高的维度：同一个音在第 3 品和第 8 品算两次不同的练习。
 */
function recordPositionAnswer(progress, positionKey, correct, at = Date.now()) {
  const position = ensurePosition(progress, positionKey);
  return applyAnswer(position, correct, at);
}

function recordGroupResult(progress, {
  levelId,
  summary,
  completedNow = false,
  at = Date.now(),
}) {
  const entry = progress.levels[levelId] || {
    completedAt: null,
    groupsPlayed: 0,
    lastGroup: null,
  };
  entry.groupsPlayed += 1;
  entry.lastGroup = {
    accuracy: summary.accuracy,
    avgMs: summary.avgMs,
    total: summary.total,
    attempts: summary.attempts,
    retries: summary.retries,
    at,
    missed: summary.missed.slice(0, 10).map((item) => ({
      key: item.key,
      levelId,
      count: item.count,
      string: item.string,
      fret: item.fret,
    })),
  };
  if (completedNow && !entry.completedAt) entry.completedAt = at;
  progress.levels[levelId] = entry;

  progress.totals.groups += 1;
  progress.totals.questions += summary.total;
  progress.totals.correct += summary.firstCorrect;
  progress.totals.retries += summary.retries;

  progress.history.push({ levelId, accuracy: summary.accuracy, at });
  if (progress.history.length > 30) progress.history = progress.history.slice(-30);

  return entry;
}

function resetProgress() {
  const fresh = createProgress();
  saveProgress(fresh);
  return fresh;
}

function clearAllData() {
  try {
    backend().removeItem(STORAGE_KEYS.settings);
    backend().removeItem(STORAGE_KEYS.progress);
  } catch {
    // 忽略：清理失败时仍然继续刷新界面
  }
}

/** 导出为可读 JSON，包含设置与进度，便于换设备或备份。 */
function exportSnapshot(settings, progress) {
  return {
    app: 'guitar-staff-flashcards',
    format: 'gsf-backup',
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    settings: normalizeSettings(settings),
    progress: normalizeProgress(progress),
  };
}

/**
 * 校验导入文件。只接受本应用的备份格式，返回规范化后的数据。
 * @throws {Error} 格式不对时抛出中文原因
 */
function parseSnapshot(raw) {
  let data = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error('文件不是有效的 JSON。');
    }
  }
  if (!data || typeof data !== 'object') {
    throw new Error('文件内容为空或格式不正确。');
  }
  if (data.format !== 'gsf-backup') {
    throw new Error('这不是「吉他五线谱闪卡」的备份文件。');
  }
  if (!data.progress || typeof data.progress !== 'object') {
    throw new Error('备份里缺少学习进度。');
  }
  const progress = normalizeProgress(data.progress);
  return {
    settings: data.settings ? normalizeSettings(data.settings) : null,
    progress,
  };
}

function applySnapshot(snapshot) {
  saveProgress(snapshot.progress);
  if (snapshot.settings) saveSettings(snapshot.settings);
  return snapshot;
}

// ---------- js/quiz.js ----------
/**
 * quiz.js — 一组 10 张题的出题、答题、重排与统计。
 *
 * 关键规则：
 * - 同一组内按「同一个音」去重（同音异位也算同一个音）。
 * - 到期的音优先安排；不够 10 张时，再用熟练度加权补足。
 * - 答错后，这道题会在 3–5 题后再次出现；同一张最多重做 2 次，
 *   避免一个始终不会的音把整组卡死。
 * - 熟练度 1–5 级，越低权重越高。
 * - 正确率按每张题的第一次作答计算，重做不刷正确率。
 */


const GROUP_TARGET_SIZE = 10;
const MAX_CARD_RETRIES = 2;

/** 5 级熟练度的抽样权重：1 级最常出现，5 级仍保留少量复习。 */
const PROFICIENCY_WEIGHTS = Object.freeze({ 1: 8, 2: 5, 3: 3, 4: 2, 5: 1 });

const QUIZ_DAY_MS = 24 * 60 * 60 * 1000;

function nowMs() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function randomInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

function weightForLevel(level) {
  return PROFICIENCY_WEIGHTS[level] || PROFICIENCY_WEIGHTS[1];
}

/**
 * 到期程度加权：越久没练、过期越久，权重越高。
 * 上限 3 倍，避免长期不练的音把整组占满。
 */
function urgencyFactor(dueAt, now) {
  if (!dueAt) return 1.6; // 从未练过
  if (dueAt > now) return 0.35; // 还没到期，只在不够时补充
  const overdueDays = (now - dueAt) / QUIZ_DAY_MS;
  return 1 + Math.min(overdueDays, 14) / 7;
}

function weightedPick(items, weightOf, rng) {
  const total = items.reduce((sum, item) => sum + weightOf(item), 0);
  if (total <= 0) return items[randomInt(rng, 0, items.length - 1)];
  let target = rng() * total;
  for (const item of items) {
    target -= weightOf(item);
    if (target < 0) return item;
  }
  return items[items.length - 1];
}

function weightedSampleWithoutReplacement(items, size, weightOf, rng) {
  const remaining = [...items];
  const picked = [];
  const count = Math.min(size, remaining.length);
  while (picked.length < count) {
    const chosen = weightedPick(remaining, weightOf, rng);
    picked.push(chosen);
    remaining.splice(remaining.indexOf(chosen), 1);
  }
  return picked;
}

function resolveStringHint(levelHint, setting, rng = Math.random) {
  if (setting === 'always') return true;
  if (setting === 'never') return false;
  if (levelHint === 1 || levelHint === true) return true;
  if (!levelHint) return false;
  return rng() < levelHint;
}

/**
 * 按「相同谱面音高」把位置分组，确保一组内不重复出同一个音。
 * 每组带上熟练度、到期时间和紧迫度权重。
 */
function buildPitchGroups(level, { settings, progress, now = Date.now(), pool = null }) {
  const notes = pool || getLevelPool(level, settings.accidentalStyle);
  const byPitch = new Map();
  for (const note of notes) {
    if (!byPitch.has(note.writtenMidi)) byPitch.set(note.writtenMidi, []);
    byPitch.get(note.writtenMidi).push(note);
  }
  return [...byPitch.entries()].map(([writtenMidi, groupNotes]) => {
    const pitchKey = groupNotes[0].pitchKey;
    const entry = progress?.notes?.[pitchKey];
    const level5 = entry?.level || 1;
    const dueAt = entry?.dueAt || 0;
    const base = weightForLevel(level5);
    return {
      writtenMidi,
      pitchKey,
      notes: groupNotes,
      level: level5,
      dueAt,
      isDue: !entry || !entry.lastSeenAt || dueAt <= now,
      weight: base * urgencyFactor(dueAt, now),
    };
  });
}

/**
 * 从候选位置里挑一个。指板模式优先挑「这个位置本身」还不熟的那个。
 */
function pickNoteForGroup(group, { settings, progress, rng }) {
  const usePosition = settings.answerMode === 'fretboard';
  const weightOf = usePosition
    ? (candidate) => weightForLevel(
      getPositionProficiency(progress, candidate.writtenMidi, candidate.string),
    )
    : (candidate) => weightForLevel(
      getNoteProficiency(progress, candidate.pitchKey),
    );
  return weightedPick(group.notes, weightOf, rng);
}

function createDeck(level, {
  settings,
  progress,
  rng = Math.random,
  now = Date.now(),
  pool = null,
} = {}) {
  const groups = buildPitchGroups(level, { settings, progress, now, pool });
  const size = Math.min(GROUP_TARGET_SIZE, groups.length);

  // 1) 到期（含从未练过）的音优先；2) 不够时从还没到期里按权重补。
  const dueGroups = groups.filter((group) => group.isDue);
  const upcomingGroups = groups.filter((group) => !group.isDue);

  const dueCount = Math.min(size, dueGroups.length);
  const selectedDue = weightedSampleWithoutReplacement(
    dueGroups,
    dueCount,
    (group) => group.weight,
    rng,
  );
  const selected = [...selectedDue];

  if (selected.length < size) {
    const pickedDue = new Set(selected.map((group) => group.pitchKey));
    const remaining = [...upcomingGroups, ...dueGroups.filter((group) => !pickedDue.has(group.pitchKey))];
    selected.push(...weightedSampleWithoutReplacement(
      remaining,
      size - selected.length,
      (group) => group.weight,
      rng,
    ));
  }

  // 打乱顺序，避免「最久没练的永远排第一」这种可预测节奏。
  for (let i = selected.length - 1; i > 0; i -= 1) {
    const j = randomInt(rng, 0, i);
    [selected[i], selected[j]] = [selected[j], selected[i]];
  }

  const cards = selected.map((group, index) => {
    const note = pickNoteForGroup(group, { settings, progress, rng });
    return {
      id: `card-${index}-${note.key}-${Math.floor(rng() * 1e6)}`,
      note,
      pitchKey: group.pitchKey,
      displayString: resolveStringHint(level.stringHint, settings.stringHint, rng),
      firstAttempt: null,
      retryCount: 0,
      isRetry: false,
      gaveUp: false,
      done: false,
      wasDue: group.isDue,
    };
  });

  return { cards, total: cards.length, dueCount: selectedDue.length };
}

/** 指板题可接受的位置；显示弦号时只认该弦。 */
function correctPositionsFor(card, level) {
  let positions = positionsForWrittenMidi(card.note.writtenMidi, {
    strings: level.strings,
    frets: level.frets,
  });
  if (card.displayString) {
    positions = positions.filter((position) => position.string === card.note.string);
  }
  return positions;
}

function checkFingerboardAnswer(card, level, selection) {
  if (!selection || !Number.isInteger(selection.string) || !Number.isInteger(selection.fret)) {
    return false;
  }
  return correctPositionsFor(card, level).some(
    (position) => position.string === selection.string && position.fret === selection.fret,
  );
}

class QuizSession {
  constructor(level, {
    settings,
    progress,
    rng = Math.random,
    pool = null,
    now = Date.now(),
    focus = false,
  }) {
    this.level = level;
    this.settings = settings;
    this.rng = rng;
    this.focus = focus;
    const deck = createDeck(level, { settings, progress, rng, now, pool });
    this.queue = deck.cards;
    this.total = deck.total;
    this.dueCount = deck.dueCount;
    this.firstCorrect = 0;
    this.firstAttempts = 0;
    this.attempts = 0;
    this.retries = 0;
    this.firstElapsedTotal = 0;
    this.firstElapsedCount = 0;
    this.missed = new Map();
    this.gaveUp = [];
    this.groupComplete = this.queue.length === 0;
    this.currentStartedAt = null;
    this.lastOutcome = null;
  }

  get current() {
    return this.queue[0] || null;
  }

  get progressFirstAttempts() {
    return Math.min(this.firstAttempts, this.total);
  }

  /** 画面真正展示这张卡片时调用，开始计本题用时（没有倒计时）。 */
  markShown() {
    this.currentStartedAt = nowMs();
  }

  elapsedMs() {
    if (this.currentStartedAt === null) return 0;
    return Math.max(0, Math.round(nowMs() - this.currentStartedAt));
  }

  answer(selection) {
    if (!this.current) {
      throw new Error('本组已经结束');
    }
    const card = this.queue.shift();
    const elapsed = this.elapsedMs();
    const firstAttempt = card.firstAttempt === null;
    let retryAfter = null;
    let correct;

    if (this.settings.answerMode === 'fretboard') {
      correct = checkFingerboardAnswer(card, this.level, selection);
    } else {
      correct = selection !== null && selection !== undefined
        && Number(selection) === card.note.pitch.pitchClass;
    }

    this.attempts += 1;
    if (card.isRetry) this.retries += 1;

    if (firstAttempt) {
      card.firstAttempt = correct;
      this.firstAttempts += 1;
      this.firstElapsedTotal += elapsed;
      this.firstElapsedCount += 1;
      if (correct) this.firstCorrect += 1;
    }

    if (!correct) {
      const missed = this.missed.get(card.note.writtenMidi) || {
        key: card.note.pitchKey,
        writtenMidi: card.note.writtenMidi,
        string: card.note.string,
        fret: card.note.fret,
        count: 0,
        lastAt: 0,
      };
      missed.count += 1;
      missed.lastAt = Date.now();
      this.missed.set(card.note.writtenMidi, missed);
    }

    const correctPositions = correctPositionsFor(card, this.level);

    if (correct) {
      card.done = true;
    } else if (card.retryCount >= MAX_CARD_RETRIES) {
      // 已经重做两次还错：先放过，记入「仍未掌握」，不让整组无限延长。
      card.done = true;
      card.gaveUp = true;
      if (!this.gaveUp.some((item) => item.key === card.note.pitchKey)) {
        this.gaveUp.push({
          key: card.note.pitchKey,
          writtenMidi: card.note.writtenMidi,
          string: card.note.string,
          fret: card.note.fret,
        });
      }
    } else {
      card.retryCount += 1;
      card.isRetry = true;
      // 当前题已经被移出队列；插入到 3–5 题之后。
      const insertAt = Math.min(this.queue.length, randomInt(this.rng, 3, 5));
      retryAfter = insertAt;
      this.queue.splice(insertAt, 0, card);
    }

    this.groupComplete = this.queue.length === 0;
    this.currentStartedAt = null;
    this.lastOutcome = {
      card,
      correct,
      selection,
      elapsedMs: elapsed,
      firstAttempt,
      retryScheduled: !correct && !card.gaveUp,
      retryAfter,
      gaveUp: card.gaveUp,
      correctPositions,
      groupComplete: this.groupComplete,
      progressFirstAttempts: this.progressFirstAttempts,
      total: this.total,
    };
    return this.lastOutcome;
  }

  summary() {
    const missed = [...this.missed.values()]
      .sort((a, b) => b.count - a.count || b.lastAt - a.lastAt)
      .slice(0, 3)
      .map((item) => ({ ...item }));
    return {
      levelId: this.level.id,
      focus: this.focus,
      total: this.total,
      dueCount: this.dueCount,
      firstCorrect: this.firstCorrect,
      accuracy: this.total ? this.firstCorrect / this.total : 0,
      avgMs: this.firstElapsedCount ? this.firstElapsedTotal / this.firstElapsedCount : 0,
      attempts: this.attempts,
      retries: this.retries,
      missed,
      gaveUp: this.gaveUp.map((item) => ({ ...item })),
      groupComplete: this.groupComplete,
      answeredFirstAttempts: this.firstAttempts,
    };
  }
}

// ---------- js/staff.js ----------
/**
 * staff.js — VexFlow 高音谱表渲染。
 * 所有音符位置都由 music.js 的谱面音高（writtenMidi）决定；
 * 加线由 VexFlow 自动绘制，弦号徽标由我们在同一个 SVG 里补充。
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const VF = globalThis.VexFlow;

let fontsReadyPromise = null;

function isVexFlowAvailable() {
  return Boolean(VF && VF.Renderer && VF.Stave && VF.StaveNote);
}

function ensureStaffFonts() {
  if (!fontsReadyPromise) {
    fontsReadyPromise = (async () => {
      if (typeof document === 'undefined' || !document.fonts) return;
      try {
        await document.fonts.ready;
        const started = Date.now();
        while (!document.fonts.check('16px Bravura') && Date.now() - started < 2500) {
          await new Promise((resolve) => setTimeout(resolve, 40));
        }
      } catch {
        // 字体检查失败时仍然继续，VexFlow 会使用可用的回退字形。
      }
    })();
  }
  return fontsReadyPromise;
}

function requireVexFlow() {
  if (!isVexFlowAvailable()) {
    throw new Error('VexFlow 未加载：请确认 vendor/vexflow.js 在页面中先于应用脚本加载。');
  }
  return VF;
}

function createBadge(svg, x, y, stringNumber, tone) {
  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute('class', `string-badge string-badge--${tone || 'neutral'}`);
  group.setAttribute('aria-hidden', 'true');

  const disc = document.createElementNS(SVG_NS, 'circle');
  disc.setAttribute('cx', String(x));
  disc.setAttribute('cy', String(y));
  disc.setAttribute('r', '8.5');
  disc.setAttribute('class', 'string-badge__disc');
  group.appendChild(disc);

  const text = document.createElementNS(SVG_NS, 'text');
  text.setAttribute('x', String(x));
  text.setAttribute('y', String(y + 0.5));
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'central');
  text.setAttribute('class', 'string-badge__text');
  text.textContent = String(stringNumber);
  group.appendChild(text);

  svg.appendChild(group);
}

/**
 * 在容器里画一个高音谱表音符。
 *
 * @param {HTMLElement} container
 * @param {object} pitch spellPitch() 的返回值
 * @param {object} options
 *   width/height       内部 SVG 尺寸
 *   viewBox            可选，{ x, y, width, height }：
 *                      只显示这块区域。VexFlow 的 clef 字形包围盒远大于实际笔画，
 *                      靠 height 猜会留下大块空白；传入实测的内容区间能贴紧裁切。
 *   staveY             谱表顶线 y
 *   noteStartX         音符起始 x
 *   showStringBadge    是否画带圈弦号
 *   stringNumber       1–6
 *   state              neutral | correct | wrong
 *   compact            结果页缩略谱
 *   ariaLabel          无障碍描述（不要泄露答案，除非已作答）
 */
function renderStaff(container, pitch, options = {}) {
  const vf = requireVexFlow();
  const {
    width = 344,
    height = 232,
    staveY = 84,
    noteStartX = Math.round(width * 0.5),
    viewBox = null,
    showStringBadge = false,
    stringNumber = null,
    state = 'neutral',
    compact = false,
    ariaLabel = '高音谱表上的一个音符',
    tone = 'neutral',
  } = options;

  container.innerHTML = '';
  container.style.removeProperty('width');
  const renderer = new vf.Renderer(container, vf.Renderer.Backends.SVG);
  renderer.resize(width, height);
  const ctx = renderer.getContext();
  const svg = ctx.svg;
  // VexFlow 的 resize() 会写内联 width/height；改回自适应，让谱表随卡片宽度缩放。
  svg.style.width = '100%';
  svg.style.height = 'auto';
  // VexFlow 的 resize() 会把 width/height 写成内联属性，SVG 会优先用它而不是 viewBox，
  // 导致「viewBox 裁紧了但卡片还是原来那么高」。去掉 height、改用 aspect-ratio，
  // 高度才能真正跟随 viewBox。
  if (viewBox) {
    svg.removeAttribute('height');
    svg.style.aspectRatio = `${viewBox.width} / ${viewBox.height}`;
  }
  svg.setAttribute('viewBox', viewBox
    ? `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`
    : `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', ariaLabel);
  svg.classList.add('staff-svg');
  if (compact) svg.classList.add('staff-svg--compact');

  const stave = new vf.Stave(compact ? 4 : 8, staveY, width - (compact ? 8 : 16));
  stave.addClef('treble');
  stave.setContext(ctx).draw();

  // 让单音符落在谱表中间，而不是紧贴谱号。
  if (typeof stave.setNoteStartX === 'function') {
    stave.setNoteStartX(noteStartX);
  }

  const note = new vf.StaveNote({
    keys: [pitch.vexKey],
    duration: 'w',
    clef: 'treble',
  });
  if (pitch.accidental) {
    note.addModifier(new vf.Accidental(pitch.accidental), 0);
  }
  if (state === 'correct') {
    note.setStyle({ fillStyle: '#2f7d4f', strokeStyle: '#2f7d4f' });
  } else if (state === 'wrong') {
    note.setStyle({ fillStyle: '#a94a4a', strokeStyle: '#a94a4a' });
  }

  vf.Formatter.FormatAndDraw(ctx, stave, [note]);

  if (showStringBadge && stringNumber) {
    const noteX = note.getAbsoluteX();
    const noteY = note.getYs()[0];
    // 徽标要离开音符头足够远：贴太近会盖住符头，看不清音高。
    // 音符起点加上偏移量后仍有重叠风险，因此统一放到右侧 34px 处。
    createBadge(svg, noteX + 34, noteY, stringNumber, state === 'neutral' ? tone : state);
  }

  return { svg, note, stave };
}

function staffAriaDescription(pitch, { showString = false, stringNumber = null, reveal = false } = {}) {
  const ledger = ledgerLinesFor(pitch.diatonicStep);
  const ledgerText = ledger.count
    ? `，${ledger.direction === 'below' ? '下' : '上'}加${ledger.count}条线`
    : '';
  const stringText = showString && stringNumber ? `，指定第 ${stringNumber} 弦` : '';
  if (reveal) {
    return `高音谱表：${pitch.fullName}，${describeDiatonicStep(pitch.diatonicStep)}${ledgerText}${stringText}`;
  }
  return `高音谱表上的一个音符：${describeDiatonicStep(pitch.diatonicStep)}${ledgerText}${stringText}`;
}

// ---------- js/fingerboard.js ----------
/**
 * fingerboard.js — 自己实现的 SVG 指板，不依赖任何图形库。
 * 6 根弦横向排列，1 弦在上、6 弦在下；支持任意品位窗口与答题点击。
 */

const FB_SVG_NS = 'http://www.w3.org/2000/svg';

const DEFAULT_LAYOUT = Object.freeze({
  cellWidth: 52,
  stringGap: 27,
  leftPad: 34,
  rightPad: 16,
  // labelBand：顶部写品位数字的条带高度。
  // padY：指板矩形在「最上面一根弦之上 / 最下面一根弦之下」预留的留白，两边相等，
  //       六根弦因此在矩形里垂直居中，不会像早先那样贴着上沿、底部空一大块。
  labelBand: 16,
  padY: 17,
  bottomPad: 2,
  openWidth: 44,
  dotRadius: 4.5,
  ringRadius: 11,
});

// 答题用的指板加大弦距，保证手机上每个可点格子至少 44px 高。
// 窄指板按容器宽度放大（约 1.3 倍），弦距 36 即可；
// 全指板（> 520）按原尺寸横向滚动，弦距直接取 44。
const WIDE_BOARD_WIDTH = 520;
const TAP_TARGET_MIN = 44;

function interactiveLayout(frets) {
  const natural = computeFingerboardGeometry(frets, DEFAULT_LAYOUT).width;
  const wide = natural > WIDE_BOARD_WIDTH;
  return Object.freeze({
    ...DEFAULT_LAYOUT,
    stringGap: wide ? TAP_TARGET_MIN : 36,
    padY: wide ? 16 : 15,
  });
}

function svgEl(tag, attrs = {}) {
  const element = document.createElementNS(FB_SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null) element.setAttribute(key, String(value));
  }
  return element;
}

function textEl(text, attrs = {}) {
  const element = svgEl('text', attrs);
  element.textContent = text;
  return element;
}

/**
 * 计算指板几何：返回每个品位的中心点与边界。
 */
function computeFingerboardGeometry(frets, layout = DEFAULT_LAYOUT) {
  const sorted = [...frets].sort((a, b) => a - b);
  const hasOpen = sorted.includes(0);
  const stopped = sorted.filter((fret) => fret > 0);
  const nutX = layout.leftPad + (hasOpen ? layout.openWidth : 0);
  const width = nutX + stopped.length * layout.cellWidth + layout.rightPad;

  // 弦的纵向位置：顶部先留出品位数字条带，再留一段等量的上下对称留白。
  const firstStringY = layout.labelBand + layout.padY;
  const stringY = (stringNumber) => firstStringY + (stringNumber - 1) * layout.stringGap;
  const boardTop = layout.labelBand;
  const boardBottom = stringY(6) + layout.padY;
  const height = boardBottom + layout.bottomPad;

  const cellCenterX = (fret) => {
    if (fret === 0) return layout.leftPad + layout.openWidth / 2;
    const index = stopped.indexOf(fret);
    return nutX + (index + 0.5) * layout.cellWidth;
  };
  return {
    sorted,
    hasOpen,
    stopped,
    nutX,
    width,
    height,
    stringY,
    firstStringY,
    boardTop,
    boardBottom,
    cellCenterX,
    boardLeft: layout.leftPad,
    boardRight: nutX + stopped.length * layout.cellWidth,
    layout,
  };
}

/**
 * 渲染指板。返回 { svg, geometry, setDisabled }。
 *
 * @param {HTMLElement} container
 * @param {object} options
 *   frets: number[]           要显示的品位（含 0 才显示空弦区）
 *   strings: number[]         要显示的弦（默认 1–6）
 *   onSelect({string,fret})   点击回调
 *   disabled: boolean
 *   targetPositions: [{string,fret}]  答后绿色高亮
 *   wrongPosition: {string,fret}|null 答错时红色高亮
 *   hintString: number|null   指定弦号（高亮该弦，不泄露品位）
 *   ariaLabel
 */
function renderFingerboard(container, options = {}) {
  const {
    frets = [0, 1, 2, 3],
    strings = STRINGS,
    onSelect = null,
    disabled = false,
    targetPositions = [],
    wrongPosition = null,
    hintString = null,
    revealPosition = null,
    ariaLabel = '吉他指板',
    showFretLabels = true,
  } = options;

  const layout = onSelect ? interactiveLayout(frets) : DEFAULT_LAYOUT;
  const geometry = computeFingerboardGeometry(frets, layout);
  const { width, height, nutX, boardLeft, boardRight, sorted, stopped, hasOpen, stringY, cellCenterX, boardTop, boardBottom } = geometry;
  const fretLineTop = boardTop + 2;
  const fretLineBottom = boardBottom - 2;

  container.innerHTML = '';
  const scroll = document.createElement('div');
  scroll.className = 'fb-scroll';
  if (width > WIDE_BOARD_WIDTH) scroll.classList.add('fb-scroll--wide');
  container.appendChild(scroll);

  const svg = svgEl('svg', {
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
    class: `fingerboard-svg${disabled ? ' is-disabled' : ''}`,
    role: 'group',
    'aria-label': ariaLabel,
  });
  if (width > WIDE_BOARD_WIDTH) svg.classList.add('fingerboard-svg--wide');
  scroll.appendChild(svg);

  const defs = svgEl('defs');
  const gradient = svgEl('linearGradient', {
    id: `fb-wood-${Math.random().toString(36).slice(2)}`,
    x1: '0', y1: '0', x2: '0', y2: '1',
  });
  gradient.appendChild(svgEl('stop', { offset: '0%', 'stop-color': '#fbf8f1' }));
  gradient.appendChild(svgEl('stop', { offset: '100%', 'stop-color': '#f0eadf' }));
  defs.appendChild(gradient);
  svg.appendChild(defs);

  // 指板底色
  svg.appendChild(svgEl('rect', {
    x: boardLeft - 3,
    y: boardTop,
    width: boardRight - boardLeft + 6,
    height: boardBottom - boardTop,
    rx: 12,
    class: 'fb-board',
    fill: `url(#${gradient.getAttribute('id')})`,
  }));

  // 空弦区
  if (hasOpen) {
    svg.appendChild(svgEl('rect', {
      x: boardLeft,
      y: boardTop + 2,
      width: layout.openWidth,
      height: boardBottom - boardTop - 4,
      rx: 8,
      class: 'fb-open-zone',
    }));
  }

  // 品位数字
  if (showFretLabels) {
    for (const fret of sorted) {
      const x = cellCenterX(fret);
      svg.appendChild(textEl(fret === 0 ? '0' : String(fret), {
        x,
        y: boardTop / 2 + 1,
        class: 'fb-fret-label',
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
      }));
    }
  }

  // 竖线（品丝/弦枕）
  if (hasOpen) {
    svg.appendChild(svgEl('line', {
      x1: nutX, y1: fretLineTop,
      x2: nutX, y2: fretLineBottom,
      class: 'fb-nut',
    }));
  }
  const boundaries = hasOpen
    ? [nutX + stopped.length * layout.cellWidth]
    : [boardLeft];
  if (hasOpen) {
    for (let i = 1; i <= stopped.length; i += 1) boundaries.push(nutX + i * layout.cellWidth);
  } else {
    for (let i = 1; i <= stopped.length; i += 1) boundaries.push(boardLeft + i * layout.cellWidth);
  }
  for (const x of boundaries) {
    svg.appendChild(svgEl('line', {
      x1: x, y1: fretLineTop,
      x2: x, y2: fretLineBottom,
      class: 'fb-fret',
    }));
  }
  if (!hasOpen) {
    svg.appendChild(svgEl('line', {
      x1: boardLeft, y1: fretLineTop,
      x2: boardLeft, y2: fretLineBottom,
      class: 'fb-fret fb-fret--edge',
    }));
  }

  // 弦线与弦号
  for (const stringNumber of strings) {
    const y = stringY(stringNumber);
    svg.appendChild(svgEl('line', {
      x1: boardLeft + (hasOpen ? 2 : 0),
      y1: y,
      x2: boardRight,
      y2: y,
      class: `fb-string${hintString === stringNumber ? ' is-hinted' : ''}`,
    }));
    svg.appendChild(textEl(CIRCLED_NUMBERS[stringNumber], {
      x: 12,
      y,
      class: `fb-string-label${hintString === stringNumber ? ' is-hinted' : ''}`,
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
    }));
  }

  // 每个位置的浅色圆点 + 点击区域
  for (const stringNumber of strings) {
    for (const fret of sorted) {
      const x = cellCenterX(fret);
      const y = stringY(stringNumber);
      svg.appendChild(svgEl('circle', {
        cx: x, cy: y, r: layout.dotRadius,
        class: 'fb-dot',
      }));

      const isTarget = targetPositions.some(
        (position) => position.string === stringNumber && position.fret === fret,
      );
      const isWrong = wrongPosition
        && wrongPosition.string === stringNumber
        && wrongPosition.fret === fret;

      if (isTarget) {
        svg.appendChild(svgEl('circle', {
          cx: x, cy: y, r: layout.ringRadius,
          class: 'fb-target-ring',
        }));
        svg.appendChild(svgEl('circle', {
          cx: x, cy: y, r: 6,
          class: 'fb-target-dot',
        }));
      }
      if (isWrong && !isTarget) {
        svg.appendChild(svgEl('circle', {
          cx: x, cy: y, r: layout.ringRadius,
          class: 'fb-wrong-ring',
        }));
        svg.appendChild(textEl('×', {
          x, y: y + 4,
          class: 'fb-wrong-mark',
          'text-anchor': 'middle',
        }));
      }

      if (!onSelect || disabled) continue;
      const hitWidth = fret === 0 ? layout.openWidth : layout.cellWidth;
      const hitX = fret === 0
        ? boardLeft
        : (hasOpen ? nutX + (stopped.indexOf(fret)) * layout.cellWidth : boardLeft + stopped.indexOf(fret) * layout.cellWidth);
      const hit = svgEl('rect', {
        x: hitX,
        y: y - layout.stringGap / 2,
        width: hitWidth,
        height: layout.stringGap,
        class: 'fb-hit',
        tabindex: '0',
        role: 'button',
        'aria-label': `第 ${stringNumber} 弦，${fret === 0 ? '空弦' : `第 ${fret} 品`}`,
        'data-string': stringNumber,
        'data-fret': fret,
        'data-position-key': positionKey(stringNumber, fret),
      });
      const activate = (event) => {
        if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        if (svg.classList.contains('is-disabled')) return;
        onSelect({ string: stringNumber, fret }, event);
      };
      hit.addEventListener('click', activate);
      hit.addEventListener('keydown', activate);
      svg.appendChild(hit);
    }
  }

  const setDisabled = (value) => {
    svg.classList.toggle('is-disabled', Boolean(value));
  };

  // 全指板关卡里正确答案可能在屏幕外；答后自动滑到第一个正确位置。
  if (revealPosition && Number.isInteger(revealPosition.fret)) {
    requestAnimationFrame(() => {
      const available = scroll.clientWidth;
      const contentWidth = scroll.scrollWidth;
      if (!available || contentWidth <= available + 1) return;
      const scale = contentWidth / width;
      const target = cellCenterX(revealPosition.fret) * scale - available / 2;
      scroll.scrollLeft = Math.max(0, Math.min(target, contentWidth - available));
    });
  }

  return { svg, geometry, setDisabled };
}

// ---------- js/audio.js ----------
/**
 * audio.js — 用 Web Audio 振荡器合成柔和的吉他音色。
 * 不加载任何音频文件；只在用户点击「听一下」时播放实际音高。
 */

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
function playMidi(actualMidi, { duration = 1.25, volume = 0.16 } = {}) {
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
function playNote(note, options = {}) {
  return playMidi(note.actualMidi, options);
}

function stopAudio() {
  stopActive();
}

// ---------- js/theme.js ----------
/**
 * theme.js — 可配置主色的 Material 浅色主题。
 * 用 JS 混合颜色，避免依赖 color-mix()，兼容更多手机浏览器。
 */

const COLOR_PRESETS = Object.freeze([
  { name: '松绿', value: '#3d6b5c' },
  { name: '靛蓝', value: '#4b5fa8' },
  { name: '青蓝', value: '#2f6f7e' },
  { name: '琥珀', value: '#8a5a1f' },
  { name: '玫瑰', value: '#9a4a5c' },
  { name: '石墨', value: '#4f5b62' },
]);

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function parseHex(hex) {
  const value = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!value) return { r: 61, g: 107, b: 92 };
  const number = parseInt(value[1], 16);
  return {
    r: (number >> 16) & 255,
    g: (number >> 8) & 255,
    b: number & 255,
  };
}

function toHex({ r, g, b }) {
  return `#${[r, g, b].map((part) => clamp(part).toString(16).padStart(2, '0')).join('')}`;
}

function mix(from, to, amount) {
  return toHex({
    r: from.r + (to.r - from.r) * amount,
    g: from.g + (to.g - from.g) * amount,
    b: from.b + (to.b - from.b) * amount,
  });
}

function channelLuminance(value) {
  const channel = value / 255;
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function luminance({ r, g, b }) {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

function contrastRatio(a, b) {
  const light = Math.max(a, b);
  const dark = Math.min(a, b);
  return (light + 0.05) / (dark + 0.05);
}

function applyTheme(hex) {
  const primary = parseHex(hex);
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };
  const whiteContrast = contrastRatio(luminance(primary), luminance(white));
  const blackContrast = contrastRatio(luminance(primary), luminance(black));
  const onPrimary = whiteContrast >= blackContrast ? '#ffffff' : '#14201a';
  const primaryHex = toHex(primary);
  const container = mix(primary, white, 0.86);
  const containerText = mix(primary, black, 0.7);
  const soft = mix(primary, white, 0.93);
  const outline = mix(primary, white, 0.58);
  const strong = mix(primary, black, 0.18);

  const root = document.documentElement;
  root.style.setProperty('--primary', primaryHex);
  root.style.setProperty('--on-primary', onPrimary);
  root.style.setProperty('--primary-container', container);
  root.style.setProperty('--on-primary-container', containerText);
  root.style.setProperty('--primary-soft', soft);
  root.style.setProperty('--primary-outline', outline);
  root.style.setProperty('--primary-strong', strong);
  root.style.setProperty('--primary-rgb', `${primary.r}, ${primary.g}, ${primary.b}`);

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute('content', primaryHex);

  return { primary: primaryHex, onPrimary, container, containerText, soft, outline, strong };
}

// ---------- js/pwa.js ----------
/**
 * pwa.js — Service Worker 注册、更新提示与安装提示。
 */

let waitingWorker = null;
let updateCallback = null;
let hadController = false;
let reloading = false;
let swReady = false;

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

/**
 * 离线能力需要安全上下文：HTTPS、localhost 或 127.0.0.1。
 * 手机通过局域网 http://192.168.x.x 访问时不是安全上下文，
 * Service Worker 会被浏览器直接拒绝，这里先判断再注册。
 */
function canUseOffline() {
  if (!('serviceWorker' in navigator)) return false;
  if (typeof isSecureContext === 'boolean') return isSecureContext;
  return location.protocol === 'https:'
    || location.hostname === 'localhost'
    || location.hostname === '127.0.0.1';
}

/** 只有 Service Worker 真正安装并接管页面后，才对外宣称「离线可用」。 */
function isOfflineReady() {
  if (swReady) return true;
  return Boolean(navigator.serviceWorker?.controller);
}

/** 本机通过 HTTP 访问时，读取服务器注入的局域网地址。 */
function getLanUrl() {
  return document.querySelector('meta[name="gsf-lan-url"]')?.getAttribute('content') || null;
}

function registerServiceWorker({ onUpdateReady, onReady } = {}) {
  updateCallback = onUpdateReady || null;
  if (!canUseOffline()) return;

  hadController = Boolean(navigator.serviceWorker.controller);

  const markReady = () => {
    if (swReady) return;
    swReady = true;
    onReady?.();
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !hadController) return;
    reloading = true;
    location.reload();
  });

  navigator.serviceWorker.register('./sw.js', { scope: './' }).then((registration) => {
    if (navigator.serviceWorker.controller) {
      markReady();
    } else {
      navigator.serviceWorker.ready.then(markReady).catch(() => {});
    }

    if (registration.waiting && navigator.serviceWorker.controller) {
      waitingWorker = registration.waiting;
      updateCallback?.();
    }

    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          waitingWorker = worker;
          updateCallback?.();
        }
      });
    });

    // 每次回到应用时检查一次更新（浏览器允许时）。
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update().catch(() => {});
    });
  }).catch(() => {
    // 本地 file:// 或浏览器不支持时静默失败，不影响应用本身。
  });
}

function applyServiceWorkerUpdate() {
  if (!waitingWorker) {
    location.reload();
    return;
  }
  waitingWorker.postMessage({ type: 'SKIP_WAITING' });
}

function setupInstallPrompt(onAvailable) {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    onAvailable?.(event);
  });
  window.addEventListener('appinstalled', () => {
    onAvailable?.(null);
  });
}

async function promptInstall(deferredPrompt) {
  if (!deferredPrompt) return false;
  try {
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice.catch(() => null);
    return choice?.outcome === 'accepted';
  } catch {
    return false;
  }
}

// ---------- js/app.js ----------
/**
 * app.js — 页面路由、四个页面、设置、答题交互与 PWA 启动。
 */









/* ---------- 图标 ---------- */

const ICONS = {
  logo: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 5.5v13M9 4.5v15M13 5.5v13M17 4.5v15" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><ellipse cx="15.6" cy="15.2" rx="3.1" ry="2.3" fill="currentColor" transform="rotate(-18 15.6 15.2)"/><path d="M18.2 14.8V7.2l2.4-.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h9M17 7h3M4 17h3M11 17h9" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="15" cy="7" r="2.2" stroke="currentColor" stroke-width="1.9"/><circle cx="8" cy="17" r="2.2" stroke="currentColor" stroke-width="1.9"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.5 10.5L12 4l7.5 6.5V20a1 1 0 01-1 1h-4v-6h-5v6h-4a1 1 0 01-1-1v-9.5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5.5" y="10.5" width="13" height="9.5" rx="2.2" stroke="currentColor" stroke-width="1.8"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.5 10v4h3.2L12 17.5v-11L7.7 10H4.5z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M15.2 9.2a4 4 0 010 5.6M17.8 6.8a7.4 7.4 0 010 10.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  install: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v10m0 0l-3.5-3.5M12 14l3.5-3.5M5 16v3.5h14V16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19 8.5A7.5 7.5 0 105 12" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M19 4.5v4.2h-4.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 7h14M9 7V5.2h6V7M7.5 7l.7 12h7.6l.7-12M10 10.5v5M14 10.5v5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8.2" stroke="currentColor" stroke-width="1.7"/><path d="M12 11v5M12 8.2h.01" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v10m0 0l-3.6-3.6M12 14l3.6-3.6M5 17.5V19a1 1 0 001 1h12a1 1 0 001-1v-1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 15V5m0 0L8.4 8.6M12 5l3.6 3.6M5 17.5V19a1 1 0 001 1h12a1 1 0 001-1v-1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8.2" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4.4" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="9" y="9" width="10.5" height="10.5" rx="2.4" stroke="currentColor" stroke-width="1.8"/><path d="M15 6.5V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7a2 2 0 002 2h.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 15V4.5m0 0L8.2 8.3M12 4.5l3.8 3.8M6.5 11.5H6a1.5 1.5 0 00-1.5 1.5v6A1.5 1.5 0 006 20.5h12a1.5 1.5 0 001.5-1.5v-6a1.5 1.5 0 00-1.5-1.5h-.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  arrowRight: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.5 12h14M13 6.5l5.5 5.5L13 17.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const APP_VERSION = '1.3.0';
const SHARE_SITE_URL = 'https://guitar-staff-flashcards.pages.dev/';

/* ---------- 状态 ---------- */

const state = {
  settings: loadSettings(),
  progress: loadProgress(),
  route: { name: 'home' },
  session: null,
  sessionHash: null,
  feedback: null,
  lastResult: null,
  installPrompt: null,
  snackbarTimer: null,
  snackbarShownAt: 0,
  storageOK: true,
};

let appStarted = false;

/* ---------- 小工具 ---------- */

const $ = (selector, root = document) => root.querySelector(selector);

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function icon(name) {
  return ICONS[name] || '';
}

function parseRoute() {
  const hash = location.hash || '#/';
  if (hash.startsWith('#/quiz/')) {
    try {
      return { name: 'quiz', levelId: decodeURIComponent(hash.slice('#/quiz/'.length)) };
    } catch {
      return { name: 'home' };
    }
  }
  if (hash === '#/settings') return { name: 'settings' };
  if (hash === '#/result') return { name: 'result' };
  return { name: 'home' };
}

function navigate(hash, { replace = false, scrollToTop = true } = {}) {
  // 切页时收掉上一页的提示，避免它叠在新页面的按钮或结果上。
  hideSnackbar({ olderThan: 250 });
  if (location.hash === hash) {
    render({ scrollToTop, focusView: true });
    return;
  }
  if (replace) history.replaceState(null, '', hash);
  else history.pushState(null, '', hash);
  render({ scrollToTop, focusView: true });
}

function renderPreserveScroll() {
  render({ preserveScroll: true });
}

function getDisplayAnswer(pitch) {
  const display = state.settings.display;
  if (display === 'solfege') return { main: pitch.solfege, sub: '' };
  if (display === 'name') return { main: pitch.name, sub: '' };
  return { main: pitch.name, sub: pitch.solfege };
}

function answerMarkup(pitch) {
  const answer = getDisplayAnswer(pitch);
  return `<span>${esc(answer.main)}</span>${answer.sub ? `<small> · ${esc(answer.sub)}</small>` : ''}`;
}

function answerInline(pitch) {
  const answer = getDisplayAnswer(pitch);
  return answer.sub ? `${esc(answer.main)} · ${esc(answer.sub)}` : esc(answer.main);
}

function staffDescription(note) {
  return describeDiatonicStep(note.pitch.diatonicStep);
}

function levelHintText(level) {
  if (state.settings.stringHint === 'always') return '显示弦号';
  if (state.settings.stringHint === 'never') return '不显示弦号';
  if (level.stringHint === 1) return '显示弦号';
  if (level.stringHint === 0) return '不显示弦号';
  return '部分显示弦号';
}

function drawStaff(container, pitch, options) {
  if (!container) return;
  try {
    renderStaff(container, pitch, options);
  } catch (error) {
    console.error(error);
    container.innerHTML = '<div class="staff-fallback">谱表加载失败，请刷新页面</div>';
  }
}

function progressRingStyle(percent) {
  return `--p:${Math.max(0, Math.min(100, percent))}`;
}

/* ---------- 应用栏 / 底部导航 ---------- */

function renderAppBar({ title, subtitle = '', back = false, actions = '' }) {
  const bar = $('#app-bar');
  bar.innerHTML = `
    <div class="app-bar__inner">
      ${back
        ? `<button class="icon-btn" data-action="back" aria-label="返回">${icon('back')}</button>`
        : `<div class="brand-mark" aria-hidden="true">${icon('logo')}</div>`}
      <div class="app-bar__titles">
        <h1 class="app-bar__title">${esc(title)}</h1>
        ${subtitle ? `<p class="app-bar__subtitle">${esc(subtitle)}</p>` : ''}
      </div>
      <div class="app-bar__actions">${actions}</div>
    </div>`;
}

function renderBottomNav(active) {
  const nav = $('#bottom-nav');
  document.body.classList.toggle('nav-hidden', !active);
  if (!active) {
    nav.hidden = true;
    nav.innerHTML = '';
    return;
  }
  nav.hidden = false;
  nav.innerHTML = `
    <button class="nav-item ${active === 'home' ? 'is-active' : ''}" data-action="navigate" data-route="#/" ${active === 'home' ? 'aria-current="page"' : ''}>
      ${icon('home')}<span>关卡</span>
    </button>
    <button class="nav-item ${active === 'settings' ? 'is-active' : ''}" data-action="navigate" data-route="#/settings" ${active === 'settings' ? 'aria-current="page"' : ''}>
      ${icon('settings')}<span>设置</span>
    </button>`;
}

/* ---------- 首页 ---------- */

function renderHome() {
  const overall = getOverallMastery(state.progress, state.settings);
  const unlockedLevels = LEVELS.filter((level) => (
    isLevelUnlocked(level, state.progress, state.settings)
  ));
  const nextLevel = unlockedLevels.find((level) => (
    !getLevelStatus(level, state.progress, state.settings).completed
  )) || unlockedLevels[unlockedLevels.length - 1] || LEVELS[0];

  renderAppBar({
    title: '吉他五线谱闪卡',
    subtitle: '读谱 · 唱名 · 找位置',
    back: false,
    actions: `<button class="icon-btn" data-action="navigate" data-route="#/settings" aria-label="设置">${icon('settings')}</button>`,
  });
  renderBottomNav('home');

  const groups = groupLevels();
  const installButton = state.installPrompt && !isStandalone()
    ? `<button class="btn btn--tonal hero__install" data-action="install">${icon('install')} 添加到主屏幕</button>`
    : '';

  const practice = getPracticeSummary(state.progress, state.settings);
  const weak = getWeakestPitches(state.progress, state.settings, 12);
  const weakPreview = weak.slice(0, 3).map((item) => item.note.pitch.name).join('、');
  // 只有真正答错过 / 反复没记住的音才进弱项（见 levels.js isWeakEntry），刚开始练不会出现。
  const focusCard = weak.length >= 3
    ? `<button class="focus-card" data-action="start-focus">
        <span class="focus-card__icon" aria-hidden="true">${icon('target')}</span>
        <span class="focus-card__main">
          <span class="focus-card__title">弱项练习 · ${weak.length} 个音</span>
          <span class="focus-card__desc">${esc(weakPreview)}${weak.length > 3 ? ' 等' : ''}容易出错，专门练一组巩固</span>
        </span>
        <span class="focus-card__chevron" aria-hidden="true">${icon('arrowRight')}</span>
      </button>`
    : '';

  const view = $('#view');
  view.innerHTML = `
    <div class="screen home-screen">
      <section class="hero">
        <p class="hero__eyebrow">高音谱号 · 固定唱名 · 标准调弦</p>
        <h1 class="hero__title">把五线谱，<br>变成手上的位置。</h1>
        <p class="hero__desc">从第一把位开始，认清谱上的音，再把它和音名、唱名、指板位置连起来。</p>
        <div class="hero__visual">
          <div class="hero__staff" id="hero-staff"></div>
        </div>
        <div class="hero__stats">
          <div class="progress-ring" style="${progressRingStyle(practice.practiced ? overall.progressPercent : 0)}" aria-hidden="true">
            <span class="progress-ring__text">${practice.practiced ? `${overall.progressPercent}%` : '—'}</span>
          </div>
          <div class="hero__stats-text">
            <div class="hero__stats-title">${practice.practiced ? `全指板进度 ${overall.progressPercent}%` : '还没有练习记录'}</div>
            <div class="hero__stats-sub">${practice.practiced
              ? `已练 ${overall.practiced} / ${overall.total} 个音 · ${overall.mastered} 个达标`
              : `全指板共 ${overall.total} 个音`}</div>
          </div>
          <button class="btn btn--tonal" data-action="start-level" data-level="${nextLevel.id}">
            ${practice.practiced ? '继续' : '开始'} ${icon('arrowRight')}
          </button>
        </div>
        ${installButton}
      </section>

      ${focusCard}

      <section class="section">
        <div class="section-head">
          <h2 class="section-title">关卡</h2>
          <p class="section-subtitle">百分比是掌握进度，分数是达标音数</p>
        </div>
        ${groups.map((group) => `
          <div class="group-label">${esc(group.title)}</div>
          <div class="level-list">
            ${group.levels.map(renderLevelCard).join('')}
          </div>
        `).join('')}
      </section>

      <div class="rule-note">
        <strong>解锁规则：</strong>本关所有音达到 ${MASTERY_LEVEL} 级熟练度（共 5 级），且最近一组正确率达到 90%，就会解锁下一关。熟悉之后，也可以在设置里打开“解锁全部关卡”。
      </div>

      ${renderAuthorLine('home-author')}
    </div>`;

  const heroStaff = $('#hero-staff');
  if (heroStaff) {
    const example = makeNote(3, 0, state.settings.accidentalStyle);
    drawStaff(heroStaff, example.pitch, {
      width: 344,
      height: 150,
      staveY: 15,
      noteStartX: 200,
      showStringBadge: true,
      stringNumber: 3,
      ariaLabel: '示例高音谱表音符',
    });
  }

  if (!state.storageOK) {
    showSnackbar('浏览器禁用了本地存储，本次进度只能保留到关闭页面。');
  }
}

function renderLevelCard(level) {
  const unlocked = isLevelUnlocked(level, state.progress, state.settings);
  const status = getLevelStatus(level, state.progress, state.settings);
  const complete = status.completed;
  const classes = ['level-card', !unlocked ? 'is-locked' : '', complete ? 'is-complete' : '']
    .filter(Boolean)
    .join(' ');
  const badge = complete
    ? icon('check')
    : !unlocked
      ? icon('lock')
      : String(level.order);
  const tags = [
    `<span class="tag tag--primary">${esc(level.rangeLabel)}</span>`,
    `<span class="tag">${level.naturalsOnly ? '自然音' : '含升降号'}</span>`,
    `<span class="tag">${levelHintText(level)}</span>`,
  ];
  if (status.lastAccuracy !== null) {
    tags.push(`<span class="tag">上一组 ${Math.round(status.lastAccuracy * 100)}%</span>`);
  }

  return `
    <button class="${classes}" data-action="${unlocked ? 'start-level' : 'locked-level'}" data-level="${level.id}" ${unlocked ? '' : 'aria-disabled="true"'}>
      <span class="level-badge" aria-hidden="true">${badge}</span>
      <span class="level-main">
        <span class="level-topline">
          <span class="level-title">${esc(level.title)}</span>
          ${complete ? '<span class="tag tag--success">已完成</span>' : ''}
        </span>
        <span class="level-desc">${esc(level.description)}</span>
        <span class="level-tags">${tags.join('')}</span>
      </span>
      <span class="level-side" aria-hidden="true">
        ${unlocked
          ? `<span class="progress-ring" style="${progressRingStyle(status.progressPercent)}"><span class="progress-ring__text">${status.progressPercent}%</span></span>
             <span class="level-side__label">${status.mastered}/${status.total}</span>`
          : `<span class="level-lock">${icon('lock')}</span><span class="level-side__label">未解锁</span>`}
      </span>
    </button>`;
}

/* ---------- 作者 ---------- */

const AUTHOR_X_URL = 'https://x.com/nan_chen618';

function renderAuthorLine(extraClass = '') {
  return `<p class="author-line ${extraClass}">作者 南 · 一个拿 AI 做实验的吉他手 ·
    <a href="${AUTHOR_X_URL}" target="_blank" rel="noopener">X @nan_chen618</a></p>`;
}

/* ---------- 设置 ---------- */

/** 手机上怎么打开：仅在本机开发时显示；线上域名不出现任何局域网地址。 */
function renderPhoneSection() {
  const isLoopback = ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname);
  if (!isLoopback) return '';

  const lanUrl = getLanUrl();

  if (!lanUrl) {
    return `
      <section class="settings-section">
        <div class="settings-section__head">
          <div>
            <h2 class="settings-section__title">在手机上打开</h2>
            <p class="settings-section__desc">手机与电脑连同一个 Wi-Fi，用电脑的局域网地址访问即可。通过 <code>npm start</code> 启动时，这里会直接显示地址。</p>
          </div>
        </div>
        <div class="about-lines">
          <p>手机与电脑连同一个 Wi-Fi，在手机浏览器输入电脑的局域网地址即可。</p>
        </div>
      </section>`;
  }

  return `
    <section class="settings-section">
      <div class="settings-section__head">
        <div>
          <h2 class="settings-section__title">在手机上打开</h2>
          <p class="settings-section__desc">手机与电脑连同一个 Wi-Fi，然后在手机浏览器输入下面的地址。</p>
        </div>
      </div>
      <p class="lan-url" id="lan-url">${esc(lanUrl)}</p>
      <div class="danger-row">
        <button class="btn btn--outline" data-action="copy-lan-url" data-url="${esc(lanUrl)}">${icon('copy')} 复制地址</button>
      </div>
      <div class="about-lines" style="margin-top:10px">
        <p>此地址仅供同一 Wi-Fi 下的本地预览；正式分享请使用部署后的 https 地址。</p>
      </div>
    </section>`;
}

function renderSettings() {
  const settings = state.settings;
  renderAppBar({ title: '设置', subtitle: '偏好会立即保存', back: true });
  renderBottomNav('settings');

  const option = (key, value, title, sub) => `
    <button class="option ${settings[key] === value ? 'is-selected' : ''}"
      data-action="set-setting" data-key="${key}" data-value="${value}"
      aria-pressed="${settings[key] === value}">
      ${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}
    </button>`;

  const sharpPreview = spellPitch(66, 'sharp');
  const flatPreview = spellPitch(66, 'flat');
  const swatches = COLOR_PRESETS.map(({ value, name }) => `
    <button class="swatch ${settings.primaryColor === value ? 'is-selected' : ''}"
      style="--swatch:${value}" data-action="set-color" data-color="${value}"
      aria-label="主色：${name}" title="${name}"></button>`).join('');

  const view = $('#view');
  view.innerHTML = `
    <div class="screen settings-screen">
      <section class="settings-section">
        <div class="settings-section__head">
          <div>
            <h2 class="settings-section__title">答题模式</h2>
            <p class="settings-section__desc">每题只使用一种作答方式。</p>
          </div>
        </div>
        <div class="option-grid">
          ${option('answerMode', 'name', '音名', 'C / D / E')}
          ${option('answerMode', 'solfege', '唱名', 'do / re / mi')}
          ${option('answerMode', 'fretboard', '指板', '点位置')}
        </div>
      </section>

      <section class="settings-section">
        <div class="settings-section__head">
          <div>
            <h2 class="settings-section__title">显示内容</h2>
            <p class="settings-section__desc">控制答题后显示的名称；音名题按钮仍显示音名。</p>
          </div>
        </div>
        <div class="option-grid">
          ${option('display', 'name', '只音名', 'E')}
          ${option('display', 'solfege', '只唱名', 'mi')}
          ${option('display', 'both', '同时', 'E · mi')}
        </div>
      </section>

      <section class="settings-section">
        <div class="settings-section__head">
          <div>
            <h2 class="settings-section__title">升降号写法</h2>
            <p class="settings-section__desc">同一个品位的音，统一使用一种写法。</p>
          </div>
        </div>
        <div class="option-grid option-grid--2">
          ${option('accidentalStyle', 'sharp', '升号', `${sharpPreview.name} · ${sharpPreview.solfege}`)}
          ${option('accidentalStyle', 'flat', '降号', `${flatPreview.name} · ${flatPreview.solfege}`)}
        </div>
      </section>

      <section class="settings-section">
        <div class="settings-section__head">
          <div>
            <h2 class="settings-section__title">弦号提示</h2>
            <p class="settings-section__desc">“自动”按关卡配置。显示弦号时，指板题只认该弦上的位置。</p>
          </div>
        </div>
        <div class="option-grid">
          ${option('stringHint', 'auto', '自动', '按关卡')}
          ${option('stringHint', 'always', '总是显示', '①–⑥')}
          ${option('stringHint', 'never', '从不显示', '隐藏')}
        </div>
      </section>

      <section class="settings-section">
        <div class="settings-section__head">
          <div>
            <h2 class="settings-section__title">主色</h2>
            <p class="settings-section__desc">浅色主题，主色会用于按钮、进度和提示。</p>
          </div>
        </div>
        <div class="swatch-row">
          ${swatches}
          <label class="color-input-wrap">
            <input class="color-input" id="custom-color" type="color" value="${esc(settings.primaryColor)}" aria-label="自定义主色">
            自定义
          </label>
        </div>
      </section>

      <section class="settings-section">
        <div class="switch-row">
          <div>
            <h2 class="settings-section__title">解锁全部关卡</h2>
            <p class="settings-section__desc">练习模式：跳过解锁条件，自由进入任意关卡。</p>
          </div>
          <button class="switch" role="switch" aria-checked="${settings.unlockAll}" aria-label="解锁全部关卡" data-action="toggle-unlock">
            <span class="switch__knob"></span>
          </button>
        </div>
      </section>

      <section class="settings-section">
        <div class="settings-section__head">
          <div>
            <h2 class="settings-section__title">学习数据</h2>
            <p class="settings-section__desc">数据只保存在这台设备的 localStorage 中。</p>
          </div>
        </div>
        <div class="danger-row">
          <button class="btn btn--outline" data-action="export-data">${icon('download')} 导出备份</button>
          <label class="btn btn--outline" for="import-file">
            ${icon('upload')} 导入备份
          </label>
          <input class="sr-only" id="import-file" type="file" accept="application/json,.json">
          <button class="btn btn--outline" data-action="reset-progress">${icon('refresh')} 重置学习进度</button>
          <button class="btn btn--danger" data-action="clear-all">${icon('trash')} 清除全部数据</button>
        </div>
        <p class="settings-hint">备份是一个 JSON 文件，包含设置与全部熟练度。换手机或清缓存前导出一份，导入会覆盖当前进度。</p>
      </section>

      ${renderPhoneSection()}

      <section class="settings-section">
        <div class="settings-section__head">
          <div>
            <h2 class="settings-section__title">关于</h2>
            <p class="settings-section__desc">吉他五线谱闪卡 ${APP_VERSION} · 纯前端 PWA</p>
          </div>
          <span class="chip ${isOfflineReady() ? 'chip--neutral' : 'chip--warn'}">
            ${icon('info')} ${isOfflineReady() ? '离线可用' : '需联网访问'}
          </span>
        </div>
        <div class="about-lines">
          <p><strong>记谱：</strong>谱上音高 = 实际音高 + 12 个半音，低音弦会画下加线。</p>
          <p><strong>发声：</strong>答题后可以点“听一下”对照实际音高（合成音，仅作辅助）。</p>
          <p><strong>联网：</strong>${isOfflineReady()
            ? '应用已缓存到本机，断网也能打开。'
            : '当前需联网访问。浏览器支持 Service Worker 且通过 HTTPS 打开时，会在后台缓存应用；缓存完成后这里会显示“离线可用”。'}</p>
          <p><strong>安装：</strong>iPhone / iPad 用 Safari 分享菜单“添加到主屏幕”；Android 可在浏览器菜单中安装。安装需要 HTTPS。</p>
          <p><strong>谱表：</strong>VexFlow 5.0.0，已随项目内置。</p>
          <p><strong>作者：</strong>南 · 一个拿 AI 做实验的吉他手 · <a href="${AUTHOR_X_URL}" target="_blank" rel="noopener">X @nan_chen618</a></p>
        </div>
      </section>
    </div>`;
}

/* ---------- 答题页 ---------- */

const FOCUS_LEVEL_ID = 'focus';

/**
 * 从学习记录里挑出还不稳的音，组成一个虚拟关卡。
 * 只用用户练过的音高，不会突然冒出完全没接触过的音。
 */
function buildFocus(limit = 12) {
  const weak = getWeakestPitches(state.progress, state.settings, limit);
  if (weak.length === 0) return null;
  const base = LEVEL_BY_ID['full-chromatic'] || LEVELS[LEVELS.length - 1];
  const weakKeys = new Set(weak.map((item) => item.pitchKey));
  const pool = getLevelPool(base, state.settings.accidentalStyle)
    .filter((note) => weakKeys.has(note.pitchKey));
  if (pool.length === 0) return null;
  // 全部是自然音时只给 7 个按钮，避免无意义的选择负担。
  const allNatural = weak.every((item) => item.note.pitch.isNatural);
  return {
    weak,
    pool,
    level: {
      ...base,
      id: FOCUS_LEVEL_ID,
      title: '弱项练习',
      shortTitle: '弱项练习',
      description: `${weak.length} 个还没到 ${MASTERY_LEVEL} 级的音`,
      rangeLabel: '按学习记录生成',
      stringHint: 0.5,
      naturalsOnly: allNatural,
    },
  };
}

function startFocusSession() {
  const focus = buildFocus();
  if (!focus) {
    showSnackbar('还没有足够的练习记录，先做一组常规题吧。');
    return;
  }
  state.lastResult = null;
  state.feedback = null;
  state.session = new QuizSession(focus.level, {
    settings: state.settings,
    progress: state.progress,
    pool: focus.pool,
    focus: true,
  });
  state.sessionHash = `#/quiz/${FOCUS_LEVEL_ID}`;
  if (state.session.total === 0) {
    showSnackbar('弱项太少，先做一组常规题吧。');
    state.session = null;
    return;
  }
  navigate(state.sessionHash, { scrollToTop: true });
}

function ensureQuizSession(levelId) {
  if (state.session && state.session.level.id === levelId) return true;

  if (levelId === FOCUS_LEVEL_ID) {
    const focus = buildFocus();
    if (!focus) {
      showSnackbar('还没有足够的练习记录，先做一组常规题吧。');
      navigate('#/');
      return false;
    }
    state.session = new QuizSession(focus.level, {
      settings: state.settings,
      progress: state.progress,
      pool: focus.pool,
      focus: true,
    });
    state.feedback = null;
    state.sessionHash = `#/quiz/${FOCUS_LEVEL_ID}`;
    if (state.session.total === 0) {
      showSnackbar('弱项太少，先做一组常规题吧。');
      state.session = null;
      navigate('#/');
      return false;
    }
    return true;
  }

  const level = getLevel(levelId);
  if (!level) {
    showSnackbar('没有找到这个关卡。');
    navigate('#/');
    return false;
  }
  if (!isLevelUnlocked(level, state.progress, state.settings)) {
    showSnackbar('这一关还没有解锁，先完成上一关吧。');
    navigate('#/');
    return false;
  }
  state.session = new QuizSession(level, {
    settings: state.settings,
    progress: state.progress,
  });
  state.feedback = null;
  state.sessionHash = `#/quiz/${level.id}`;
  if (state.session.total === 0) {
    showSnackbar('这个关卡暂时没有可出的题。');
    state.session = null;
    navigate('#/');
    return false;
  }
  return true;
}

function startLevel(levelId) {
  const level = getLevel(levelId);
  if (!level) return;
  if (!isLevelUnlocked(level, state.progress, state.settings)) {
    showSnackbar('这一关还没有解锁，先完成上一关吧。');
    return;
  }
  state.lastResult = null;
  state.feedback = null;
  state.session = new QuizSession(level, {
    settings: state.settings,
    progress: state.progress,
  });
  state.sessionHash = `#/quiz/${level.id}`;
  if (state.session.total === 0) {
    showSnackbar('这个关卡暂时没有可出的题。');
    state.session = null;
    return;
  }
  navigate(state.sessionHash, { scrollToTop: true });
}

function renderQuiz() {
  const route = parseRoute();
  if (!ensureQuizSession(route.levelId)) return;
  const session = state.session;
  const level = session.level;
  const card = state.feedback?.card || session.current;

  if (!card) {
    finishGroup();
    return;
  }

  const feedback = state.feedback;
  const currentNumber = feedback
    ? session.firstAttempts
    : Math.min(session.firstAttempts + 1, session.total);
  const progressPercent = session.total
    ? (session.firstAttempts / session.total) * 100
    : 0;
  const showString = card.displayString;
  const isRetryCard = feedback ? !feedback.firstAttempt : card.isRetry;
  const prompt = state.settings.answerMode === 'fretboard'
    ? '在指板上找到这个音'
    : state.settings.answerMode === 'solfege'
      ? '这个音的唱名是？'
      : '这个音的音名是？';

  const chips = [];
  if (showString) {
    chips.push(`<span class="chip">指定弦：${CIRCLED_NUMBERS[card.note.string]} 弦</span>`);
  }
  if (!feedback && card.isRetry) chips.push('<span class="chip chip--warn">再练一次</span>');
  if (feedback) {
    chips.push(`<span class="chip chip--neutral">${feedback.correct ? '已答对' : '已看答案'}</span>`);
  }

  renderAppBar({
    title: level.shortTitle,
    subtitle: `第 ${currentNumber} / ${session.total} 张`,
    back: true,
  });
  renderBottomNav(null);
  $('#view').classList.add('view--no-nav');

  const answerArea = feedback ? renderFeedback(feedback) : renderAnswerArea(card, level);
  const staffAria = staffAriaDescription(card.note.pitch, {
    showString,
    stringNumber: card.note.string,
    reveal: Boolean(feedback),
  });

  const view = $('#view');
  view.innerHTML = `
    <div class="screen quiz-screen">
      <div class="quiz-progress">
        <div class="quiz-progress__head">
          <span>${isRetryCard ? '复习' : '新题'} · ${esc(level.shortTitle)}</span>
          <span class="quiz-progress__count">${currentNumber} / ${session.total}</span>
        </div>
        <div class="progress-track" role="progressbar" aria-label="本组进度" aria-valuemin="0" aria-valuemax="${session.total}" aria-valuenow="${session.firstAttempts}">
          <div class="progress-fill" style="width:${progressPercent}%"></div>
        </div>
      </div>

      <div class="staff-card">
        <div class="staff-card__staff" id="quiz-staff"></div>
      </div>

      <div class="prompt-row"><p class="prompt">${prompt}</p></div>
      <div class="chip-row">${chips.join('')}</div>

      ${answerArea}
      <div class="sr-only" id="quiz-live" aria-live="polite"></div>
    </div>`;

  drawStaff($('#quiz-staff'), card.note.pitch, {
    width: 320,
    height: 200,
    staveY: 40,
    noteStartX: 162,
    // 高音谱表的真实笔画（含弦号徽标）实测占 y≈41–163.5：最高音 E6 的
    // 上加线顶到 41，最低音 E3 的三条下加线底到 163.5。其余高度是 VexFlow
    // clef 字形的包围盒虚高。上下各留 8px 后取 33–172，既能去掉原先
    // 上下各约 50px 的空白，又不会切掉加线或升降号。
    viewBox: { x: 0, y: 33, width: 320, height: 139 },
    showStringBadge: showString,
    stringNumber: card.note.string,
    state: feedback ? (feedback.correct ? 'correct' : 'wrong') : 'neutral',
    ariaLabel: staffAria,
  });

  if (feedback) {
    const boardHost = $('#feedback-board');
    if (boardHost) {
      const accepted = feedback.correctPositions || [];
      renderFingerboard(boardHost, {
        frets: level.frets,
        strings: STRINGS,
        disabled: true,
        targetPositions: accepted,
        wrongPosition: state.settings.answerMode === 'fretboard' && feedback.selection
          ? feedback.selection
          : null,
        hintString: showString ? card.note.string : null,
        revealPosition: accepted[0] || null,
        ariaLabel: '答案指板：绿色圈出正确位置',
      });
    }
    setLiveFeedback(feedback);
  } else {
    if (state.settings.answerMode === 'fretboard') {
      const boardHost = $('#quiz-board');
      if (boardHost) {
        renderFingerboard(boardHost, {
          frets: level.frets,
          strings: STRINGS,
          hintString: showString ? card.note.string : null,
          ariaLabel: `指板题：${showString ? `只认第 ${card.note.string} 弦，` : ''}点击一个位置作答`,
          onSelect: (position) => handleAnswer(position),
        });
      }
    }
    session.markShown();
  }
}

function renderAnswerArea(card, level) {
  if (state.settings.answerMode === 'fretboard') {
    const fretsLabel = level.frets.includes(0)
      ? `0–${Math.max(...level.frets)} 品`
      : `${Math.min(...level.frets)}–${Math.max(...level.frets)} 品`;
    return `
      <div class="fingerboard-card">
        <div class="fb-caption">
          <span>点亮一个位置</span>
          <span>${esc(fretsLabel)}${level.frets.length > 9 ? ' · 左右滑动' : ''}</span>
        </div>
        <div id="quiz-board"></div>
        <div class="fb-legend">
          <span class="fb-legend__item"><i class="fb-legend__dot"></i> 答后绿色</span>
          <span class="fb-legend__item"><i class="fb-legend__dot fb-legend__dot--wrong"></i> 答错红色</span>
        </div>
      </div>`;
  }

  const choices = pitchClassChoices(level.naturalsOnly, state.settings.accidentalStyle);
  const buttons = choices.map((choice) => {
    const label = state.settings.answerMode === 'solfege' ? choice.solfege : choice.label;
    return `<button class="answer-btn ${state.settings.answerMode === 'solfege' ? 'answer-btn--solfege' : ''}"
      data-action="answer" data-value="${choice.pitchClass}"
      aria-label="${state.settings.answerMode === 'solfege' ? '唱名' : '音名'} ${esc(label)}">${esc(label)}</button>`;
  }).join('');
  return `<div class="answer-grid">${buttons}</div>`;
}

function renderFeedback(feedback) {
  const card = feedback.card;
  const pitch = card.note.pitch;
  const title = feedback.correct ? '答对了' : '正确答案';
  const answer = answerMarkup(pitch);
  const detailParts = [
    card.note.positionLabel,
    staffDescription(card.note),
  ];
  if (feedback.correctPositions && feedback.correctPositions.length > 1) {
    const others = feedback.correctPositions
      .filter((position) => position.string !== card.note.string || position.fret !== card.note.fret)
      .map((position) => `${CIRCLED_NUMBERS[position.string]}弦${position.fret === 0 ? '空弦' : `${position.fret}品`}`);
    if (others.length) detailParts.push(`也接受：${others.join('、')}`);
  }

  let selectionNote = '';
  if (!feedback.correct && state.settings.answerMode === 'fretboard' && feedback.selection) {
    const selected = feedback.selection;
    selectionNote = `<div class="feedback__retry">你点的是 ${CIRCLED_NUMBERS[selected.string]}弦${selected.fret === 0 ? '空弦' : `${selected.fret}品`}。${card.displayString ? `这道题指定了 ${CIRCLED_NUMBERS[card.note.string]} 弦。` : ''}</div>`;
  }

  let retryText = '';
  if (feedback.retryScheduled) {
    const after = feedback.retryAfter;
    retryText = after === 0
      ? '这题会马上再出现一次。'
      : after !== null && after < 3
        ? `这题会在 ${after} 题后再次出现。`
        : '这题会在 3–5 题后再次出现。';
  }
  const retryNote = retryText
    ? `<div class="feedback__retry">${retryText}</div>`
    : '';

  const nextLabel = feedback.groupComplete ? '查看结果' : '下一题';

  return `
    <div class="feedback ${feedback.correct ? 'feedback--correct' : 'feedback--wrong'}" id="feedback-area">
      <div class="feedback__head">
        <span class="feedback__icon">${feedback.correct ? icon('check') : icon('info')}</span>
        <span class="feedback__title">${title}</span>
      </div>
      <div class="feedback__answer">${answer}</div>
      <div class="feedback__detail">${detailParts.map(esc).join(' · ')}</div>
      ${selectionNote}
      ${retryNote}
      <div class="feedback__actions">
        <button class="btn btn--outline" data-action="listen">${icon('speaker')} 听一下</button>
        <button class="btn btn--filled" data-action="next">${nextLabel}</button>
      </div>
      <div class="feedback__board">
        <div class="fb-caption">
          <span>正确位置</span>
          <span>${card.displayString ? `只认 ${CIRCLED_NUMBERS[card.note.string]} 弦` : '同音位置都算对'}</span>
        </div>
        <div id="feedback-board"></div>
      </div>
    </div>`;
}

function setLiveFeedback(feedback) {
  const live = $('#quiz-live');
  if (!live) return;
  const card = feedback.card;
  const answer = getDisplayAnswer(card.note.pitch);
  const label = answer.sub ? `${answer.main}，${answer.sub}` : answer.main;
  live.textContent = feedback.correct
    ? `答对了。${card.note.positionLabel}，${label}。`
    : `答错了。正确答案是 ${label}，${card.note.positionLabel}。`;
}

function handleAnswer(selection) {
  if (!state.session || state.feedback) return;
  const outcome = state.session.answer(selection);
  const card = outcome.card;
  recordNoteAnswer(state.progress, card.note.pitchKey, outcome.correct);

  // 指板题额外记录「位置」维度：同音异位是两次不同的练习。
  if (state.settings.answerMode === 'fretboard') {
    const clickedString = selection && Number.isInteger(selection.string)
      ? selection.string
      : card.note.string;
    const positionKey = `w${card.note.writtenMidi}@${clickedString}`;
    recordPositionAnswer(state.progress, positionKey, outcome.correct);
  }

  saveProgress(state.progress);
  state.feedback = outcome;
  renderPreserveScroll();
}

async function handleNext() {
  if (!state.feedback) return;
  if (state.feedback.groupComplete) {
    finishGroup();
    return;
  }
  state.feedback = null;
  if (!state.session?.current) {
    finishGroup();
    return;
  }
  render({ scrollToTop: true, focusView: true });
}

async function handleListen(target) {
  const card = state.feedback?.card;
  if (!card) return;
  const original = target.innerHTML;
  target.disabled = true;
  target.innerHTML = `${icon('speaker')} 播放中…`;
  try {
    await playNote(card.note);
  } finally {
    target.disabled = false;
    target.innerHTML = original;
  }
}

function finishGroup() {
  const session = state.session;
  if (!session) {
    navigate('#/');
    return;
  }
  const level = session.level;
  const summary = session.summary();
  const statusBefore = getLevelStatus(level, state.progress, state.settings);
  const nextLevel = getNextLevel(level.id);
  const wasNextUnlocked = nextLevel
    ? isLevelUnlocked(nextLevel, state.progress, state.settings)
    : true;
  const alreadyCompleted = Boolean(state.progress.levels[level.id]?.completedAt);
  const completedNow = !alreadyCompleted
    && statusBefore.mastered >= statusBefore.total
    && summary.accuracy >= 0.9;

  recordGroupResult(state.progress, {
    levelId: level.id,
    summary,
    completedNow,
  });
  saveProgress(state.progress);

  const statusAfter = getLevelStatus(level, state.progress, state.settings);
  const nextUnlockedNow = nextLevel
    ? isLevelUnlocked(nextLevel, state.progress, state.settings)
    : true;
  const newlyUnlockedLevel = nextLevel && !wasNextUnlocked && nextUnlockedNow ? nextLevel : null;
  const requirement = nextLevel
    ? getNextUnlockRequirement(level, state.progress, state.settings)
    : null;

  state.lastResult = {
    summary,
    level,
    nextLevel,
    statusAfter,
    completedNow,
    newlyUnlockedLevel,
    requirement,
    alreadyCompleted,
  };
  state.session = null;
  state.sessionHash = null;
  state.feedback = null;
  navigate('#/result', { scrollToTop: true });
}

/* ---------- 结果页 ---------- */

function renderResult() {
  const result = state.lastResult;
  if (!result) {
    navigate('#/', { replace: true });
    return;
  }
  const { summary, level, nextLevel, statusAfter, completedNow, newlyUnlockedLevel, requirement } = result;
  const accuracyPercent = Math.round(summary.accuracy * 100);
  const message = summary.accuracy === 1
    ? '全对，很稳。'
    : summary.accuracy >= 0.9
      ? '很棒，继续保持。'
      : summary.accuracy >= 0.7
        ? '不错，错的音会再出现。'
        : '慢一点也没关系，先看清谱上位置。';

  renderAppBar({ title: '本组结果', subtitle: level.title, back: true });
  renderBottomNav(null);
  $('#view').classList.add('view--no-nav');

  const unlockBanner = newlyUnlockedLevel
    ? `<div class="unlock-banner">
        <span class="unlock-banner__icon">${icon('check')}</span>
        <div>
          <div class="unlock-banner__title">已解锁：${esc(newlyUnlockedLevel.title)}</div>
          <div class="unlock-banner__text">继续下一关，或回到关卡列表看看。</div>
        </div>
      </div>`
    : '';

  const alreadyTag = (statusAfter.completed && !completedNow)
    ? ' <span class="tag tag--success">本关已完成</span>'
    : '';

  let requirementBlock = '';
  if (summary.focus) {
    requirementBlock = `<div class="requirement">
      <div class="requirement__title">弱项练习不关卡进度，只影响这些音的熟练度。</div>
      <div class="requirement__row">下一组会根据最新的熟练度重新挑选弱项。</div>
    </div>`;
  } else if (nextLevel && !statusAfter.completed) {
    const mastered = requirement?.mastered ?? statusAfter.mastered;
    const total = requirement?.total ?? statusAfter.total;
    const accuracy = requirement?.accuracy ?? summary.accuracy;
    requirementBlock = `
      <div class="requirement">
        <div class="requirement__title">下一关：${esc(nextLevel.title)}</div>
        <div class="requirement__row">
          <span class="requirement__check ${mastered >= total ? 'is-done' : ''}">${mastered >= total ? '✓' : ''}</span>
          <span>本关进度 ${statusAfter.progressPercent}%：${mastered} / ${total} 个音达到 ${MASTERY_LEVEL} 级</span>
        </div>
        <div class="requirement__row">
          <span class="requirement__check ${accuracy >= 0.9 ? 'is-done' : ''}">${accuracy >= 0.9 ? '✓' : ''}</span>
          <span>最近一组正确率：${Math.round((accuracy || 0) * 100)}%（需 ≥ 90%）</span>
        </div>
        ${mastered >= total && accuracy < 0.9 ? '<div class="requirement__row">再练一组，把正确率提到 90% 就能解锁。</div>' : ''}
        ${accuracy >= 0.9 && mastered < total ? `<div class="requirement__row">正确率达标了，还差一些音达到 ${MASTERY_LEVEL} 级。</div>` : ''}
      </div>`;
  } else if (nextLevel && statusAfter.completed && !newlyUnlockedLevel) {
    requirementBlock = '<div class="requirement"><div class="requirement__title">本关已完成，可以继续挑战下一关。</div></div>';
  } else if (!nextLevel) {
    requirementBlock = `<div class="requirement"><div class="requirement__title">${statusAfter.completed ? '全部关卡完成，厉害。' : '这是最后一关，继续练习就能完成它。'}</div></div>`;
  }

  // 重做两次仍未掌握的音：单独列出来，而不是无限重做。
  const gaveUpBlock = summary.gaveUp && summary.gaveUp.length
    ? `<div class="requirement requirement--warn">
        <div class="requirement__title">这几张还没掌握，已收录进弱项</div>
        <div class="requirement__row">重新练会时它们会优先出现，不用在这一组死磕。</div>
        <div class="tag-row" style="margin-top:8px">
          ${summary.gaveUp.map((item) => {
            const note = makeNote(item.string, item.fret, state.settings.accidentalStyle);
            return `<span class="tag">${esc(note.pitch.name)} · ${esc(note.positionLabel)}</span>`;
          }).join('')}
        </div>
      </div>`
    : '';

  const missedHtml = summary.missed.length
    ? `<div class="missed-list">
        ${summary.missed.map((item, index) => {
          const note = makeNote(item.string, item.fret, state.settings.accidentalStyle);
          return `<div class="missed-item">
            <div class="missed-item__staff" id="missed-staff-${index}"></div>
            <div class="missed-item__main">
              <div class="missed-item__name">${answerInline(note.pitch)}</div>
              <div class="missed-item__detail">${esc(note.positionLabel)} · ${esc(staffDescription(note))}</div>
            </div>
            <span class="missed-item__count">×${item.count}</span>
          </div>`;
        }).join('')}
      </div>`
    : '<div class="requirement"><div class="requirement__title">这一组没有错音。可以换一组，或者挑战下一关。</div></div>';

  const view = $('#view');
  view.innerHTML = `
    <div class="screen result-screen">
      <section class="result-hero">
        <div class="result-ring" style="${progressRingStyle(accuracyPercent)}" aria-hidden="true">
          <div class="result-ring__inner">
            <span class="result-ring__value">${accuracyPercent}%</span>
            <span class="result-ring__label">正确率</span>
          </div>
        </div>
        <h1 class="result-title">本组完成</h1>
        <p class="result-sub">${esc(message)}${alreadyTag}</p>
      </section>

      ${unlockBanner}
      ${requirementBlock}

      <div class="stats-grid">
        <div class="stat"><div class="stat__label">正确率</div><div class="stat__value">${accuracyPercent}%</div></div>
        <div class="stat"><div class="stat__label">平均用时</div><div class="stat__value">${formatDuration(summary.avgMs)}</div></div>
        <div class="stat"><div class="stat__label">本组题数</div><div class="stat__value">${summary.total}</div></div>
        <div class="stat"><div class="stat__label">重做次数</div><div class="stat__value">${summary.retries}</div></div>
      </div>

      ${gaveUpBlock}

      <section class="section">
        <div class="section-head">
          <h2 class="section-title">最容易错的 3 个音</h2>
          <p class="section-subtitle">按本组错误次数</p>
        </div>
        ${missedHtml}
      </section>

      <div class="share-row">
        <button class="btn btn--tonal share-row__main" data-action="share-x">${icon('share')}分享成绩到 X</button>
        <button class="btn btn--outline share-row__copy" data-action="share-copy" aria-label="复制成绩文字">复制</button>
      </div>

      <div class="result-actions">
        ${summary.focus
          ? `<button class="btn btn--filled btn--block" data-action="start-focus">再练一组弱项</button>
             <button class="btn btn--outline btn--block" data-action="navigate" data-route="#/">返回关卡</button>`
          : `<button class="btn btn--filled btn--block" data-action="start-level" data-level="${level.id}">再来一组</button>
             <button class="btn btn--outline btn--block" data-action="navigate" data-route="#/">返回关卡</button>`}
      </div>
    </div>`;

  summary.missed.forEach((item, index) => {
    const note = makeNote(item.string, item.fret, state.settings.accidentalStyle);
    const host = $(`#missed-staff-${index}`);
    if (host) {
      drawStaff(host, note.pitch, {
        width: 150,
        height: 120,
        staveY: 0,
        noteStartX: 74,
        compact: true,
        ariaLabel: staffAriaDescription(note.pitch, { reveal: true }),
      });
    }
  });
}

function buildShareText() {
  const result = state.lastResult;
  if (!result) return '';
  const { summary } = result;
  const percent = Math.round(summary.accuracy * 100);
  return `我在五线谱闪卡练习拿了 ${percent}%（${summary.firstCorrect}/${summary.total}），来试试？`;
}

function shareToX() {
  const text = buildShareText();
  if (!text) return;
  const url = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(SHARE_SITE_URL)}`;
  // 注意：带 noopener 时 window.open 总是返回 null，所以这里手动断开 opener。
  const opened = window.open(url, '_blank');
  if (opened) {
    try { opened.opener = null; } catch { /* 跨域时忽略 */ }
  } else {
    location.href = url;
  }
}

/* ---------- 渲染入口 ---------- */

function render({ scrollToTop = false, preserveScroll = false, focusView = false } = {}) {
  const previousScroll = window.scrollY;
  const route = parseRoute();
  state.route = route;
  applyTheme(state.settings.primaryColor);
  $('#view').classList.remove('view--no-nav');
  $('#view').classList.toggle('view--no-enter', preserveScroll);

  if (route.name === 'quiz') {
    renderQuiz();
  } else if (route.name === 'settings') {
    renderSettings();
  } else if (route.name === 'result') {
    renderResult();
  } else {
    renderHome();
  }

  if (scrollToTop) window.scrollTo({ top: 0, behavior: 'auto' });
  else if (preserveScroll) {
    requestAnimationFrame(() => window.scrollTo({ top: previousScroll, behavior: 'auto' }));
  }
  if (focusView) $('#view').focus({ preventScroll: true });
}

/* ---------- 对话框 / Snackbar ---------- */

function showDialog({
  title,
  body,
  confirmLabel = '确定',
  cancelLabel = '取消',
  danger = false,
} = {}) {
  const root = $('#dialog-root');
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    root.innerHTML = `
      <div class="dialog-backdrop" data-dialog-backdrop>
        <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
          <h2 class="dialog__title" id="dialog-title">${esc(title)}</h2>
          <p class="dialog__body">${esc(body)}</p>
          <div class="dialog__actions">
            <button class="btn btn--text" data-dialog-cancel>${esc(cancelLabel)}</button>
            <button class="btn ${danger ? 'btn--danger' : 'btn--filled'}" data-dialog-confirm>${esc(confirmLabel)}</button>
          </div>
        </div>
      </div>`;

    const cleanup = (value) => {
      document.removeEventListener('keydown', onKey);
      root.innerHTML = '';
      previousFocus?.focus?.({ preventScroll: true });
      resolve(value);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') cleanup(false);
    };
    root.querySelector('[data-dialog-cancel]').addEventListener('click', () => cleanup(false));
    root.querySelector('[data-dialog-confirm]').addEventListener('click', () => cleanup(true));
    root.querySelector('[data-dialog-backdrop]').addEventListener('click', (event) => {
      if (event.target === event.currentTarget) cleanup(false);
    });
    document.addEventListener('keydown', onKey);
    setTimeout(() => root.querySelector('[data-dialog-cancel]')?.focus(), 30);
  });
}

function hideSnackbar({ olderThan = 0 } = {}) {
  const snackbar = $('#snackbar');
  if (!snackbar || !snackbar.classList.contains('is-visible')) return;
  if (olderThan && Date.now() - (state.snackbarShownAt || 0) < olderThan) return;
  if (state.snackbarTimer) clearTimeout(state.snackbarTimer);
  state.snackbarTimer = null;
  snackbar.classList.remove('is-visible');
}

function showSnackbar(message, { actionLabel = '', onAction = null, duration = 3600 } = {}) {
  const snackbar = $('#snackbar');
  if (state.snackbarTimer) clearTimeout(state.snackbarTimer);
  snackbar.innerHTML = '';
  const text = document.createElement('span');
  text.textContent = message;
  snackbar.appendChild(text);
  if (actionLabel && onAction) {
    const action = document.createElement('button');
    action.className = 'snackbar__action';
    action.type = 'button';
    action.textContent = actionLabel;
    action.addEventListener('click', (event) => {
      event.stopPropagation();
      hideSnackbar();
      onAction();
    });
    snackbar.appendChild(action);
  }
  if (!snackbar.dataset.bound) {
    // 点一下提示条即可收起，不挡操作。
    snackbar.addEventListener('click', () => hideSnackbar());
    snackbar.dataset.bound = '1';
  }
  state.snackbarShownAt = Date.now();
  snackbar.classList.add('is-visible');
  state.snackbarTimer = setTimeout(() => {
    snackbar.classList.remove('is-visible');
    state.snackbarTimer = null;
  }, duration);
}

/* ---------- 交互 ---------- */

async function requestLeaveQuiz(target = '#/') {
  const ok = await showDialog({
    title: '退出本组？',
    body: '本组不会生成结果页，但已经答过的题会保留熟练度。',
    confirmLabel: '退出',
    cancelLabel: '继续练习',
    danger: true,
  });
  if (!ok) return;
  state.session = null;
  state.sessionHash = null;
  state.feedback = null;
  navigate(target, { scrollToTop: true });
}

async function setColor(value, { renderAfter = false } = {}) {
  if (!/^#[0-9a-f]{6}$/i.test(value)) return;
  state.settings = normalizeSettings({ ...state.settings, primaryColor: value });
  saveSettings(state.settings);
  applyTheme(state.settings.primaryColor);
  if (renderAfter) renderPreserveScroll();
}

async function updateSetting(key, value) {
  const allowed = {
    answerMode: new Set(['name', 'solfege', 'fretboard']),
    display: new Set(['name', 'solfege', 'both']),
    accidentalStyle: new Set(['sharp', 'flat']),
    stringHint: new Set(['auto', 'always', 'never']),
  };
  if (allowed[key] && !allowed[key].has(value)) return;
  state.settings = normalizeSettings({ ...state.settings, [key]: value });
  saveSettings(state.settings);
  applyTheme(state.settings.primaryColor);
  if (key === 'unlockAll') {
    showSnackbar(value ? '已解锁全部关卡，可自由练习。' : '已恢复按完成度解锁。');
  }
  renderPreserveScroll();
}

function handleBack() {
  const route = parseRoute();
  if (route.name === 'quiz') {
    requestLeaveQuiz('#/');
  } else {
    navigate('#/', { scrollToTop: true });
  }
}

function handlePopState() {
  hideSnackbar({ olderThan: 250 });
  const route = parseRoute();
  if (state.session && route.name !== 'quiz') {
    const pending = location.hash || '#/';
    history.pushState(null, '', state.sessionHash || '#/');
    showDialog({
      title: '退出本组？',
      body: '本组不会生成结果页，但已经答过的题会保留熟练度。',
      confirmLabel: '退出',
      cancelLabel: '继续练习',
      danger: true,
    }).then((ok) => {
      if (ok) {
        state.session = null;
        state.sessionHash = null;
        state.feedback = null;
        navigate(pending, { scrollToTop: true });
      }
    });
    return;
  }
  render({ scrollToTop: true, focusView: true });
}

function onClick(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;

  if (action === 'navigate') {
    navigate(target.dataset.route || '#/', { scrollToTop: true });
    return;
  }
  if (action === 'back') {
    handleBack();
    return;
  }
  if (action === 'start-level') {
    startLevel(target.dataset.level);
    return;
  }
  if (action === 'start-focus') {
    startFocusSession();
    return;
  }
  if (action === 'locked-level') {
    showSnackbar('这一关还没有解锁，先完成上一关吧。');
    return;
  }
  if (action === 'answer') {
    handleAnswer(Number(target.dataset.value));
    return;
  }
  if (action === 'next') {
    handleNext();
    return;
  }
  if (action === 'listen') {
    handleListen(target);
    return;
  }
  if (action === 'set-setting') {
    updateSetting(target.dataset.key, target.dataset.value);
    return;
  }
  if (action === 'set-color') {
    setColor(target.dataset.color, { renderAfter: true });
    return;
  }
  if (action === 'share-x') {
    shareToX();
    return;
  }
  if (action === 'share-copy') {
    const text = buildShareText();
    if (!text) return;
    // 结果页不弹提示条，直接在按钮上显示「已复制」，不遮挡成绩和按钮。
    copyText(`${text} ${SHARE_SITE_URL}`, { silent: true }).then((ok) => {
      if (!ok || !target.isConnected) return;
      target.textContent = '已复制';
      target.classList.add('is-done');
      setTimeout(() => {
        if (!target.isConnected) return;
        target.textContent = '复制';
        target.classList.remove('is-done');
      }, 1800);
    });
    return;
  }
  if (action === 'toggle-unlock') {
    updateSetting('unlockAll', !state.settings.unlockAll);
    return;
  }
  if (action === 'reset-progress') {
    showDialog({
      title: '重置学习进度？',
      body: '会清除所有音符熟练度、关卡完成度和本机统计，但保留设置。',
      confirmLabel: '重置',
      cancelLabel: '取消',
      danger: true,
    }).then((ok) => {
      if (!ok) return;
      state.progress = resetProgress();
      state.lastResult = null;
      state.session = null;
      showSnackbar('学习进度已重置。');
      renderPreserveScroll();
    });
    return;
  }
  if (action === 'clear-all') {
    showDialog({
      title: '清除全部数据？',
      body: '会删除设置、熟练度和所有统计。此操作无法撤销。',
      confirmLabel: '全部清除',
      cancelLabel: '取消',
      danger: true,
    }).then((ok) => {
      if (!ok) return;
      clearAllData();
      state.settings = { ...DEFAULT_SETTINGS };
      state.progress = createProgress();
      state.lastResult = null;
      state.session = null;
      state.feedback = null;
      applyTheme(state.settings.primaryColor);
      showSnackbar('全部数据已清除。');
      navigate('#/', { scrollToTop: true });
    });
    return;
  }
  if (action === 'install') {
    const prompt = state.installPrompt;
    state.installPrompt = null;
    promptInstall(prompt).then((accepted) => {
      if (accepted) showSnackbar('已添加到主屏幕。');
      renderPreserveScroll();
    });
    return;
  }
  if (action === 'copy-lan-url') {
    copyText(target.dataset.url || '');
    return;
  }
  if (action === 'export-data') {
    exportBackup();
  }
}

/** 把设置与进度导出成一个 JSON 文件。 */
function exportBackup() {
  const snapshot = exportSnapshot(state.settings, state.progress);
  const json = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.href = url;
  link.download = `吉他五线谱闪卡-备份-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  showSnackbar('备份已导出。换手机时导入这个文件即可。');
}

/** 读取并校验备份文件，确认后覆盖当前进度。 */
async function importBackup(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;

  let text;
  try {
    text = await file.text();
  } catch {
    showSnackbar('读取文件失败，请换一个文件试试。');
    return;
  }

  let snapshot;
  try {
    snapshot = parseSnapshot(text);
  } catch (error) {
    showSnackbar(error.message || '备份文件无法读取。');
    return;
  }

  const noteCount = Object.keys(snapshot.progress.notes).length;
  const positionCount = Object.keys(snapshot.progress.positions || {}).length;
  const exportedAt = snapshot.progress.createdAt
    ? new Date(snapshot.progress.createdAt).toLocaleDateString('zh-CN')
    : '未知';

  const ok = await showDialog({
    title: '导入这份备份？',
    body: `包含 ${noteCount} 个音的熟练度${positionCount ? `、${positionCount} 个指板位置` : ''}。导入会覆盖当前进度${snapshot.settings ? '和设置' : ''}，无法撤销。`,
    confirmLabel: '覆盖导入',
    cancelLabel: '取消',
    danger: true,
  });
  if (!ok) return;

  try {
    applySnapshot(snapshot);
  } catch {
    showSnackbar('写入失败：浏览器可能禁用了本地存储。');
    return;
  }
  state.settings = loadSettings();
  state.progress = loadProgress();
  state.lastResult = null;
  state.session = null;
  state.sessionHash = null;
  state.feedback = null;
  applyTheme(state.settings.primaryColor);
  showSnackbar(`已导入 ${exportedAt} 的备份。`);
  navigate('#/', { scrollToTop: true });
}

/** 复制文本；局域网 http 下没有 clipboard API，退回到选中文本。 */
async function copyText(text, { doneMessage = '地址已复制，发到手机上打开。', silent = false } = {}) {
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      if (!silent) showSnackbar(doneMessage);
      return true;
    }
  } catch {
    // 继续走回退方案
  }
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  field.remove();
  if (!copied) showSnackbar(`请手动复制：${text}`, { duration: 8000 });
  else if (!silent) showSnackbar(doneMessage);
  return copied;
}

function onChange(event) {
  if (event.target.id === 'custom-color') {
    setColor(event.target.value, { renderAfter: true });
    return;
  }
  if (event.target.id === 'import-file') {
    importBackup(event.target);
  }
}

function onInput(event) {
  if (event.target.id === 'custom-color') {
    setColor(event.target.value);
  }
}

/**
 * 桌面键盘：1–9 选答案、空格 / 回车下一题、L 听一下。
 * 手机端不会触发，不影响触屏。
 */
function onKeyDown(event) {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
  if (document.querySelector('.dialog-backdrop')) return;
  const tag = event.target && event.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (event.target && event.target.isContentEditable) return;
  if (state.route.name !== 'quiz') return;

  if (event.key === ' ' || event.key === 'Enter') {
    if (!state.feedback) return;
    event.preventDefault();
    handleNext();
    return;
  }

  if (event.key === 'l' || event.key === 'L') {
    const listenButton = document.querySelector('[data-action="listen"]');
    if (!listenButton) return;
    event.preventDefault();
    handleListen(listenButton);
    return;
  }

  if (state.feedback) return;
  const digit = Number(event.key);
  if (!Number.isInteger(digit) || digit < 1 || digit > 9) return;
  const button = document.querySelectorAll('.answer-btn')[digit - 1];
  if (!button) return;
  event.preventDefault();
  button.click();
}

function onBeforeUnload(event) {
  if (state.session) {
    event.preventDefault();
    event.returnValue = '';
  }
}

/* ---------- 启动 ---------- */

async function boot() {
  if (appStarted) return;
  appStarted = true;

  state.settings = loadSettings();
  state.progress = loadProgress();
  state.storageOK = isStorageAvailable();
  // 把默认值（含 v1 → v2 的答题模式迁移）落地，避免每次打开都重新推断。
  saveSettings(state.settings);
  applyTheme(state.settings.primaryColor);

  setupInstallPrompt((prompt) => {
    state.installPrompt = prompt;
    if (state.route.name === 'home' && !$('#app').hidden) renderPreserveScroll();
  });

  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  document.addEventListener('input', onInput);
  window.addEventListener('popstate', handlePopState);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('beforeunload', onBeforeUnload);

  if (!location.hash) history.replaceState(null, '', '#/');

  await ensureStaffFonts();
  state.route = parseRoute();
  $('#boot').hidden = true;
  $('#app').hidden = false;
  render({ scrollToTop: true });

  // 只在显式带 ?e2e=1 时暴露状态，供本地真实浏览器验收读取当前题答案。
  if (new URLSearchParams(location.search).has('e2e')) {
    window.__gsf = state;
  }

  registerServiceWorker({
    onUpdateReady: () => {
      showSnackbar('新版本已准备好。', {
        actionLabel: '刷新',
        onAction: applyServiceWorkerUpdate,
        duration: 8000,
      });
    },
    onReady: () => {
      // 首次打开时缓存可能晚于首屏完成；如果用户正停在设置页，刷新离线状态文案。
      if (state.route.name === 'settings') renderPreserveScroll();
    },
  });
}

boot().catch((error) => {
  console.error(error);
  const boot = $('#boot');
  const app = $('#app');
  if (app) app.hidden = true;
  if (boot) {
    boot.hidden = false;
    boot.innerHTML = '<div class="noscript">应用启动失败，请刷新页面重试。</div>';
  }
});

// 供可选的应用冒烟测试读取；不挂到 window，不影响生产行为。

})();
