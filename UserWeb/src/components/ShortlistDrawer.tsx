import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { api } from '../api';
import { hasErrorCode } from '../apiError';
import { describeError, type FriendlyError } from '../errors/messages';
import {
  deriveList,
  hasList,
  keepOnly,
  membershipSnapshot,
  noteEmptyList,
  noteMembership,
} from '../lib/shortlistCache';
import { isMember, orderLists, validateListName, type MembershipMap } from '../lib/shortlists';
import type { Shortlist } from '../types';
import { ErrorNotice } from './ErrorNotice';
import { ListNameField } from './ListNameField';
import { Button } from './ui/button';
import { useDialogFocus } from './useDialogFocus';

export const NOT_NOTIFIED_TEXT = 'People you shortlist are not notified.';

interface ShortlistDrawerProps {
  token: string;
  profileRef: string;
  onClose: () => void;
  onLogout: () => void;
}

/**
 * Side drawer (a bottom sheet on narrow screens) with one checkbox per list.
 * Membership comes from the session cache, which is filled by walking each list.
 */
export function ShortlistDrawer({ token, profileRef, onClose, onLogout }: ShortlistDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onKeyDown = useDialogFocus(panelRef, onClose);
  const alive = useRef(true);
  const busyLists = useRef(new Set<string>());
  const creating = useRef(false);

  const [lists, setLists] = useState<Shortlist[]>([]);
  const [members, setMembers] = useState<MembershipMap>({});
  const [deriving, setDeriving] = useState(true);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [error, setError] = useState<FriendlyError | null>(null);

  const [nameValue, setNameValue] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setDeriving(true);
    try {
      const fetched = orderLists(await api.listShortlists(token));
      keepOnly(
        token,
        fetched.map((list) => list.id),
      );
      await Promise.all(
        fetched.filter((list) => !hasList(token, list.id)).map((list) => deriveList(token, list.id)),
      );
      if (!alive.current) return;
      setLists(fetched);
      setMembers(membershipSnapshot(token));
    } catch (err) {
      if (!alive.current) return;
      if (hasErrorCode(err, 'UNAUTHORIZED')) {
        onLogout();
        return;
      }
      setError(describeError(err, 'shortlists'));
    } finally {
      if (alive.current) setDeriving(false);
    }
  }, [token, onLogout]);

  useEffect(() => {
    void load();
  }, [load]);

  function setBusy(id: string, on: boolean) {
    if (on) busyLists.current.add(id);
    else busyLists.current.delete(id);
    setBusyIds([...busyLists.current]);
  }

  async function toggle(list: Shortlist, checked: boolean) {
    if (busyLists.current.has(list.id)) return;
    setBusy(list.id, true);
    setError(null);
    try {
      if (checked) await api.addToShortlist(token, list.id, profileRef);
      else await api.removeFromShortlist(token, list.id, profileRef);
      noteMembership(token, list.id, profileRef, checked);
      if (alive.current) setMembers(membershipSnapshot(token));
    } catch (err) {
      if (hasErrorCode(err, 'UNAUTHORIZED')) {
        onLogout();
        return;
      }
      if (!alive.current) return;
      setError(describeError(err, 'shortlists'));
      if (hasErrorCode(err, 'SHORTLIST_NOT_FOUND')) void load();
    } finally {
      busyLists.current.delete(list.id);
      if (alive.current) setBusyIds([...busyLists.current]);
    }
  }

  async function createList(event: FormEvent) {
    event.preventDefault();
    if (creating.current) return;
    setError(null);
    const check = validateListName(nameValue);
    if (!check.ok) {
      setNameError(check.message);
      return;
    }
    setNameError(null);
    creating.current = true;
    setCreateBusy(true);
    try {
      const created = await api.createShortlist(token, check.name);
      noteEmptyList(token, created.id);
      if (!alive.current) return;
      setLists((existing) => orderLists([...existing, created]));
      setMembers(membershipSnapshot(token));
      setNameValue('');
    } catch (err) {
      if (hasErrorCode(err, 'UNAUTHORIZED')) {
        onLogout();
        return;
      }
      if (!alive.current) return;
      const friendly = describeError(err, 'shortlists');
      if (friendly.fields.name) setNameError(friendly.fields.name);
      else setError(friendly);
    } finally {
      creating.current = false;
      if (alive.current) setCreateBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-stretch sm:justify-end"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortlist-drawer-title"
        tabIndex={-1}
        data-testid="shortlist-drawer"
        onKeyDown={onKeyDown}
        className="max-h-[90vh] w-full space-y-5 overflow-y-auto rounded-t-2xl bg-white p-6 text-left shadow-soft focus:outline-none sm:max-h-none sm:max-w-md sm:rounded-none"
      >
        <div className="flex items-start justify-between gap-3">
          <h2
            id="shortlist-drawer-title"
            className="font-serif text-xl font-bold text-brand-charcoal"
          >
            Save to shortlist
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Close"
            data-testid="shortlist-drawer-close"
            onClick={onClose}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <p className="text-xs text-brand-muted" data-testid="shortlist-not-notified">
          {NOT_NOTIFIED_TEXT}
        </p>

        <div aria-live="polite">
          <ErrorNotice error={error} testId="shortlist-drawer-error" />
        </div>

        {deriving ? (
          <p role="status" data-testid="shortlist-drawer-loading" className="text-sm text-brand-muted">
            Loading your lists...
          </p>
        ) : null}

        <ul className="space-y-2" data-testid="shortlist-drawer-lists">
          {lists.map((list) => (
            <li key={list.id} className="min-w-0 list-none">
              <label className="flex min-h-11 items-center gap-3 rounded-xl border border-brand-border px-3 py-2 text-sm text-brand-charcoal">
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0"
                  checked={isMember(members, list.id, profileRef)}
                  disabled={deriving || busyIds.includes(list.id)}
                  onChange={(event) => void toggle(list, event.target.checked)}
                />
                <span className="min-w-0 [overflow-wrap:anywhere]">{list.name}</span>
              </label>
            </li>
          ))}
        </ul>

        <form onSubmit={(event) => void createList(event)} className="space-y-3" noValidate>
          <ListNameField
            id="shortlist-create-name"
            label="Create new list"
            value={nameValue}
            error={nameError}
            disabled={createBusy}
            onChange={(value) => {
              setNameValue(value);
              setNameError(null);
            }}
          />
          <Button type="submit" size="sm" disabled={createBusy} data-testid="shortlist-create-submit">
            {createBusy ? 'Creating...' : 'Create list'}
          </Button>
        </form>

        <Link
          to="/shortlists"
          className="inline-block text-sm font-semibold text-brand-primary hover:underline"
        >
          View all your lists
        </Link>
      </div>
    </div>
  );
}
