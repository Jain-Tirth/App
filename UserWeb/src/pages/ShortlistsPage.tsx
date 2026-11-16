import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../api';
import { hasErrorCode } from '../apiError';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CardSkeletons, ProfileCard } from '../components/DiscoveryCards';
import { ErrorNotice } from '../components/ErrorNotice';
import { RenameListDialog } from '../components/RenameListDialog';
import { NOT_NOTIFIED_TEXT } from '../components/ShortlistDrawer';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { describeError, type FriendlyError } from '../errors/messages';
import { keepOnly, noteMembership } from '../lib/shortlistCache';
import { mergeCardPage, orderLists } from '../lib/shortlists';
import type { DiscoveryCard, Shortlist } from '../types';

const PAGE_SIZE = 20;

interface ShortlistsPageProps {
  token: string;
  onLogout: () => void;
}

export function ShortlistsPage({ token, onLogout }: ShortlistsPageProps) {
  const [lists, setLists] = useState<Shortlist[]>([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pageError, setPageError] = useState<FriendlyError | null>(null);
  const [attempt, setAttempt] = useState(0);

  const [cards, setCards] = useState<DiscoveryCard[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cardsError, setCardsError] = useState<FriendlyError | null>(null);

  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<FriendlyError | null>(null);
  const [removingRef, setRemovingRef] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  const deleteInFlight = useRef(false);
  const removeInFlight = useRef(false);
  const cardSeq = useRef(0);
  const listButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  const headingRef = useRef<HTMLHeadingElement>(null);

  const selected = lists.find((list) => list.id === selectedId) ?? null;

  /** Reloads the lists. Keeps the preferred or current selection when it still exists. */
  const loadLists = useCallback(
    async (prefer?: string | null) => {
      try {
        const fetched = orderLists(await api.listShortlists(token));
        keepOnly(
          token,
          fetched.map((list) => list.id),
        );
        setLists(fetched);
        setSelectedId((current) => {
          const wanted = prefer ?? current;
          return fetched.some((list) => list.id === wanted) ? wanted : (fetched[0]?.id ?? null);
        });
      } catch (err) {
        if (hasErrorCode(err, 'UNAUTHORIZED')) {
          onLogout();
          return;
        }
        setPageError(describeError(err, 'shortlists'));
      } finally {
        setListsLoading(false);
      }
    },
    [token, onLogout],
  );

  useEffect(() => {
    void loadLists();
  }, [loadLists, attempt]);

  useEffect(() => {
    if (!selectedId) {
      setCards([]);
      setNextCursor(null);
      return;
    }
    const mine = ++cardSeq.current;
    async function firstPage(id: string) {
      setCardsLoading(true);
      setLoadingMore(false);
      setCardsError(null);
      setCards([]);
      setNextCursor(null);
      try {
        const page = await api.listShortlistProfiles(token, id, { limit: PAGE_SIZE });
        if (mine !== cardSeq.current) return;
        setCards(mergeCardPage([], page.items));
        setNextCursor(page.nextCursor);
      } catch (err) {
        if (mine !== cardSeq.current) return;
        if (hasErrorCode(err, 'UNAUTHORIZED')) {
          onLogout();
          return;
        }
        const friendly = describeError(err, 'shortlists');
        if (hasErrorCode(err, 'SHORTLIST_NOT_FOUND')) {
          setPageError(friendly);
          void loadLists();
        } else {
          setCardsError(friendly);
        }
      } finally {
        if (mine === cardSeq.current) setCardsLoading(false);
      }
    }
    void firstPage(selectedId);
  }, [selectedId, token, onLogout, loadLists]);

  useEffect(() => {
    if (focusId) {
      listButtons.current[focusId]?.focus();
      setFocusId(null);
    }
  }, [focusId, lists]);

  async function loadMore() {
    if (!nextCursor || !selectedId) return;
    const mine = cardSeq.current;
    setLoadingMore(true);
    setCardsError(null);
    try {
      const page = await api.listShortlistProfiles(token, selectedId, {
        limit: PAGE_SIZE,
        cursor: nextCursor,
      });
      if (mine !== cardSeq.current) return;
      setCards((existing) => mergeCardPage(existing, page.items));
      setNextCursor(page.nextCursor);
    } catch (err) {
      if (mine !== cardSeq.current) return;
      if (hasErrorCode(err, 'UNAUTHORIZED')) {
        onLogout();
        return;
      }
      setCardsError(describeError(err, 'shortlists'));
    } finally {
      if (mine === cardSeq.current) setLoadingMore(false);
    }
  }

  async function removeCard(card: DiscoveryCard) {
    if (!selected || removeInFlight.current) return;
    removeInFlight.current = true;
    setRemovingRef(card.profileRef);
    setCardsError(null);
    try {
      await api.removeFromShortlist(token, selected.id, card.profileRef);
      noteMembership(token, selected.id, card.profileRef, false);
      setCards((existing) => existing.filter((item) => item.profileRef !== card.profileRef));
      headingRef.current?.focus();
    } catch (err) {
      if (hasErrorCode(err, 'UNAUTHORIZED')) {
        onLogout();
        return;
      }
      const friendly = describeError(err, 'shortlists');
      if (hasErrorCode(err, 'SHORTLIST_NOT_FOUND')) {
        setPageError(friendly);
        void loadLists();
      } else {
        setCardsError(friendly);
      }
    } finally {
      removeInFlight.current = false;
      setRemovingRef(null);
    }
  }

  function handleRenamed(renamed: Shortlist) {
    setLists((existing) => orderLists(existing.map((list) => (list.id === renamed.id ? renamed : list))));
    setRenaming(false);
  }

  function handleMissing(friendly: FriendlyError) {
    setRenaming(false);
    setDeleting(false);
    setPageError(friendly);
    void loadLists();
  }

  function closeDelete() {
    if (deleteBusy) return;
    setDeleting(false);
    setDeleteError(null);
  }

  async function confirmDelete() {
    if (!selected || deleteInFlight.current) return;
    deleteInFlight.current = true;
    setDeleteBusy(true);
    setDeleteError(null);
    const doomed = selected;
    try {
      await api.deleteShortlist(token, doomed.id);
      const index = lists.findIndex((list) => list.id === doomed.id);
      const remaining = lists.filter((list) => list.id !== doomed.id);
      const next = remaining[index] ?? remaining[index - 1] ?? remaining[0] ?? null;
      keepOnly(
        token,
        remaining.map((list) => list.id),
      );
      setLists(remaining);
      setSelectedId(next ? next.id : null);
      setFocusId(next ? next.id : null);
      setPageError(null);
      setDeleting(false);
    } catch (err) {
      if (hasErrorCode(err, 'UNAUTHORIZED')) {
        onLogout();
        return;
      }
      const friendly = describeError(err, 'shortlists');
      if (hasErrorCode(err, 'SHORTLIST_NOT_FOUND')) {
        handleMissing(friendly);
      } else {
        setDeleteError(friendly);
      }
    } finally {
      deleteInFlight.current = false;
      setDeleteBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-canvas text-brand-charcoal">
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <Link
          to="/app"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to search
        </Link>
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-bold">Shortlists</h1>
          <p className="text-sm text-brand-muted" data-testid="shortlist-not-notified">
            {NOT_NOTIFIED_TEXT}
          </p>
        </div>

        <div aria-live="polite">
          <ErrorNotice error={pageError} testId="shortlists-error" />
        </div>

        {listsLoading ? (
          <p role="status" data-testid="shortlists-loading" className="text-sm text-brand-muted">
            Loading your lists...
          </p>
        ) : lists.length === 0 ? (
          <div className="space-y-3">
            <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </Button>
          </div>
        ) : (
          <>
            <ul className="flex flex-wrap gap-2" data-testid="shortlists-lists" aria-label="Your lists">
              {lists.map((list) => (
                <li key={list.id} className="min-w-0 list-none">
                  <button
                    type="button"
                    ref={(node) => {
                      listButtons.current[list.id] = node;
                    }}
                    aria-pressed={list.id === selectedId}
                    data-testid="shortlist-select"
                    onClick={() => setSelectedId(list.id)}
                    className={`max-w-full rounded-full border px-4 py-2 text-sm font-semibold [overflow-wrap:anywhere] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
                      list.id === selectedId
                        ? 'border-brand-primary bg-brand-primary text-white'
                        : 'border-brand-border bg-white text-brand-charcoal hover:bg-brand-primary-soft'
                    }`}
                  >
                    {list.name}
                  </button>
                </li>
              ))}
            </ul>

            {selected ? (
              <section aria-labelledby="shortlist-heading" className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <h2
                    id="shortlist-heading"
                    ref={headingRef}
                    tabIndex={-1}
                    className="min-w-0 font-serif text-2xl font-bold [overflow-wrap:anywhere] focus:outline-none"
                  >
                    {selected.name}
                  </h2>
                  {selected.isDefault ? (
                    <span
                      data-testid="default-list-label"
                      className="rounded-full bg-brand-primary-soft px-3 py-1 text-xs font-semibold text-brand-primary"
                    >
                      Default list
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        data-testid="rename-list"
                        onClick={() => setRenaming(true)}
                      >
                        Rename
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        data-testid="delete-list"
                        onClick={() => {
                          setDeleteError(null);
                          setDeleting(true);
                        }}
                      >
                        Delete list
                      </Button>
                    </div>
                  )}
                </div>

                <div aria-live="polite">
                  <ErrorNotice error={cardsError} testId="shortlist-cards-error" />
                </div>

                {cardsLoading ? (
                  <CardSkeletons count={3} testId="shortlist-cards-loading" />
                ) : cards.length === 0 && !cardsError ? (
                  <Card
                    className="space-y-3 border-brand-border bg-white p-8 text-center"
                    data-testid="shortlist-empty"
                  >
                    <p className="text-sm text-brand-muted">
                      Nothing here yet. Use the Shortlist button on a profile to save it.
                    </p>
                    <Link
                      to="/app"
                      className="inline-block text-sm font-semibold text-brand-primary hover:underline"
                    >
                      Find profiles
                    </Link>
                  </Card>
                ) : (
                  <>
                    <ul
                      className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
                      data-testid="shortlist-cards"
                    >
                      {cards.map((card) => (
                        <ProfileCard key={card.profileRef} card={card} backSearch="">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            data-testid="shortlist-remove"
                            aria-label={`Remove ${card.firstName} from ${selected.name}`}
                            disabled={removingRef === card.profileRef}
                            onClick={() => void removeCard(card)}
                            className="w-full"
                          >
                            Remove
                          </Button>
                        </ProfileCard>
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
              </section>
            ) : null}
          </>
        )}
      </main>

      {renaming && selected ? (
        <RenameListDialog
          token={token}
          list={selected}
          onRenamed={handleRenamed}
          onClose={() => setRenaming(false)}
          onMissing={handleMissing}
          onLogout={onLogout}
        />
      ) : null}

      {deleting && selected ? (
        <ConfirmDialog
          title={`Delete the list ${selected.name}? The profiles stay in your other lists.`}
          confirmLabel="Delete"
          cancelLabel="Keep list"
          busyLabel="Deleting..."
          busy={deleteBusy}
          error={deleteError}
          onConfirm={() => void confirmDelete()}
          onClose={closeDelete}
        />
      ) : null}
    </div>
  );
}
