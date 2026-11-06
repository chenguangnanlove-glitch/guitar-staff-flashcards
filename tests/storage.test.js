import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PROFICIENCY_MAX,
  exportSnapshot,
  normalizeProgress,
  parseSnapshot,
  recordNoteAnswer,
  recordPositionAnswer,
  reviewIntervalMs,
} from '../js/storage.js';

const DAY = 24 * 60 * 60 * 1000;

test('熟练度 5 级：答对升级，答错降一级而不是归零', () => {
  const progress = normalizeProgress(null);
  const key = 'w64';
  const at = 1_700_000_000_000;

  // 从 1 级连对 4 次到 5 级
  for (let i = 0; i < 4; i += 1) recordNoteAnswer(progress, key, true, at + i);
  assert.equal(progress.notes[key].level, PROFICIENCY_MAX);

  recordNoteAnswer(progress, key, true, at + 10);
  assert.equal(progress.notes[key].level, 5, '最高只到 5 级');

  recordNoteAnswer(progress, key, false, at + 20);
  assert.equal(progress.notes[key].level, 4, '答错降一级');

  recordNoteAnswer(progress, key, false, at + 30);
  assert.equal(progress.notes[key].level, 3);

  // 降到 1 级后不再往下掉
  recordNoteAnswer(progress, key, false, at + 40);
  recordNoteAnswer(progress, key, false, at + 50);
  recordNoteAnswer(progress, key, false, at + 60);
  assert.equal(progress.notes[key].level, 1);
  assert.ok(progress.notes[key].wrong >= 4);
});

test('dueAt：答对按级别延后，答错立即到期', () => {
  const progress = normalizeProgress(null);
  const key = 'w60';
  const at = 1_700_000_000_000;

  recordNoteAnswer(progress, key, true, at); // 1 → 2
  assert.equal(progress.notes[key].level, 2);
  assert.equal(progress.notes[key].dueAt, at + reviewIntervalMs(2));

  recordNoteAnswer(progress, key, true, at + 1); // 2 → 3
  assert.equal(progress.notes[key].level, 3);
  assert.equal(progress.notes[key].dueAt, at + 1 + 3 * DAY);

  recordNoteAnswer(progress, key, false, at + 2);
  assert.equal(progress.notes[key].level, 2);
  assert.equal(progress.notes[key].dueAt, at + 2, '答错后立刻到期');
});

test('间隔是递增的：1 级当天、5 级 16 天', () => {
  assert.equal(reviewIntervalMs(1), 0);
  assert.equal(reviewIntervalMs(2), 1 * DAY);
  assert.equal(reviewIntervalMs(3), 3 * DAY);
  assert.equal(reviewIntervalMs(4), 7 * DAY);
  assert.equal(reviewIntervalMs(5), 16 * DAY);
});

test('指板位置是独立维度：同音异位分开记录', () => {
  const progress = normalizeProgress(null);
  const at = 1_700_000_000_000;
  // 谱上 A3 在 ⑤弦空弦与 ⑥弦 5 品
  const string5 = 'w57@5';
  const string6 = 'w57@6';

  recordPositionAnswer(progress, string5, true, at);
  recordPositionAnswer(progress, string5, true, at + 1);
  recordPositionAnswer(progress, string6, false, at + 2);

  assert.equal(progress.positions[string5].level, 3);
  assert.equal(progress.positions[string6].level, 1);
  assert.equal(progress.notes.w57, undefined, '位置练习不应写进音高记录');
});

test('v1 数据迁移：3 级制原样保留，并按最后练习时间推算 dueAt', () => {
  const lastSeenAt = 1_700_000_000_000;
  const legacy = {
    version: 1,
    notes: {
      w64: { level: 3, correct: 5, wrong: 1, firstSeenAt: lastSeenAt - DAY, lastSeenAt },
      w60: { level: 1, correct: 0, wrong: 2, lastSeenAt },
      s3f0: { level: 2, correct: 1, wrong: 0 }, // 旧版错误的键格式，应被丢弃
    },
    levels: { 'p1-upper': { completedAt: lastSeenAt, groupsPlayed: 3, lastGroup: null } },
    totals: { groups: 3, questions: 30, correct: 27, retries: 2 },
  };
  const progress = normalizeProgress(legacy);

  assert.equal(progress.version, 2);
  assert.equal(progress.notes.w64.level, 3);
  assert.equal(progress.notes.w64.correct, 5);
  assert.equal(progress.notes.w64.dueAt, lastSeenAt + 3 * DAY, '3 级对应 3 天间隔');
  assert.equal(progress.notes.w60.dueAt, lastSeenAt, '1 级答错后立即到期');
  assert.equal(progress.notes.s3f0, undefined);
  assert.deepEqual(progress.positions, {});
  assert.equal(progress.levels['p1-upper'].completedAt, lastSeenAt);
  assert.equal(progress.totals.groups, 3);
});

test('v1 里从未练过的音立刻到期，不会被推迟', () => {
  const progress = normalizeProgress({
    version: 1,
    notes: { w64: { level: 3, correct: 2, wrong: 0 } },
  });
  assert.equal(progress.notes.w64.dueAt, 0);
});

test('导出快照可往返导入', () => {
  const progress = normalizeProgress(null);
  const at = 1_700_000_000_000;
  recordNoteAnswer(progress, 'w64', true, at);
  recordPositionAnswer(progress, 'w64@1', true, at);

  const settings = {
    answerMode: 'fretboard',
    display: 'solfege',
    accidentalStyle: 'flat',
    stringHint: 'always',
    primaryColor: '#4b5fa8',
    unlockAll: true,
  };
  const snapshot = exportSnapshot(settings, progress);
  assert.equal(snapshot.format, 'gsf-backup');
  assert.equal(snapshot.settings.answerMode, 'fretboard');

  const roundTrip = parseSnapshot(JSON.stringify(snapshot));
  assert.equal(roundTrip.progress.notes.w64.level, 2);
  assert.equal(roundTrip.progress.positions['w64@1'].level, 2);
  assert.equal(roundTrip.progress.notes.w64.dueAt, at + DAY);
  assert.equal(roundTrip.settings.accidentalStyle, 'flat');
});

test('导入会拒绝非本应用的或损坏的文件', () => {
  assert.throws(() => parseSnapshot('not json'), /JSON/);
  assert.throws(() => parseSnapshot('{"format":"other"}'), /不是/);
  assert.throws(() => parseSnapshot({ format: 'gsf-backup' }), /缺少学习进度/);
  assert.throws(() => parseSnapshot(null), /空|格式/);
});

test('导入时规范化越界和不认识的字段', () => {
  const snapshot = parseSnapshot({
    format: 'gsf-backup',
    progress: {
      notes: {
        w64: { level: 99, correct: -3, wrong: 'x' },
        bogus: { level: 2 },
      },
      positions: { 'w64@1': { level: 0 }, 'w64@9': { level: 2 } },
    },
  });
  assert.equal(snapshot.progress.notes.w64.level, 5);
  assert.equal(snapshot.progress.notes.w64.correct, 0);
  assert.equal(snapshot.progress.notes.w64.wrong, 0);
  assert.equal(snapshot.progress.notes.bogus, undefined);
  assert.equal(snapshot.progress.positions['w64@1'].level, 1);
  assert.equal(snapshot.progress.positions['w64@9'], undefined);
});
