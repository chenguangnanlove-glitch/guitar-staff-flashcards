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

import { getLevelPool, getNoteProficiency, getPositionProficiency } from './levels.js';
import { positionsForWrittenMidi } from './music.js';

export const GROUP_TARGET_SIZE = 10;
export const MAX_CARD_RETRIES = 2;

/** 5 级熟练度的抽样权重：1 级最常出现，5 级仍保留少量复习。 */
export const PROFICIENCY_WEIGHTS = Object.freeze({ 1: 8, 2: 5, 3: 3, 4: 2, 5: 1 });

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

export function resolveStringHint(levelHint, setting, rng = Math.random) {
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
export function buildPitchGroups(level, { settings, progress, now = Date.now(), pool = null }) {
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

export function createDeck(level, {
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
export function correctPositionsFor(card, level) {
  let positions = positionsForWrittenMidi(card.note.writtenMidi, {
    strings: level.strings,
    frets: level.frets,
  });
  if (card.displayString) {
    positions = positions.filter((position) => position.string === card.note.string);
  }
  return positions;
}

export function checkFingerboardAnswer(card, level, selection) {
  if (!selection || !Number.isInteger(selection.string) || !Number.isInteger(selection.fret)) {
    return false;
  }
  return correctPositionsFor(card, level).some(
    (position) => position.string === selection.string && position.fret === selection.fret,
  );
}

export class QuizSession {
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
