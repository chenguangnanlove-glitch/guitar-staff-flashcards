/**
 * 验证两处新行为的 UI：指板位置熟练度、重做上限后的「仍未掌握」区块。
 * 用法：npm run check:progress
 */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const requireFrom = createRequire(import.meta.url);
const { chromium } = requireFrom('playwright-core');

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const PORT = Number(process.env.PORT || 8096);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, ORIGIN).pathname);
  let filePath = normalize(join(ROOT, pathname));
  if (!filePath.startsWith(ROOT + sep)) {
    response.writeHead(403).end('forbidden');
    return;
  }
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html');
  }
  if (!existsSync(filePath)) {
    response.writeHead(404).end('not found');
    return;
  }
  response.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
  createReadStream(filePath).pipe(response);
});
await new Promise((done) => server.listen(PORT, '127.0.0.1', done));

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH
    || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--no-sandbox'],
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});

await page.goto(`${ORIGIN}/?e2e=1#/`, { waitUntil: 'networkidle' });
await page.waitForSelector('.home-screen');
await page.evaluate(() => localStorage.clear());
await page.goto(`${ORIGIN}/?e2e=1#/`, { waitUntil: 'networkidle' });
await page.waitForSelector('.home-screen');

const results = {};

// --- 1) 指板模式：位置熟练度独立记录 ---
await page.evaluate(() => document.querySelector('#bottom-nav [data-route="#/settings"]').click());
await page.waitForSelector('.settings-screen');
await page.locator('[data-key="answerMode"][data-value="fretboard"]').click();
await page.waitForTimeout(200);
await page.evaluate(() => document.querySelector('#bottom-nav [data-route="#/"]').click());
await page.waitForSelector('.home-screen');
await page.locator('.level-card[data-level="p1-upper"]').click();
await page.waitForSelector('.fingerboard-card');
await page.waitForTimeout(300);

const target = await page.evaluate(() => {
  const card = window.__gsf.session.current;
  return { string: card.note.string, fret: card.note.fret, writtenMidi: card.note.writtenMidi };
});
// 故意点错一个不同弦的位置，验证记在「点击的位置」而不是卡片位置
const wrongString = target.string === 1 ? 2 : 1;
await page.locator(`.fb-hit[data-string="${wrongString}"][data-fret="0"]`).click();
await page.waitForSelector('.feedback');
await page.waitForTimeout(300);

const afterFret = await page.evaluate(() => ({
  positions: window.__gsf.progress.positions,
  notes: window.__gsf.progress.notes,
}));
results.fretboardAnswer = {
  target,
  wrongString,
  positionKeys: Object.keys(afterFret.positions),
  noteKeys: Object.keys(afterFret.notes),
  wrongRecordedOnClicked: Boolean(afterFret.positions[`w${target.writtenMidi}@${wrongString}`]),
};

// 退出并回到音名模式
await page.locator('#app-bar [data-action="back"]').click();
await page.waitForSelector('[data-dialog-confirm]');
await page.locator('[data-dialog-confirm]').click();
await page.waitForSelector('.home-screen');
await page.evaluate(() => document.querySelector('#bottom-nav [data-route="#/settings"]').click());
await page.waitForSelector('.settings-screen');
await page.locator('[data-key="answerMode"][data-value="name"]').click();
await page.waitForTimeout(200);
await page.evaluate(() => document.querySelector('#bottom-nav [data-route="#/"]').click());
await page.waitForSelector('.home-screen');
await page.evaluate(() => localStorage.removeItem('gsf:progress:v1'));
await page.goto(`${ORIGIN}/?e2e=1#/`, { waitUntil: 'networkidle' });
await page.waitForSelector('.home-screen');

// --- 2) 同一张题连错三次，触发「仍未掌握」 ---
await page.locator('.level-card[data-level="p1-upper"]').click();
await page.waitForSelector('.quiz-screen');
const targetId = await page.evaluate(() => window.__gsf.session.current.id);
const targetPc = await page.evaluate(() => window.__gsf.session.current.note.pitch.pitchClass);

let guard = 0;
let gaveUpSeen = false;
while (guard < 80) {
  if (await page.locator('.result-screen').count()) break;
  if (await page.locator('.feedback').count()) {
    const isGaveUp = await page.locator('.feedback__retry').count();
    await page.locator('[data-action="next"]').click();
    await page.waitForTimeout(30);
    guard += 1;
    if (isGaveUp) gaveUpSeen = true;
    continue;
  }
  const info = await page.evaluate(() => {
    const card = window.__gsf.session && window.__gsf.session.current;
    return card ? { id: card.id, pc: card.note.pitch.pitchClass } : null;
  });
  if (!info) break;
  const value = info.id === targetId
    ? await page.evaluate((pc) => {
      const button = [...document.querySelectorAll('.answer-btn')]
        .find((element) => Number(element.dataset.value) !== pc);
      return button ? Number(button.dataset.value) : pc;
    }, info.pc)
    : info.pc;
  await page.evaluate((chosen) => {
    document.querySelector(`.answer-btn[data-value="${chosen}"]`)?.click();
  }, value);
  await page.waitForTimeout(30);
  guard += 1;
}

await page.waitForSelector('.result-screen', { timeout: 8000 });
await page.waitForTimeout(400);
await page.screenshot({ path: resolve(ROOT, 'tests/shots/19-gaveup.png'), fullPage: true });

results.gaveUp = {
  sawRetryNotice: gaveUpSeen,
  warnSection: await page.locator('.requirement--warn').count(),
  warnText: await page.locator('.requirement--warn .requirement__title').textContent().catch(() => null),
  retries: await page.locator('.stat').filter({ hasText: '重做次数' }).locator('.stat__value').textContent(),
  ring: await page.locator('.result-ring__value').textContent(),
};

results.errors = errors;
console.log(JSON.stringify(results, null, 2));

await browser.close();
server.close();
