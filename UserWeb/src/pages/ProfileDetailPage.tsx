import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../api';
import { hasErrorCode } from '../apiError';
import { ErrorNotice } from '../components/ErrorNotice';
import { PhotoPlaceholder, VerifiedBadge } from '../components/DiscoveryCards';
import { SendInterestButton } from '../components/SendInterestButton';
import { ShortlistButton } from '../components/ShortlistButton';
import { Button } from '../components/ui/button';
import { describeCode, describeError, type FriendlyError } from '../errors/messages';
import {
  DIET_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  displayValue,
  formatAge,
  optionLabel,
} from '../lib/discovery';
import type { ProfileDetail } from '../types';

interface ProfileDetailPageProps {
  token: string;
  onLogout: () => void;
}

function readBackSearch(state: unknown): string {
  if (state && typeof state === 'object' && 'backSearch' in state) {
    const value = (state as { backSearch: unknown }).backSearch;
    if (typeof value === 'string') return value;
  }
  return '';
}

function formatHeight(heightCm: number | null): string {
  return typeof heightCm === 'number' && heightCm > 0 ? `${heightCm} cm` : displayValue(null);
}

function DetailSkeleton() {
  return (
    <div aria-busy="true" data-testid="detail-skeleton" className="animate-pulse space-y-4">
      <span role="status" className="sr-only">
        Loading profile
      </span>
      <div className="h-24 rounded-2xl bg-brand-border" aria-hidden="true" />
      <div className="h-40 rounded-2xl bg-brand-border" aria-hidden="true" />
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-brand-border/60 pb-2 text-xs">
      <dt className="shrink-0 text-brand-muted">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-brand-charcoal [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}

export function ProfileDetailPage({ token, onLogout }: ProfileDetailPageProps) {
  const { profileRef = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const backSearch = readBackSearch(location.state);
  const backTo = `/app${backSearch ? `?${backSearch}` : ''}`;

  const [detail, setDetail] = useState<ProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(
    async (isCurrent: () => boolean) => {
      setLoading(true);
      setError(null);
      setNotFound(false);
      try {
        const response = await api.getProfileDetail(token, profileRef);
        if (isCurrent()) setDetail(response);
      } catch (err) {
        if (!isCurrent()) return;
        setDetail(null);
        if (hasErrorCode(err, 'UNAUTHORIZED')) {
          onLogout();
        } else if (hasErrorCode(err, 'PROFILE_NOT_FOUND')) {
          setNotFound(true);
        } else {
          setError(describeError(err, 'discovery'));
        }
      } finally {
        if (isCurrent()) setLoading(false);
      }
    },
    [token, profileRef, onLogout],
  );

  useEffect(() => {
    let current = true;
    void load(() => current);
    return () => {
      current = false;
    };
  }, [load, attempt]);

  // The page title carries the first name only.
  useEffect(() => {
    if (!detail) return;
    const previous = document.title;
    document.title = `${detail.firstName} | Dhobi Matrimony`;
    return () => {
      document.title = previous;
    };
  }, [detail]);

  const notFoundText = describeCode('PROFILE_NOT_FOUND', null, 'discovery').message;

  return (
    <div className="min-h-screen bg-brand-canvas text-brand-charcoal">
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to results
        </Link>

        {loading ? <DetailSkeleton /> : null}

        {!loading && notFound ? (
          <div
            data-testid="profile-not-found"
            className="rounded-2xl border border-brand-border bg-white p-8 text-center"
          >
            <p className="font-serif text-xl font-bold text-brand-charcoal">{notFoundText}</p>
            <Button className="mt-5" onClick={() => navigate(backTo)}>
              Back to search
            </Button>
          </div>
        ) : null}

        {!loading && error ? (
          <div className="space-y-3">
            <ErrorNotice error={error} testId="detail-error" />
            <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </Button>
          </div>
        ) : null}

        {!loading && detail ? (
          <article className="space-y-6" data-testid="profile-detail">
            <header className="flex flex-wrap items-center gap-4 rounded-2xl border border-brand-border bg-white p-6">
              <PhotoPlaceholder firstName={detail.firstName} hasPhoto={detail.photoRef !== null} />
              <div className="min-w-0 flex-1 space-y-1">
                <h1 className="truncate font-serif text-2xl font-bold">{detail.firstName}</h1>
                <p className="text-sm text-brand-muted">{formatAge(detail.age)}</p>
                {detail.verified ? <VerifiedBadge /> : null}
              </div>
              <div className="flex max-w-full flex-wrap items-start gap-2">
                <SendInterestButton
                  token={token}
                  receiverProfileRef={detail.profileRef}
                  onLogout={onLogout}
                  size="default"
                />
                <ShortlistButton
                  token={token}
                  profileRef={detail.profileRef}
                  onLogout={onLogout}
                  size="default"
                />
              </div>
            </header>

            <section
              aria-labelledby="detail-basics"
              className="rounded-2xl border border-brand-border bg-white p-6"
            >
              <h2 id="detail-basics" className="mb-4 font-serif text-base font-bold">
                Basics
              </h2>
              <dl className="space-y-2.5">
                <Fact label="Height" value={formatHeight(detail.heightCm)} />
                <Fact
                  label="Marital status"
                  value={optionLabel(MARITAL_STATUS_OPTIONS, detail.maritalStatus)}
                />
                <Fact label="Diet" value={optionLabel(DIET_OPTIONS, detail.diet)} />
                <Fact
                  label="Languages spoken"
                  value={detail.spokenLanguages.length > 0 ? detail.spokenLanguages.join(', ') : displayValue(null)}
                />
              </dl>
            </section>

            <section
              aria-labelledby="detail-community"
              className="rounded-2xl border border-brand-border bg-white p-6"
            >
              <h2 id="detail-community" className="mb-4 font-serif text-base font-bold">
                Religion and community
              </h2>
              <dl className="space-y-2.5">
                <Fact label="Religion" value={displayValue(detail.religion)} />
                <Fact label="Community" value={displayValue(detail.community)} />
                <Fact label="Subcommunity" value={displayValue(detail.subcommunity)} />
              </dl>
            </section>

            <section
              aria-labelledby="detail-location"
              className="rounded-2xl border border-brand-border bg-white p-6"
            >
              <h2 id="detail-location" className="mb-4 font-serif text-base font-bold">
                Location
              </h2>
              <dl className="space-y-2.5">
                <Fact label="City" value={displayValue(detail.city)} />
                <Fact label="State" value={displayValue(detail.state)} />
                <Fact label="Country" value={displayValue(detail.country)} />
              </dl>
            </section>

            <section
              aria-labelledby="detail-career"
              className="rounded-2xl border border-brand-border bg-white p-6"
            >
              <h2 id="detail-career" className="mb-4 font-serif text-base font-bold">
                Education and career
              </h2>
              <dl className="space-y-2.5">
                <Fact label="Education" value={displayValue(detail.education)} />
                <Fact label="Profession" value={displayValue(detail.profession)} />
                <Fact label="Employment type" value={optionLabel(EMPLOYMENT_TYPE_OPTIONS, detail.employmentType)} />
                <Fact label="Family status" value={displayValue(detail.familyStatus)} />
              </dl>
            </section>

            <section
              aria-labelledby="detail-about"
              className="space-y-4 rounded-2xl border border-brand-border bg-white p-6"
            >
              <h2 id="detail-about" className="font-serif text-base font-bold">
                About
              </h2>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider">About me</h3>
                <p className="mt-1 text-sm leading-relaxed text-brand-muted [overflow-wrap:anywhere]">
                  {displayValue(detail.aboutMyself)}
                </p>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider">Looking for</h3>
                <p className="mt-1 text-sm leading-relaxed text-brand-muted [overflow-wrap:anywhere]">
                  {displayValue(detail.lookingFor)}
                </p>
              </div>
            </section>
          </article>
        ) : null}
      </main>
    </div>
  );
}
