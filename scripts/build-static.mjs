/**
 * 生成静态发布目录 dist/，供 Cloudflare Pages、Netlify 等静态托管使用。
 *
 * 项目本身是纯静态的，不需要打包器；这个脚本只做三件事：
 * 1. 把运行所需文件复制到 dist/（排除 node_modules、tests、脚本和 file:// 专用的 app.file.js）。
 * 2. 写入 _headers（Cloudflare Pages 与 Netlify 都识别这个文件）。
 * 3. 按产物内容哈希写入 Service Worker 缓存版本，避免上线后老用户拿不到新代码。
 *
 * 零依赖，只用 Node 内置模块，因此托管平台的构建环境不需要 npm install。
 *
 * 用法：npm run build:static
 */
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST = join(ROOT, 'dist');

const STATIC_FILES = ['index.html', 'manifest.webmanifest', 'sw.js'];
const STATIC_DIRS = ['css', 'vendor', 'icons'];

// Cloudflare Pages 与 Netlify 的 _headers 语法一致：路径行 + 缩进的 Header: value。
// `/` 必须单独写一条：根路径请求不会命中 `/index.html` 规则。
const HEADERS = `# 由 scripts/build-static.mjs 生成，请勿手改。
# 语法兼容 Cloudflare Pages 与 Netlify。
/
  Cache-Control: no-cache

/index.html
  Cache-Control: no-cache

/sw.js
  Cache-Control: no-cache, no-store, must-revalidate

/manifest.webmanifest
  Content-Type: application/manifest+json; charset=utf-8
  Cache-Control: public, max-age=3600

# 脚本与样式没有文件名哈希，必须每次校验，否则发版后可能新旧混用。
/js/*
  Cache-Control: no-cache

/css/*
  Cache-Control: no-cache

# 图标很少变动，可以放心缓存一天。
/icons/*
  Cache-Control: public, max-age=86400
`;

async function assertInsideRoot(path) {
  if (path !== DIST && !path.startsWith(DIST + sep)) {
    throw new Error(`拒绝写入 dist 之外的路径：${path}`);
  }
}

async function copyDir(name, { exclude = [] } = {}) {
  const from = join(ROOT, name);
  const to = join(DIST, name);
  await cp(from, to, {
    recursive: true,
    filter: (source) => !exclude.some((suffix) => source.endsWith(suffix)),
  });
}

async function totalBytes(dir) {
  let bytes = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) bytes += await totalBytes(path);
    else if (entry.isFile()) bytes += (await stat(path)).size;
  }
  return bytes;
}

async function countFiles(dir) {
  let count = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) count += await countFiles(path);
    else if (entry.isFile()) count += 1;
  }
  return count;
}

async function listFiles(dir, base = '') {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await listFiles(join(dir, entry.name), rel));
    else if (entry.isFile()) files.push(rel);
  }
  return files.sort();
}

/**
 * 用产物内容哈希生成缓存版本。
 *
 * 这样不需要人工记得改 sw.js 的 CACHE_NAME：内容没变版本就不变（不会反复提示更新），
 * 内容一变版本就变（老用户会收到「新版本已准备好」并刷新到新缓存）。
 */
async function stampServiceWorkerVersion() {
  const files = (await listFiles(DIST)).filter((file) => file !== 'sw.js');
  const digest = createHash('sha256');
  for (const file of files) {
    digest.update(file);
    digest.update(await readFile(join(DIST, file)));
  }

  const swPath = join(DIST, 'sw.js');
  const source = await readFile(swPath, 'utf8');

  // sw.js 自身也要参与哈希，否则「只改 Service Worker」的发版不会换版本号，
  // 老用户的等待中新 worker 会沿用同名缓存，等于没有更新。
  // 先把版本行归一化，避免哈希结果自我依赖。
  digest.update('sw.js');
  digest.update(source.replace(/const CACHE_NAME = '[^']+';/, "const CACHE_NAME = '';"));

  const buildId = digest.digest('hex').slice(0, 8);
  const versioned = source.replace(
    /const CACHE_NAME = '[^']+';/,
    `const CACHE_NAME = 'guitar-staff-flashcards-${buildId}';`,
  );
  if (versioned === source) {
    throw new Error('sw.js 中没有找到 CACHE_NAME，无法写入构建版本。');
  }
  await writeFile(swPath, versioned, 'utf8');
  return buildId;
}

await assertInsideRoot(DIST);
await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });

for (const file of STATIC_FILES) {
  await cp(join(ROOT, file), join(DIST, file));
}

for (const dir of STATIC_DIRS) {
  await copyDir(dir);
}

// app.file.js 只在 file:// 下使用，线上不会请求，避免白占体积。
await copyDir('js', { exclude: ['app.file.js'] });

await writeFile(join(DIST, '_headers'), HEADERS, 'utf8');
const buildId = await stampServiceWorkerVersion();

const files = await countFiles(DIST);
const bytes = await totalBytes(DIST);
console.log(`dist/ 已生成：${files} 个文件，${(bytes / 1024 / 1024).toFixed(2)} MB`);
console.log(`Service Worker 缓存版本：guitar-staff-flashcards-${buildId}`);
console.log('发布目录：dist/（入口 dist/index.html）');
