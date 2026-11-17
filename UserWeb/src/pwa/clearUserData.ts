import { SHELL_CACHE_PREFIX } from './cachePolicy';
import { resetDirtyForms } from './dirtyForms';
import { drafts } from './drafts';

/** Deletes every Cache Storage cache the app does not own as its static shell (SEC-32). */
export async function clearNonShellCaches(): Promise<void> {
  if (typeof caches === 'undefined') return;
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => !key.startsWith(SHELL_CACHE_PREFIX)).map((key) => caches.delete(key)));
}

/**
 * Called from clearSession, so every way a session ends (logout, logout-all, the 401 handler, the
 * deletion screen's Log out) wipes the local drafts and any non-shell cache. Best effort and silent.
 */
export function clearPwaUserData(): void {
  resetDirtyForms();
  void drafts.clearAll().catch(() => undefined);
  void clearNonShellCaches().catch(() => undefined);
}
