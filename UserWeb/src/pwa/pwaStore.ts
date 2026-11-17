import { useSyncExternalStore } from 'react';
import { isStandalone } from './platform';

/** Minimal external store for PWA state shared by the banner, the prompts and the registration code. */
export interface PwaState {
  online: boolean;
  waiting: ServiceWorker | null;
  installEvent: BeforeInstallPromptEventLike | null;
  installed: boolean;
}

export interface BeforeInstallPromptEventLike extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const INSTALLED_KEY = 'pwa_installed';

function readInstalled(): boolean {
  try {
    return localStorage.getItem(INSTALLED_KEY) === '1';
  } catch {
    return false;
  }
}

let state: PwaState = {
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  waiting: null,
  installEvent: null,
  installed: false,
};
const listeners = new Set<() => void>();

export function setPwaState(patch: Partial<PwaState>): void {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

export function getPwaState(): PwaState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePwaState(): PwaState {
  return useSyncExternalStore(subscribe, getPwaState, getPwaState);
}

let listening = false;

/** Attaches the window listeners once. Must run at startup so beforeinstallprompt is not missed. */
export function startPwaListeners(): void {
  if (listening) return;
  listening = true;
  setPwaState({ installed: readInstalled() || isStandalone(), online: navigator.onLine });
  window.addEventListener('online', () => setPwaState({ online: true }));
  window.addEventListener('offline', () => setPwaState({ online: false }));
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    setPwaState({ installEvent: event as BeforeInstallPromptEventLike });
  });
  window.addEventListener('appinstalled', () => {
    try {
      localStorage.setItem(INSTALLED_KEY, '1');
    } catch {
      // Storage unavailable: the in-memory flag still hides the prompt for this page.
    }
    setPwaState({ installed: true, installEvent: null });
  });
}
