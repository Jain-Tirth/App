import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../api';
import { buildConsentPayload, codesNeedingConsent } from '../lib/consents';
import { describeError, type FriendlyError } from '../errors/messages';
import type { ConsentDocument, ConsentLanguage, ConsentRecord, CurrentConsentsResponse } from '../types';
import { ConsentChecklist } from './ConsentChecklist';
import { ErrorNotice } from './ErrorNotice';

interface ReconsentPanelProps {
  token: string;
  onAccepted: () => void;
}

/**
 * Asks a signed-in member to accept the current documents. Uses
 * POST /consents/renew when they have accepted before, otherwise POST /consents.
 */
export function ReconsentPanel({ token, onAccepted }: ReconsentPanelProps) {
  const [language, setLanguage] = useState<ConsentLanguage>('en');
  const [documents, setDocuments] = useState<ConsentDocument[]>([]);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [everAccepted, setEverAccepted] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<FriendlyError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const payload = buildConsentPayload(documents, accepted);

  async function loadDocuments(next: ConsentLanguage): Promise<ConsentDocument[]> {
    const response = await api.getCurrentConsents(token, next);
    setEverAccepted(
      Object.fromEntries(response.consents.map((item) => [item.code, item.accepted])),
    );
    return response.consents;
  }

  async function submit() {
    if (!payload) return;
    setError(null);
    setSubmitting(true);
    try {
      for (const item of payload) {
        await api.recordConsent(token, { ...item, language }, everAccepted[item.code] === true);
      }
      onAccepted();
    } catch (err) {
      setError(describeError(err, 'consents'));
      setAccepted({});
      setReloadKey((key) => key + 1);
      setSubmitting(false);
    }
  }

  return (
    <div data-testid="reconsent-panel" className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-2xl font-serif font-bold text-brand-charcoal">Please review our documents</h1>
      <p className="text-sm text-brand-muted">
        To continue, please read and accept the current documents.
      </p>
      <ConsentChecklist
        language={language}
        onLanguageChange={setLanguage}
        accepted={accepted}
        onAcceptedChange={setAccepted}
        onDocumentsChange={setDocuments}
        reloadKey={reloadKey}
        loadDocuments={loadDocuments}
      />
      <ErrorNotice error={error} testId="reconsent-error" />
      <button
        type="button"
        data-testid="reconsent-submit"
        disabled={!payload || submitting}
        onClick={() => void submit()}
        className="w-full rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {submitting ? 'Saving...' : 'Accept and continue'}
      </button>
    </div>
  );
}

interface ConsentGateProps {
  token: string;
  children: ReactNode;
}

/**
 * Shows the re-consent panel in place of its children while any required
 * document is unaccepted, expired or flagged for re-consent. If the status
 * cannot be read it lets the page through; the page's own calls then report
 * the problem (a KYC call also answers CONSENT_REQUIRED).
 */
export function ConsentGate({ token, children }: ConsentGateProps) {
  const [state, setState] = useState<'checking' | 'ok' | 'needed'>('checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .getCurrentConsents(token, 'en')
      .then((response: CurrentConsentsResponse) => {
        if (!cancelled) {
          setState(codesNeedingConsent(response.consents).length > 0 ? 'needed' : 'ok');
        }
      })
      .catch(() => {
        if (!cancelled) setState('ok');
      });
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  if (state === 'checking') {
    return <p className="p-6 text-center text-sm text-brand-muted">Loading...</p>;
  }
  if (state === 'needed') {
    return <ReconsentPanel token={token} onAccepted={() => setAttempt((n) => n + 1)} />;
  }
  return <>{children}</>;
}

/** Read-only list of the member's consent records. */
export function ConsentHistory({ token }: { token: string }) {
  const [records, setRecords] = useState<ConsentRecord[] | null>(null);
  const [error, setError] = useState<FriendlyError | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getConsentHistory(token)
      .then((response) => {
        if (!cancelled) setRecords(response.records);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(describeError(err, 'consents'));
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <section data-testid="consent-history" className="rounded-2xl border border-brand-border bg-white p-5">
      <h2 className="text-sm font-semibold text-brand-charcoal">Consent history</h2>
      <ErrorNotice error={error} testId="consent-history-error" className="mt-2" />
      {records && records.length === 0 ? (
        <p className="mt-2 text-xs text-brand-muted">No consents recorded yet.</p>
      ) : null}
      <ul className="mt-2 space-y-1 text-xs text-brand-muted">
        {(records ?? []).map((record) => (
          <li key={record.id} data-testid={`consent-record-${record.code}`}>
            <span className="font-semibold text-brand-charcoal">{record.code}</span> version{' '}
            {record.version}, accepted {record.grantedAt.slice(0, 10)}, valid until{' '}
            {record.expiresAt.slice(0, 10)}
          </li>
        ))}
      </ul>
    </section>
  );
}
