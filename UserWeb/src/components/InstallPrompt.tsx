import { useEffect, useRef, useState } from 'react';
import { Download, Share } from 'lucide-react';
import { Button } from './ui/button';
import { installPromptMode, isDismissed, rememberDismissal, rememberShown, wasShown } from '../pwa/installPrompt';
import { currentPlatform, isIosSafari } from '../pwa/platform';
import { setPwaState, usePwaState } from '../pwa/pwaStore';
import { userIdFromAccessToken } from '../pwa/tokenUser';

/**
 * Rendered only by PendingPage and AppPage, i.e. after the profile was submitted, so it can never
 * appear on first load, login, onboarding or the account-deletion screen.
 */
export function InstallPrompt({ token }: { token: string }) {
  const userId = userIdFromAccessToken(token);
  const { installEvent, installed } = usePwaState();
  // Hidden once dismissed, or once it has already been displayed to this member (shown once).
  const [dismissed, setDismissed] = useState(() => (userId ? isDismissed(userId) || wasShown(userId) : true));
  const anchorRef = useRef<HTMLDivElement>(null);

  const mode = installPromptMode({
    installed,
    dismissed: dismissed || !userId,
    hasNativeEvent: installEvent !== null,
    iosSafari: isIosSafari(currentPlatform()),
  });

  useEffect(() => {
    if (mode && userId) rememberShown(userId);
  }, [mode, userId]);

  // Stable, always-mounted focus target so keyboard focus survives the prompt unmounting.
  const anchor = <div ref={anchorRef} tabIndex={-1} data-testid="install-focus-anchor" className="outline-none" />;
  if (!mode || !userId) return anchor;

  function dismiss() {
    if (userId) rememberDismissal(userId);
    anchorRef.current?.focus();
    setDismissed(true);
  }

  async function install() {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === 'dismissed') dismiss();
    } catch {
      // The browser refused to show its dialog; the prompt stays so the member can try again.
    }
    // A captured event can be used only once.
    anchorRef.current?.focus();
    setPwaState({ installEvent: null });
  }

  return (
    <>
    {anchor}
    <section
      aria-label="Install the app"
      data-testid="install-prompt"
      data-mode={mode}
      className="mx-auto mb-4 w-full max-w-xl rounded-2xl border border-brand-border bg-white p-4 text-left shadow-soft"
    >
      <p className="text-sm font-semibold text-brand-charcoal">Install Dhobi Matrimony</p>
      {mode === 'native' ? (
        <p className="mt-1 text-xs text-brand-muted">Add the app to your home screen for quick access.</p>
      ) : (
        <p data-testid="install-ios-instruction" className="mt-1 text-xs text-brand-muted">
          Tap the Share button <Share className="inline h-3.5 w-3.5" aria-hidden="true" /> in Safari, then choose
          &quot;Add to Home Screen&quot;.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {mode === 'native' ? (
          <Button type="button" size="sm" data-testid="install-button" onClick={() => void install()} className="gap-1.5">
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Install app
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="outline" data-testid="install-dismiss" onClick={dismiss}>
          {mode === 'native' ? 'Not now' : 'Got it'}
        </Button>
      </div>
    </section>
    </>
  );
}
