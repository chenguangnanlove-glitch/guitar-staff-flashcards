/**
 * 验证手机通过局域网地址访问的路径。
 * 需要：npm start 已在本机运行（默认 0.0.0.0:8080）。
 * 用法：npm run check:mobile
 */
import { createRequire } from 'node:module';
import os from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const requireFrom = createRequire(import.meta.url);
const { chromium } = requireFrom('playwright-core');

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const PORT = process.env.PORT || 8090;

function lanAddress() {
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    if (name.startsWith('utun') || name.startsWith('bridge')) continue;
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) return entry.address;
    }
  }
  return null;
}

const LAN_IP = process.env.LAN_IP || lanAddress();
if (!LAN_IP) {
  console.error('没有找到局域网地址，请用 LAN_IP=192.168.x.x 指定。');
  process.exit(1);
}

const LAN_URL = `http://${LAN_IP}:${PORT}/`;
const LOCAL_URL = `http://127.0.0.1:${PORT}/`;

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH
    || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});

const iPhone = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
};

const results = {};

async function inspect(label, url, deviceOptions, screenshotName) {
  const context = await browser.newContext(deviceOptions);
  const page = await context.newPage();
  const errors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('.home-screen', { timeout: 15000 });
  await page.waitForTimeout(700);

  const home = {
    levels: await page.locator('.level-card').count(),
    staffSvgs: await page.locator('#hero-staff svg').count(),
    secureContext: await page.evaluate(() => window.isSecureContext),
    canUseOffline: await page.evaluate(() => {
      const p = document.querySelector('meta[name="gsf-lan-url"]');
      return { hasLanMeta: Boolean(p), swRegistered: Boolean(navigator.serviceWorker?.controller) };
    }),
  };

  await page.locator('.level-card[data-level="p1-upper"]').click();
  await page.waitForSelector('.quiz-screen');
  await page.waitForTimeout(400);
  const quiz = {
    buttons: await page.locator('.answer-btn').count(),
    staffPaths: await page.locator('#quiz-staff svg path').count(),
  };

  await page.locator('.answer-btn').first().click();
  await page.waitForSelector('.feedback');
  await page.waitForTimeout(300);
  const feedback = {
    rings: await page.locator('.fb-target-ring').count(),
    saved: await page.evaluate(() => Boolean(localStorage.getItem('gsf:progress:v1'))),
  };

  // 设置页：手机访问区块
  await page.locator('#app-bar [data-action="back"]').click();
  await page.waitForSelector('[data-dialog-confirm]');
  await page.locator('[data-dialog-confirm]').click();
  await page.waitForSelector('.home-screen');
  await page.locator('#bottom-nav [data-route="#/settings"]').click();
  await page.waitForSelector('.settings-screen');
  await page.waitForTimeout(300);
  const settings = {
    phoneSection: await page.locator('#lan-url').count(),
    lanUrlText: await page.locator('#lan-url').textContent().catch(() => null),
    offlineChip: await page.locator('.chip--warn').count(),
  };

  if (screenshotName) {
    await page.screenshot({ path: resolve(ROOT, 'tests/shots', screenshotName), fullPage: true });
  }

  results[label] = { url, home, quiz, feedback, settings, errors, consoleErrors };
  await context.close();
}

// 1) 手机 UA 通过局域网 IP（非安全上下文）
await inspect('phoneOverLan', LAN_URL, iPhone, '13-phone-lan.png');
// 2) 电脑通过 127.0.0.1（安全上下文，SW 可用）
await inspect('desktopLoopback', LOCAL_URL, { viewport: { width: 390, height: 844 } }, null);

console.log(JSON.stringify({ lanIp: LAN_IP, ...results }, null, 2));
await browser.close();
