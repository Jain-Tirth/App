import type { ReactNode } from 'react';
import { Edit3, LogOut, XCircle, FileWarning } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { DecisionView } from '../lib/reviewDecision';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface ReviewDecisionPanelProps {
  view: DecisionView;
  onLogout: () => void;
  /** Extra actions shown above Sign Out, such as Submit again. */
  children?: ReactNode;
}

/** What the admin decided, why, and where to fix it. */
export function ReviewDecisionPanel({ view, onLogout, children }: ReviewDecisionPanelProps) {
  const navigate = useNavigate();
  const isChanges = view.kind === 'changesRequested';
  const isFinal = view.kind === 'rejected' && view.final;

  const heading = isChanges
    ? 'Changes needed'
    : isFinal
      ? 'Profile not approved'
      : 'Profile needs revision';
  const intro = isChanges
    ? 'Our review team asked for a few changes before your profile can go live.'
    : isFinal
      ? 'Our review team could not approve this profile, and it cannot be resubmitted.'
      : 'Our review team reviewed your profile and did not approve it yet.';

  return (
    <div data-testid="review-decision-panel" data-kind={view.kind} className="space-y-5">
      <div
        className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ring-8 ${
          isChanges ? 'bg-amber-50 text-amber-600 ring-amber-50/50' : 'bg-red-50 text-red-600 ring-red-50/50'
        }`}
      >
        {isChanges ? <FileWarning className="h-10 w-10" /> : <XCircle className="h-10 w-10" />}
      </div>

      <div>
        <Badge variant="secondary" className="mb-2 font-semibold">
          {isFinal ? 'Final decision' : 'Action required'}
        </Badge>
        <h1 data-testid="review-heading" className="font-serif text-3xl font-bold text-brand-charcoal">
          {heading}
        </h1>
        <p className="mt-2 text-sm text-brand-muted">{intro}</p>
      </div>

      <div className="rounded-xl border border-brand-border bg-brand-canvas p-4 text-left text-sm">
        <span className="block text-xs font-semibold uppercase tracking-wider text-brand-muted">
          Reason
        </span>
        <p data-testid="review-reason" className="mt-1 font-medium text-brand-charcoal">
          {view.reasonLabel}
        </p>
        {view.notes ? (
          <p data-testid="review-notes" className="mt-2 whitespace-pre-wrap italic text-brand-muted">
            {view.notes}
          </p>
        ) : null}
      </div>

      {view.kind === 'changesRequested' && view.sections.length > 0 ? (
        <div className="text-left" data-testid="review-sections">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-muted">
            Please update
          </span>
          <ul className="mt-2 space-y-2">
            {view.sections.map((section) => (
              <li key={section.section}>
                <button
                  type="button"
                  data-testid={`review-section-${section.section}`}
                  onClick={() => navigate(`/register?step=${section.step}`)}
                  className="flex w-full items-center justify-between rounded-xl border border-brand-border bg-white px-4 py-3 text-sm font-semibold text-brand-primary hover:bg-brand-primary-soft"
                >
                  <span>{section.label}</span>
                  <Edit3 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 pt-2">
        {view.kycRestart ? (
          <Button data-testid="review-kyc-restart" onClick={() => navigate('/kyc')} className="w-full gap-2">
            <Edit3 className="h-4 w-4" />
            <span>Upload your documents again</span>
          </Button>
        ) : null}
        {!isFinal && view.kind === 'rejected' && !view.kycRestart ? (
          <Button
            data-testid="review-edit-profile"
            onClick={() => navigate('/register')}
            className="w-full gap-2"
          >
            <Edit3 className="h-4 w-4" />
            <span>Update Profile Details</span>
          </Button>
        ) : null}
        {children}
        <Button
          variant="ghost"
          onClick={onLogout}
          className="gap-2 text-brand-muted hover:text-brand-charcoal"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </Button>
      </div>
    </div>
  );
}
