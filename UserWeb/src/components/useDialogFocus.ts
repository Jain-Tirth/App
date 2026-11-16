import { useEffect, type KeyboardEvent, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared modal behaviour: focus moves into the container on open and returns to
 * the opener on close; Tab stays inside; Escape closes unless `busy`.
 * Returns the keydown handler to put on the container.
 */
export function useDialogFocus(
  container: RefObject<HTMLElement | null>,
  onClose: () => void,
  busy = false,
): (event: KeyboardEvent<HTMLElement>) => void {
  useEffect(() => {
    const opener = document.activeElement;
    container.current?.focus();
    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [container]);

  return (event) => {
    if (event.key === 'Escape') {
      if (busy) return;
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !container.current) return;
    const items = Array.from(container.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === container.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };
}
