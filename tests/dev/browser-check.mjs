/**
 * 真实浏览器验收（开发用，不参与应用运行）。
 * 需要本机 Chrome + playwright-core。
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
  console.error('需要先安装可选依赖：npm i -D playwright-core，并确保本机有 Chrome。');
  process.exit(1);
}

const CHROME_PATH = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const PORT = 8099;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const BASE = `${ORIGIN}/?e2e=1`;
const shots = resolve(ROOT, 'tests/shots');
mkdirSync(shots, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, ORIGIN).pathname);
  let filePath = normalize(join(ROOT, pathname));
  if (!filePath.startsWith(ROOT + sep) && filePath !== ROOT) {
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

await new Promise((resolveListen) => server.listen(PORT, '127.0.0.1', resolveListen));
console.log(`server on ${ORIGIN}`);

const browser = await chromium.launch({
  headless: true,
  executablePath: CHROME_PATH,
  args: ['--no-sandbox'],
});

const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'zh-CN',
});
const page = await context.newPage();
const errors = [];
const requests = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error}`));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
page.on('request', (request) => requests.push(request.url()));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('.home-screen', { timeout: 15000 });
await page.waitForTimeout(800);
await page.screenshot({ path: resolve(shots, '01-home.png'), fullPage: true });

const home = {
  title: await page.title(),
  levels: await page.locator('.level-card').count(),
  staffSvgs: await page.locator('#hero-staff svg').count(),
  staffPaths: await page.locator('#hero-staff svg path').count(),
  firstUnlocked: await page.locator('.level-card[data-level="p1-upper"]').getAttribute('class'),
  secondLocked: await page.locator('.level-card[data-level="p1-lower"]').getAttribute('class'),
  progressText: await page.locator('.hero__stats-sub').textContent(),
  manifestHref: await page.evaluate(
    () => document.querySelector('link[rel="manifest"]')?.href || null,
  ),
  moduleScript: await page.evaluate(
    () => [...document.scripts].filter((s) => s.type === 'module').map((s) => s.src),
  ),
};

// Service Worker
const swState = await page.evaluate(async () => {
  const registration = await navigator.serviceWorker.getRegistration();
  return {
    hasRegistration: Boolean(registration),
    active: Boolean(registration?.active),
    scope: registration?.scope || null,
  };
});
await page.waitForTimeout(1200);
const cacheInfo = await page.evaluate(async () => {
  const names = await caches.keys();
  const details = {};
  for (const name of names) {
    const cache = await caches.open(name);
    details[name] = (await cache.keys()).length;
  }
  return details;
});

// 进入第一关
await page.locator('.level-card[data-level="p1-upper"]').click();
await page.waitForSelector('.quiz-screen');
await page.waitForTimeout(600);
await page.screenshot({ path: resolve(shots, '02-quiz.png'), fullPage: true });

const quiz = {
  buttons: await page.locator('.answer-btn').count(),
  staffPaths: await page.locator('#quiz-staff svg path').count(),
  prompt: await page.locator('.prompt').textContent(),
  toolbarTitle: await page.locator('.app-bar__title').textContent(),
};

// 故意答错一张，检查反馈与指板高亮
const wrongButtonIndex = await page.evaluate(() => {
  const state = window.__gsf;
  const card = state?.session?.current || state?.feedback?.card;
  if (!card) return 0;
  const buttons = [...document.querySelectorAll('.answer-btn')];
  const correct = card.note.pitch.pitchClass;
  return buttons.findIndex((button) => Number(button.dataset.value) !== correct);
});
await page.locator('.answer-btn').nth(Math.max(0, wrongButtonIndex)).click();
await page.waitForSelector('.feedback');
await page.waitForTimeout(700);
await page.screenshot({ path: resolve(shots, '03-feedback.png'), fullPage: true });
const feedback = {
  title: await page.locator('.feedback__title').textContent(),
  answer: await page.locator('.feedback__answer').textContent(),
  detail: await page.locator('.feedback__detail').textContent(),
  targetRings: await page.locator('.fb-target-ring').count(),
  hasListen: await page.locator('[data-action="listen"]').count(),
  boardDots: await page.locator('.fb-dot').count(),
};

// 听一下（真实 Web Audio）
const audioOk = await page.evaluate(async () => {
  const button = document.querySelector('[data-action="listen"]');
  button?.click();
  await new Promise((r) => setTimeout(r, 350));
  return Boolean(window.AudioContext || window.webkitAudioContext);
});

// 一路答到结果页：读取当前卡片正确答案
let guard = 0;
while (!(await page.locator('.result-screen').count()) && guard < 40) {
  const inFeedback = await page.locator('.feedback').count();
  if (inFeedback) {
    await page.locator('[data-action="next"]').click();
    await page.waitForTimeout(120);
    guard += 1;
    continue;
  }
  const answered = await page.evaluate(() => {
    const card = window.__gsf?.session?.current;
    if (!card) return null;
    const button = document.querySelector(`.answer-btn[data-value="${card.note.pitch.pitchClass}"]`);
    if (!button) return null;
    button.click();
    return true;
  });
  if (!answered) break;
  await page.waitForSelector('.feedback', { timeout: 4000 });
  await page.waitForTimeout(80);
  guard += 1;
}

await page.waitForSelector('.result-screen', { timeout: 8000 });
await page.waitForTimeout(700);
await page.screenshot({ path: resolve(shots, '04-result.png'), fullPage: true });
const result = {
  ring: await page.locator('.result-ring__value').textContent(),
  stats: await page.locator('.stat').count(),
  missed: await page.locator('.missed-item').count(),
  missedStaff: await page.locator('.missed-item__staff svg').count(),
  requirement: await page.locator('.requirement__title').first().textContent().catch(() => null),
};

// 设置页
await page.locator('[data-action="navigate"][data-route="#/"]').click();
await page.waitForSelector('.home-screen');
await page.locator('#bottom-nav [data-route="#/settings"]').click();
await page.waitForSelector('.settings-screen');
await page.waitForTimeout(500);
await page.screenshot({ path: resolve(shots, '05-settings.png'), fullPage: true });
const settings = {
  sections: await page.locator('.settings-section').count(),
  options: await page.locator('.option').count(),
  swatches: await page.locator('.swatch').count(),
};

// 指板模式 + 全指板关卡
await page.locator('[data-key="answerMode"][data-value="fretboard"]').click();
await page.waitForTimeout(200);
await page.locator('[data-action="toggle-unlock"]').click();
await page.waitForTimeout(200);
await page.locator('#bottom-nav [data-route="#/"]').click();
await page.waitForSelector('.home-screen');
await page.locator('.level-card[data-level="full-chromatic"]').click();
await page.waitForSelector('.fingerboard-card', { timeout: 8000 });
await page.waitForTimeout(700);
await page.screenshot({ path: resolve(shots, '06-fretboard.png'), fullPage: true });
const fretboard = {
  hits: await page.locator('.fb-hit').count(),
  wide: await page.locator('.fingerboard-svg--wide').count(),
  stringBadges: await page.locator('.string-badge').count(),
  chips: await page.locator('.chip').allTextContents(),
  svgWidth: await page.locator('.fingerboard-svg').getAttribute('width'),
};

await page.locator('.fb-hit[data-string="6"][data-fret="5"]').click();
await page.waitForSelector('.feedback');
await page.waitForTimeout(500);
await page.screenshot({ path: resolve(shots, '07-fretboard-feedback.png'), fullPage: true });
const fretFeedback = {
  targetRings: await page.locator('.fb-target-ring').count(),
  wrongRings: await page.locator('.fb-wrong-ring').count(),
  answer: await page.locator('.feedback__answer').textContent(),
};

// 离线：断网后重新加载（当前仍在 #/quiz/full-chromatic）
await context.setOffline(true);
let offline;
try {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.screen', { timeout: 15000 });
  await page.waitForTimeout(600);
  const offlineQuiz = {
    screen: await page.locator('.quiz-screen').count(),
    staff: await page.locator('#quiz-staff svg').count(),
    fbHits: await page.locator('.fb-hit').count(),
  };
  await page.screenshot({ path: resolve(shots, '08-offline.png'), fullPage: true });
  await page.locator('#app-bar [data-action="back"]').click();
  await page.waitForSelector('[data-dialog-confirm]');
  await page.locator('[data-dialog-confirm]').click();
  await page.waitForSelector('.home-screen', { timeout: 15000 });
  await page.waitForTimeout(500);
  offline = {
    quiz: offlineQuiz,
    title: await page.title(),
    levels: await page.locator('.level-card').count(),
    staff: await page.locator('#hero-staff svg').count(),
  };
  await page.screenshot({ path: resolve(shots, '09-offline-home.png'), fullPage: true });
} catch (error) {
  offline = { failed: String(error).slice(0, 400) };
  await page.screenshot({ path: resolve(shots, '08-offline-failed.png'), fullPage: true }).catch(() => {});
}
await context.setOffline(false);

// 桌面宽屏
await page.setViewportSize({ width: 1280, height: 900 });
await page.waitForTimeout(500);
await page.screenshot({ path: resolve(shots, '10-desktop.png'), fullPage: true });

const externalRequests = requests.filter((url) => !url.startsWith(BASE.slice(0, -1)) && !url.startsWith('data:'));

console.log(JSON.stringify({
  home,
  swState,
  cacheInfo,
  quiz,
  feedback,
  audioOk,
  result,
  settings,
  fretboard,
  fretFeedback,
  offline,
  externalRequests,
  errors,
}, null, 2));
await browser.close();
server.close();
