import { useState } from 'react';
import { WifiOff } from 'lucide-react';
import { Button } from './ui/button';
import { applyUpdate } from '../pwa/register';
import { usePwaState } from '../pwa/pwaStore';
import { SAVE_FIRST_HINT } from '../pwa/updateController';

export const OFFLINE_MESSAGE = 'You are offline. Some features may not work until you reconnect.';

/** In normal flow at the top of the page, so it pushes content down instead of covering navigation. */
export function OfflineBanner() {
  const { online } = usePwaState();
  if (online) return null;
  return (
    <div
      role="status"
      data-testid="offline-banner"
      className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-center text-xs font-semibold text-amber-900"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{OFFLINE_MESSAGE}</span>
    </div>
  );
}

export function UpdatePrompt() {
  const { waiting } = usePwaState();
  const [hint, setHint] = useState(false);
  if (!waiting) return null;

  function onUpdate() {
    // Nothing reloads here: skip-waiting is sent, and the single reload follows controllerchange.
    setHint(applyUpdate(waiting) === 'blocked-dirty');
  }

  return (
    <section
      aria-label="Update available"
      data-testid="update-prompt"
      className="border-b border-brand-border bg-brand-primary-soft px-4 py-2.5"
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-3 text-xs">
        <span className="font-semibold text-brand-charcoal">Update available</span>
        <Button type="button" size="sm" data-testid="update-button" onClick={onUpdate}>
          Update
        </Button>
      </div>
      {hint ? (
        <p role="status" data-testid="update-save-first-hint" className="mt-2 text-center text-xs text-brand-charcoal">
          {SAVE_FIRST_HINT}
        </p>
      ) : null}
    </section>
  );
}

export function PwaStatus() {
  return (
    <>
      <OfflineBanner />
      <UpdatePrompt />
    </>
  );
}
