/* 吉他五线谱闪卡 — 离线缓存。版本变化时更新 CACHE_NAME。 */
const CACHE_NAME = 'guitar-staff-flashcards-v1.3.0';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/music.js',
  './js/levels.js',
  './js/storage.js',
  './js/quiz.js',
  './js/staff.js',
  './js/fingerboard.js',
  './js/audio.js',
  './js/theme.js',
  './js/pwa.js',
  './vendor/vexflow.js',
  './icons/icon.svg',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => {
        // 新版本先进入等待状态；由应用提示用户刷新。
      }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

async function navigationResponse(request) {
  const shell = await cachedShell();
  if (shell) return shell;
  try {
    return await fetch(request);
  } catch {
    return new Response('离线状态下还没有缓存应用，请先联网打开一次。', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

/**
 * 把「重定向过」的缓存响应重新包一层。
 *
 * 为什么要这么做：Cloudflare Pages 会把 /index.html 用 308 重定向到 /，
 * 预缓存时 fetch 默认跟随重定向，缓存下来的响应带 redirected 标记。
 * 浏览器不允许用这种响应满足一次导航请求，会直接报 net::ERR_FAILED，
 * 表现为「Service Worker 一旦接管，刷新就打不开了」。
 * 重新构造 Response 可以清掉这个标记。
 */
async function unwrapRedirect(response) {
  if (!response || !response.redirected) return response;
  const body = await response.blob();
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

/** 取应用外壳：优先用没被重定向的版本，实在没有就包一层干净的。 */
async function cachedShell() {
  const candidates = (await Promise.all([
    caches.match('./'),
    caches.match('./index.html'),
  ])).filter(Boolean);
  if (candidates.length === 0) return null;
  return candidates.find((response) => !response.redirected)
    || unwrapRedirect(candidates[0]);
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigationResponse(request));
    return;
  }
  event.respondWith(
    cacheFirst(request).catch(async () => (
      (await caches.match(request))
      || new Response('离线状态下资源不可用。', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    )),
  );
});
