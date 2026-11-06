import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const BASE = 'http://localhost/';

function pngSize(path) {
  const buffer = readFileSync(path);
  assert.equal(buffer.toString('ascii', 1, 4), 'PNG');
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

test('manifest 只在 http(s) 下注入，file:// 不会请求不存在的清单', () => {
  const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
  assert.ok(html.includes("location.protocol !== 'file:'"));
  assert.ok(html.includes("manifest.href = './manifest.webmanifest'"));
  assert.equal(
    /<link[^>]+rel=["']manifest["']/.test(html),
    false,
    '不应静态写死 manifest link',
  );
});

test('manifest 字段与图标文件完整', () => {
  const manifest = JSON.parse(readFileSync(resolve(ROOT, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.name, '吉他五线谱闪卡');
  assert.equal(manifest.short_name, '吉他闪卡');
  assert.equal(manifest.lang, 'zh-CN');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './index.html');
  assert.equal(manifest.scope, './');
  assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512'));
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'));

  for (const icon of manifest.icons) {
    const path = resolve(ROOT, icon.src.replace(/^\.\//, ''));
    assert.ok(existsSync(path), `图标存在：${icon.src}`);
    if (icon.type === 'image/png') {
      assert.deepEqual(pngSize(path), {
        width: Number(icon.sizes.split('x')[0]),
        height: Number(icon.sizes.split('x')[1]),
      });
    }
  }
});

test('index.html 引用的本地资源都存在', () => {
  const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  for (const ref of refs) {
    if (/^(#|https?:|data:)/.test(ref)) continue;
    const path = resolve(ROOT, ref.replace(/^\.\//, ''));
    assert.ok(existsSync(path), `资源存在：${ref}`);
  }
});

test('Service Worker 能安装、命中导航缓存并清理旧缓存', async () => {
  const source = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
  const listeners = {};
  const stores = new Map();
  const requests = [];

  function normalize(request) {
    const raw = typeof request === 'string' ? request : request.url;
    const url = new URL(raw, BASE);
    url.hash = '';
    return url.href;
  }

  const cacheApi = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async addAll(urls) {
          for (const url of urls) {
            const full = normalize(url);
            requests.push(full);
            store.set(full, new Response(`cached:${full}`, { status: 200 }));
          }
        },
        async put(request, response) {
          store.set(normalize(request), response);
        },
        async match(request) {
          return store.get(normalize(request));
        },
      };
    },
    async match(request) {
      for (const store of stores.values()) {
        const found = store.get(normalize(request));
        if (found) return found;
      }
      return undefined;
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name) {
      return stores.delete(name);
    },
  };

  const context = {
    self: {
      location: { origin: 'http://localhost' },
      addEventListener(type, handler) { listeners[type] = handler; },
      skipWaiting() { context.skipped = true; },
      clients: { claim() { return Promise.resolve(); } },
    },
    caches: cacheApi,
    fetch: async () => { throw new Error('offline'); },
    Response,
    Request,
    URL,
    console,
  };
  vm.createContext(context);
  vm.runInContext(source, context);

  assert.equal(typeof listeners.install, 'function');
  assert.equal(typeof listeners.fetch, 'function');
  assert.equal(typeof listeners.activate, 'function');

  let installPromise;
  listeners.install({ waitUntil(promise) { installPromise = promise; } });
  await installPromise;
  assert.ok(requests.length > 10);
  assert.ok(requests.some((url) => url.endsWith('/vendor/vexflow.js')));
  assert.ok(requests.some((url) => url.endsWith('/js/app.js')));
  assert.ok(requests.some((url) => url.endsWith('/icons/icon-512.png')));

  let navigationPromise;
  listeners.fetch({
    request: { method: 'GET', mode: 'navigate', url: `${BASE}index.html#/quiz/p1-upper` },
    respondWith(promise) { navigationPromise = promise; },
  });
  const navigationResponse = await navigationPromise;
  assert.ok(navigationResponse);
  assert.match(await navigationResponse.text(), /cached:/);

  stores.set('old-cache', new Map([['x', new Response('old')]]));
  let activatePromise;
  listeners.activate({ waitUntil(promise) { activatePromise = promise; } });
  await activatePromise;
  assert.equal(stores.has('old-cache'), false);

  listeners.message({ data: { type: 'SKIP_WAITING' } });
  assert.equal(context.skipped, true);
});

test('Service Worker 的缓存清单覆盖全部应用脚本与图标', () => {
  const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
  const jsFiles = readdirSync(resolve(ROOT, 'js'))
    .filter((file) => file.endsWith('.js'))
    // app.file.js 只在 file:// 下使用，HTTP 部署不会请求，无需预缓存。
    .filter((file) => file !== 'app.file.js');
  for (const file of jsFiles) {
    assert.ok(sw.includes(`./js/${file}`), `预缓存包含 js/${file}`);
  }
  assert.ok(sw.includes('./css/styles.css'));
  assert.ok(sw.includes('./vendor/vexflow.js'));
  for (const icon of readdirSync(resolve(ROOT, 'icons'))) {
    assert.ok(sw.includes(`./icons/${icon}`), `预缓存包含 icons/${icon}`);
  }
});

test('导航不使用被重定向过的缓存响应（Cloudflare 把 /index.html 308 到 /）', async () => {
  const source = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
  const listeners = {};
  const stores = new Map();
  const cacheName = 'test-cache';

  function normalize(request) {
    const raw = typeof request === 'string' ? request : request.url;
    const url = new URL(raw, BASE);
    url.hash = '';
    return url.href;
  }

  const store = new Map();
  stores.set(cacheName, store);

  const cacheApi = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const inner = stores.get(name);
      return {
        async addAll(urls) {
          for (const url of urls) inner.set(normalize(url), new Response(`cached:${url}`, { status: 200 }));
        },
        async put(request, response) { inner.set(normalize(request), response); },
        async match(request) { return inner.get(normalize(request)); },
      };
    },
    async match(request) {
      for (const inner of stores.values()) {
        const found = inner.get(normalize(request));
        if (found) return found;
      }
      return undefined;
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };

  const context = {
    self: {
      location: { origin: 'http://localhost' },
      addEventListener(type, handler) { listeners[type] = handler; },
      skipWaiting() {},
      clients: { claim() { return Promise.resolve(); } },
    },
    caches: cacheApi,
    fetch: async () => { throw new Error('offline'); },
    Response,
    Request,
    URL,
    console,
  };
  vm.createContext(context);
  vm.runInContext(source, context);

  // 模拟 Cloudflare：/index.html 是跟随 308 后得到的响应，带 redirected 标记。
  const redirected = new Response('shell-body', { status: 200 });
  Object.defineProperty(redirected, 'redirected', { value: true });
  store.set('http://localhost/index.html', redirected);
  store.set('http://localhost/', new Response('shell-body', { status: 200 }));

  async function navigate(url) {
    let promise;
    listeners.fetch({
      request: { method: 'GET', mode: 'navigate', url },
      respondWith(value) { promise = value; },
    });
    return promise;
  }

  const first = await navigate(`${BASE}`);
  assert.equal(first.redirected, false, '优先使用未被重定向的缓存条目');
  assert.equal(await first.text(), 'shell-body');

  // 只剩被重定向的条目时，也必须返回干净的响应，否则浏览器会 ERR_FAILED。
  store.delete('http://localhost/');
  const second = await navigate(`${BASE}`);
  assert.equal(second.redirected, false, '重定向响应需要重新包一层');
  assert.equal(await second.text(), 'shell-body');
});
