/**
 * 学习逻辑与备份功能的真实浏览器验收。
 * 需要先 npm install（含 playwright-core）和本机 Chrome。
 * 用法：npm run check:learning
 */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const requireFrom = createRequire(import.meta.url);
const { chromium } = requireFrom('playwright-core');

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const PORT = Number(process.env.PORT || 8097);
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
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});

await page.goto(`${ORIGIN}/?e2e=1`, { waitUntil: 'networkidle' });
await page.waitForSelector('.home-screen');

const state = () => page.evaluate(() => {
  const s = window.__gsf;
  return {
    notes: s.progress.notes,
    positions: s.progress.positions,
    groups: s.progress.totals.groups,
    session: s.session ? { total: s.session.total, focus: s.session.focus } : null,
  };
});

const results = {};

// 1) 清空数据，做一组题（故意答错前两张）
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.home-screen');
await page.waitForTimeout(400);

results.homeWithoutHistory = {
  focusCard: await page.locator('.focus-card').count(),
  progressText: await page.locator('.hero__stats-sub').textContent(),
};

await page.locator('.level-card[data-level="p1-upper"]').click();
await page.waitForSelector('.quiz-screen');

const wrongKeys = new Set();
let answered = 0;
let guard = 0;
while (guard < 40) {
  const feedback = await page.locator('.feedback').count();
  if (feedback) {
    await page.locator('[data-action="next"]').click();
    await page.waitForTimeout(40);
    guard += 1;
    if (await page.locator('.result-screen').count()) break;
    continue;
  }
  if (!(await page.locator('.answer-btn').count())) break;

  const card = await page.evaluate(() => {
    const current = window.__gsf.session?.current;
    if (!current) return null;
    return { pc: current.note.pitch.pitchClass, key: current.pitchKey };
  });
  if (!card) break;

  const shouldWrong = wrongKeys.size < 2 && !wrongKeys.has(card.key);
  if (shouldWrong) wrongKeys.add(card.key);
  const choice = shouldWrong
    ? await page.evaluate(() => {
      const card = window.__gsf.session.current;
      const buttons = [...document.querySelectorAll('.answer-btn')];
      const wrongButton = buttons.find((b) => Number(b.dataset.value) !== card.note.pitch.pitchClass);
      return wrongButton ? Number(wrongButton.dataset.value) : card.note.pitch.pitchClass;
    })
    : card.pc;

  await page.evaluate((value) => {
    document.querySelector(`.answer-btn[data-value="${value}"]`)?.click();
  }, choice);
  answered += 1;
  await page.waitForTimeout(40);
  guard += 1;
}

await page.waitForSelector('.result-screen', { timeout: 8000 });
await page.waitForTimeout(400);
await page.screenshot({ path: resolve(ROOT, 'tests/shots/15-result-v2.png'), fullPage: true });

results.afterGroup = {
  answered,
  ring: await page.locator('.result-ring__value').textContent(),
  gaveUpSection: await page.locator('.requirement--warn').count(),
  missed: await page.locator('.missed-item').count(),
};

const afterGroupState = await state();
results.progressShape = {
  notes: Object.keys(afterGroupState.notes).length,
  positions: Object.keys(afterGroupState.positions).length,
  levels: [...new Set(Object.values(afterGroupState.notes).map((note) => note.level))].sort(),
  hasDueAt: Object.values(afterGroupState.notes).every((note) => Number.isFinite(note.dueAt)),
  positionsAreFretboardOnly: Object.keys(afterGroupState.positions).every((key) => key.includes('@')),
};

// 2) 返回首页：应该出现弱项练习入口
await page.locator('[data-action="navigate"][data-route="#/"]').click();
await page.waitForSelector('.home-screen');
await page.waitForTimeout(300);
results.homeWithHistory = {
  focusCard: await page.locator('.focus-card').count(),
  focusText: await page.locator('.focus-card__title').textContent().catch(() => null),
  progressText: await page.locator('.hero__stats-sub').textContent(),
};
await page.screenshot({ path: resolve(ROOT, 'tests/shots/16-home-focus.png'), fullPage: true });

