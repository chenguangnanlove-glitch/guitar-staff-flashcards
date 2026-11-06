/**
 * levels.js — 关卡配置与关卡范围计算。
 *
 * 关卡只声明「弦、品、是否只要自然音、显示弦号的概率」。
 * 具体有哪些音、音名和谱上位置，全部由 music.js 从弦号+品位推算。
 */

import {
  STRINGS,
  buildPositions,
  rangeInclusive,
} from './music.js';

export const LEVEL_GROUPS = Object.freeze([
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
export const LEVELS = Object.freeze([
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

export const LEVEL_BY_ID = Object.freeze(
  Object.fromEntries(LEVELS.map((level) => [level.id, level])),
);

export function getLevel(levelId) {
  return LEVEL_BY_ID[levelId] || null;
}

export function getNextLevel(levelId) {
  const index = LEVELS.findIndex((level) => level.id === levelId);
  return index >= 0 ? LEVELS[index + 1] || null : null;
}

/** 生成一个关卡的完整位置池（音名拼写会跟随设置）。 */
export function getLevelPool(level, accidentalStyle = 'sharp') {
  return buildPositions({
    strings: level.strings,
    frets: level.frets,
    naturalsOnly: level.naturalsOnly,
    accidentalStyle,
  });
}

export function getLevelIndex(levelId) {
  return LEVELS.findIndex((level) => level.id === levelId);
}

/** 该关是否有足够的音做一组 10 张不重复的题。 */
export function getGroupSize(level, accidentalStyle = 'sharp') {
  const seenPitches = new Set(getLevelPool(level, accidentalStyle).map((note) => note.writtenMidi));
  return Math.min(10, seenPitches.size);
}

/**
 * 5 级熟练度里，达到第 3 级（熟悉）才算这个音掌握。
 * 旧版是 3 级制里的「2 级」，换算后正好也是第 3 级。
 */
export const MASTERY_LEVEL = 3;
export const MASTERY_ACCURACY = 0.9;

export function getNoteProficiency(progress, noteKey) {
  return progress?.notes?.[noteKey]?.level || 1;
}

export function getPositionProficiency(progress, writtenMidi, stringNumber) {
  if (!Number.isFinite(writtenMidi) || !Number.isInteger(stringNumber)) return 1;
  return progress?.positions?.[`w${writtenMidi}@${stringNumber}`]?.level || 1;
}

/** 关卡「完成度」按不同谱面音高计算，同音异位只算一个音。 */
function uniquePitchKeys(pool) {
  return [...new Set(pool.map((note) => note.pitchKey))];
}

export function getLevelStatus(level, progress, settings) {
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
    completed,
    lastGroup,
    lastAccuracy: lastGroup ? lastGroup.accuracy : null,
    groupSize: Math.min(10, new Set(pool.map((note) => note.writtenMidi)).size),
  };
}

export function isLevelUnlocked(level, progress, settings) {
  const index = getLevelIndex(level.id);
  if (index <= 0) return true;
  if (settings.unlockAll) return true;
  const previous = LEVELS[index - 1];
  return Boolean(progress?.levels?.[previous.id]?.completedAt);
}

export function getNextUnlockRequirement(level, progress, settings) {
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
export function getOverallMastery(progress, settings) {
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
  };
}

/**
 * 找出练过但还不稳的音，用于「只练弱项」。
 * 排序：熟练度低的优先；同级时错误多的优先；再同级时更久没练的优先。
 *
 * @returns {Array<{pitchKey:string, writtenMidi:number, level:number,
 *   correct:number, wrong:number, accuracy:number, lastSeenAt:number, note:object}>}
 */
export function getWeakestPitches(progress, settings, limit = 12) {
  const pool = getLevelPool(
    LEVEL_BY_ID['full-chromatic'] || LEVELS[LEVELS.length - 1],
    settings.accidentalStyle,
  );
  const seen = new Map();
  for (const note of pool) {
    if (seen.has(note.pitchKey)) continue;
    const entry = progress?.notes?.[note.pitchKey];
    if (!entry || !entry.lastSeenAt) continue;
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
    .filter((item) => item.level < MASTERY_LEVEL || item.wrong > 0)
    .sort((a, b) => (
      a.level - b.level
      || b.wrong - a.wrong
      || a.accuracy - b.accuracy
      || a.lastSeenAt - b.lastSeenAt
    ))
    .slice(0, limit);
}

/** 首页 / 设置页展示用：练习过多少音、多少已掌握。 */
export function getPracticeSummary(progress, settings) {
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

export function groupLevels(levels = LEVELS) {
  return LEVEL_GROUPS.map((group) => ({
    ...group,
    levels: levels.filter((level) => level.group === group.id),
  })).filter((group) => group.levels.length > 0);
}
