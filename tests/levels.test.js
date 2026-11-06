import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LEVELS,
  LEVEL_BY_ID,
  getGroupSize,
  getLevelPool,
  getLevelStatus,
  getOverallMastery,
  isLevelUnlocked,
} from '../js/levels.js';
import { DEFAULT_SETTINGS, createProgress } from '../js/storage.js';

const SETTINGS = { ...DEFAULT_SETTINGS };

test('关卡配置完整且 ID 唯一', () => {
  assert.equal(LEVELS.length, 11);
  assert.equal(new Set(LEVELS.map((level) => level.id)).size, LEVELS.length);
  assert.deepEqual(
    LEVELS.map((level) => level.order),
    Array.from({ length: 11 }, (_, index) => index + 1),
  );
});

test('关卡位置池与唯一音高数量', () => {
  const expected = {
    'p1-upper': [8, 8],
    'p1-lower': [9, 9],
    'p1-mixed': [17, 17],
    'p1-chromatic': [24, 24],
    p2: [24, 24],
    p3: [24, 24],
    p4: [24, 24],
    p5: [24, 24],
    'full-natural': [48, 22],
    'full-chromatic': [78, 37],
    mixed: [78, 37],
  };
  for (const [id, [positions, pitches]] of Object.entries(expected)) {
    const pool = getLevelPool(LEVEL_BY_ID[id], 'sharp');
    assert.equal(pool.length, positions, `${id} 位置数`);
    assert.equal(new Set(pool.map((note) => note.writtenMidi)).size, pitches, `${id} 唯一音高数`);
  }
});

test('每组题数：小关卡按可用音数缩小，大关卡为 10', () => {
  assert.equal(getGroupSize(LEVEL_BY_ID['p1-upper']), 8);
  assert.equal(getGroupSize(LEVEL_BY_ID['p1-lower']), 9);
  assert.equal(getGroupSize(LEVEL_BY_ID['p1-mixed']), 10);
  assert.equal(getGroupSize(LEVEL_BY_ID['full-chromatic']), 10);
});

test('自然音关卡只包含自然音', () => {
  for (const id of ['p1-upper', 'p1-lower', 'p1-mixed', 'full-natural']) {
    const pool = getLevelPool(LEVEL_BY_ID[id], 'sharp');
    assert.ok(pool.every((note) => note.pitch.isNatural), `${id} 应只含自然音`);
  }
});

test('完成度按唯一音高计算，同音异位只算一次', () => {
  const progress = createProgress();
  // 谱上 A3 在 5 弦空弦和 6 弦 5 品各出现一次；只应计为一个音。
  progress.notes.w57 = { level: 3, correct: 2, wrong: 0 };
  const status = getLevelStatus(LEVEL_BY_ID['full-natural'], progress, SETTINGS);
  assert.equal(status.total, 22);
  assert.equal(status.mastered, 1);
  assert.equal(status.percent, 5);
});

test('5 级制里达到第 3 级才算掌握', () => {
  const progress = createProgress();
  const level = LEVEL_BY_ID['p1-upper'];
  // 逐个把 8 个音设成 2 级：仍未掌握
  for (const key of new Set(getLevelPool(level, 'sharp').map((n) => n.pitchKey))) {
    progress.notes[key] = { level: 2, correct: 1, wrong: 0 };
  }
  assert.equal(getLevelStatus(level, progress, SETTINGS).mastered, 0);
  // 提到 3 级：全部掌握
  for (const key of Object.keys(progress.notes)) {
    progress.notes[key].level = 3;
  }
  assert.equal(getLevelStatus(level, progress, SETTINGS).mastered, 8);
});

test('解锁链与手动解锁', () => {
  const progress = createProgress();
  assert.equal(isLevelUnlocked(LEVEL_BY_ID['p1-upper'], progress, SETTINGS), true);
  assert.equal(isLevelUnlocked(LEVEL_BY_ID['p1-lower'], progress, SETTINGS), false);
  progress.levels['p1-upper'] = { completedAt: Date.now(), groupsPlayed: 1, lastGroup: null };
  assert.equal(isLevelUnlocked(LEVEL_BY_ID['p1-lower'], progress, SETTINGS), true);
  assert.equal(isLevelUnlocked(LEVEL_BY_ID.mixed, progress, { ...SETTINGS, unlockAll: true }), true);
});

test('总进度分母为全指板唯一自然音/变化音音高', () => {
  const progress = createProgress();
  assert.equal(getOverallMastery(progress, SETTINGS).total, 37);
  progress.notes.w60 = { level: 4, correct: 3, wrong: 0 };
  const overall = getOverallMastery(progress, SETTINGS);
  assert.equal(overall.mastered, 1);
  assert.equal(overall.percent, 3);
});
