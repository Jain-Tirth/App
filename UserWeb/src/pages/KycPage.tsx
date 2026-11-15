import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, putToStorage } from '../api';
import { hasErrorCode } from '../apiError';
import { ErrorNotice, FieldError } from '../components/ErrorNotice';
import { KycStatusCard } from '../components/KycStatusCard';
import { ReconsentPanel } from '../components/ConsentPanels';
import { Logo } from '../components/Logo';
import { describeCode, describeError, type FriendlyError } from '../errors/messages';
import {
  ACCEPT_BY_PURPOSE,
  DOCUMENT_TYPES,
  fileProblemMessage,
  isValidIdNumber,
} from '../lib/kycFiles';
import { sha256HexOfBlob } from '../lib/sha256';
import {
  KycUploadFailure,
  STAGE_PROGRESS,
  uploadKycFile,
  type KycUploadDeps,
  type UploadStage,
} from '../lib/kycUpload';
import { allowedActions } from '../lib/profileStatus';
import { SubmitForReview } from '../components/SubmitForReview';
import type {
  KycDocumentType,
  KycPurpose,
  KycVerification,
  ProfileResponse,
  ProfileReviewStatus,
} from '../types';

interface KycPageProps {
  token: string;
  reviewStatus: ProfileReviewStatus;
  onProfileUpdate: (profile: ProfileResponse) => void;
  onLogout: () => void;
}

interface Slot {
  file: File | null;
  previewUrl: string | null;
  stage: UploadStage | null;
  progress: number;
  error: FriendlyError | null;
  uploaded: boolean;
}

const EMPTY_SLOT: Slot = {
  file: null,
  previewUrl: null,
  stage: null,
  progress: 0,
  error: null,
  uploaded: false,
};

const SLOT_LABEL: Record<KycPurpose, string> = {
  kycPhoto: 'Your photo',
  kycId: 'Your ID document',
};

const TEST_KEY: Record<KycPurpose, string> = { kycPhoto: 'photo', kycId: 'id' };

const SELECT_CLASS =
  'mt-1 w-full rounded-xl border border-brand-border bg-white px-4 py-2.5 text-sm text-brand-charcoal focus:border-brand-primary focus:outline-none';

