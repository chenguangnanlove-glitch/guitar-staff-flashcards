import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LEVELS,
  LEVEL_BY_ID,
  getGroupSize,
  getLevelPool,
  getLevelStatus,
  getOverallMastery,
  getWeakestPitches,
  isLevelUnlocked,
  isWeakEntry,
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

/** 模拟「第一组 8 个音全部答对一次」：每个音 1 → 2 级。 */
function afterFirstRound() {
  const progress = createProgress();
  const level = LEVEL_BY_ID['p1-upper'];
  const keys = [...new Set(getLevelPool(level, 'sharp').map((note) => note.pitchKey))];
  for (const key of keys) {
    progress.notes[key] = { level: 2, correct: 1, wrong: 0, lastSeenAt: 1, dueAt: 1 };
  }
  return { progress, level, keys };
}

test('掌握进度：关卡卡片、结果页、首页同一口径，没练过的音计 0', () => {
  const { progress, level, keys } = afterFirstRound();
  const status = getLevelStatus(level, progress, SETTINGS);
  assert.equal(keys.length, 8);
  // 每个音走了达标线（3 级）的一半。
  assert.equal(status.progressPercent, 50);
  assert.equal(status.practiced, 8);
  assert.equal(status.mastered, 0);

  const overall = getOverallMastery(progress, SETTINGS);
  assert.equal(overall.practiced, 8);
  // 8 个音各一半 / 全指板 37 个音 = 4/37 ≈ 11%。
  assert.equal(overall.progressPercent, Math.round((4 / 37) * 100));

  assert.equal(getLevelStatus(level, createProgress(), SETTINGS).progressPercent, 0);
  assert.equal(getOverallMastery(createProgress(), SETTINGS).progressPercent, 0);

  // 超过达标线不再加分：全部 5 级时正好 100%。
  for (const key of keys) progress.notes[key].level = 5;
  assert.equal(getLevelStatus(level, progress, SETTINGS).progressPercent, 100);
});

test('弱项：刚练完第一组、一次没错的音不算弱项', () => {
  const { progress } = afterFirstRound();
  assert.equal(getWeakestPitches(progress, SETTINGS).length, 0);
});

test('弱项：答错过的音、练很多次仍没达标的音才算', () => {
  assert.equal(isWeakEntry({ level: 1, correct: 0, wrong: 1, lastSeenAt: 1 }), false, '只答过一次不判');
  assert.equal(isWeakEntry({ level: 1, correct: 1, wrong: 1, lastSeenAt: 1 }), true);
  assert.equal(isWeakEntry({ level: 2, correct: 4, wrong: 0, lastSeenAt: 1 }), true, '练了 4 次还没达标');
  assert.equal(isWeakEntry({ level: 3, correct: 2, wrong: 0, lastSeenAt: 1 }), false);
  assert.equal(isWeakEntry({ level: 3, correct: 3, wrong: 2, lastSeenAt: 1 }), true, '达标但正确率 60%');
  assert.equal(isWeakEntry({ level: 4, correct: 9, wrong: 1, lastSeenAt: 1 }), false);
});
