import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const DIST = resolve(ROOT, 'dist');

/** 每次测试都重新生成，确保检查的就是最终发布产物。 */
execFileSync(process.execPath, [resolve(ROOT, 'scripts/build-static.mjs')], {
  cwd: ROOT,
  stdio: 'pipe',
});

function walk(dir, base = '') {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...walk(resolve(dir, entry.name), rel));
    else if (entry.isFile()) files.push(rel);
  }
  return files;
}

test('dist 只包含运行所需文件', () => {
  const files = walk(DIST);
  assert.ok(files.includes('index.html'));
  assert.ok(files.includes('sw.js'));
  assert.ok(files.includes('manifest.webmanifest'));
  assert.ok(files.includes('_headers'));
  assert.ok(files.includes('css/styles.css'));
  assert.ok(files.includes('vendor/vexflow.js'));
  assert.ok(files.includes('js/app.js'));
  assert.ok(!files.includes('js/app.file.js'), 'file:// 专用包不应上线');
  assert.ok(!files.some((file) => file.startsWith('tests/')));
  assert.ok(!files.some((file) => file.startsWith('node_modules/')));
  assert.ok(!files.includes('package.json'));
  assert.ok(!files.includes('netlify.toml'));
  assert.ok(!files.includes('_redirects'), '哈希路由不需要 SPA 重定向');
});

test('dist/index.html 的资源全部是相对路径且存在', () => {
  const html = readFileSync(resolve(DIST, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  for (const ref of refs) {
    if (/^(#|https?:|data:|mailto:)/.test(ref)) continue;
    assert.ok(!ref.startsWith('/'), `不使用根路径引用：${ref}`);
    assert.ok(existsSync(resolve(DIST, ref.replace(/^\.\//, ''))), `资源在 dist 中：${ref}`);
  }
});

test('manifest 在 dist 中可解析，start_url 与 scope 是相对路径', () => {
  const manifest = JSON.parse(readFileSync(resolve(DIST, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.start_url, './index.html');
  assert.equal(manifest.scope, './');
  for (const icon of manifest.icons) {
    assert.ok(!icon.src.startsWith('/'), `图标使用相对路径：${icon.src}`);
    assert.ok(existsSync(resolve(DIST, icon.src.replace(/^\.\//, ''))));
  }
});

test('Service Worker 预缓存清单覆盖 dist 中的全部前端脚本', () => {
  const sw = readFileSync(resolve(DIST, 'sw.js'), 'utf8');
  const jsFiles = readdirSync(resolve(DIST, 'js')).filter((file) => file.endsWith('.js'));
  assert.ok(jsFiles.length > 0);
  for (const file of jsFiles) {
    assert.ok(sw.includes(`./js/${file}`), `预缓存包含 js/${file}`);
  }
  assert.ok(sw.includes('./css/styles.css'));
  assert.ok(sw.includes('./vendor/vexflow.js'));
  assert.ok(sw.includes('./index.html'));
  const version = sw.match(/CACHE_NAME = '([^']+)'/)?.[1];
  assert.match(version || '', /^guitar-staff-flashcards-[0-9a-f]{8}$/, '缓存版本由产物内容哈希生成');
});

test('_headers 同时覆盖根路径与 sw.js，且语法兼容 Cloudflare Pages', () => {
  const headers = readFileSync(resolve(DIST, '_headers'), 'utf8');
  const rules = headers
    .split('\n')
    .filter((line) => line.trim() && !line.trim().startsWith('#'))
    .reduce((acc, line) => {
      if (!/^\s/.test(line)) acc.push({ path: line.trim(), headers: [] });
      else acc[acc.length - 1].headers.push(line.trim());
      return acc;
    }, []);

  assert.ok(rules.length >= 4, '至少 4 条路径规则');
  for (const rule of rules) {
    assert.ok(rule.path.startsWith('/'), `路径规则以 / 开头：${rule.path}`);
    assert.ok(rule.headers.length > 0, `${rule.path} 至少一个响应头`);
    for (const header of rule.headers) {
      assert.match(header, /^[A-Za-z-]+:\s*\S/, `响应头格式：${header}`);
    }
  }

  const root = rules.find((rule) => rule.path === '/');
  assert.ok(root, '根路径单独一条规则（/ 不会命中 /index.html）');
  assert.ok(root.headers.some((h) => /^Cache-Control:\s*no-cache/i.test(h)), '根路径不缓存 HTML');

  const sw = rules.find((rule) => rule.path === '/sw.js');
  assert.ok(sw, 'sw.js 单独一条规则');
  assert.ok(sw.headers.some((h) => /no-store/i.test(h)), 'sw.js 不缓存');

  const manifest = rules.find((rule) => rule.path === '/manifest.webmanifest');
  assert.ok(manifest, 'manifest 单独一条规则');
  assert.ok(manifest.headers.some((h) => /^Content-Type:\s*application\/manifest\+json/i.test(h)));

  // 文件名没有内容哈希，脚本与样式必须每次校验，避免发版后新旧混用。
  for (const path of ['/js/*', '/css/*']) {
    const rule = rules.find((item) => item.path === path);
    assert.ok(rule, `${path} 有缓存规则`);
    assert.ok(rule.headers.some((h) => /^Cache-Control:\s*no-cache/i.test(h)), `${path} 每次校验`);
  }
});

test('构建脚本零依赖，托管平台无需安装 node_modules', () => {
  const source = readFileSync(resolve(ROOT, 'scripts/build-static.mjs'), 'utf8');
  const imports = [...source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1]);
  assert.ok(imports.length > 0);
  for (const specifier of imports) {
    assert.ok(specifier.startsWith('node:'), `只导入 Node 内置模块：${specifier}`);
  }
});

test('仓库不包含平台专属部署配置，发布参数由宿主机设置', () => {
  for (const file of ['netlify.toml', 'wrangler.toml', 'vercel.json', '_redirects']) {
    assert.ok(!existsSync(resolve(ROOT, file)), `不应存在 ${file}`);
  }
  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['build:static'], 'node scripts/build-static.mjs');
  assert.equal(pkg.scripts['build:deploy'], undefined, '旧命令名已移除');
});

test('Node 版本固定，构建可复现', () => {
  const nvmrc = readFileSync(resolve(ROOT, '.nvmrc'), 'utf8').trim();
  assert.match(nvmrc, /^20(\.\d+){0,2}$/);
  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.engines.node.includes('18'));
});

test('dist 中没有过大的单文件，适合免费静态托管', () => {
  const files = walk(DIST);
  let total = 0;
  for (const file of files) {
    const size = statSync(resolve(DIST, file)).size;
    total += size;
    assert.ok(size < 2 * 1024 * 1024, `${file} 小于 2 MB`);
  }
  assert.ok(total < 5 * 1024 * 1024, `dist 总体积 ${(total / 1024 / 1024).toFixed(2)} MB 小于 5 MB`);
});
