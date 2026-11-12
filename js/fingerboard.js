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
  // labelBand：顶部写品位数字的条带高度。
  // padY：指板矩形在「最上面一根弦之上 / 最下面一根弦之下」预留的留白，两边相等，
  //       六根弦因此在矩形里垂直居中，不会像早先那样贴着上沿、底部空一大块。
  labelBand: 16,
  padY: 17,
  bottomPad: 2,
  openWidth: 44,
  dotRadius: 4.5,
  ringRadius: 11,
});

// 答题用的指板加大弦距，保证手机上每个可点格子至少 44px 高。
// 窄指板按容器宽度放大（约 1.3 倍），弦距 36 即可；
// 全指板（> 520）按原尺寸横向滚动，弦距直接取 44。
const WIDE_BOARD_WIDTH = 520;
const TAP_TARGET_MIN = 44;

function interactiveLayout(frets) {
  const natural = computeFingerboardGeometry(frets, DEFAULT_LAYOUT).width;
  const wide = natural > WIDE_BOARD_WIDTH;
  return Object.freeze({
    ...DEFAULT_LAYOUT,
    stringGap: wide ? TAP_TARGET_MIN : 36,
    padY: wide ? 16 : 15,
  });
}

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

  // 弦的纵向位置：顶部先留出品位数字条带，再留一段等量的上下对称留白。
  const firstStringY = layout.labelBand + layout.padY;
  const stringY = (stringNumber) => firstStringY + (stringNumber - 1) * layout.stringGap;
  const boardTop = layout.labelBand;
  const boardBottom = stringY(6) + layout.padY;
  const height = boardBottom + layout.bottomPad;

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
    firstStringY,
    boardTop,
    boardBottom,
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

  const layout = onSelect ? interactiveLayout(frets) : DEFAULT_LAYOUT;
  const geometry = computeFingerboardGeometry(frets, layout);
  const { width, height, nutX, boardLeft, boardRight, sorted, stopped, hasOpen, stringY, cellCenterX, boardTop, boardBottom } = geometry;
  const fretLineTop = boardTop + 2;
  const fretLineBottom = boardBottom - 2;

  container.innerHTML = '';
  const scroll = document.createElement('div');
  scroll.className = 'fb-scroll';
  if (width > WIDE_BOARD_WIDTH) scroll.classList.add('fb-scroll--wide');
  container.appendChild(scroll);

  const svg = svgEl('svg', {
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
    class: `fingerboard-svg${disabled ? ' is-disabled' : ''}`,
    role: 'group',
    'aria-label': ariaLabel,
  });
  if (width > WIDE_BOARD_WIDTH) svg.classList.add('fingerboard-svg--wide');
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
    y: boardTop,
    width: boardRight - boardLeft + 6,
    height: boardBottom - boardTop,
    rx: 12,
    class: 'fb-board',
    fill: `url(#${gradient.getAttribute('id')})`,
  }));

  // 空弦区
  if (hasOpen) {
    svg.appendChild(svgEl('rect', {
      x: boardLeft,
      y: boardTop + 2,
      width: layout.openWidth,
      height: boardBottom - boardTop - 4,
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
        y: boardTop / 2 + 1,
        class: 'fb-fret-label',
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
      }));
    }
  }

  // 竖线（品丝/弦枕）
  if (hasOpen) {
    svg.appendChild(svgEl('line', {
      x1: nutX, y1: fretLineTop,
      x2: nutX, y2: fretLineBottom,
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
      x1: x, y1: fretLineTop,
      x2: x, y2: fretLineBottom,
      class: 'fb-fret',
    }));
  }
  if (!hasOpen) {
    svg.appendChild(svgEl('line', {
      x1: boardLeft, y1: fretLineTop,
      x2: boardLeft, y2: fretLineBottom,
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
      y,
      class: `fb-string-label${hintString === stringNumber ? ' is-hinted' : ''}`,
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
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
