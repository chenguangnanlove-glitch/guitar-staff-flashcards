/**
 * fingerboard.js — 自己实现的 SVG 指板，不依赖任何图形库。
 * 6 根弦横向排列，1 弦在上、6 弦在下；支持任意品位窗口与答题点击。
 */

import { CIRCLED_NUMBERS, STRINGS, positionKey } from './music.js';

const FB_SVG_NS = 'http://www.w3.org/2000/svg';

const DEFAULT_LAYOUT = Object.freeze({
  cellWidth: 52,
  stringGap: 27,
  leftPad: 34,
  rightPad: 16,
  topPad: 30,
  bottomPad: 18,
  openWidth: 44,
  dotRadius: 4.5,
  ringRadius: 11,
});

function svgEl(tag, attrs = {}) {
  const element = document.createElementNS(FB_SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null) element.setAttribute(key, String(value));
  }
  return element;
}

function textEl(text, attrs = {}) {
  const element = svgEl('text', attrs);
  element.textContent = text;
  return element;
}

/**
 * 计算指板几何：返回每个品位的中心点与边界。
 */
export function computeFingerboardGeometry(frets, layout = DEFAULT_LAYOUT) {
  const sorted = [...frets].sort((a, b) => a - b);
  const hasOpen = sorted.includes(0);
  const stopped = sorted.filter((fret) => fret > 0);
  const nutX = layout.leftPad + (hasOpen ? layout.openWidth : 0);
  const width = nutX + stopped.length * layout.cellWidth + layout.rightPad;
  const height = layout.topPad + 6 * layout.stringGap + layout.bottomPad;
  const stringY = (stringNumber) => layout.topPad + (stringNumber - 1) * layout.stringGap;
  const cellCenterX = (fret) => {
    if (fret === 0) return layout.leftPad + layout.openWidth / 2;
    const index = stopped.indexOf(fret);
    return nutX + (index + 0.5) * layout.cellWidth;
  };
  return {
    sorted,
    hasOpen,
    stopped,
    nutX,
    width,
    height,
    stringY,
    cellCenterX,
    boardLeft: layout.leftPad,
    boardRight: nutX + stopped.length * layout.cellWidth,
    layout,
  };
}

/**
 * 渲染指板。返回 { svg, geometry, setDisabled }。
 *
 * @param {HTMLElement} container
 * @param {object} options
 *   frets: number[]           要显示的品位（含 0 才显示空弦区）
 *   strings: number[]         要显示的弦（默认 1–6）
 *   onSelect({string,fret})   点击回调
 *   disabled: boolean
 *   targetPositions: [{string,fret}]  答后绿色高亮
 *   wrongPosition: {string,fret}|null 答错时红色高亮
 *   hintString: number|null   指定弦号（高亮该弦，不泄露品位）
 *   ariaLabel
 */
