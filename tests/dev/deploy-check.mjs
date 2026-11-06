/**
 * 生产构建验收（开发用，不参与应用运行）。
 *
 * 目标：用 dist/ 的真实产物模拟静态托管 + HTTPS 安全上下文，
 * 验证「桌面能练题、刷新不丢进度、设置导出/导入可用、Service Worker 可离线」。
 *
 * 用法：
 *   npm run build:static
 *   npm run check:deploy
 */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
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
const DIST = join(ROOT, 'dist');
const TMP = join(ROOT, 'tests/tmp');
const PORT = 8137;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const BASE = `${ORIGIN}/`;

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/ 不存在，请先运行 npm run build:static。');
  process.exit(1);
}
mkdirSync(TMP, { recursive: true });

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

const requests = [];
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, ORIGIN).pathname);
  let filePath = normalize(join(DIST, pathname));
  if (!filePath.startsWith(DIST + sep) && filePath !== DIST) {
    response.writeHead(403).end('forbidden');
    return;
  }
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html');
  }
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    requests.push({ path: pathname, status: 404 });
    response.writeHead(404).end('not found');
    return;
  }
  requests.push({ path: pathname, status: 200 });
  response.writeHead(200, {
    'Content-Type': MIME[extname(filePath)] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  createReadStream(filePath).pipe(response);
});

await new Promise((resolveListen) => server.listen(PORT, '127.0.0.1', resolveListen));
console.log(`生产构建预览：${ORIGIN}`);

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

async function waitForApp(page) {
  await page.waitForSelector('#app:not([hidden])', { timeout: 15000 });
}

