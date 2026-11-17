export type InstallPromptMode = 'native' | 'ios-manual' | null;

export interface InstallPromptInputs {
  installed: boolean;
  dismissed: boolean;
  /** A captured beforeinstallprompt event is available (Chromium). */
  hasNativeEvent: boolean;
  iosSafari: boolean;
}

/** Which install prompt to show, if any. Installed or dismissed always wins over availability. */
export function installPromptMode(inputs: InstallPromptInputs): InstallPromptMode {
  if (inputs.installed || inputs.dismissed) return null;
  if (inputs.hasNativeEvent) return 'native';
  if (inputs.iosSafari) return 'ios-manual';
  return null;
}

/** Dismissal is remembered per member id, in localStorage, and survives logout on purpose. */
export function dismissalKey(userId: string): string {
  return `pwa_install_dismissed:${userId}`;
}

export function isDismissed(userId: string): boolean {
  try {
    return localStorage.getItem(dismissalKey(userId)) === '1';
  } catch {
    return false;
  }
}

/** The prompt is shown once per member: this flag is set on first display. */
export function shownKey(userId: string): string {
  return `pwa_install_shown:${userId}`;
}

export function wasShown(userId: string): boolean {
  try {
    return localStorage.getItem(shownKey(userId)) === '1';
  } catch {
    return false;
  }
}

export function rememberShown(userId: string): void {
  try {
    localStorage.setItem(shownKey(userId), '1');
  } catch {
    // Storage unavailable: the prompt is limited to this page view.
  }
}

export function rememberDismissal(userId: string): void {
  try {
    localStorage.setItem(dismissalKey(userId), '1');
  } catch {
    // Storage unavailable: the prompt hides for this page view only.
  }
}
