import { useEffect, useState } from 'react';
import { api } from '../api';
import { describeError, type FriendlyError } from '../errors/messages';
import { REQUIRED_CONSENT_CODES } from '../lib/consents';
import type { ConsentDocument, ConsentLanguage } from '../types';
import { ErrorNotice } from './ErrorNotice';

const LANGUAGES: Array<{ value: ConsentLanguage; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'gu', label: 'ગુજરાતી' },
];

const TITLES: Record<string, string> = {
  terms: 'Terms of Service',
  privacy: 'Privacy Policy',
  id_processing: 'Identity document processing',
};

interface ConsentChecklistProps {
  language: ConsentLanguage;
  onLanguageChange: (language: ConsentLanguage) => void;
  accepted: Record<string, boolean>;
  onAcceptedChange: (accepted: Record<string, boolean>) => void;
  onDocumentsChange: (documents: ConsentDocument[]) => void;
  /** Bump to force a reload, for example after a stale-document rejection. */
  reloadKey?: number;
  /** Supplies documents for a signed-in member instead of the public endpoint. */
  loadDocuments?: (language: ConsentLanguage) => Promise<ConsentDocument[]>;
}

/**
 * Shows the consent documents as plain text (never HTML) in the chosen
 * language, with one required checkbox per document code.
 */
export function ConsentChecklist({
  language,
  onLanguageChange,
  accepted,
  onAcceptedChange,
  onDocumentsChange,
  reloadKey = 0,
  loadDocuments,
}: ConsentChecklistProps) {
  const [documents, setDocuments] = useState<ConsentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FriendlyError | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const load = loadDocuments
      ? loadDocuments(language)
      : api.getConsentDocuments(language).then((response) => response.documents);
    load
      .then((loaded) => {
        if (cancelled) return;
        const ordered = REQUIRED_CONSENT_CODES.flatMap((code) =>
          loaded.filter((document) => document.code === code),
        );
        setDocuments(ordered);
        onDocumentsChange(ordered);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(describeError(err, 'consents'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // The callbacks are stable enough for this screen; reload on language or key only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, reloadKey]);

  return (
    <section data-testid="consent-checklist" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-brand-charcoal">Documents to accept</h2>
        <div className="flex gap-1" role="group" aria-label="Document language">
          {LANGUAGES.map((item) => (
            <button
              key={item.value}
              type="button"
              data-testid={`consent-language-${item.value}`}
              aria-pressed={language === item.value}
              onClick={() => onLanguageChange(item.value)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                language === item.value
                  ? 'bg-brand-primary text-white'
                  : 'border border-brand-border text-brand-muted'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <ErrorNotice error={error} testId="consent-error" />
      {loading ? <p className="text-xs text-brand-muted">Loading documents...</p> : null}

      {documents.map((document) => (
        <div
          key={document.code}
          data-testid={`consent-doc-${document.code}`}
          className="rounded-xl border border-brand-border bg-white p-3"
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-muted">
            {TITLES[document.code] ?? 'Document'}
          </h3>
          <pre
            data-testid={`consent-text-${document.code}`}
            className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap font-sans text-xs text-brand-charcoal"
          >
            {document.text}
          </pre>
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-brand-charcoal">
            <input
              type="checkbox"
              data-testid={`consent-checkbox-${document.code}`}
              checked={accepted[document.code] === true}
              onChange={(event) =>
                onAcceptedChange({ ...accepted, [document.code]: event.target.checked })
              }
              className="mt-0.5 h-4 w-4 accent-brand-primary"
            />
            <span>I have read and accept the {TITLES[document.code] ?? 'document'}.</span>
          </label>
        </div>
      ))}
    </section>
  );
}
