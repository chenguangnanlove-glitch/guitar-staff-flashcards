import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { buildFileBundle } from '../scripts/build-file-bundle.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);

test('file:// 兼容包与源码同步（改动源码后请运行 npm run build:file）', () => {
  const onDisk = readFileSync(resolve(ROOT, 'js/app.file.js'), 'utf8');
  const expected = buildFileBundle();
  assert.equal(
    onDisk,
    expected,
    'js/app.file.js 已过期：请运行 npm run build:file 重新生成',
  );
});

test('兼容包包含全部应用模块且不含模块语法', () => {
  const bundle = readFileSync(resolve(ROOT, 'js/app.file.js'), 'utf8');
  for (const file of [
    'music.js', 'levels.js', 'storage.js', 'quiz.js', 'staff.js',
    'fingerboard.js', 'audio.js', 'theme.js', 'pwa.js', 'app.js',
  ]) {
    assert.ok(bundle.includes(`// ---------- js/${file} ----------`), `包含 ${file}`);
  }
  assert.equal(/^\s*import\s/m.test(bundle), false, '不应残留 import 语句');
  assert.equal(/^\s*export\s/m.test(bundle), false, '不应残留 export 语句');
  assert.ok(bundle.includes("(function () {\n  'use strict';"));
});

test('index.html 按协议选择模块或兼容包', () => {
  const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
  assert.ok(html.includes("location.protocol === 'file:'"));
  assert.ok(html.includes("'./js/app.file.js'"));
  assert.ok(html.includes("'./js/app.js'"));
  assert.ok(html.includes("script.type = 'module'"));
});
