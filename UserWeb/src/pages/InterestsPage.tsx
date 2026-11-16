import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Briefcase, MapPin, Sparkles } from 'lucide-react';
import { api } from '../api';
import { hasErrorCode } from '../apiError';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PhotoPlaceholder, VerifiedBadge } from '../components/DiscoveryCards';
import { ErrorNotice } from '../components/ErrorNotice';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { describeError, type FriendlyError } from '../errors/messages';
import { displayValue, formatAge } from '../lib/discovery';
import {
  STATUS_FILTERS,
  allowedActions,
  chatLabel,
  filterLabel,
  formatInterestDate,
  mergeInterestPage,
  statusLabel,
} from '../lib/interests';
import type { InterestAction, InterestListItem, InterestStatus, InterestTab } from '../types';

const PAGE_SIZE = 20;

const TABS: ReadonlyArray<{ id: InterestTab; label: string }> = [
  { id: 'sent', label: 'Sent' },
  { id: 'received', label: 'Received' },
];

const SELECT_CLASS =
  'flex h-11 w-full rounded-xl border border-brand-border bg-white px-3 text-sm text-brand-charcoal focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 sm:w-60';

const ACTION_TEXT: Record<
  InterestAction,
  { trigger: string; title: string; confirm: string; busy: string }
> = {
  accept: {
    trigger: 'Accept',
    title: 'Accept this interest?',
    confirm: 'Yes, accept',
    busy: 'Accepting...',
  },
  decline: {
    trigger: 'Decline',
    title: 'Decline this interest? The sender will see Not accepted.',
    confirm: 'Yes, decline',
    busy: 'Declining...',
  },
  withdraw: {
    trigger: 'Withdraw',
    title: 'Withdraw this interest?',
    confirm: 'Yes, withdraw',
    busy: 'Withdrawing...',
  },
};

function emptyText(tab: InterestTab, filtered: boolean): string {
  if (filtered) return 'No interests with this status.';
  return tab === 'sent'
    ? "You haven't sent any interests yet. Find profiles on the search page."
    : "You haven't received any interests yet.";
}