try {
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', (error) => consoleErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('dialog', (dialog) => dialog.accept());

  console.log('\n[桌面 · 首次访问]');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await waitForApp(page);

  await check('副标题已改为「读谱 · 唱名 · 找位置」', async () => {
    const subtitle = await page.locator('.app-bar__subtitle').innerText();
    assert(subtitle === '读谱 · 唱名 · 找位置', `实际：${subtitle}`);
  });

  await check('无练习记录时主按钮显示「开始」', async () => {
    const label = await page.locator('.hero [data-action="start-level"]').innerText();
    assert(label.includes('开始'), `实际：${label}`);
    assert(!label.includes('继续'), `实际：${label}`);
  });

  await check('默认答题模式是唱名', async () => {
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('gsf:settings:v1') || 'null'));
    assert(stored?.answerMode === 'solfege', `localStorage answerMode=${stored?.answerMode}`);
  });

  console.log('\n[桌面 · 答题]');
  await page.locator('.hero [data-action="start-level"]').click();
  await page.waitForSelector('.answer-btn, #quiz-board', { timeout: 10000 });

  await check('题目要求唱名而不是音名', async () => {
    const prompt = await page.locator('.prompt').innerText();
    assert(prompt.includes('唱名'), `实际题目：${prompt}`);
  });

  await check('答一题后出现反馈与正确答案', async () => {
    await page.locator('.answer-btn').first().click();
    await page.waitForSelector('#feedback-area', { timeout: 10000 });
    const feedback = await page.locator('#feedback-area').innerText();
    assert(feedback.length > 0, '反馈区为空');
  });

  console.log('\n[桌面 · 刷新保留]');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await waitForApp(page);

  await check('刷新后进度仍在，主按钮显示「继续」', async () => {
    const label = await page.locator('.hero [data-action="start-level"]').innerText();
    assert(label.includes('继续'), `实际：${label}`);
    const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('gsf:progress:v1') || 'null'));
    const count = Object.keys(progress?.notes || {}).length;
    assert(count > 0, 'progress.notes 为空');
  });

  console.log('\n[Service Worker · 离线]');
  const controlled = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller) return true;
    await new Promise((resolveWait) => {
      navigator.serviceWorker.addEventListener('controllerchange', resolveWait, { once: true });
      setTimeout(resolveWait, 4000);
    });
    return Boolean(navigator.serviceWorker.controller);
  });
  await check('生产构建注册并接管页面', async () => {
    assert(controlled, 'Service Worker 未接管页面');
  });

  await page.goto(`${BASE}#/settings`, { waitUntil: 'domcontentloaded' });
  await waitForApp(page);

  await check('关于页显示「离线可用」而不是笼统承诺', async () => {
    const chip = await page.locator('.settings-section', { hasText: '关于' }).locator('.chip').innerText();
    assert(chip.includes('离线可用'), `实际：${chip}`);
    const text = await page.locator('.settings-section', { hasText: '关于' }).innerText();
    assert(text.includes('已缓存到本机'), '关于页缺少缓存状态说明');
  });

  await check('本机访问时不显示具体局域网 IP（未注入 meta）', async () => {
    const body = await page.locator('#view').innerText();
    assert(!body.includes('192.168'), '出现局域网 IP');
  });

  console.log('\n[设置 · 导出/导入]');
  const backupPath = join(TMP, 'backup.json');
  await check('导出备份会下载可解析的 JSON', async () => {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }),
      page.locator('[data-action="export-data"]').click(),
    ]);
    await download.saveAs(backupPath);
    const snapshot = JSON.parse(readFileSync(backupPath, 'utf8'));
    assert(snapshot.format === 'gsf-backup', `format=${snapshot.format}`);
    assert(snapshot.progress && Object.keys(snapshot.progress.notes).length > 0, '备份没有进度');
    assert(snapshot.settings?.answerMode === 'solfege', '备份没有设置');
  });

  const notesBefore = await page.evaluate(() => (
    Object.keys(JSON.parse(localStorage.getItem('gsf:progress:v1') || '{}').notes || {}).length
  ));

  await check('重置进度会清空记录', async () => {
    await page.locator('[data-action="reset-progress"]').click();
    await page.locator('[data-dialog-confirm]').click();
    await page.waitForTimeout(300);
    const notes = await page.evaluate(() => (
      Object.keys(JSON.parse(localStorage.getItem('gsf:progress:v1') || '{}').notes || {}).length
    ));
    assert(notes === 0, `重置后仍有 ${notes} 个音`);
  });

  await check('导入备份可恢复进度', async () => {
    await page.setInputFiles('#import-file', backupPath);
    await page.waitForSelector('[data-dialog-confirm]', { timeout: 10000 });
    await page.locator('[data-dialog-confirm]').click();
    await page.waitForSelector('.home-screen', { timeout: 10000 });
    const notes = await page.evaluate(() => (
      Object.keys(JSON.parse(localStorage.getItem('gsf:progress:v1') || '{}').notes || {}).length
    ));
    assert(notes === notesBefore, `导入后 ${notes} 个音，导出前 ${notesBefore} 个`);
    const label = await page.locator('.hero [data-action="start-level"]').innerText();
    assert(label.includes('继续'), `导入后按钮：${label}`);
  });

  console.log('\n[离线访问]');
  await context.setOffline(true);
  await check('断网后刷新仍能打开并作答', async () => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await waitForApp(page);
    const title = await page.locator('.hero__title').innerText();
    assert(title.length > 0, '离线页面没有渲染');
    await page.locator('.hero [data-action="start-level"]').click();
    await page.waitForSelector('.answer-btn, #quiz-board', { timeout: 10000 });
  });
  await context.setOffline(false);

  await check('控制台没有报错', async () => {
    const meaningful = consoleErrors.filter((line) => !line.includes('favicon'));
    assert(meaningful.length === 0, meaningful.join(' | '));
  });

  await context.close();

  console.log('\n[手机视口 · 390×844]');
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  const mobilePage = await mobile.newPage();
  mobilePage.on('dialog', (dialog) => dialog.accept());
  await mobilePage.goto(BASE, { waitUntil: 'networkidle' });
  await waitForApp(mobilePage);

  await check('手机视口无横向溢出', async () => {
    const overflow = await mobilePage.evaluate(() => (
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    ));
    assert(overflow <= 1, `横向溢出 ${overflow}px`);
  });

  await check('手机视口能进入答题', async () => {
    await mobilePage.locator('.hero [data-action="start-level"]').click();
    await mobilePage.waitForSelector('.answer-btn, #quiz-board', { timeout: 10000 });
    const prompt = await mobilePage.locator('.prompt').innerText();
    assert(prompt.length > 0, '题目为空');
  });

  await mobile.close();


  const missing = requests.filter((item) => item.status === 404);
  await check('生产构建没有 404 资源', async () => {
    assert(missing.length === 0, missing.map((item) => item.path).join(', '));
  });

  console.log(`\n结果：${passed} 项通过，${failures.length} 项失败`);
  if (failures.length > 0) {
    for (const failure of failures) console.error(`- ${failure.name}: ${failure.error.message}`);
    process.exitCode = 1;
  }
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}
