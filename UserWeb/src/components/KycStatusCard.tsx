import { useEffect, useState } from 'react';
import { api } from '../api';
import type { KycMedia, KycStatus, KycVerification } from '../types';
import { ErrorNotice } from './ErrorNotice';
import { describeError, type FriendlyError } from '../errors/messages';

export const KYC_STATUS_LABELS: Record<KycStatus, { label: string; detail: string }> = {
  consentGiven: {
    label: 'Consent given',
    detail: 'Upload your photo and ID document to continue.',
  },
  documentUploaded: {
    label: 'Document uploaded',
    detail: 'One more file is needed before we can review your case.',
  },
  needsReview: {
    label: 'Waiting for review',
    detail: 'Your documents have been received and are waiting for an admin to review them.',
  },
  changesNeeded: {
    label: 'Changes needed',
    detail: 'An admin asked for changes. You can start over and upload your documents again.',
  },
  failed: {
    label: 'Not verified',
    detail: 'We could not verify your documents. You can start over and try again.',
  },
  approved: {
    label: 'Verified',
    detail: 'Your identity has been verified.',
  },
};

interface KycStatusCardProps {
  token: string;
  verification: KycVerification;
  onRestart?: () => void;
  restarting?: boolean;
  restartError?: FriendlyError | null;
}

function Thumbnail({ token, media }: { token: string; media: KycMedia }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<FriendlyError | null>(null);
  const isImage = media.contentType.startsWith('image/');

  useEffect(() => {
    if (!isImage) return;
    let cancelled = false;
    api
      .getKycMediaUrl(token, media.mediaId)
      .then((response) => {
        if (!cancelled) setUrl(response.url);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(describeError(err, 'kyc'));
      });
    return () => {
      cancelled = true;
    };
  }, [token, media.mediaId, isImage]);

  const label = media.purpose === 'kycPhoto' ? 'Photo' : 'ID document';

  return (
    <figure data-testid={`kyc-thumb-${media.purpose}`} className="w-28 text-center">
      {isImage && url ? (
        <img src={url} alt={label} className="h-24 w-28 rounded-lg border border-brand-border object-cover" />
      ) : (
        <div className="flex h-24 w-28 items-center justify-center rounded-lg border border-brand-border bg-brand-canvas text-xs text-brand-muted">
          {isImage ? (error ? 'Preview unavailable' : 'Loading...') : 'PDF file'}
        </div>
      )}
      <figcaption className="mt-1 text-xs text-brand-muted">{label}</figcaption>
    </figure>
  );
}

/** Shows the six KYC states, the masked ID number, thumbnails and the restart action. */
export function KycStatusCard({
  token,
  verification,
  onRestart,
  restarting = false,
  restartError = null,
}: KycStatusCardProps) {
  const info = KYC_STATUS_LABELS[verification.status];
  const canRestart = verification.status === 'failed' || verification.status === 'changesNeeded';

  return (
    <div data-testid="kyc-status-card" className="rounded-2xl border border-brand-border bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-brand-charcoal">Identity verification</h2>
        <span
          data-testid="kyc-status"
          data-status={verification.status}
          className="rounded-full bg-brand-primary-soft px-3 py-1 text-xs font-semibold text-brand-primary"
        >
          {info.label}
        </span>
      </div>
      <p data-testid="kyc-status-detail" className="mt-2 text-sm text-brand-muted">
        {info.detail}
      </p>

      {verification.idNumberLast4 ? (
        <p data-testid="kyc-id-last4" className="mt-2 text-sm text-brand-charcoal">
          ID number ending ••••{verification.idNumberLast4}
        </p>
      ) : null}

      {verification.media.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-3">
          {verification.media.map((media) => (
            <Thumbnail key={media.mediaId} token={token} media={media} />
          ))}
        </div>
      ) : null}

      {canRestart && onRestart ? (
        <div className="mt-4 space-y-2">
          <ErrorNotice error={restartError} testId="kyc-restart-error" />
          <button
            type="button"
            data-testid="kyc-restart"
            disabled={restarting}
            onClick={onRestart}
            className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {restarting ? 'Starting over...' : 'Start over'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
