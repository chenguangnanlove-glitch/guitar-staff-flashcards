/**
 * 生成 js/app.file.js：把 ES modules 合成一个传统 IIFE 脚本。
 *
 * 用途：直接用 file:// 双击打开 index.html 时，浏览器会以 CORS 为由
 * 拦截 <script type="module">。这个 bundle 让「双击即用」成为可能。
 *
 * 运行：npm run build:file
 * 说明：这是开发脚本，不参与应用运行；正常 HTTP 部署仍使用 ES modules。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const ORDER = [
  'music.js',
  'levels.js',
  'storage.js',
  'quiz.js',
  'staff.js',
  'fingerboard.js',
  'audio.js',
  'theme.js',
  'pwa.js',
  'app.js',
];

const IMPORT_RE = /^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*$/gm;
const BARE_IMPORT_RE = /^\s*import\s+['"][^'"]+['"]\s*;?\s*$/gm;
const EXPORT_LIST_RE = /^\s*export\s*\{[^}]*\}\s*;?\s*$/gm;
const EXPORT_PREFIX_RE = /^(\s*)export\s+(async\s+function|function|class|const|let|var)\b/gm;

function stripModuleSyntax(source) {
  return source
    .replace(IMPORT_RE, '')
    .replace(BARE_IMPORT_RE, '')
    .replace(EXPORT_LIST_RE, '')
    .replace(EXPORT_PREFIX_RE, '$1$2');
}

function topLevelNames(source) {
  const names = new Set();
  const patterns = [
    /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm,
    /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm,
    /^class\s+([A-Za-z_$][\w$]*)/gm,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) names.add(match[1]);
  }
  return names;
}

export function buildFileBundle() {
  const seen = new Map();
  const collisions = [];
  const chunks = [];

  for (const file of ORDER) {
    const raw = readFileSync(resolve(ROOT, 'js', file), 'utf8');
    const code = stripModuleSyntax(raw);
    for (const name of topLevelNames(code)) {
      if (seen.has(name) && seen.get(name) !== file) {
        collisions.push(`${name}: ${seen.get(name)} ↔ ${file}`);
      }
      seen.set(name, file);
    }
    chunks.push(`// ---------- js/${file} ----------\n${code.trim()}\n`);
  }

  if (collisions.length) {
    throw new Error(`顶层标识符冲突，需要先重命名：\n${collisions.join('\n')}`);
  }

  return `/* 吉他五线谱闪卡 — file:// 兼容包（自动生成，请勿手改）
 * 源文件：js/*.js；生成命令：npm run build:file
 * HTTP/HTTPS 部署时 index.html 会改用 ES module，不加载此文件。
 */
(function () {
  'use strict';

${chunks.join('\n')}
})();
`;
}

const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  const bundle = buildFileBundle();
  writeFileSync(resolve(ROOT, 'js/app.file.js'), bundle);
  console.log(`已生成 js/app.file.js（${(bundle.length / 1024).toFixed(1)} KB）`);
}

