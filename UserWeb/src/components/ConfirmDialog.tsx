import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { FriendlyError } from '../errors/messages';
import { ErrorNotice } from './ErrorNotice';
import { Button } from './ui/button';

interface ConfirmDialogProps {
  /** The question, also the dialog's accessible name. */
  title: string;
  confirmLabel: string;
  /** Label of the dismiss button. Defaults to "Cancel". */
  cancelLabel?: string;
  busyLabel: string;
  busy: boolean;
  error: FriendlyError | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Modal confirmation. Focus moves to Cancel on open and returns to the trigger
 * on close; Tab stays inside; Escape cancels unless a request is in flight.
 */
export function ConfirmDialog({
  title,
  confirmLabel,
  cancelLabel = 'Cancel',
  busyLabel,
  busy,
  error,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const trigger = document.activeElement;
    cancelRef.current?.focus();
    return () => {
      if (trigger instanceof HTMLElement) trigger.focus();
    };
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !busy) {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const first = cancelRef.current;
    const last = confirmRef.current;
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        data-testid="confirm-dialog"
        onKeyDown={onKeyDown}
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 text-left shadow-soft"
      >
        <h2 id="confirm-title" className="font-serif text-xl font-bold text-brand-charcoal">
          {title}
        </h2>
        <ErrorNotice error={error} testId="confirm-error" />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            data-testid="confirm-cancel"
            disabled={busy}
            onClick={onClose}
          >
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            data-testid="confirm-ok"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? busyLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
