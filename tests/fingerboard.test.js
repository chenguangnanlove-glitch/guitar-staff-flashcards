import test from 'node:test';
import assert from 'node:assert/strict';

import { computeFingerboardGeometry } from '../js/fingerboard.js';

/** 4 品窗口（第一把位）：空弦 + 1–3 品。 */
const FIRST_POSITION = [0, 1, 2, 3];
/** 全指板：空弦 + 1–12 品。 */
const FULL_BOARD = Array.from({ length: 13 }, (_, i) => i);

test('六根弦在指板矩形内垂直居中，上下留白相等', () => {
  for (const frets of [FIRST_POSITION, FULL_BOARD, [1, 2, 3, 4]]) {
    const g = computeFingerboardGeometry(frets);
    const topGap = g.stringY(1) - g.boardTop;
    const bottomGap = g.boardBottom - g.stringY(6);
    assert.equal(topGap, bottomGap, `品位${frets.length > 4 ? '全指板' : '4品'}上下留白应相等`);
    assert.ok(topGap > 0, '弦不能贴到指板边缘');
  }
});

test('弦序从①到⑥自上而下，间距均匀', () => {
  const g = computeFingerboardGeometry(FIRST_POSITION);
  const ys = [1, 2, 3, 4, 5, 6].map((n) => g.stringY(n));
  for (let i = 1; i < ys.length; i += 1) {
    assert.ok(ys[i] > ys[i - 1], '①弦在最上、⑥弦在最下');
    assert.equal(ys[i] - ys[i - 1], ys[1] - ys[0], '弦间距一致');
  }
});

test('触控区足够大且互不重叠', () => {
  for (const frets of [FIRST_POSITION, FULL_BOARD]) {
    const g = computeFingerboardGeometry(frets);
    const { layout } = g;
    assert.ok(layout.stringGap >= 26, `触控高度 ${layout.stringGap}px 不应过小`);

    // 相邻弦的触控矩形正好相接，不重叠。
    for (let n = 1; n < 6; n += 1) {
      const upperBottom = g.stringY(n) + layout.stringGap / 2;
      const lowerTop = g.stringY(n + 1) - layout.stringGap / 2;
      assert.equal(upperBottom, lowerTop, '上下相邻弦的触控区不重叠');
    }
    // 每个触控矩形都落在指板矩形里。
    assert.ok(g.stringY(1) - layout.stringGap / 2 >= g.boardTop, '①弦触控区不越出上沿');
    assert.ok(g.stringY(6) + layout.stringGap / 2 <= g.boardBottom, '⑥弦触控区不越出下沿');
  }
});

test('品位数字条带在指板矩形上方，不压到弦', () => {
  const g = computeFingerboardGeometry(FIRST_POSITION);
  assert.ok(g.boardTop > 0, '指板上方要留出品号条带');
  assert.ok(g.boardTop <= g.stringY(1), '条带不与①弦重叠');
  assert.ok(g.height > g.boardBottom, '画布底部留有余量');
});

test('横向宽度随品位窗口增长，全指板可横向滚动', () => {
  const four = computeFingerboardGeometry(FIRST_POSITION);
  const full = computeFingerboardGeometry(FULL_BOARD);
  assert.ok(full.width > four.width, '品位越多越宽');
  // renderFingerboard 用 520 作为「需要横向滚动」的阈值。
  assert.ok(four.width < 520, '第一把位应能完整显示，不需要滚动');
  assert.ok(full.width > 520, '全指板应进入横向滚动模式');
});

test('没有空弦时不产生空弦区', () => {
  const g = computeFingerboardGeometry([1, 2, 3, 4]);
  assert.equal(g.hasOpen, false);
  assert.equal(g.nutX, g.boardLeft, '没有空弦区时弦枕贴着左边');
  assert.equal(g.stopped.length, 4);
});

test('几何结果不随入参顺序变化', () => {
  const a = computeFingerboardGeometry([3, 0, 1, 2]);
  const b = computeFingerboardGeometry([0, 1, 2, 3]);
  assert.deepEqual(a.sorted, b.sorted);
  assert.equal(a.width, b.width);
  assert.equal(a.height, b.height);
});
