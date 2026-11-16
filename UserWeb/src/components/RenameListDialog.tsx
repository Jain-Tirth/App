import { useRef, useState, type FormEvent } from 'react';
import { api } from '../api';
import { hasErrorCode } from '../apiError';
import { describeError, type FriendlyError } from '../errors/messages';
import { validateListName } from '../lib/shortlists';
import type { Shortlist } from '../types';
import { ErrorNotice } from './ErrorNotice';
import { ListNameField } from './ListNameField';
import { Button } from './ui/button';
import { useDialogFocus } from './useDialogFocus';

interface RenameListDialogProps {
  token: string;
  list: Shortlist;
  onRenamed: (list: Shortlist) => void;
  onClose: () => void;
  /** The list no longer exists for this member. */
  onMissing: (error: FriendlyError) => void;
  onLogout: () => void;
}

/** Modal rename with the same name rules and messages as creating a list. */
export function RenameListDialog({
  token,
  list,
  onRenamed,
  onClose,
  onMissing,
  onLogout,
}: RenameListDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [value, setValue] = useState(list.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<FriendlyError | null>(null);
  const onKeyDown = useDialogFocus(panelRef, onClose, busy);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    setError(null);
    const check = validateListName(value);
    if (!check.ok) {
      setNameError(check.message);
      return;
    }
    setNameError(null);
    inFlight.current = true;
    setBusy(true);
    try {
      const renamed = await api.renameShortlist(token, list.id, check.name);
      onRenamed(renamed);
    } catch (err) {
      if (hasErrorCode(err, 'UNAUTHORIZED')) {
        onLogout();
        return;
      }
      const friendly = describeError(err, 'shortlists');
      if (hasErrorCode(err, 'SHORTLIST_NOT_FOUND')) {
        onMissing(friendly);
        return;
      }
      if (friendly.fields.name) setNameError(friendly.fields.name);
      else setError(friendly);
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-list-title"
        tabIndex={-1}
        data-testid="rename-dialog"
        onKeyDown={onKeyDown}
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 text-left shadow-soft focus:outline-none"
      >
        <form onSubmit={(event) => void submit(event)} className="space-y-4" noValidate>
          <h2 id="rename-list-title" className="font-serif text-xl font-bold text-brand-charcoal">
            Rename list
          </h2>
          <ErrorNotice error={error} testId="rename-error" />
          <ListNameField
            id="shortlist-rename-name"
            label="List name"
            value={value}
            error={nameError}
            disabled={busy}
            onChange={(next) => {
              setValue(next);
              setNameError(null);
            }}
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy} data-testid="rename-submit">
              {busy ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
