/**
 * app.js — 页面路由、四个页面、设置、答题交互与 PWA 启动。
 */

import {
  CIRCLED_NUMBERS,
  STRINGS,
  describeDiatonicStep,
  formatDuration,
  makeNote,
  pitchClassChoices,
  spellPitch,
} from './music.js';
import {
  LEVELS,
  LEVEL_BY_ID,
  MASTERY_LEVEL,
  getLevel,
  getLevelPool,
  getLevelStatus,
  getNextLevel,
  getNextUnlockRequirement,
  getOverallMastery,
  getPracticeSummary,
  getWeakestPitches,
  isLevelUnlocked,
  groupLevels,
} from './levels.js';
import {
  DEFAULT_SETTINGS,
  applySnapshot,
  clearAllData,
  createProgress,
  exportSnapshot,
  isStorageAvailable,
  loadProgress,
  loadSettings,
  normalizeSettings,
  parseSnapshot,
  recordGroupResult,
  recordNoteAnswer,
  recordPositionAnswer,
  resetProgress,
  saveProgress,
  saveSettings,
} from './storage.js';
import { QuizSession } from './quiz.js';
import { ensureStaffFonts, renderStaff, staffAriaDescription } from './staff.js';
import { renderFingerboard } from './fingerboard.js';
import { playNote } from './audio.js';
import { COLOR_PRESETS, applyTheme } from './theme.js';
import {
  applyServiceWorkerUpdate,
  getLanUrl,
  isOfflineReady,
  isStandalone,
  promptInstall,
  registerServiceWorker,
  setupInstallPrompt,
} from './pwa.js';

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
  arrowRight: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.5 12h14M13 6.5l5.5 5.5L13 17.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const APP_VERSION = '1.2.0';

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
  const focusSummary = practice.practiced
    ? `练过 ${practice.practiced} 个音，${practice.mastered} 个已达标`
    : '';
  const weakPreview = weak.slice(0, 3).map((item) => item.note.pitch.name).join('、');
  const focusCard = weak.length >= 3
    ? `<button class="focus-card" data-action="start-focus">
        <span class="focus-card__icon" aria-hidden="true">${icon('target')}</span>
        <span class="focus-card__main">
          <span class="focus-card__title">弱项练习 · ${weak.length} 个音</span>
          <span class="focus-card__desc">${esc(weakPreview)} 等还没达标 · ${esc(focusSummary)}</span>
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
          <div class="progress-ring" style="${progressRingStyle(practice.practiced ? overall.avgPercent : 0)}" aria-hidden="true">
            <span class="progress-ring__text">${practice.practiced ? `${overall.avgPercent}%` : '—'}</span>
          </div>
          <div class="hero__stats-text">
            <div class="hero__stats-title">${practice.practiced ? `平均熟练度 ${overall.avgLevel} / 5` : '还没有练习记录'}</div>
            <div class="hero__stats-sub">${overall.mastered} / ${overall.total} 个音达标</div>
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
          <p class="section-subtitle">完成度按音高熟练度计算</p>
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
          ? `<span class="progress-ring" style="${progressRingStyle(status.percent)}"><span class="progress-ring__text">${status.percent}%</span></span>
             <span class="level-side__label">${status.mastered}/${status.total}</span>`
          : `<span class="level-lock">${icon('lock')}</span><span class="level-side__label">未解锁</span>`}
      </span>
    </button>`;
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
          <span>本关熟练度：平均 ${statusAfter.avgLevel} / 5，${mastered} / ${total} 个音达标</span>
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
    action.addEventListener('click', () => {
      snackbar.classList.remove('is-visible');
      onAction();
    });
    snackbar.appendChild(action);
  }
  snackbar.classList.add('is-visible');
  state.snackbarTimer = setTimeout(() => {
    snackbar.classList.remove('is-visible');
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
async function copyText(text) {
  if (!text) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      showSnackbar('地址已复制，发到手机上打开。');
      return;
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
  showSnackbar(copied ? '地址已复制，发到手机上打开。' : `请手动输记：${text}`);
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
export { state };
