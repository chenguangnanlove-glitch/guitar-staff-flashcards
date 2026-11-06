/**
 * 截取「在手机上打开」设置区块（电脑 127.0.0.1 视角）。
 * 需要先启动：npm start
 */
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const requireFrom = createRequire(import.meta.url);
const { chromium } = requireFrom('playwright-core');

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const PORT = process.env.PORT || 8090;

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH
    || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await context.newPage();
await page.goto(`http://127.0.0.1:${PORT}/?e2e=1`, { waitUntil: 'networkidle' });
await page.waitForSelector('.home-screen');
await page.locator('#bottom-nav [data-route="#/settings"]').click();
await page.waitForSelector('.settings-screen');
await page.waitForTimeout(500);

const section = page.locator('.settings-section').filter({ hasText: '在手机上打开' });
console.log('section count:', await section.count());
console.log('lan url:', await page.locator('#lan-url').textContent().catch(() => null));
await section.screenshot({ path: resolve(ROOT, 'tests/shots/14-phone-access-section.png') });

// 测试复制按钮
await page.locator('[data-action="copy-lan-url"]').click();
await page.waitForTimeout(500);
console.log('snackbar:', await page.locator('#snackbar').textContent().catch(() => null));

await browser.close();
