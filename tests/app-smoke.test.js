/**
 * 可选的应用级冒烟测试：先 npm install（会安装 devDependency jsdom）。
 * 默认 npm test 不包含本文件；它用真实 DOM 点击走一遍首页→答题→结果→设置。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { loadVexFlow } from './load-vexflow.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);

function loadJsdom() {
  return createRequire(import.meta.url)('jsdom');
}
const { JSDOM } = loadJsdom();
const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');

const dom = new JSDOM(html, {
  url: 'http://localhost/index.html#/',
  pretendToBeVisual: true,
  runScripts: 'outside-only',
});
const { window } = dom;

globalThis.window = window;
globalThis.document = window.document;
globalThis.navigator = window.navigator;
globalThis.location = window.location;
globalThis.history = window.history;
globalThis.localStorage = window.localStorage;
globalThis.HTMLElement = window.HTMLElement;
globalThis.SVGElement = window.SVGElement;
globalThis.Element = window.Element;
globalThis.Node = window.Node;
globalThis.HTMLCanvasElement = window.HTMLCanvasElement;
globalThis.requestAnimationFrame = (callback) => window.setTimeout(() => callback(Date.now()), 0);
globalThis.cancelAnimationFrame = (id) => window.clearTimeout(id);
globalThis.FontFace = class FontFace {
  constructor(family) { this.family = family; }
  load() { return Promise.resolve(this); }
};
window.FontFace = globalThis.FontFace;
Object.defineProperty(window.document, 'fonts', {
  configurable: true,
  value: { add() {}, ready: Promise.resolve(), check() { return true; } },
});
window.SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 20, height: 20 });
window.SVGElement.prototype.getScreenCTM = () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
window.HTMLCanvasElement.prototype.getContext = () => ({
  measureText(text) {
    return {
      width: String(text).length * 8,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 3,
    };
  },
  font: '',
});
window.scrollTo = () => {};
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

const VF = loadVexFlow(dom);
globalThis.VexFlow = VF;

const sleep = (ms = 15) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

const appModule = await import('../js/app.js');
await sleep(120);

test('首页渲染出关卡、示例谱表与进度', () => {
  const view = document.querySelector('#view');
  assert.ok(view.querySelector('.hero'));
  assert.ok(view.querySelector('.level-card[data-level="p1-upper"]'));
  assert.ok(document.querySelector('#hero-staff svg'));
  assert.ok(document.querySelector('#app-bar').textContent.includes('吉他五线谱闪卡'));
  assert.equal(document.querySelector('#bottom-nav').hidden, false);
});

test('进入第一关，答题、重试并到达结果页', async () => {
  document.querySelector('.level-card[data-level="p1-upper"]').click();
  await sleep();
  assert.ok(document.querySelector('.quiz-screen'));
  assert.ok(document.querySelector('#quiz-staff svg'));
  assert.equal(document.querySelectorAll('.answer-btn').length, 7);

  let guard = 0;
  while (!document.querySelector('.result-screen') && guard < 400) {
    const feedback = document.querySelector('.feedback');
    if (feedback) {
      const next = document.querySelector('[data-action="next"]');
      assert.ok(next, '反馈区应有下一题按钮');
      next.click();
      await sleep(5);
      guard += 1;
      continue;
    }
    const buttons = [...document.querySelectorAll('.answer-btn')];
    if (buttons.length) {
      buttons[Math.floor(Math.random() * buttons.length)].click();
      await sleep(5);
      guard += 1;
      continue;
    }
    await sleep(5);
    guard += 1;
  }

  assert.ok(guard < 400, '答题循环应在合理次数内结束');
  assert.ok(document.querySelector('.result-screen'), '应到达结果页');
  assert.ok(document.querySelector('.result-ring'));
  assert.ok(document.querySelector('.stats-grid'));
  assert.ok(localStorage.getItem('gsf:progress:v1'));
});

test('设置页可切换模式、主色与手动解锁', async () => {
  document.querySelector('#app-bar [data-action="back"]').click();
  await sleep();
  document.querySelector('#bottom-nav [data-route="#/settings"]').click();
  await sleep();
  assert.ok(document.querySelector('.settings-screen'));

  const fretboardOption = document.querySelector('[data-key="answerMode"][data-value="fretboard"]');
  fretboardOption.click();
  await sleep();
  const settings = JSON.parse(localStorage.getItem('gsf:settings:v1'));
  assert.equal(settings.answerMode, 'fretboard');

  document.querySelector('[data-action="toggle-unlock"]').click();
  await sleep();
  assert.equal(JSON.parse(localStorage.getItem('gsf:settings:v1')).unlockAll, true);

  const color = document.querySelector('#custom-color');
  color.value = '#4b5fa8';
  color.dispatchEvent(new window.Event('input', { bubbles: true }));
  await sleep();
  assert.equal(JSON.parse(localStorage.getItem('gsf:settings:v1')).primaryColor, '#4b5fa8');
});

test('指板模式渲染 6 弦 4 品，并可作答', async () => {
  document.querySelector('#bottom-nav [data-route="#/"]').click();
  await sleep();
  document.querySelector('.level-card[data-level="p1-upper"]').click();
  await sleep();
  assert.ok(document.querySelector('.fingerboard-card'));
  const hits = document.querySelectorAll('.fb-hit');
  assert.equal(hits.length, 24);
  hits[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep();
  assert.ok(document.querySelector('.feedback'));
  assert.ok(document.querySelector('.fb-target-ring'));
});

test('升降号关卡：降号按钮与始终显示弦号', async () => {
  document.querySelector('#app-bar [data-action="back"]').click();
  await sleep();
  document.querySelector('[data-dialog-confirm]').click();
  await sleep();
  document.querySelector('#bottom-nav [data-route="#/settings"]').click();
  await sleep();
  document.querySelector('[data-key="accidentalStyle"][data-value="flat"]').click();
  await sleep();
  document.querySelector('[data-key="stringHint"][data-value="always"]').click();
  await sleep();
  document.querySelector('[data-key="answerMode"][data-value="name"]').click();
  await sleep();
  document.querySelector('#bottom-nav [data-route="#/"]').click();
  await sleep();
  document.querySelector('.level-card[data-level="p1-chromatic"]').click();
  await sleep();
  assert.ok(document.querySelector('.quiz-screen'));
  assert.equal(document.querySelectorAll('.answer-btn').length, 12);
  const labels = [...document.querySelectorAll('.answer-btn')].map((button) => button.textContent);
  assert.ok(labels.includes('D♭'), `按钮应包含降号，实际：${labels.join(',')}`);
  assert.equal(document.querySelectorAll('.string-badge').length, 1);
  document.querySelector('.answer-btn').click();
  await sleep();
  assert.ok(document.querySelector('.feedback'));
});

test('全指板指板题：0–12 品、78 个位置与横向滚动', async () => {
  document.querySelector('#app-bar [data-action="back"]').click();
  await sleep();
  document.querySelector('[data-dialog-confirm]').click();
  await sleep();
  document.querySelector('#bottom-nav [data-route="#/settings"]').click();
  await sleep();
  document.querySelector('[data-key="answerMode"][data-value="fretboard"]').click();
  await sleep();
  document.querySelector('#bottom-nav [data-route="#/"]').click();
  await sleep();
  document.querySelector('.level-card[data-level="full-chromatic"]').click();
  await sleep();
  assert.ok(document.querySelector('.quiz-screen'));
  assert.ok(document.querySelector('.fingerboard-card'));
  assert.equal(document.querySelectorAll('.fb-hit').length, 78);
  assert.ok(document.querySelector('.fingerboard-svg--wide'));
  const hit = document.querySelector('.fb-hit[data-string="6"][data-fret="5"]');
  assert.ok(hit);
  hit.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep();
  assert.ok(document.querySelector('.feedback'));
  assert.ok(document.querySelector('.fb-target-ring'));
});

test('连续全对把熟练度练到 3 级后解锁下一关', async () => {
  // 复位到干净状态：关闭手动解锁，答音名，升号，自动弦号
  document.querySelector('#app-bar [data-action="back"]').click();
  await sleep();
  document.querySelector('[data-dialog-confirm]').click();
  await sleep();
  document.querySelector('#bottom-nav [data-route="#/settings"]').click();
  await sleep();
  if (document.querySelector('[data-action="toggle-unlock"]').getAttribute('aria-checked') === 'true') {
    document.querySelector('[data-action="toggle-unlock"]').click();
    await sleep();
  }
  document.querySelector('[data-key="answerMode"][data-value="name"]').click();
  await sleep();
  document.querySelector('[data-key="accidentalStyle"][data-value="sharp"]').click();
  await sleep();
  document.querySelector('[data-key="stringHint"][data-value="auto"]').click();
  await sleep();
  document.querySelector('[data-action="reset-progress"]').click();
  await sleep();
  document.querySelector('[data-dialog-confirm]').click();
  await sleep();
  document.querySelector('#bottom-nav [data-route="#/"]').click();
  await sleep();

  assert.ok(
    document.querySelector('.level-card[data-level="p1-lower"]').classList.contains('is-locked'),
    '重置后第二关应处于锁定状态',
  );

  // 5 级制里 3 级才算掌握，所以要做多组全对；最多 4 组。
  let rounds = 0;
  let unlocked = false;
  while (rounds < 4 && !unlocked) {
    document.querySelector('.level-card[data-level="p1-upper"]').click();
    await sleep();

    let guard = 0;
    while (!document.querySelector('.result-screen') && guard < 40) {
      const card = appModule.state.session?.current;
      if (!card) break;
      const button = document.querySelector(`.answer-btn[data-value="${card.note.pitch.pitchClass}"]`);
      assert.ok(button, '应能找到正确音名按钮');
      button.click();
      await sleep(5);
      document.querySelector('[data-action="next"]').click();
      await sleep(5);
      guard += 1;
    }

    assert.ok(document.querySelector('.result-screen'), '应到达结果页');
    assert.equal(document.querySelector('.result-ring__value').textContent, '100%');
    unlocked = Boolean(document.querySelector('.unlock-banner'));
    document.querySelector('[data-action="navigate"][data-route="#/"]').click();
    await sleep();
    rounds += 1;
  }

  assert.ok(rounds >= 2, '从 1 级到 3 级至少需要两组');
  assert.ok(unlocked, '全部到 3 级且正确率 100% 后应解锁');
  assert.equal(
    document.querySelector('.level-card[data-level="p1-lower"]').classList.contains('is-locked'),
    false,
  );
});
