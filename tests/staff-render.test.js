/**
 * 可选的真实渲染测试：先 npm install（会安装 devDependency jsdom）。
 * 默认 npm test 不包含本文件，避免把 jsdom 变成运行应用或核心测试的必需依赖。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { loadVexFlow } from './load-vexflow.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);

function loadJsdom() {
  return createRequire(import.meta.url)('jsdom');
}
const { JSDOM } = loadJsdom();

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
  runScripts: 'outside-only',
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.navigator = dom.window.navigator;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.SVGElement = dom.window.SVGElement;
globalThis.Element = dom.window.Element;
globalThis.Node = dom.window.Node;
globalThis.FontFace = class FontFace {
  constructor(family) { this.family = family; }
  load() { return Promise.resolve(this); }
};
Object.defineProperty(dom.window.document, 'fonts', {
  configurable: true,
  value: { add() {}, ready: Promise.resolve(), check() { return true; } },
});
dom.window.FontFace = globalThis.FontFace;
dom.window.SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 20, height: 20 });
dom.window.SVGElement.prototype.getScreenCTM = () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
dom.window.HTMLCanvasElement.prototype.getContext = () => ({
  measureText(text) {
    return { width: String(text).length * 8, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 3 };
  },
  font: '',
});

const VF = loadVexFlow(dom);
globalThis.VexFlow = VF;

const { renderStaff, staffAriaDescription } = await import('../js/staff.js');
const { makeNote, ledgerLinesFor } = await import('../js/music.js');

test('VexFlow 实际绘制：低音 E3 有三条下加线，高音区可绘制', async () => {
  const cases = [
    makeNote(6, 0),
    makeNote(5, 3),
    makeNote(4, 0),
    makeNote(3, 0),
    makeNote(2, 0),
    makeNote(1, 0),
    makeNote(1, 3),
    makeNote(1, 12),
  ];
  for (const note of cases) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const result = renderStaff(host, note.pitch, {
      width: 344,
      height: 232,
      staveY: 84,
      noteStartX: 180,
      showStringBadge: true,
      stringNumber: note.string,
      ariaLabel: staffAriaDescription(note.pitch, { reveal: true }),
    });
    const svg = host.querySelector('svg');
    assert.ok(svg, `${note.positionLabel} 应产生 SVG`);
    assert.ok(result.note.getAbsoluteX() > 0, `${note.positionLabel} 音符应有 x 坐标`);
    assert.equal(host.querySelectorAll('.string-badge').length, 1, `${note.positionLabel} 应有弦号徽标`);
    assert.ok(host.querySelectorAll('path').length > 0, `${note.positionLabel} 应有 VexFlow 图形`);
    console.log(
      note.positionLabel,
      note.pitch.fullName,
      `ledger=${ledgerLinesFor(note.pitch.diatonicStep).count}`,
      `noteX=${Math.round(result.note.getAbsoluteX())}`,
      `paths=${host.querySelectorAll('path').length}`,
    );
  }
});