function InterestSkeletons() {
  return (
    <div aria-busy="true" data-testid="interests-loading">
      <span role="status" className="sr-only">
        Loading interests
      </span>
      <ul className="space-y-4" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => (
          <li
            key={index}
            data-testid="interest-skeleton"
            className="list-none animate-pulse rounded-2xl border border-brand-border bg-white p-5"
          >
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 rounded-2xl bg-brand-border" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 rounded bg-brand-border" />
                <div className="h-3 w-1/3 rounded bg-brand-border" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface InterestRowProps {
  item: InterestListItem;
  tab: InterestTab;
  onAct: (item: InterestListItem, action: InterestAction) => void;
}

function InterestRow({ item, tab, onAct }: InterestRowProps) {
  const { member } = item;
  const chat = chatLabel(item.canChat);
  const date = formatInterestDate(item.createdAt);
  return (
    <li
      data-testid="interest-item"
      className="min-w-0 list-none rounded-2xl border border-brand-border bg-white p-5"
    >
      <div className="flex items-center gap-3">
        <PhotoPlaceholder firstName={member.firstName} hasPhoto={member.photoRef !== null} />
        <div className="min-w-0 space-y-0.5">
          <h3 className="truncate font-serif text-lg font-bold text-brand-charcoal">
            <Link
              to={`/profile/${encodeURIComponent(member.profileRef)}`}
              className="rounded hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              {member.firstName}
            </Link>
          </h3>
          <p className="text-xs text-brand-muted">{formatAge(member.age)}</p>
          {member.verified ? <VerifiedBadge /> : null}
        </div>
      </div>
      <div className="mt-4 space-y-2 text-xs text-brand-muted">
        <div className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-brand-primary" aria-hidden="true" />
          <span className="truncate">{displayValue(member.city)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand-gold" aria-hidden="true" />
          <span className="truncate">
            {[displayValue(member.religion), displayValue(member.community)].join(' | ')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Briefcase className="h-3.5 w-3.5 shrink-0 text-brand-charcoal/70" aria-hidden="true" />
          <span className="truncate">{displayValue(member.profession)}</span>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-brand-border/60 pt-4">
        <span
          data-testid="interest-status"
          className="rounded-full bg-brand-primary-soft px-3 py-1 text-xs font-semibold text-brand-primary"
        >
          {statusLabel(item.status, tab)}
        </span>
        {date ? (
          <span data-testid="interest-date" className="text-xs text-brand-muted">
            {date}
          </span>
        ) : null}
      </div>
      {chat ? (
        <p data-testid="interest-chat" className="mt-3 text-xs font-medium text-emerald-800">
          {chat}
        </p>
      ) : null}
      {allowedActions(tab, item.status).length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {allowedActions(tab, item.status).map((action) => (
            <Button
              key={action}
              type="button"
              size="sm"
              variant={action === 'accept' ? 'default' : 'outline'}
              data-testid={`interest-${action}`}
              onClick={() => onAct(item, action)}
            >
              {ACTION_TEXT[action].trigger}
            </Button>
          ))}
        </div>
      ) : null}
    </li>
  );
}

interface InterestsPageProps {
  token: string;
  onLogout: () => void;
}

export function InterestsPage({ token, onLogout }: InterestsPageProps) {
  const [tab, setTab] = useState<InterestTab>('sent');
  const [status, setStatus] = useState<'' | InterestStatus>('');
  const [items, setItems] = useState<InterestListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [failedFirstPage, setFailedFirstPage] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const [pending, setPending] = useState<{ item: InterestListItem; action: InterestAction } | null>(
    null,
  );
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<FriendlyError | null>(null);
  const actionInFlight = useRef(false);

  // Latest-wins: a tab or filter change makes any older answer stale.
  const seq = useRef(0);
  const tabRefs = useRef<Record<InterestTab, HTMLButtonElement | null>>({
    sent: null,
    received: null,
  });

  const fetchPage = useCallback(
    (which: InterestTab, filter: '' | InterestStatus, cursor: string | null) => {
      const query = { status: filter, limit: PAGE_SIZE, cursor };
      return which === 'sent'
        ? api.listSentInterests(token, query)
        : api.listReceivedInterests(token, query);
    },
    [token],
  );

  useEffect(() => {
    const mine = ++seq.current;
    async function loadFirstPage() {
      setLoading(true);
      setLoadingMore(false);
      setError(null);
      setFailedFirstPage(false);
      setItems([]);
      setNextCursor(null);
      try {
        const page = await fetchPage(tab, status, null);
        if (mine !== seq.current) return;
        setItems(mergeInterestPage([], page.items));
        setNextCursor(page.nextCursor);
      } catch (err) {
        if (mine !== seq.current) return;
        if (hasErrorCode(err, 'UNAUTHORIZED')) {
          onLogout();
          return;
        }
        setFailedFirstPage(true);
        setError(describeError(err, 'interests'));
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }
    void loadFirstPage();
  }, [tab, status, attempt, fetchPage, onLogout]);

  async function loadMore() {
    if (!nextCursor) return;
    const mine = seq.current;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await fetchPage(tab, status, nextCursor);
      if (mine !== seq.current) return;
      setItems((existing) => mergeInterestPage(existing, page.items));
      setNextCursor(page.nextCursor);
    } catch (err) {
      if (mine !== seq.current) return;
      if (hasErrorCode(err, 'UNAUTHORIZED')) {
        onLogout();
        return;
      }
      setError(describeError(err, 'interests'));
    } finally {
      if (mine === seq.current) setLoadingMore(false);
    }
  }

  function selectTab(next: InterestTab, focus = false) {
    if (next !== tab) {
      setTab(next);
      setStatus('');
    }
    if (focus) tabRefs.current[next]?.focus();
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = TABS.findIndex((t) => t.id === tab);
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % TABS.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TABS.length - 1;
    else return;
    event.preventDefault();
    selectTab(TABS[next].id, true);
  }

  function openAction(item: InterestListItem, action: InterestAction) {
    setActionError(null);
    setPending({ item, action });
  }

  function closeAction() {
    if (actionBusy) return;
    setPending(null);
    setActionError(null);
  }

  async function confirmAction() {
    if (!pending || actionInFlight.current) return;
    actionInFlight.current = true;
    setActionBusy(true);
    setActionError(null);
    const { item, action } = pending;
    try {
      const result =
        action === 'accept'
          ? await api.acceptInterest(token, item.id)
          : action === 'decline'
            ? await api.declineInterest(token, item.id)
            : await api.withdrawInterest(token, item.id);
      // Update in place; an item that no longer matches the status filter leaves the list.
      setItems((existing) =>
        existing.flatMap((row) => {
          if (row.id !== item.id) return [row];
          if (status !== '' && result.status !== status) return [];
          return [{ ...row, ...result, member: row.member }];
        }),
      );
      setPending(null);
    } catch (err) {
      if (hasErrorCode(err, 'UNAUTHORIZED')) {
        onLogout();
        return;
      }
      setActionError(describeError(err, 'interests'));
    } finally {
      actionInFlight.current = false;
      setActionBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-canvas text-brand-charcoal">
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        <Link
          to="/app"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to search
        </Link>
        <h1 className="font-serif text-3xl font-bold">Interests</h1>

        <div
          role="tablist"
          aria-label="Interest direction"
          onKeyDown={onTabKeyDown}
          className="flex gap-2 border-b border-brand-border"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              ref={(node) => {
                tabRefs.current[t.id] = node;
              }}
              type="button"
              role="tab"
              id={`interests-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="interests-panel"
              tabIndex={tab === t.id ? 0 : -1}
              data-testid={`interests-tab-${t.id}`}
              onClick={() => selectTab(t.id)}
              className={`-mb-px rounded-t-lg border-b-2 px-5 py-2.5 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
                tab === t.id
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-brand-muted hover:text-brand-charcoal'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id="interests-panel"
          aria-labelledby={`interests-tab-${tab}`}
          className="space-y-5"
        >
          <div className="space-y-1.5">
            <Label htmlFor="interests-status">Status</Label>
            <select
              id="interests-status"
              data-testid="interests-status-filter"
              className={SELECT_CLASS}
              value={status}
              onChange={(event) => setStatus(event.target.value as '' | InterestStatus)}
            >
              {STATUS_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {filterLabel(option.value, tab)}
                </option>
              ))}
            </select>
          </div>

          <div aria-live="polite">
            <ErrorNotice error={error} testId="interests-error" />
          </div>
          {failedFirstPage ? (
            <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </Button>
          ) : null}

          {loading ? (
            <InterestSkeletons />
          ) : failedFirstPage ? null : items.length === 0 ? (
            <Card
              className="border-brand-border bg-white p-8 text-center"
              data-testid="interests-empty"
            >
              <p className="text-sm text-brand-muted">{emptyText(tab, status !== '')}</p>
            </Card>
          ) : (
            <>
              <ul className="space-y-4" data-testid="interests-list">
                {items.map((item) => (
                  <InterestRow key={item.id} item={item} tab={tab} onAct={openAction} />
                ))}
              </ul>
              {nextCursor ? (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => void loadMore()}
                    disabled={loadingMore}
                    aria-busy={loadingMore}
                  >
                    {loadingMore ? 'Loading more...' : 'Load more'}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </main>

      {pending ? (
        <ConfirmDialog
          title={ACTION_TEXT[pending.action].title}
          confirmLabel={ACTION_TEXT[pending.action].confirm}
          busyLabel={ACTION_TEXT[pending.action].busy}
          busy={actionBusy}
          error={actionError}
          onConfirm={() => void confirmAction()}
          onClose={closeAction}
        />
      ) : null}
    </div>
  );
}
