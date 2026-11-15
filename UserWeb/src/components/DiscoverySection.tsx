import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { api } from '../api';
import { hasErrorCode } from '../apiError';
import { describeError, type FriendlyError } from '../errors/messages';
import {
  DIET_OPTIONS,
  EMPTY_FILTERS,
  MARITAL_STATUS_OPTIONS,
  filtersFromQuery,
  filtersToQuery,
  mergePage,
  type FilterKey,
  type SearchFilters,
} from '../lib/discovery';
import type { DiscoveryCard } from '../types';
import { CardSkeletons, ProfileCard } from './DiscoveryCards';
import { ErrorNotice } from './ErrorNotice';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';

const PAGE_SIZE = 20;
const RECOMMENDATION_LIMIT = 9;
const SELECT_CLASS =
  'flex h-11 w-full rounded-xl border border-brand-border bg-white px-3 text-sm text-brand-charcoal focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20';

interface SelectSpec {
  key: FilterKey;
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}

const SELECTS: SelectSpec[] = [
  { key: 'maritalStatus', label: 'Marital status', options: MARITAL_STATUS_OPTIONS },
  { key: 'diet', label: 'Diet', options: DIET_OPTIONS },
];

const TEXT_FIELDS: Array<{ key: FilterKey; label: string }> = [
  { key: 'religion', label: 'Religion' },
  { key: 'community', label: 'Community' },
  { key: 'state', label: 'State' },
  { key: 'city', label: 'City' },
];

interface DiscoverySectionProps {
  token: string;
  onLogout: () => void;
}

