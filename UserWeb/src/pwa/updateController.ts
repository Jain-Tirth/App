export type UpdateOutcome = 'blocked-dirty' | 'applying' | 'nothing-waiting';

export interface UpdateDeps {
  /** The worker in the "waiting" state, if any. */
  waiting: { postMessage(message: unknown): void } | null;
  isDirty: () => boolean;
}

export const SAVE_FIRST_HINT = 'Save your changes first, then update.';

/**
 * Applies a waiting worker only when no step form is dirty. The page reloads in response to the
 * resulting controllerchange (see reloadOnceOnControllerChange), never from here.
 */
export function requestUpdate(deps: UpdateDeps): UpdateOutcome {
  if (!deps.waiting) return 'nothing-waiting';
  if (deps.isDirty()) return 'blocked-dirty';
  deps.waiting.postMessage({ type: 'SKIP_WAITING' });
  return 'applying';
}

/**
 * Returns a controllerchange handler that reloads at most once, and only after an update was
 * requested by a click. A first install (no previous controller) never reloads.
 */
export function createReloadGuard(reload: () => void) {
  let requested = false;
  let reloaded = false;
  return {
    markRequested(): void {
      requested = true;
    },
    onControllerChange(): void {
      if (!requested || reloaded) return;
      reloaded = true;
      reload();
    },
  };
}
