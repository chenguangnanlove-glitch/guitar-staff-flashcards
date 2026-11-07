/**
 * 三模式布局验收（开发用，不参与应用运行）。
 *
 * 目标：音名 / 唱名 / 指板三种作答方式下，
 * - 顶部进度、谱面卡片、题目提示的位置与宽度完全一致；
 * - 谱面卡片比旧版更矮，但上加线、下加线、升降号、弦号徽标都完整显示；
 * - 指板六根弦垂直居中、上下留白对称，弦号与弦对齐；
 * - 小屏（320×568）没有横向溢出，答题前后与反馈展开不重叠。
 *
 * 用法：
 *   npm run build:static
 *   npm run check:layout
 */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const requireFrom = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = requireFrom('playwright-core'));
} catch {
  console.error('需要可选依赖：npm i -D playwright-core，并确保本机有 Chrome。');
  process.exit(1);
}

const CHROME_PATH = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const DIST = join(ROOT, 'dist');
const SHOTS = join(ROOT, 'tests/shots');
const PORT = 8211;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const BASE = `${ORIGIN}/`;

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/ 不存在，请先运行 npm run build:static。');
  process.exit(1);
}
mkdirSync(SHOTS, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, ORIGIN).pathname);
  // 与 Cloudflare 一致：/index.html 走 308。
  if (pathname === '/index.html') {
    response.writeHead(308, { Location: '/' }).end();
    return;
  }
  let filePath = normalize(join(DIST, pathname));
  if (!filePath.startsWith(DIST + sep) && filePath !== DIST) {
    response.writeHead(403).end('forbidden');
    return;
  }
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html');
  }
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404).end('not found');
    return;
  }
  response.writeHead(200, {
    'Content-Type': MIME[extname(filePath)] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  createReadStream(filePath).pipe(response);
});

await new Promise((done) => server.listen(PORT, '127.0.0.1', done));
console.log(`布局验收：${ORIGIN}`);

const browser = await chromium.launch({
  headless: true,
  executablePath: CHROME_PATH,
  args: ['--no-sandbox'],
});

