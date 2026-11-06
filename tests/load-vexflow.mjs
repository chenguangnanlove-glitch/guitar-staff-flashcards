/**
 * 在 Node/jsdom 中加载 VexFlow 的 UMD 包。
 * 直接用 require 会把 .js 当成 ESM（项目 package.json type=module），
 * 所以在 vm 沙箱里提供 CommonJS 外壳，同时共享 jsdom 的 DOM。
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SOURCE = readFileSync(new URL('../vendor/vexflow.js', import.meta.url), 'utf8');

export function loadVexFlow(dom) {
  const sandbox = {
    module: { exports: {} },
    exports: {},
    window: dom.window,
    self: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    location: dom.window.location,
    FontFace: dom.window.FontFace,
    HTMLElement: dom.window.HTMLElement,
    SVGElement: dom.window.SVGElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    HTMLCanvasElement: dom.window.HTMLCanvasElement,
    console,
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    performance,
    structuredClone,
    Math,
    Date,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    TypeError,
    RangeError,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox, { filename: 'vendor/vexflow.js' });
  const VF = sandbox.module.exports;
  dom.window.VexFlow = VF;
  return VF;
}