export function renderFingerboard(container, options = {}) {
  const {
    frets = [0, 1, 2, 3],
    strings = STRINGS,
    onSelect = null,
    disabled = false,
    targetPositions = [],
    wrongPosition = null,
    hintString = null,
    revealPosition = null,
    ariaLabel = '吉他指板',
    showFretLabels = true,
  } = options;

  const layout = DEFAULT_LAYOUT;
  const geometry = computeFingerboardGeometry(frets, layout);
  const { width, height, nutX, boardLeft, boardRight, sorted, stopped, hasOpen, stringY, cellCenterX } = geometry;

  container.innerHTML = '';
  const scroll = document.createElement('div');
  scroll.className = 'fb-scroll';
  if (width > 520) scroll.classList.add('fb-scroll--wide');
  container.appendChild(scroll);

  const svg = svgEl('svg', {
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
    class: `fingerboard-svg${disabled ? ' is-disabled' : ''}`,
    role: 'group',
    'aria-label': ariaLabel,
  });
  if (width > 520) svg.classList.add('fingerboard-svg--wide');
  scroll.appendChild(svg);

  const defs = svgEl('defs');
  const gradient = svgEl('linearGradient', {
    id: `fb-wood-${Math.random().toString(36).slice(2)}`,
    x1: '0', y1: '0', x2: '0', y2: '1',
  });
  gradient.appendChild(svgEl('stop', { offset: '0%', 'stop-color': '#fbf8f1' }));
  gradient.appendChild(svgEl('stop', { offset: '100%', 'stop-color': '#f0eadf' }));
  defs.appendChild(gradient);
  svg.appendChild(defs);

  // 指板底色
  svg.appendChild(svgEl('rect', {
    x: boardLeft - 3,
    y: layout.topPad - 14,
    width: boardRight - boardLeft + 6,
    height: 6 * layout.stringGap + 28,
    rx: 12,
    class: 'fb-board',
    fill: `url(#${gradient.getAttribute('id')})`,
  }));

  // 空弦区
  if (hasOpen) {
    svg.appendChild(svgEl('rect', {
      x: boardLeft,
      y: layout.topPad - 12,
      width: layout.openWidth,
      height: 6 * layout.stringGap + 24,
      rx: 8,
      class: 'fb-open-zone',
    }));
  }

  // 品位数字
  if (showFretLabels) {
    for (const fret of sorted) {
      const x = cellCenterX(fret);
      svg.appendChild(textEl(fret === 0 ? '0' : String(fret), {
        x,
        y: layout.topPad - 17,
        class: 'fb-fret-label',
        'text-anchor': 'middle',
      }));
    }
  }

  // 竖线（品丝/弦枕）
  if (hasOpen) {
    svg.appendChild(svgEl('line', {
      x1: nutX, y1: layout.topPad - 13,
      x2: nutX, y2: layout.topPad + 5 * layout.stringGap + 13,
      class: 'fb-nut',
    }));
  }
  const boundaries = hasOpen
    ? [nutX + stopped.length * layout.cellWidth]
    : [boardLeft];
  if (hasOpen) {
    for (let i = 1; i <= stopped.length; i += 1) boundaries.push(nutX + i * layout.cellWidth);
  } else {
    for (let i = 1; i <= stopped.length; i += 1) boundaries.push(boardLeft + i * layout.cellWidth);
  }
  for (const x of boundaries) {
    svg.appendChild(svgEl('line', {
      x1: x, y1: layout.topPad - 13,
      x2: x, y2: layout.topPad + 5 * layout.stringGap + 13,
      class: 'fb-fret',
    }));
  }
  if (!hasOpen) {
    svg.appendChild(svgEl('line', {
      x1: boardLeft, y1: layout.topPad - 13,
      x2: boardLeft, y2: layout.topPad + 5 * layout.stringGap + 13,
      class: 'fb-fret fb-fret--edge',
    }));
  }

  // 弦线与弦号
  for (const stringNumber of strings) {
    const y = stringY(stringNumber);
    svg.appendChild(svgEl('line', {
      x1: boardLeft + (hasOpen ? 2 : 0),
      y1: y,
      x2: boardRight,
      y2: y,
      class: `fb-string${hintString === stringNumber ? ' is-hinted' : ''}`,
    }));
    svg.appendChild(textEl(CIRCLED_NUMBERS[stringNumber], {
      x: 12,
      y: y + 4,
      class: `fb-string-label${hintString === stringNumber ? ' is-hinted' : ''}`,
      'text-anchor': 'middle',
    }));
  }

  // 每个位置的浅色圆点 + 点击区域
  for (const stringNumber of strings) {
    for (const fret of sorted) {
      const x = cellCenterX(fret);
      const y = stringY(stringNumber);
      svg.appendChild(svgEl('circle', {
        cx: x, cy: y, r: layout.dotRadius,
        class: 'fb-dot',
      }));

      const isTarget = targetPositions.some(
        (position) => position.string === stringNumber && position.fret === fret,
      );
      const isWrong = wrongPosition
        && wrongPosition.string === stringNumber
        && wrongPosition.fret === fret;

      if (isTarget) {
        svg.appendChild(svgEl('circle', {
          cx: x, cy: y, r: layout.ringRadius,
          class: 'fb-target-ring',
        }));
        svg.appendChild(svgEl('circle', {
          cx: x, cy: y, r: 6,
          class: 'fb-target-dot',
        }));
      }
      if (isWrong && !isTarget) {
        svg.appendChild(svgEl('circle', {
          cx: x, cy: y, r: layout.ringRadius,
          class: 'fb-wrong-ring',
        }));
        svg.appendChild(textEl('×', {
          x, y: y + 4,
          class: 'fb-wrong-mark',
          'text-anchor': 'middle',
        }));
      }

      if (!onSelect || disabled) continue;
      const hitWidth = fret === 0 ? layout.openWidth : layout.cellWidth;
      const hitX = fret === 0
        ? boardLeft
        : (hasOpen ? nutX + (stopped.indexOf(fret)) * layout.cellWidth : boardLeft + stopped.indexOf(fret) * layout.cellWidth);
      const hit = svgEl('rect', {
        x: hitX,
        y: y - layout.stringGap / 2,
        width: hitWidth,
        height: layout.stringGap,
        class: 'fb-hit',
        tabindex: '0',
        role: 'button',
        'aria-label': `第 ${stringNumber} 弦，${fret === 0 ? '空弦' : `第 ${fret} 品`}`,
        'data-string': stringNumber,
        'data-fret': fret,
        'data-position-key': positionKey(stringNumber, fret),
      });
      const activate = (event) => {
        if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        if (svg.classList.contains('is-disabled')) return;
        onSelect({ string: stringNumber, fret }, event);
      };
      hit.addEventListener('click', activate);
      hit.addEventListener('keydown', activate);
      svg.appendChild(hit);
    }
  }

  const setDisabled = (value) => {
    svg.classList.toggle('is-disabled', Boolean(value));
  };

  // 全指板关卡里正确答案可能在屏幕外；答后自动滑到第一个正确位置。
  if (revealPosition && Number.isInteger(revealPosition.fret)) {
    requestAnimationFrame(() => {
      const available = scroll.clientWidth;
      const contentWidth = scroll.scrollWidth;
      if (!available || contentWidth <= available + 1) return;
      const scale = contentWidth / width;
      const target = cellCenterX(revealPosition.fret) * scale - available / 2;
      scroll.scrollLeft = Math.max(0, Math.min(target, contentWidth - available));
    });
  }

  return { svg, geometry, setDisabled };
}
