/**
 * pwa.js — Service Worker 注册、更新提示与安装提示。
 */

let waitingWorker = null;
let updateCallback = null;
let hadController = false;
let reloading = false;
let swReady = false;

export function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

/**
 * 离线能力需要安全上下文：HTTPS、localhost 或 127.0.0.1。
 * 手机通过局域网 http://192.168.x.x 访问时不是安全上下文，
 * Service Worker 会被浏览器直接拒绝，这里先判断再注册。
 */
export function canUseOffline() {
  if (!('serviceWorker' in navigator)) return false;
  if (typeof isSecureContext === 'boolean') return isSecureContext;
  return location.protocol === 'https:'
    || location.hostname === 'localhost'
    || location.hostname === '127.0.0.1';
}

/** 只有 Service Worker 真正安装并接管页面后，才对外宣称「离线可用」。 */
export function isOfflineReady() {
  if (swReady) return true;
  return Boolean(navigator.serviceWorker?.controller);
}

/** 本机通过 HTTP 访问时，读取服务器注入的局域网地址。 */
export function getLanUrl() {
  return document.querySelector('meta[name="gsf-lan-url"]')?.getAttribute('content') || null;
}

export function registerServiceWorker({ onUpdateReady, onReady } = {}) {
  updateCallback = onUpdateReady || null;
  if (!canUseOffline()) return;

  hadController = Boolean(navigator.serviceWorker.controller);

  const markReady = () => {
    if (swReady) return;
    swReady = true;
    onReady?.();
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !hadController) return;
    reloading = true;
    location.reload();
  });

  navigator.serviceWorker.register('./sw.js', { scope: './' }).then((registration) => {
    if (navigator.serviceWorker.controller) {
      markReady();
    } else {
      navigator.serviceWorker.ready.then(markReady).catch(() => {});
    }

    if (registration.waiting && navigator.serviceWorker.controller) {
      waitingWorker = registration.waiting;
      updateCallback?.();
    }

    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          waitingWorker = worker;
          updateCallback?.();
        }
      });
    });

    // 每次回到应用时检查一次更新（浏览器允许时）。
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update().catch(() => {});
    });
  }).catch(() => {
    // 本地 file:// 或浏览器不支持时静默失败，不影响应用本身。
  });
}

export function applyServiceWorkerUpdate() {
  if (!waitingWorker) {
    location.reload();
    return;
  }
  waitingWorker.postMessage({ type: 'SKIP_WAITING' });
}

export function setupInstallPrompt(onAvailable) {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    onAvailable?.(event);
  });
  window.addEventListener('appinstalled', () => {
    onAvailable?.(null);
  });
}

export async function promptInstall(deferredPrompt) {
  if (!deferredPrompt) return false;
  try {
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice.catch(() => null);
    return choice?.outcome === 'accepted';
  } catch {
    return false;
  }
}