// 3) 弱项练习
if (await page.locator('.focus-card').count()) {
  await page.locator('.focus-card').click();
  await page.waitForSelector('.quiz-screen');
  await page.waitForTimeout(300);
  results.focusSession = {
    ...(await state()).session,
    toolbar: await page.locator('.app-bar__title').textContent(),
    buttons: await page.locator('.answer-btn').count(),
  };
  await page.screenshot({ path: resolve(ROOT, 'tests/shots/17-focus-quiz.png'), fullPage: true });
}

// 4) 键盘快捷键：数字键答题、空格下一题
await page.keyboard.press('1');
await page.waitForTimeout(200);
results.keyboardAfterDigit = await page.locator('.feedback').count();
await page.keyboard.press(' ');
await page.waitForTimeout(250);
results.keyboardAfterSpace = {
  feedback: await page.locator('.feedback').count(),
  quiz: await page.locator('.quiz-screen').count(),
};

// 退出弱项练习
if (await page.locator('.quiz-screen').count()) {
  await page.locator('#app-bar [data-action="back"]').click();
  await page.waitForSelector('[data-dialog-confirm]');
  await page.locator('[data-dialog-confirm]').click();
  await page.waitForSelector('.home-screen');
}

// 5) 导出备份
await page.locator('#bottom-nav [data-route="#/settings"]').click();
await page.waitForSelector('.settings-screen');
await page.waitForTimeout(300);

const downloadPromise = page.waitForEvent('download', { timeout: 8000 });
await page.locator('[data-action="export-data"]').click();
const download = await downloadPromise;
const downloadPath = await download.path();
const suggested = download.suggestedFilename();
const exported = JSON.parse(await import('node:fs').then((fs) => fs.readFileSync(downloadPath, 'utf8')));

results.exported = {
  suggested,
  format: exported.format,
  notes: Object.keys(exported.progress.notes).length,
  positions: Object.keys(exported.progress.positions || {}).length,
  hasSettings: Boolean(exported.settings),
};

// 6) 清空后导入回来
await page.evaluate(() => localStorage.clear());
// 重新加载到首页（当前 hash 可能是 #/settings）
await page.goto(`${ORIGIN}/?e2e=1#/`, { waitUntil: 'networkidle' });
await page.waitForSelector('.home-screen');
await page.evaluate(() => {
  document.querySelector('#bottom-nav [data-route="#/settings"]').click();
});
await page.waitForSelector('.settings-screen');

await page.setInputFiles('#import-file', {
  name: 'backup.json',
  mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify(exported)),
});
await page.waitForSelector('[data-dialog-confirm]');
results.importDialog = await page.locator('.dialog__body').textContent();
await page.locator('[data-dialog-confirm]').click();
await page.waitForTimeout(1500);
results.afterImportDiagnostics = {
  hash: await page.evaluate(() => location.hash),
  home: await page.locator('.home-screen').count(),
  settings: await page.locator('.settings-screen').count(),
  snackbar: await page.locator('#snackbar').textContent(),
  boot: await page.evaluate(() => document.querySelector('#boot')?.textContent?.trim().slice(0, 80)),
  appHidden: await page.evaluate(() => document.querySelector('#app')?.hidden),
};
await page.screenshot({ path: resolve(ROOT, 'tests/shots/18-after-import.png'), fullPage: true });
await page.waitForSelector('.home-screen', { timeout: 8000 });
await page.waitForTimeout(400);

const importedState = await state();
results.imported = {
  notes: Object.keys(importedState.notes).length,
  positions: Object.keys(importedState.positions).length,
  groups: importedState.groups,
};

// 7) 坏文件应被拒绝
await page.evaluate(() => document.querySelector('#bottom-nav [data-route="#/settings"]').click());
await page.waitForSelector('.settings-screen');
await page.setInputFiles('#import-file', {
  name: 'bad.json',
  mimeType: 'application/json',
  buffer: Buffer.from('{"format":"something-else"}'),
});
await page.waitForTimeout(500);
results.badImport = {
  dialog: await page.locator('.dialog__backdrop').count(),
  snackbar: await page.locator('#snackbar').textContent(),
  notesStillThere: Object.keys((await state()).notes).length,
};

results.errors = errors;
console.log(JSON.stringify(results, null, 2));

await browser.close();
server.close();