const failures = [];
let passed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.error(`  ✗ ${name}\n    ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const SETTINGS = {
  version: 2,
  display: 'both',
  accidentalStyle: 'sharp',
  stringHint: 'auto',
  primaryColor: '#3d6b5c',
  unlockAll: true,
};

const VIEWPORTS = [
  { label: 'iPhone 14', width: 390, height: 844 },
  { label: '小屏 Android', width: 360, height: 640 },
  { label: 'iPhone SE', width: 320, height: 568 },
];

/** 只截视口可见区域，避免 fullPage 把 sticky 顶栏重复绘制造成误判。 */
async function shot(page, name) {
  await page.screenshot({ path: join(SHOTS, `layout-${name}.png`) });
}

async function measureQuiz(page) {
  return page.evaluate(() => {
    const rect = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        top: +r.top.toFixed(1),
        height: +r.height.toFixed(1),
        width: +r.width.toFixed(1),
        left: +r.left.toFixed(1),
      };
    };
    const fb = document.querySelector('.fingerboard-svg');
    let board = null;
    if (fb) {
      const rectEl = fb.querySelector('.fb-board');
      const b = rectEl.getBBox();
      const strings = [...fb.querySelectorAll('.fb-string')]
        .map((line) => +(+line.getAttribute('y1')).toFixed(2));
      const labels = [...fb.querySelectorAll('.fb-string-label')]
        .map((text) => +(+text.getAttribute('y')).toFixed(2));
      const hits = [...fb.querySelectorAll('.fb-hit')].map((hit) => {
        const hb = hit.getBBox();
        return {
          x: +hb.x.toFixed(2),
          y: +hb.y.toFixed(2),
          width: +hb.width.toFixed(2),
          height: +hb.height.toFixed(2),
          string: Number(hit.getAttribute('data-string')),
          fret: Number(hit.getAttribute('data-fret')),
        };
      });
      board = {
        top: +b.y.toFixed(2),
        bottom: +(b.y + b.height).toFixed(2),
        height: +b.height.toFixed(2),
        strings,
        labels,
        topGap: +(Math.min(...strings) - b.y).toFixed(2),
        bottomGap: +(b.y + b.height - Math.max(...strings)).toFixed(2),
        noteArea: null,
        hits,
        renderedHeight: +fb.getBoundingClientRect().height.toFixed(1),
      };
    }
    return {
      progress: rect('.quiz-progress'),
      staffCard: rect('.staff-card'),
      prompt: rect('.prompt-row'),
      answer: rect('.answer-grid') || rect('.fingerboard-card'),
      board,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
    };
  });
}

try {
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));

    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForSelector('#app:not([hidden])');

    const measured = {};
    for (const mode of ['solfege', 'name', 'fretboard']) {
      await page.evaluate((value) => {
        localStorage.setItem('gsf:settings:v1', JSON.stringify(value));
        localStorage.removeItem('gsf:progress:v1');
      }, { ...SETTINGS, answerMode: mode });
      await page.goto(`${BASE}?mode=${mode}#/quiz/p1-upper`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.quiz-screen', { timeout: 15000 });
      await page.waitForTimeout(420);
      measured[mode] = await measureQuiz(page);
      await shot(page, `${viewport.width}-${mode}`);
    }

    console.log(`\n[${viewport.label} · ${viewport.width}×${viewport.height}]`);

    await check('三个模式的进度、谱面、题目位置与宽度完全一致', async () => {
      const base = measured.solfege;
      for (const mode of ['name', 'fretboard']) {
        const other = measured[mode];
        for (const part of ['progress', 'staffCard', 'prompt']) {
          assert(
            base[part].top === other[part].top,
            `${part} 纵向不一致：${mode}=${other[part].top} vs solfege=${base[part].top}`,
          );
          assert(
            base[part].width === other[part].width,
            `${part} 宽度不一致：${mode}=${other[part].width} vs solfege=${base[part].width}`,
          );
          assert(
            base[part].left === other[part].left,
            `${part} 横向不一致：${mode}=${other[part].left} vs solfege=${base[part].left}`,
          );
        }
      }
    });

    await check('谱面卡片已压缩，且三模式高度相同', async () => {
      const heights = ['solfege', 'name', 'fretboard'].map((m) => measured[m].staffCard.height);
      assert(new Set(heights).size === 1, `三模式谱面高度不一致：${heights.join(' / ')}`);
      // 旧版固定 200 内部高度，实测卡片约 230（390 宽）；压缩后应明显低于它。
      assert(heights[0] < 175, `谱面卡片仍偏高：${heights[0]}px`);
      assert(heights[0] > 100, `谱面卡片被压得过狠：${heights[0]}px`);
    });

    await check('谱面的加线、升降号与弦号徽标都完整落在卡片内', async () => {
      // 两步，避免用硬编码数值自证：
      // 1) 用一块足够大的 viewBox 渲染极值音，像素扫描出内容真实的上下边界；
      // 2) 断言页面上实际使用的 viewBox 完整覆盖这个范围。
      const report = await page.evaluate(async () => {
        const { renderStaff } = await import('./js/staff.js');
        const { makeNote } = await import('./js/music.js');

        const probeHost = document.createElement('div');
        probeHost.style.cssText = 'position:fixed;left:-9999px;top:0;width:320px';
        document.body.appendChild(probeHost);

        // 完整画布：200 高足够容纳当前音域，不会裁切。
        const FULL = { x: 0, y: 0, width: 320, height: 240 };

        async function inkBounds(svg, vb) {
          const xml = new XMLSerializer().serializeToString(svg);
          const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }));
          const img = new Image();
          await new Promise((done, fail) => { img.onload = done; img.onerror = fail; img.src = url; });
          const W = 640;
          const H = Math.round((W * vb.height) / vb.width);
          const canvas = document.createElement('canvas');
          canvas.width = W; canvas.height = H;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
          ctx.drawImage(img, 0, 0, W, H);
          URL.revokeObjectURL(url);
          const px = ctx.getImageData(0, 0, W, H).data;
          const rowInk = [];
          for (let y = 0; y < H; y += 1) {
            let ink = false;
            for (let x = 0; x < W; x += 2) {
              const i = (y * W + x) * 4;
              if (px[i] < 200 || px[i + 1] < 200 || px[i + 2] < 200) { ink = true; break; }
            }
            rowInk.push(ink);
          }
          const first = rowInk.indexOf(true);
          const last = rowInk.length - 1 - [...rowInk].reverse().indexOf(true);
          const toUser = (py) => vb.y + (py / H) * vb.height;
          return { top: toUser(first), bottom: toUser(last) };
        }

        const cases = [
          [6, 0, 'E3 三条下加线'],
          [1, 12, 'E6 三条上加线'],
          [1, 2, 'F#5 升号'],
          [3, 3, 'D#4 升降号'],
          [5, 3, 'C4 一条下加线'],
        ];
        let contentTop = Infinity;
        let contentBottom = -Infinity;
        for (const [stringNumber, fret] of cases) {
          const note = makeNote(stringNumber, fret, 'sharp');
          const { svg } = renderStaff(probeHost, note.pitch, {
            width: 320, height: 240, staveY: 40, noteStartX: 162,
            viewBox: FULL, showStringBadge: true, stringNumber,
          });
          const bounds = await inkBounds(svg, FULL);
          contentTop = Math.min(contentTop, bounds.top);
          contentBottom = Math.max(contentBottom, bounds.bottom);
        }
        probeHost.remove();

        // 页面当前这一题用的真实 viewBox
        const live = document.querySelector('#quiz-staff svg');
        const vb = live.viewBox.baseVal;
        return {
          contentTop: +contentTop.toFixed(1),
          contentBottom: +contentBottom.toFixed(1),
          liveViewBox: { x: vb.x, y: +vb.y.toFixed(1), width: vb.width, height: +vb.height.toFixed(1) },
          liveBottom: +(vb.y + vb.height).toFixed(1),
        };
      });

      assert(
        report.liveViewBox.y <= report.contentTop - 2,
        `viewBox 上沿 ${report.liveViewBox.y} 没留出余量（内容顶到 ${report.contentTop}）`,
      );
      assert(
        report.liveBottom >= report.contentBottom + 2,
        `viewBox 下沿 ${report.liveBottom} 没留出余量（内容底到 ${report.contentBottom}）`,
      );
    });

    await check('指板六弦垂直居中，上下留白对称', async () => {
      const { board } = measured.fretboard;
      assert(board, '指板未渲染');
      const diff = Math.abs(board.topGap - board.bottomGap);
      assert(board.topGap > 6, `上方留白过小：${board.topGap}`);
      assert(diff <= 0.5, `上下留白不对称：上 ${board.topGap} / 下 ${board.bottomGap}`);
    });

    await check('弦号与弦线对齐，①在上⑥在下', async () => {
      const { board } = measured.fretboard;
      assert(board.strings.length === 6, `弦数量错误：${board.strings.length}`);
      assert(board.labels.length === 6, `弦号数量错误：${board.labels.length}`);
      for (let i = 0; i < 6; i += 1) {
        assert(
          Math.abs(board.labels[i] - board.strings[i]) <= 0.5,
          `第 ${i + 1} 个弦号偏离弦线 ${(board.labels[i] - board.strings[i]).toFixed(2)}px`,
        );
        if (i > 0) assert(board.strings[i] > board.strings[i - 1], '弦序应从①到⑥自上而下');
      }
    });

    await check('触控区足够大且互不重叠', async () => {
      const { hits } = measured.fretboard.board;
      assert(hits.length > 0, '没有触控区');
      const byCell = new Map();
      for (const hit of hits) {
        assert(hit.height >= 24 / (measured.fretboard.board.renderedHeight / 187), `触控高度过小：${hit.height}`);
        const key = `${hit.string}:${hit.fret}`;
        assert(!byCell.has(key), `触控区重复：${key}`);
        byCell.set(key, hit);
      }
      // 同一品上相邻弦的触控矩形不重叠。
      for (const hit of hits) {
        const above = hits.find((o) => o.fret === hit.fret && o.string === hit.string - 1);
        if (above) {
          assert(
            above.y + above.height <= hit.y + 0.01,
            `第 ${hit.string} 弦与上一弦的触控区重叠`,
          );
        }
      }
    });

    await check('小屏无横向溢出', async () => {
      for (const mode of ['solfege', 'name', 'fretboard']) {
        assert(
          measured[mode].overflowX <= 1,
          `${mode} 横向溢出 ${measured[mode].overflowX}px`,
        );
      }
    });

    console.log('\n[答题后 · 反馈展开]');
    await page.evaluate(() => {
      localStorage.setItem('gsf:settings:v1', JSON.stringify({
        version: 2, answerMode: 'fretboard', display: 'both', accidentalStyle: 'sharp',
        stringHint: 'auto', primaryColor: '#3d6b5c', unlockAll: true,
      }));
    });
    await page.goto(`${BASE}?fb=${viewport.width}#/quiz/p1-upper`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.fingerboard-card', { timeout: 15000 });
    await page.waitForTimeout(350);
    const before = await measureQuiz(page);
    await page.locator('.fb-hit').first().click();
    await page.waitForSelector('#feedback-area', { timeout: 15000 });
    await page.waitForTimeout(400);
    const after = await measureQuiz(page);
    await shot(page, `${viewport.width}-feedback`);

    await check('答题后进度、谱面和题目位置不跳动', async () => {
      for (const part of ['progress', 'staffCard', 'prompt']) {
        assert(
          before[part].top === after[part].top,
          `${part} 答题后位移 ${(after[part].top - before[part].top).toFixed(1)}px`,
        );
        assert(
          before[part].height === after[part].height,
          `${part} 答题后高度变化 ${(after[part].height - before[part].height).toFixed(1)}px`,
        );
      }
    });

    await check('反馈展开后没有横向溢出', async () => {
      assert(after.overflowX <= 1, `反馈展开横向溢出 ${after.overflowX}px`);
    });

    await check('反馈区与谱面卡片不重叠', async () => {
      const overlap = await page.evaluate(() => {
        const card = document.querySelector('.staff-card').getBoundingClientRect();
        const feedback = document.querySelector('#feedback-area').getBoundingClientRect();
        return +(card.bottom - feedback.top).toFixed(1);
      });
      assert(overlap <= 0, `反馈区压住谱面卡片 ${overlap}px`);
    });

    await check('没有 JS 报错', async () => {
      assert(errors.length === 0, errors.join(' | '));
    });

    await context.close();
  }

  console.log(`\n结果：${passed} 项通过，${failures.length} 项失败`);
  if (failures.length) {
    for (const failure of failures) console.error(`- ${failure.name}: ${failure.error.message}`);
    process.exitCode = 1;
  }
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
