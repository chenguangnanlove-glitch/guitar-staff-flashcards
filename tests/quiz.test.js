import test from 'node:test';
import assert from 'node:assert/strict';

import {
  QuizSession,
  buildPitchGroups,
  checkFingerboardAnswer,
  correctPositionsFor,
  createDeck,
  resolveStringHint,
} from '../js/quiz.js';
import { LEVEL_BY_ID, getLevelPool } from '../js/levels.js';
import { DEFAULT_SETTINGS, createProgress } from '../js/storage.js';
import { makeNote } from '../js/music.js';

function mulberry32(seed) {
  let value = seed;
  return function random() {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SETTINGS = { ...DEFAULT_SETTINGS };

test('一组内不重复出同一个音（同音异位也算重复）', () => {
  for (const id of ['p1-upper', 'p1-lower', 'p1-mixed', 'p2', 'full-natural', 'full-chromatic']) {
    const deck = createDeck(LEVEL_BY_ID[id], {
      settings: SETTINGS,
      progress: createProgress(),
      rng: mulberry32(42),
    });
    const pitches = deck.cards.map((card) => card.note.writtenMidi);
    assert.equal(new Set(pitches).size, deck.total, `${id} 组内音高不应重复`);
    assert.ok(deck.total <= 10);
  }
});

test('熟练度低的音获得更高抽样权重', () => {
  const level = LEVEL_BY_ID['p1-mixed'];
  const progress = createProgress();
  const now = Date.now();
  for (const note of getLevelPool(level)) {
    progress.notes[note.pitchKey] = {
      level: 3, correct: 3, wrong: 0, lastSeenAt: now, dueAt: now + 86400000,
    };
  }
  const target = getLevelPool(level)[0];
  progress.notes[target.pitchKey] = {
    level: 1, correct: 0, wrong: 2, lastSeenAt: now, dueAt: now,
  };
  const groups = buildPitchGroups(level, { settings: SETTINGS, progress, now });
  const targetGroup = groups.find((group) => group.notes[0].pitchKey === target.pitchKey);
  const other = groups.find((group) => group !== targetGroup);
  assert.equal(targetGroup.level, 1);
  assert.ok(targetGroup.weight > other.weight * 2, '低熟练度权重应明显更高');
  assert.equal(targetGroup.isDue, true);
  assert.equal(other.isDue, false);
});

test('到期和从未练过的音优先，未到期的只在不够时补充', () => {
  const level = LEVEL_BY_ID['p1-mixed'];
  const progress = createProgress();
  const now = Date.now();
  const pool = getLevelPool(level);
  const dueKeys = new Set();
  // 只有 3 个音过期，其余都是 3 天后再复习
  for (const [index, note] of pool.entries()) {
    const due = index < 3;
    if (due) dueKeys.add(note.pitchKey);
    progress.notes[note.pitchKey] = {
      level: 2,
      correct: 1,
      wrong: 0,
      lastSeenAt: now - 1000,
      dueAt: due ? now - 86400000 : now + 3 * 86400000,
    };
  }
  const deck = createDeck(level, { settings: SETTINGS, progress, rng: mulberry32(3), now });
  const picked = deck.cards.map((card) => card.pitchKey);
  for (const key of picked.slice(0, 3)) {
    // 到期组内部随机，但 3 个到期音必须都被选中
  }
  const pickedDue = picked.filter((key) => dueKeys.has(key));
  assert.equal(pickedDue.length, 3, '所有到期的音都应进入这一组');
  assert.equal(deck.total, 10);
});

test('同一张题最多重做 2 次，之后记入仍未掌握', () => {
  const session = new QuizSession(LEVEL_BY_ID['p1-upper'], {
    settings: SETTINGS,
    progress: createProgress(),
    rng: mulberry32(11),
  });
  const targetKey = session.current.pitchKey;
  const wrongPc = (session.current.note.pitch.pitchClass + 1) % 12;
  let targetAttempts = 0;
  let guard = 0;

  while (!session.groupComplete && guard < 60) {
    session.markShown();
    const card = session.current;
    if (card.pitchKey === targetKey) {
      targetAttempts += 1;
      session.answer(wrongPc);
    } else {
      session.answer(card.note.pitch.pitchClass);
    }
    guard += 1;
  }

  assert.equal(targetAttempts, 3, '第一次作答 + 两次重做后再放弃');
  const summary = session.summary();
  assert.equal(summary.gaveUp.length, 1);
  assert.equal(summary.gaveUp[0].key, targetKey);
  assert.equal(summary.retries, 2);
  assert.equal(summary.accuracy, 7 / 8, '放弃的题仍按第一次答错计入正确率');
});

test('答错后 3–5 题再出现，正确率按第一次作答计算', () => {
  const session = new QuizSession(LEVEL_BY_ID['p1-mixed'], {
    settings: SETTINGS,
    progress: createProgress(),
    rng: mulberry32(7),
  });
  const firstCard = session.current;
  assert.ok(firstCard);
  session.markShown();
  const wrongPc = (firstCard.note.pitch.pitchClass + 1) % 12;
  const outcome = session.answer(wrongPc);
  assert.equal(outcome.correct, false);
  assert.equal(outcome.retryScheduled, true);
  assert.ok(outcome.retryAfter >= 3 && outcome.retryAfter <= 5);

  const retryIndex = session.queue.findIndex((card) => card.id === firstCard.id);
  assert.ok(retryIndex >= 3 && retryIndex <= 5, `重做位置应在 3–5，实际 ${retryIndex}`);

  let guard = 0;
  while (!session.groupComplete && guard < 100) {
    session.markShown();
    const card = session.current;
    session.answer(card.note.pitch.pitchClass);
    guard += 1;
  }
  assert.equal(session.groupComplete, true);
  const summary = session.summary();
  assert.equal(summary.total, 10);
  assert.equal(summary.firstCorrect, 9);
  assert.equal(summary.accuracy, 0.9);
  assert.ok(summary.retries >= 1);
  assert.equal(summary.missed.length, 1);
  assert.equal(summary.missed[0].count, 1);
});

test('全部答对时正确率为 100%', () => {
  const session = new QuizSession(LEVEL_BY_ID['p1-upper'], {
    settings: SETTINGS,
    progress: createProgress(),
    rng: mulberry32(99),
  });
  let guard = 0;
  while (!session.groupComplete && guard < 100) {
    session.markShown();
    session.answer(session.current.note.pitch.pitchClass);
    guard += 1;
  }
  const summary = session.summary();
  assert.equal(summary.total, 8);
  assert.equal(summary.firstCorrect, 8);
  assert.equal(summary.accuracy, 1);
  assert.equal(summary.retries, 0);
});

test('不显示弦号时，同音异位都算对；显示弦号时只认该弦', () => {
  const level = LEVEL_BY_ID['full-chromatic'];
  const note = makeNote(6, 5, 'sharp'); // 谱上 A3，与 5 弦空弦同音
  const alternate = { string: 5, fret: 0 };

  const freeCard = { note, displayString: false };
  const strictCard = { note, displayString: true };

  assert.equal(correctPositionsFor(freeCard, level).length, 2);
  assert.equal(correctPositionsFor(strictCard, level).length, 1);
  assert.equal(checkFingerboardAnswer(freeCard, level, alternate), true);
  assert.equal(checkFingerboardAnswer(strictCard, level, alternate), false);
  assert.equal(checkFingerboardAnswer(strictCard, level, { string: 6, fret: 5 }), true);
});

test('弦号提示的自动/总是/从不规则', () => {
  assert.equal(resolveStringHint(0, 'always'), true);
  assert.equal(resolveStringHint(1, 'never'), false);
  assert.equal(resolveStringHint(1, 'auto'), true);
  assert.equal(resolveStringHint(0, 'auto'), false);
  assert.equal(resolveStringHint(0.5, 'auto', () => 0.1), true);
  assert.equal(resolveStringHint(0.5, 'auto', () => 0.9), false);
});
