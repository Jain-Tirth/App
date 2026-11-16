import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Briefcase, MapPin, Sparkles, UserRound } from 'lucide-react';
import type { DiscoveryCard } from '../types';
import { displayValue, formatAge } from '../lib/discovery';
import { SendInterestButton } from './SendInterestButton';
import { ShortlistButton } from './ShortlistButton';

/** Stand-in for a missing photo. Always carries an alt text; never shows another image. */
export function PhotoPlaceholder({ firstName, hasPhoto }: { firstName: string; hasPhoto: boolean }) {
  const label = hasPhoto
    ? `Photo of ${firstName} is being prepared`
    : `${firstName} has not added a photo yet`;
  return (
    <div
      role="img"
      aria-label={label}
      data-testid="photo-placeholder"
      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-brand-border bg-white text-brand-primary shadow-sm"
    >
      <UserRound className="h-7 w-7" aria-hidden="true" />
    </div>
  );
}

export function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/90 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
      <BadgeCheck className="h-3 w-3 text-emerald-600" aria-hidden="true" />
      Verified
    </span>
  );
}

interface ProfileCardProps {
  card: DiscoveryCard;
  /** Query string of the search that produced the card, so "Back to results" restores it. */
  backSearch: string;
  /** With a token the card carries the Send interest button (kept outside the link). */
  token?: string;
  onLogout?: () => void;
  /** Extra actions under the card (kept outside the link). */
  children?: ReactNode;
}

/** Shows only the story 6 card fields. Links use profileRef and nothing else. */
export function ProfileCard({ card, backSearch, token, onLogout, children }: ProfileCardProps) {
  const age = formatAge(card.age);
  return (
    <li className="flex min-w-0 list-none flex-col gap-3" data-testid="profile-card">
      <Link
        to={`/profile/${encodeURIComponent(card.profileRef)}`}
        state={{ backSearch }}
        className="block flex-1 overflow-hidden rounded-2xl border border-brand-border bg-white transition-all hover:-translate-y-1 hover:shadow-glow focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
      >
        <div className="flex items-center gap-3 border-b border-brand-border/60 bg-gradient-to-r from-brand-primary-soft to-brand-gold-light/60 p-5">
          <PhotoPlaceholder firstName={card.firstName} hasPhoto={card.photoRef !== null} />
          <div className="min-w-0">
            <h3 className="truncate font-serif text-lg font-bold text-brand-charcoal">
              {card.firstName}
            </h3>
            <p className="text-xs text-brand-muted">{age}</p>
            {card.verified ? <VerifiedBadge /> : null}
          </div>
        </div>
        <div className="space-y-3 p-5 text-xs text-brand-muted">
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-brand-primary" aria-hidden="true" />
            <span className="truncate">{displayValue(card.city)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand-gold" aria-hidden="true" />
            <span className="truncate">
              {[displayValue(card.religion), displayValue(card.community)].join(' | ')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Briefcase className="h-3.5 w-3.5 shrink-0 text-brand-charcoal/70" aria-hidden="true" />
            <span className="truncate">{displayValue(card.profession)}</span>
          </div>
        </div>
      </Link>
      {token && onLogout ? (
        <div className="flex flex-wrap items-start gap-2">
          <SendInterestButton
            token={token}
            receiverProfileRef={card.profileRef}
            onLogout={onLogout}
          />
          <ShortlistButton token={token} profileRef={card.profileRef} onLogout={onLogout} />
        </div>
      ) : null}
      {children}
    </li>
  );
}

/** Skeleton cards with a visually hidden status. The container is aria-busy while loading. */
export function CardSkeletons({ count, testId }: { count: number; testId: string }) {
  return (
    <div aria-busy="true" data-testid={testId}>
      <span role="status" className="sr-only">
        Loading profiles
      </span>
      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <li
            key={index}
            data-testid="card-skeleton"
            className="list-none animate-pulse rounded-2xl border border-brand-border bg-white p-5"
          >
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 rounded-2xl bg-brand-border" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 rounded bg-brand-border" />
                <div className="h-3 w-1/3 rounded bg-brand-border" />
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <div className="h-3 w-3/4 rounded bg-brand-border" />
              <div className="h-3 w-1/2 rounded bg-brand-border" />
              <div className="h-3 w-2/3 rounded bg-brand-border" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
