/**
 * theme.js — 可配置主色的 Material 浅色主题。
 * 用 JS 混合颜色，避免依赖 color-mix()，兼容更多手机浏览器。
 */

export const COLOR_PRESETS = Object.freeze([
  { name: '松绿', value: '#3d6b5c' },
  { name: '靛蓝', value: '#4b5fa8' },
  { name: '青蓝', value: '#2f6f7e' },
  { name: '琥珀', value: '#8a5a1f' },
  { name: '玫瑰', value: '#9a4a5c' },
  { name: '石墨', value: '#4f5b62' },
]);

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function parseHex(hex) {
  const value = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!value) return { r: 61, g: 107, b: 92 };
  const number = parseInt(value[1], 16);
  return {
    r: (number >> 16) & 255,
    g: (number >> 8) & 255,
    b: number & 255,
  };
}

function toHex({ r, g, b }) {
  return `#${[r, g, b].map((part) => clamp(part).toString(16).padStart(2, '0')).join('')}`;
}

function mix(from, to, amount) {
  return toHex({
    r: from.r + (to.r - from.r) * amount,
    g: from.g + (to.g - from.g) * amount,
    b: from.b + (to.b - from.b) * amount,
  });
}

function channelLuminance(value) {
  const channel = value / 255;
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function luminance({ r, g, b }) {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

function contrastRatio(a, b) {
  const light = Math.max(a, b);
  const dark = Math.min(a, b);
  return (light + 0.05) / (dark + 0.05);
}

export function applyTheme(hex) {
  const primary = parseHex(hex);
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };
  const whiteContrast = contrastRatio(luminance(primary), luminance(white));
  const blackContrast = contrastRatio(luminance(primary), luminance(black));
  const onPrimary = whiteContrast >= blackContrast ? '#ffffff' : '#14201a';
  const primaryHex = toHex(primary);
  const container = mix(primary, white, 0.86);
  const containerText = mix(primary, black, 0.7);
  const soft = mix(primary, white, 0.93);
  const outline = mix(primary, white, 0.58);
  const strong = mix(primary, black, 0.18);

  const root = document.documentElement;
  root.style.setProperty('--primary', primaryHex);
  root.style.setProperty('--on-primary', onPrimary);
  root.style.setProperty('--primary-container', container);
  root.style.setProperty('--on-primary-container', containerText);
  root.style.setProperty('--primary-soft', soft);
  root.style.setProperty('--primary-outline', outline);
  root.style.setProperty('--primary-strong', strong);
  root.style.setProperty('--primary-rgb', `${primary.r}, ${primary.g}, ${primary.b}`);

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute('content', primaryHex);

  return { primary: primaryHex, onPrimary, container, containerText, soft, outline, strong };
}
