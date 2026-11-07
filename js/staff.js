/**
 * staff.js — VexFlow 高音谱表渲染。
 * 所有音符位置都由 music.js 的谱面音高（writtenMidi）决定；
 * 加线由 VexFlow 自动绘制，弦号徽标由我们在同一个 SVG 里补充。
 */

import { describeDiatonicStep, ledgerLinesFor } from './music.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const VF = globalThis.VexFlow;

let fontsReadyPromise = null;

export function isVexFlowAvailable() {
  return Boolean(VF && VF.Renderer && VF.Stave && VF.StaveNote);
}

export function ensureStaffFonts() {
  if (!fontsReadyPromise) {
    fontsReadyPromise = (async () => {
      if (typeof document === 'undefined' || !document.fonts) return;
      try {
        await document.fonts.ready;
        const started = Date.now();
        while (!document.fonts.check('16px Bravura') && Date.now() - started < 2500) {
          await new Promise((resolve) => setTimeout(resolve, 40));
        }
      } catch {
        // 字体检查失败时仍然继续，VexFlow 会使用可用的回退字形。
      }
    })();
  }
  return fontsReadyPromise;
}

function requireVexFlow() {
  if (!isVexFlowAvailable()) {
    throw new Error('VexFlow 未加载：请确认 vendor/vexflow.js 在页面中先于应用脚本加载。');
  }
  return VF;
}

function createBadge(svg, x, y, stringNumber, tone) {
  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute('class', `string-badge string-badge--${tone || 'neutral'}`);
  group.setAttribute('aria-hidden', 'true');

  const disc = document.createElementNS(SVG_NS, 'circle');
  disc.setAttribute('cx', String(x));
  disc.setAttribute('cy', String(y));
  disc.setAttribute('r', '8.5');
  disc.setAttribute('class', 'string-badge__disc');
  group.appendChild(disc);

  const text = document.createElementNS(SVG_NS, 'text');
  text.setAttribute('x', String(x));
  text.setAttribute('y', String(y + 0.5));
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'central');
  text.setAttribute('class', 'string-badge__text');
  text.textContent = String(stringNumber);
  group.appendChild(text);

  svg.appendChild(group);
}

/**
 * 在容器里画一个高音谱表音符。
 *
 * @param {HTMLElement} container
 * @param {object} pitch spellPitch() 的返回值
 * @param {object} options
 *   width/height       内部 SVG 尺寸
 *   viewBox            可选，{ x, y, width, height }：
 *                      只显示这块区域。VexFlow 的 clef 字形包围盒远大于实际笔画，
 *                      靠 height 猜会留下大块空白；传入实测的内容区间能贴紧裁切。
 *   staveY             谱表顶线 y
 *   noteStartX         音符起始 x
 *   showStringBadge    是否画带圈弦号
 *   stringNumber       1–6
 *   state              neutral | correct | wrong
 *   compact            结果页缩略谱
 *   ariaLabel          无障碍描述（不要泄露答案，除非已作答）
 */
export function renderStaff(container, pitch, options = {}) {
  const vf = requireVexFlow();
  const {
    width = 344,
    height = 232,
    staveY = 84,
    noteStartX = Math.round(width * 0.5),
    viewBox = null,
    showStringBadge = false,
    stringNumber = null,
    state = 'neutral',
    compact = false,
    ariaLabel = '高音谱表上的一个音符',
    tone = 'neutral',
  } = options;

  container.innerHTML = '';
  container.style.removeProperty('width');
  const renderer = new vf.Renderer(container, vf.Renderer.Backends.SVG);
  renderer.resize(width, height);
  const ctx = renderer.getContext();
  const svg = ctx.svg;
  // VexFlow 的 resize() 会写内联 width/height；改回自适应，让谱表随卡片宽度缩放。
  svg.style.width = '100%';
  svg.style.height = 'auto';
  // VexFlow 的 resize() 会把 width/height 写成内联属性，SVG 会优先用它而不是 viewBox，
  // 导致「viewBox 裁紧了但卡片还是原来那么高」。去掉 height、改用 aspect-ratio，
  // 高度才能真正跟随 viewBox。
  if (viewBox) {
    svg.removeAttribute('height');
    svg.style.aspectRatio = `${viewBox.width} / ${viewBox.height}`;
  }
  svg.setAttribute('viewBox', viewBox
    ? `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`
    : `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', ariaLabel);
  svg.classList.add('staff-svg');
  if (compact) svg.classList.add('staff-svg--compact');

  const stave = new vf.Stave(compact ? 4 : 8, staveY, width - (compact ? 8 : 16));
  stave.addClef('treble');
  stave.setContext(ctx).draw();

  // 让单音符落在谱表中间，而不是紧贴谱号。
  if (typeof stave.setNoteStartX === 'function') {
    stave.setNoteStartX(noteStartX);
  }

  const note = new vf.StaveNote({
    keys: [pitch.vexKey],
    duration: 'w',
    clef: 'treble',
  });
  if (pitch.accidental) {
    note.addModifier(new vf.Accidental(pitch.accidental), 0);
  }
  if (state === 'correct') {
    note.setStyle({ fillStyle: '#2f7d4f', strokeStyle: '#2f7d4f' });
  } else if (state === 'wrong') {
    note.setStyle({ fillStyle: '#a94a4a', strokeStyle: '#a94a4a' });
  }

  vf.Formatter.FormatAndDraw(ctx, stave, [note]);

  if (showStringBadge && stringNumber) {
    const noteX = note.getAbsoluteX();
    const noteY = note.getYs()[0];
    // 徽标要离开音符头足够远：贴太近会盖住符头，看不清音高。
    // 音符起点加上偏移量后仍有重叠风险，因此统一放到右侧 34px 处。
    createBadge(svg, noteX + 34, noteY, stringNumber, state === 'neutral' ? tone : state);
  }

  return { svg, note, stave };
}

export function staffAriaDescription(pitch, { showString = false, stringNumber = null, reveal = false } = {}) {
  const ledger = ledgerLinesFor(pitch.diatonicStep);
  const ledgerText = ledger.count
    ? `，${ledger.direction === 'below' ? '下' : '上'}加${ledger.count}条线`
    : '';
  const stringText = showString && stringNumber ? `，指定第 ${stringNumber} 弦` : '';
  if (reveal) {
    return `高音谱表：${pitch.fullName}，${describeDiatonicStep(pitch.diatonicStep)}${ledgerText}${stringText}`;
  }
  return `高音谱表上的一个音符：${describeDiatonicStep(pitch.diatonicStep)}${ledgerText}${stringText}`;
}