export function KycPage({ token, reviewStatus, onProfileUpdate, onLogout }: KycPageProps) {
  const navigate = useNavigate();
  const [verification, setVerification] = useState<KycVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [slots, setSlots] = useState<Record<KycPurpose, Slot>>({
    kycPhoto: EMPTY_SLOT,
    kycId: EMPTY_SLOT,
  });
  const [documentType, setDocumentType] = useState<KycDocumentType | ''>('');
  const [idNumber, setIdNumber] = useState('');
  const [idFieldErrors, setIdFieldErrors] = useState<Record<string, string>>({});
  const [restarting, setRestarting] = useState(false);
  const [restartError, setRestartError] = useState<FriendlyError | null>(null);
  const previews = useRef<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let current: KycVerification;
      try {
        current = await api.getKycVerification(token);
      } catch (err) {
        if (!hasErrorCode(err, 'VERIFICATION_NOT_FOUND')) throw err;
        try {
          current = await api.createKycVerification(token);
        } catch (createErr) {
          if (!hasErrorCode(createErr, 'VERIFICATION_ALREADY_EXISTS')) throw createErr;
          current = await api.getKycVerification(token);
        }
      }
      setVerification(current);
    } catch (err) {
      if (hasErrorCode(err, 'CONSENT_REQUIRED')) setNeedsConsent(true);
      setError(describeError(err, 'kyc'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(
    () => () => {
      previews.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  function patchSlot(purpose: KycPurpose, patch: Partial<Slot>) {
    setSlots((current) => ({ ...current, [purpose]: { ...current[purpose], ...patch } }));
  }

  function chooseFile(purpose: KycPurpose, file: File | null) {
    const previous = slots[purpose].previewUrl;
    if (previous) URL.revokeObjectURL(previous);
    if (!file) {
      patchSlot(purpose, { ...EMPTY_SLOT });
      return;
    }
    const problem = fileProblemMessage(purpose, file);
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    if (previewUrl) previews.current.push(previewUrl);
    patchSlot(purpose, {
      ...EMPTY_SLOT,
      file,
      previewUrl,
      error: problem ? { message: problem, fields: {}, reference: null } : null,
    });
  }

  function discard(purpose: KycPurpose) {
    chooseFile(purpose, null);
  }

  const deps: KycUploadDeps = {
    requestUpload: (payload) => api.requestKycUpload(token, payload),
    putToStorage,
    sha256Hex: sha256HexOfBlob,
    complete: (mediaId, checksum) => api.completeKycUpload(token, mediaId, checksum),
    discard: (mediaId) => api.discardKycUpload(token, mediaId),
  };

  async function upload(purpose: KycPurpose) {
    const slot = slots[purpose];
    if (!slot.file) return;
    setError(null);

    let nextFieldErrors: Record<string, string> = {};
    if (purpose === 'kycId') {
      if (!documentType) {
        nextFieldErrors.documentType = describeCode('VALIDATION_ERROR', { fields: { documentType: 1 } }).fields.documentType;
      }
      if (!isValidIdNumber(idNumber)) {
        nextFieldErrors.idNumber = describeCode('VALIDATION_ERROR', { fields: { idNumber: 1 } }).fields.idNumber;
      }
      setIdFieldErrors(nextFieldErrors);
      if (Object.keys(nextFieldErrors).length > 0) return;
    }

    const problem = fileProblemMessage(purpose, slot.file);
    if (problem) {
      patchSlot(purpose, { error: { message: problem, fields: {}, reference: null } });
      return;
    }

    patchSlot(purpose, { error: null, stage: 'requesting', progress: STAGE_PROGRESS.requesting });
    try {
      const result = await uploadKycFile(
        deps,
        {
          purpose,
          file: slot.file,
          documentType: documentType === '' ? undefined : documentType,
          idNumber,
        },
        (stage) => patchSlot(purpose, { stage, progress: STAGE_PROGRESS[stage] }),
      );
      patchSlot(purpose, { uploaded: true, stage: 'done', progress: 100 });
      setVerification(result);
    } catch (err) {
      const original = err instanceof KycUploadFailure ? err.original : err;
      if (hasErrorCode(original, 'CONSENT_REQUIRED')) {
        setNeedsConsent(true);
      }
      patchSlot(purpose, {
        stage: null,
        progress: 0,
        error: describeError(original, 'kycUpload'),
      });
      if (hasErrorCode(original, 'VALIDATION_ERROR')) {
        setIdFieldErrors(describeError(original, 'kycUpload').fields);
      }
    }
  }

  async function restart() {
    setRestarting(true);
    setRestartError(null);
    try {
      const restarted = await api.restartKycVerification(token);
      setVerification(restarted);
      setSlots({ kycPhoto: EMPTY_SLOT, kycId: EMPTY_SLOT });
      setDocumentType('');
      setIdNumber('');
    } catch (err) {
      if (hasErrorCode(err, 'CONSENT_REQUIRED')) setNeedsConsent(true);
      setRestartError(describeError(err, 'kycRestart'));
    } finally {
      setRestarting(false);
    }
  }

  if (needsConsent) {
    return (
      <ReconsentPanel
        token={token}
        onAccepted={() => {
          setNeedsConsent(false);
          void load();
        }}
      />
    );
  }

  const actions = allowedActions(reviewStatus);
  const status = verification?.status;
  const collecting = status === 'consentGiven' || status === 'documentUploaded';
  const attachedPurposes = new Set(verification?.media.map((media) => media.purpose));

  function renderSlot(purpose: KycPurpose) {
    const slot = slots[purpose];
    const key = TEST_KEY[purpose];
    const busy = slot.stage !== null && slot.stage !== 'done';
    const attached = attachedPurposes.has(purpose);
    return (
      <div
        key={purpose}
        data-testid={`kyc-slot-${key}`}
        className="rounded-2xl border border-brand-border bg-white p-4"
      >
        <h3 className="text-sm font-semibold text-brand-charcoal">{SLOT_LABEL[purpose]}</h3>
        <p className="text-xs text-brand-muted">
          {purpose === 'kycPhoto'
            ? 'JPEG, PNG or WebP, up to 10 MB.'
            : 'JPEG, PNG, WebP or PDF, up to 10 MB.'}
        </p>

        {attached ? (
          <p data-testid={`kyc-${key}-attached`} className="mt-2 text-xs font-semibold text-emerald-700">
            Uploaded
          </p>
        ) : null}

        <input
          type="file"
          data-testid={`kyc-${key}-input`}
          aria-label={SLOT_LABEL[purpose]}
          accept={ACCEPT_BY_PURPOSE[purpose]}
          disabled={busy}
          onChange={(event) => chooseFile(purpose, event.target.files?.[0] ?? null)}
          className="mt-2 block w-full text-xs"
        />

        {slot.file ? (
          <div className="mt-3 flex items-center gap-3">
            {slot.previewUrl ? (
              <img
                data-testid={`kyc-${key}-preview`}
                src={slot.previewUrl}
                alt={`${SLOT_LABEL[purpose]} preview`}
                className="h-20 w-20 rounded-lg border border-brand-border object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-brand-border bg-brand-canvas text-xs text-brand-muted">
                PDF
              </div>
            )}
            <span className="truncate text-xs text-brand-charcoal">{slot.file.name}</span>
          </div>
        ) : null}

        {slot.stage ? (
          <div className="mt-3" data-testid={`kyc-${key}-progress`}>
            <div className="h-2 overflow-hidden rounded-full bg-brand-primary-soft">
              <div
                className="h-full bg-brand-primary transition-all"
                style={{ width: `${slot.progress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-brand-muted" data-testid={`kyc-${key}-stage`}>
              {slot.stage === 'requesting' && 'Preparing upload...'}
              {slot.stage === 'uploading' && 'Uploading...'}
              {slot.stage === 'verifying' && 'Checking your file...'}
              {slot.stage === 'attaching' && 'Saving...'}
              {slot.stage === 'done' && 'Done'}
            </p>
          </div>
        ) : null}

        <ErrorNotice error={slot.error} testId={`kyc-${key}-error`} className="mt-3" />

        {slot.file ? (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              data-testid={`kyc-${key}-upload`}
              disabled={busy || slot.uploaded}
              onClick={() => void upload(purpose)}
              className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {slot.error && !busy ? 'Try again' : 'Upload'}
            </button>
            <button
              type="button"
              data-testid={`kyc-${key}-discard`}
              disabled={busy}
              onClick={() => discard(purpose)}
              className="rounded-xl border border-brand-border px-4 py-2 text-sm font-semibold text-brand-charcoal disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-canvas px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="flex items-center justify-between border-b border-brand-border/60 pb-4">
          <Logo variant="navbar" showTagline={false} />
          <button type="button" onClick={onLogout} className="text-xs text-brand-muted hover:underline">
            Sign out
          </button>
        </header>

        <div>
          <h1 className="font-serif text-3xl font-bold text-brand-charcoal">Verify your identity</h1>
          <p className="mt-1 text-sm text-brand-muted">
            Upload a clear photo of yourself and a government ID. Only our review team can see them.
          </p>
        </div>

        <ErrorNotice error={error} testId="kyc-error" />
        {loading ? <p className="text-sm text-brand-muted">Loading...</p> : null}

        {verification ? (
          <KycStatusCard
            token={token}
            verification={verification}
            onRestart={() => void restart()}
            restarting={restarting}
            restartError={restartError}
          />
        ) : null}

        {collecting ? (
          <>
            <div className="rounded-2xl border border-brand-border bg-white p-4">
              <div>
                <label htmlFor="kyc-document-type" className="text-xs font-semibold uppercase tracking-wider text-brand-muted">
                  Document type
                </label>
                <select
                  id="kyc-document-type"
                  data-testid="kyc-document-type"
                  className={SELECT_CLASS}
                  value={documentType}
                  onChange={(event) => setDocumentType(event.target.value as KycDocumentType | '')}
                >
                  <option value="">Choose a document</option>
                  {DOCUMENT_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <FieldError name="documentType" text={idFieldErrors.documentType} />
              </div>
              <div className="mt-3">
                <label htmlFor="kyc-id-number" className="text-xs font-semibold uppercase tracking-wider text-brand-muted">
                  ID number
                </label>
                <input
                  id="kyc-id-number"
                  data-testid="kyc-id-number"
                  className={SELECT_CLASS}
                  value={idNumber}
                  maxLength={32}
                  onChange={(event) => setIdNumber(event.target.value)}
                  autoComplete="off"
                />
                <FieldError name="idNumber" text={idFieldErrors.idNumber} />
              </div>
            </div>
            {renderSlot('kycPhoto')}
            {renderSlot('kycId')}
          </>
        ) : null}

        {actions.submit ? (
          <SubmitForReview
            token={token}
            label="Submit for review"
            onSubmitted={async () => onProfileUpdate(await api.getMyProfile(token))}
          />
        ) : null}
        {(status === 'needsReview' || status === 'approved') && !actions.submit ? (
          <button
            type="button"
            data-testid="kyc-continue"
            onClick={() => navigate('/pending')}
            className="w-full rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white"
          >
            Continue
          </button>
        ) : null}
        {status === 'failed' || status === 'changesNeeded' ? (
          <button
            type="button"
            data-testid="kyc-back-to-status"
            onClick={() => navigate('/pending')}
            className="w-full rounded-xl border border-brand-border px-5 py-3 text-sm font-semibold text-brand-charcoal"
          >
            Back to review status
          </button>
        ) : null}
      </div>
    </div>
  );
}
