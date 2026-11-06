/**
 * 生产域名下的文案与状态测试（jsdom）。
 *
 * 与 app-smoke 不同，这里把 location 设为 https://xxx.pages.dev/：
 * - 线上域名不应出现任何局域网/手机访问提示；
 * - 没有 Service Worker 时必须写「需联网访问」，不能承诺离线；
 * - 默认答题模式是唱名。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { loadVexFlow } from './load-vexflow.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const { JSDOM } = createRequire(import.meta.url)('jsdom');
const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');

const dom = new JSDOM(html, {
  url: 'https://guitar-flashcards-demo.pages.dev/index.html#/',
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

globalThis.VexFlow = loadVexFlow(dom);

const sleep = (ms = 20) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

await import('../js/app.js');
await sleep(150);

test('生产域名：首页副标题用「唱名」，不再承诺听音', () => {
  const subtitle = document.querySelector('.app-bar__subtitle').textContent;
  assert.equal(subtitle, '读谱 · 唱名 · 找位置');
  assert.ok(!document.querySelector('#view').textContent.includes('听音'));
});

test('生产域名：无记录时主按钮是「开始」', () => {
  const start = document.querySelector('.hero [data-action="start-level"]');
  assert.ok(start);
  assert.match(start.textContent, /开始/);
  assert.ok(!start.textContent.includes('继续'));
});

test('生产域名：设置页隐藏所有局域网手机访问文案', async () => {
  document.querySelector('#bottom-nav [data-route="#/settings"]').click();
  await sleep();

  const view = document.querySelector('#view');
  assert.ok(view.querySelector('.settings-screen'));
  const text = view.textContent;
  assert.ok(!text.includes('在手机上打开'), '出现「在手机上打开」');
  assert.ok(!text.includes('局域网'), '出现局域网文案');
  assert.ok(!text.includes('同一个 Wi-Fi'), '出现同一 Wi-Fi 文案');
  assert.ok(!text.includes('192.168'), '出现局域网 IP');
});

test('生产域名：默认答题模式是唱名', () => {
  const selected = document.querySelector('[data-key="answerMode"].is-selected');
  assert.ok(selected);
  assert.equal(selected.dataset.value, 'solfege');
  assert.match(selected.textContent, /唱名/);
});

test('生产域名：没有 Service Worker 时关于页写「需联网访问」', () => {
  const about = [...document.querySelectorAll('.settings-section')]
    .find((section) => section.querySelector('.settings-section__title')?.textContent === '关于');
  assert.ok(about, '找不到关于区块');

  const chip = about.querySelector('.chip');
  assert.match(chip.textContent, /需联网访问/);
  assert.ok(!chip.textContent.includes('离线可用'));

  const text = about.textContent;
  assert.match(text, /当前需联网访问/);
  assert.ok(!text.includes('应用已缓存到本机'));
});
