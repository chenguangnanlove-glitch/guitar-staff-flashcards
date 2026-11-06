/**
 * 验证「听一下」播放的是实际音高（而不是谱上高八度）。
 * 需要 playwright-core + 本机 Chrome。
 */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const requireFrom = createRequire(import.meta.url);
const { chromium } = requireFrom('playwright-core');

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const PORT = 8084;
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
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
await page.goto(`${ORIGIN}/?e2e=1`, { waitUntil: 'networkidle' });
await page.waitForSelector('.home-screen');

// 捕获振荡器实际发声频率：在 start() 时读取，此时频率已经设置好。
await page.evaluate(() => {
  window.__freqs = [];
  const original = OscillatorNode.prototype.start;
  OscillatorNode.prototype.start = function patched(...args) {
    window.__freqs.push(this.frequency.value);
    return original.apply(this, args);
  };
});

await page.locator('.level-card[data-level="p1-upper"]').click();
await page.waitForSelector('.quiz-screen');
const note = await page.evaluate(() => {
  const current = window.__gsf.session.current.note;
  return {
    string: current.string,
    fret: current.fret,
    actualMidi: current.actualMidi,
    writtenMidi: current.writtenMidi,
    position: current.positionLabel,
    written: current.pitch.fullName,
  };
});

await page.locator('.answer-btn').first().click();
await page.waitForSelector('.feedback');
await page.locator('[data-action="listen"]').click();
await page.waitForTimeout(700);

const freqs = await page.evaluate(() => window.__freqs);
const expectedActual = 440 * 2 ** ((note.actualMidi - 69) / 12);
const expectedWritten = 440 * 2 ** ((note.writtenMidi - 69) / 12);
const closest = freqs.reduce((best, value) => (
  Math.abs(value - expectedActual) < Math.abs(best - expectedActual) ? value : best
), freqs[0] ?? 0);

// 低音弦：6 弦空弦 E2 应播放约 82.41 Hz
await page.evaluate(async () => {
  window.__freqs = [];
  const module = await import('./js/audio.js');
  await module.playMidi(40, { duration: 0.35, volume: 0.1 });
});
const lowFreqs = await page.evaluate(() => window.__freqs);
const lowest = 440 * 2 ** ((40 - 69) / 12);

console.log(JSON.stringify({
  note,
  expectedActualHz: Number(expectedActual.toFixed(2)),
  expectedWrittenHz: Number(expectedWritten.toFixed(2)),
  captured: freqs.map((value) => Number(value.toFixed(2))),
  played: Number(closest.toFixed(2)),
  matchesActual: Math.abs(closest - expectedActual) < 0.5,
  matchesWrittenInstead: Math.abs(closest - expectedWritten) < 0.5,
  lowE: {
    expectedHz: Number(lowest.toFixed(2)),
    captured: lowFreqs.map((value) => Number(value.toFixed(2))),
    matches: lowFreqs.some((value) => Math.abs(value - lowest) < 0.5),
  },
}, null, 2));

await browser.close();
server.close();
