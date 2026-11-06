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

export const STORAGE_KEYS = Object.freeze({
  settings: 'gsf:settings:v1',
  progress: 'gsf:progress:v1',
});

export const PROGRESS_VERSION = 2;
export const PROFICIENCY_MAX = 5;
export const PROFICIENCY_MIN = 1;

const DAY_MS = 24 * 60 * 60 * 1000;

/** 下标即熟练度：1 级当天再来，5 级隔 16 天。 */
export const REVIEW_INTERVAL_DAYS = Object.freeze([0, 0, 1, 3, 7, 16]);

export function reviewIntervalMs(level) {
  const days = REVIEW_INTERVAL_DAYS[Math.max(PROFICIENCY_MIN, Math.min(PROFICIENCY_MAX, level))] ?? 0;
  return days * DAY_MS;
}

export const SETTINGS_VERSION = 2;

export const DEFAULT_SETTINGS = Object.freeze({
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

export function isStorageAvailable() {
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

export function normalizeSettings(raw) {
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

export function loadSettings() {
  return normalizeSettings(readJSON(STORAGE_KEYS.settings, null));
}

export function saveSettings(settings) {
  return writeJSON(STORAGE_KEYS.settings, normalizeSettings(settings));
}

export function createProgress() {
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

export function normalizeProgress(raw) {
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

export function loadProgress() {
  return normalizeProgress(readJSON(STORAGE_KEYS.progress, null));
}

export function saveProgress(progress) {
  return writeJSON(STORAGE_KEYS.progress, progress);
}

export function ensureNote(progress, noteKey) {
  if (!progress.notes[noteKey]) {
    progress.notes[noteKey] = normalizeNoteEntry({ level: PROFICIENCY_MIN });
  }
  return progress.notes[noteKey];
}

export function ensurePosition(progress, positionKey) {
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
export function recordNoteAnswer(progress, noteKey, correct, at = Date.now()) {
  const note = ensureNote(progress, noteKey);
  return applyAnswer(note, correct, at);
}

/**
 * 记录一次指板位置作答。
 * 这是独立于音高的维度：同一个音在第 3 品和第 8 品算两次不同的练习。
 */
export function recordPositionAnswer(progress, positionKey, correct, at = Date.now()) {
  const position = ensurePosition(progress, positionKey);
  return applyAnswer(position, correct, at);
}

export function recordGroupResult(progress, {
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

export function resetProgress() {
  const fresh = createProgress();
  saveProgress(fresh);
  return fresh;
}

export function clearAllData() {
  try {
    backend().removeItem(STORAGE_KEYS.settings);
    backend().removeItem(STORAGE_KEYS.progress);
  } catch {
    // 忽略：清理失败时仍然继续刷新界面
  }
}

/** 导出为可读 JSON，包含设置与进度，便于换设备或备份。 */
export function exportSnapshot(settings, progress) {
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
export function parseSnapshot(raw) {
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

export function applySnapshot(snapshot) {
  saveProgress(snapshot.progress);
  if (snapshot.settings) saveSettings(snapshot.settings);
  return snapshot;
}
