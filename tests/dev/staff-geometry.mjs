/**
 * 输出页面里谱表 SVG 的几何信息，用于检查布局。
 */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const requireFrom = createRequire(import.meta.url);
const { chromium } = requireFrom('playwright-core');

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const PORT = 8082;
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
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
await page.goto(`${ORIGIN}/?e2e=1`, { waitUntil: 'networkidle' });
await page.waitForSelector('#hero-staff svg');
await page.waitForTimeout(500);

const geometry = await page.evaluate(() => {
  const svg = document.querySelector('#hero-staff svg');
  const paths = [...svg.querySelectorAll('path')].map((path) => {
    const box = path.getBBox();
    return [Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height)];
  });
  const rect = svg.getBoundingClientRect();
  return {
    svgCss: [Math.round(rect.width), Math.round(rect.height)],
    viewBox: svg.getAttribute('viewBox'),
    paths,
  };
});
console.log(JSON.stringify(geometry));
await browser.close();
server.close();
