/**
 * 验证「直接双击 index.html」的 file:// 路径可以正常启动。
 * 用法：npm run check:file
 */
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const requireFrom = createRequire(import.meta.url);
const { chromium } = requireFrom('playwright-core');

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const PAGE_URL = pathToFileURL(resolve(ROOT, 'index.html')).href;

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH
    || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  // 刻意不加 --allow-file-access-from-files：模拟用户直接双击的默认浏览器。

});
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

const errors = [];
const consoleErrors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});

await page.goto(PAGE_URL, { waitUntil: 'load' });
await page.waitForSelector('.home-screen', { timeout: 15000 });
await page.waitForTimeout(1200);

const home = {
  protocol: await page.evaluate(() => location.protocol),
  levels: await page.locator('.level-card').count(),
  staffSvgs: await page.locator('#hero-staff svg').count(),
  staffPaths: await page.locator('#hero-staff svg path').count(),
  usedBundle: await page.evaluate(() => [...document.scripts].some((s) => s.src.endsWith('app.file.js'))),
  storage: await page.evaluate(() => {
    try {
      localStorage.setItem('__gsf_probe__', '1');
      const value = localStorage.getItem('__gsf_probe__');
      localStorage.removeItem('__gsf_probe__');
      return value === '1' ? 'available' : 'unavailable';
    } catch (error) {
      return `error: ${error.name}`;
    }
  }),
};

await page.screenshot({
  path: resolve(ROOT, 'tests/shots/12-file-home.png'),
  fullPage: true,
});

await page.locator('.level-card[data-level="p1-upper"]').click();
await page.waitForSelector('.quiz-screen');
await page.waitForTimeout(500);
const quiz = {
  buttons: await page.locator('.answer-btn').count(),
  staffPaths: await page.locator('#quiz-staff svg path').count(),
  prompt: await page.locator('.prompt').textContent(),
};

await page.locator('.answer-btn').first().click();
await page.waitForSelector('.feedback');
await page.waitForTimeout(400);
const feedback = {
  title: await page.locator('.feedback__title').textContent(),
  answer: await page.locator('.feedback__answer').textContent(),
  targetRings: await page.locator('.fb-target-ring').count(),
  progressSaved: await page.evaluate(() => Boolean(localStorage.getItem('gsf:progress:v1'))),
};

await page.screenshot({
  path: resolve(ROOT, 'tests/shots/11-file-open.png'),
  fullPage: true,
});

console.log(JSON.stringify({
  pageUrl: PAGE_URL,
  home,
  quiz,
  feedback,
  errors,
  consoleErrors,
}, null, 2));

await browser.close();
