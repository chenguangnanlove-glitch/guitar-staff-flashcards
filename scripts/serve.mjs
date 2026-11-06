/**
 * 零依赖静态服务器。用于本地开发和手机预览；Netlify 直接托管静态文件。
 *
 * 用法：
 *   npm start                 # 监听 0.0.0.0，同一 Wi-Fi 下手机可访问
 *   HOST=127.0.0.1 npm start  # 只允许本机访问
 *   PORT=9000 npm start
 */
import http from 'node:http';
import os from 'node:os';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

/** 取第一个非回环的 IPv4 地址，用于手机访问。 */
function lanAddress() {
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    if (name.startsWith('utun') || name.startsWith('bridge')) continue;
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) return entry.address;
    }
  }
  return null;
}

const LAN_IP = lanAddress();
const LAN_URL = LAN_IP ? `http://${LAN_IP}:${PORT}/` : null;
const LOCAL_URL = `http://127.0.0.1:${PORT}/`;

/**
 * 给 index.html 注入局域网地址，让应用能在设置页显示「手机访问」。
 * 只在通过 HTTP 访问时注入；file:// 与服务端无关。
 */
function injectLanMeta(html, requestHost) {
  if (!LAN_URL) return html;
  const safe = LAN_URL.replace(/"/g, '&quot;');
  const tag = `<meta name="gsf-lan-url" content="${safe}">`;
  const servedFrom = requestHost || '';
  // 只有从本机访问时才提示手机地址，避免手机自己看到自己的地址。
  if (servedFrom && !/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(servedFrom)) {
    return html;
  }
  return html.replace('</head>', `  ${tag}\n</head>`);
}

const server = http.createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }

  let filePath = normalize(join(ROOT, pathname));
  if (!filePath.startsWith(ROOT + sep) && filePath !== ROOT) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html');
  }
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('404 Not Found');
    return;
  }

  const extension = extname(filePath).toLowerCase();
  const headers = {
    'Content-Type': MIME[extension] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
  };

  if (extension === '.html') {
    const html = injectLanMeta(readFileSync(filePath, 'utf8'), request.headers.host);
    headers['Content-Length'] = Buffer.byteLength(html);
    response.writeHead(200, headers);
    response.end(html);
    return;
  }

  response.writeHead(200, headers);
  createReadStream(filePath).pipe(response);
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  吉他五线谱闪卡');
  console.log('');
  console.log(`  电脑打开：${LOCAL_URL}`);
  if (LAN_URL) {
    console.log(`  手机打开：${LAN_URL}`);
    console.log('            （手机与电脑需连同一个 Wi-Fi）');
  }
  if (HOST === '127.0.0.1') {
    console.log('');
    console.log('  当前只监听本机，手机无法访问。要去掉 HOST=127.0.0.1 重新启动。');
  }
  console.log('');
  console.log('  按 Ctrl+C 停止。');
  console.log('');
});