export function DiscoverySection({ token, onLogout }: DiscoverySectionProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeFilters = useMemo(() => filtersFromQuery(searchParams), [searchParams]);
  const activeQuery = useMemo(() => filtersToQuery(activeFilters).toString(), [activeFilters]);

  const [draft, setDraft] = useState<SearchFilters>(activeFilters);
  const [nonce, setNonce] = useState(0);

  const [recs, setRecs] = useState<DiscoveryCard[]>([]);
  const [recsLoading, setRecsLoading] = useState(true);
  const [recsError, setRecsError] = useState<FriendlyError | null>(null);
  const [recsAttempt, setRecsAttempt] = useState(0);

  const [results, setResults] = useState<DiscoveryCard[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState<FriendlyError | null>(null);
  const [cursorExpired, setCursorExpired] = useState(false);
  const [failedFirstPage, setFailedFirstPage] = useState(false);

  // Latest-wins: every search bumps this, so an older, slower answer is ignored.
  const searchSeq = useRef(0);

  // Keep the form in step with the URL (back navigation restores filters).
  useEffect(() => {
    setDraft(activeFilters);
  }, [activeFilters]);

  useEffect(() => {
    let current = true;
    async function loadRecommendations() {
      setRecsLoading(true);
      setRecsError(null);
      try {
        const response = await api.discoveryRecommendations(token);
        if (current) setRecs((response.items ?? []).slice(0, RECOMMENDATION_LIMIT));
      } catch (err) {
        if (!current) return;
        if (hasErrorCode(err, 'UNAUTHORIZED')) onLogout();
        else setRecsError(describeError(err, 'discovery'));
      } finally {
        if (current) setRecsLoading(false);
      }
    }
    void loadRecommendations();
    return () => {
      current = false;
    };
  }, [token, onLogout, recsAttempt]);

  useEffect(() => {
    const seq = ++searchSeq.current;
    async function runSearch() {
      setLoading(true);
      setLoadingMore(false);
      setSearchError(null);
      setCursorExpired(false);
      setFailedFirstPage(false);
      try {
        const page = await api.discoverySearch(token, { ...activeFilters, limit: PAGE_SIZE });
        if (seq !== searchSeq.current) return;
        setResults(mergePage([], page.items));
        setNextCursor(page.nextCursor);
      } catch (err) {
        if (seq !== searchSeq.current) return;
        if (hasErrorCode(err, 'UNAUTHORIZED')) {
          onLogout();
          return;
        }
        setResults([]);
        setNextCursor(null);
        setFailedFirstPage(true);
        setSearchError(describeError(err, 'discovery'));
      } finally {
        if (seq === searchSeq.current) setLoading(false);
      }
    }
    void runSearch();
  }, [token, activeFilters, nonce, onLogout]);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    const seq = searchSeq.current;
    setLoadingMore(true);
    setSearchError(null);
    setCursorExpired(false);
    try {
      const page = await api.discoverySearch(token, {
        ...activeFilters,
        limit: PAGE_SIZE,
        cursor: nextCursor,
      });
      if (seq !== searchSeq.current) return;
      setResults((existing) => mergePage(existing, page.items));
      setNextCursor(page.nextCursor);
    } catch (err) {
      if (seq !== searchSeq.current) return;
      if (hasErrorCode(err, 'UNAUTHORIZED')) {
        onLogout();
        return;
      }
      setCursorExpired(hasErrorCode(err, 'INVALID_CURSOR'));
      setSearchError(describeError(err, 'discovery'));
    } finally {
      if (seq === searchSeq.current) setLoadingMore(false);
    }
  }, [nextCursor, token, activeFilters, onLogout]);

  function submit(event: FormEvent) {
    event.preventDefault();
    setSearchParams(filtersToQuery(draft), { replace: false });
    setNonce((n) => n + 1);
  }

  function clearFilters() {
    setDraft(EMPTY_FILTERS);
    setSearchParams(new URLSearchParams());
    setNonce((n) => n + 1);
  }

  const noFiltersActive = activeQuery === '';

  return (
    <div className="space-y-10">
      {/* Today's recommendations */}
      <section aria-labelledby="recs-heading" className="space-y-4">
        <h2 id="recs-heading" className="font-serif text-2xl font-bold text-brand-charcoal">
          Today&apos;s recommendations
        </h2>
        <ErrorNotice error={recsError} testId="recommendations-error" />
        {recsError ? (
          <Button variant="outline" size="sm" onClick={() => setRecsAttempt((n) => n + 1)}>
            Try again
          </Button>
        ) : null}
        {recsLoading ? (
          <CardSkeletons count={3} testId="recommendations-loading" />
        ) : !recsError && recs.length === 0 ? (
          <Card className="border-brand-border bg-white p-8 text-center" data-testid="recommendations-empty">
            <Sparkles className="mx-auto mb-3 h-6 w-6 text-brand-primary" aria-hidden="true" />
            <p className="text-sm text-brand-muted">
              No new recommendations today. Try the search below to find more profiles.
            </p>
          </Card>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" data-testid="recommendations-list">
            {recs.map((card) => (
              <ProfileCard key={card.profileRef} card={card} backSearch={activeQuery} />
            ))}
          </ul>
        )}
      </section>

      {/* Search */}
      <section aria-labelledby="search-heading" className="space-y-4">
        <h2 id="search-heading" className="font-serif text-2xl font-bold text-brand-charcoal">
          Search profiles
        </h2>
        <form
          onSubmit={submit}
          aria-label="Search filters"
          data-testid="search-form"
          className="grid gap-4 rounded-2xl border border-brand-border bg-white p-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {SELECTS.map((spec) => (
            <div key={spec.key} className="space-y-1.5">
              <Label htmlFor={`filter-${spec.key}`}>{spec.label}</Label>
              <select
                id={`filter-${spec.key}`}
                name={spec.key}
                className={SELECT_CLASS}
                value={draft[spec.key]}
                onChange={(e) => setDraft({ ...draft, [spec.key]: e.target.value })}
              >
                <option value="">Any</option>
                {spec.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {TEXT_FIELDS.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={`filter-${field.key}`}>{field.label}</Label>
              <Input
                id={`filter-${field.key}`}
                name={field.key}
                value={draft[field.key]}
                maxLength={100}
                onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
              />
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-3 sm:col-span-2 lg:col-span-3">
            <Button type="submit">Search</Button>
            <Button type="button" variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        </form>

        <div aria-live="polite">
          <ErrorNotice error={searchError} testId="search-error" />
        </div>
        {cursorExpired ? (
          <Button onClick={() => setNonce((n) => n + 1)}>Start the search again</Button>
        ) : null}
        {failedFirstPage ? (
          <Button variant="outline" onClick={() => setNonce((n) => n + 1)}>
            Try again
          </Button>
        ) : null}

        {loading ? (
          <CardSkeletons count={6} testId="results-loading" />
        ) : failedFirstPage ? null : results.length === 0 ? (
          <Card className="border-brand-border bg-white p-8 text-center" data-testid="results-empty">
            <p className="text-sm text-brand-muted">
              No profiles match your search. Try removing a filter.
            </p>
            {noFiltersActive ? null : (
              <Button className="mt-4" variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </Card>
        ) : (
          <>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" data-testid="results-list">
              {results.map((card) => (
                <ProfileCard key={card.profileRef} card={card} backSearch={activeQuery} />
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
    </div>
  );
}
