export interface PlatformInfo {
  userAgent: string;
  /** navigator.platform */
  platform?: string;
  maxTouchPoints?: number;
}

const OTHER_IOS_BROWSERS = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|DuckDuckGo/i;

/**
 * True for Safari on iPhone, iPad and iPod (including iPadOS, which reports a Mac user agent but
 * has touch points). Other browsers on iOS cannot add to the home screen from their menus the same
 * way, so they are not told to.
 */
export function isIosSafari(info: PlatformInfo): boolean {
  const ua = info.userAgent;
  const iosDevice =
    /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (info.maxTouchPoints ?? 0) > 1);
  if (!iosDevice) return false;
  if (OTHER_IOS_BROWSERS.test(ua)) return false;
  return /Safari/.test(ua) && /AppleWebKit/.test(ua);
}

export function currentPlatform(): PlatformInfo {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
  };
}

/** True when the app is already running as an installed app. */
export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}
