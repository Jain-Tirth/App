import { setPwaState } from './pwaStore';
import { createReloadGuard, requestUpdate } from './updateController';
import { anyFormDirty } from './dirtyForms';

const UPDATE_CHECK_MS = 60 * 60 * 1000;

const reloadGuard = createReloadGuard(() => window.location.reload());

/** Returns 'applying' or 'blocked-dirty' for the update prompt's click handler. */
export function applyUpdate(waiting: ServiceWorker | null) {
  const outcome = requestUpdate({ waiting, isDirty: anyFormDirty });
  if (outcome === 'applying') reloadGuard.markRequested();
  return outcome;
}

function watch(registration: ServiceWorkerRegistration): void {
  const publish = () => setPwaState({ waiting: registration.waiting });
  publish();
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    worker?.addEventListener('statechange', () => {
      // A worker that installs while another controls the page is an update; the first install is not.
      if (worker.state === 'installed' && navigator.serviceWorker.controller) publish();
    });
  });
}

/** Production only. The worker waits after an update; nothing reloads until the member clicks Update. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => reloadGuard.onControllerChange());
  const register = () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        watch(registration);
        setInterval(() => void registration.update().catch(() => undefined), UPDATE_CHECK_MS);
      })
      .catch(() => undefined);
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register);
}
