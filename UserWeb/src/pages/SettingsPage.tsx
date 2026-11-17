import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../api';
import { hasErrorCode, isApiError } from '../apiError';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorNotice } from '../components/ErrorNotice';
import { StepUpDialog } from '../components/StepUpDialog';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { describeError, type FriendlyError } from '../errors/messages';
import {
  DELETION_COOLING_OFF_DAYS,
  LANGUAGE_OPTIONS,
  NO_THIRD_PARTY_TEXT,
  diffSettings,
  humanizeFlag,
  pickEditable,
  type EditableSettings,
  type SettingsLanguage,
} from '../lib/accountSettings';
import {
  clearExportRequest,
  readExportRequest,
  saveExportRequest,
} from '../lib/exportRequest';

interface SettingsPageProps {
  token: string;
  userId: string;
  /** The session is no longer valid: clear it and go to sign-in. */
  onLogout: () => void;
  /** Every session was ended on the server. */
  onLoggedOutEverywhere: () => void;
  /** A deletion was scheduled; the app switches to the deleted-pending screen. */
  onDeletionScheduled: (scheduledPurgeAt: string) => void;
}

type Dialog = 'logoutAll' | 'export' | 'delete' | null;

function SettingsSkeleton() {
  return (
    <div data-testid="settings-skeleton" aria-busy="true" className="space-y-4">
      <div className="h-24 animate-pulse rounded-2xl bg-brand-border/50" />
      <div className="h-40 animate-pulse rounded-2xl bg-brand-border/50" />
      <div className="h-24 animate-pulse rounded-2xl bg-brand-border/50" />
    </div>
  );
}

export function SettingsPage({
  token,
  userId,
  onLogout,
  onLoggedOutEverywhere,
  onDeletionScheduled,
}: SettingsPageProps) {
  const [values, setValues] = useState<EditableSettings | null>(null);
  /** The settings as shown (saved values plus changes still being sent). */
  const view = useRef<EditableSettings | null>(null);
  const show = useCallback((next: EditableSettings) => {
    view.current = next;
    setValues(next);
  }, []);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<FriendlyError | null>(null);
  const [saveError, setSaveError] = useState<FriendlyError | null>(null);
  const [pendingKeys, setPendingKeys] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);

  const [dialog, setDialog] = useState<Dialog>(null);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState<FriendlyError | null>(null);
  const logoutInFlight = useRef(false);

  const [exportId, setExportId] = useState<string | null>(() => readExportRequest(userId)?.requestId ?? null);
  const [exportReceived, setExportReceived] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [downloadError, setDownloadError] = useState<FriendlyError | null>(null);
  const downloadInFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    api
      .getSettings(token)
      .then((response) => {
        if (cancelled) return;
        const editable = pickEditable(response);
        show(editable);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (hasErrorCode(err, 'UNAUTHORIZED')) {
          onLogout();
          return;
        }
        // A pending deletion is handled by the app-level reaction to the 403.
        setLoadError(describeError(err, 'settings'));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, attempt, onLogout, show]);

  const language = values?.language;
  useEffect(() => {
    if (language) document.documentElement.lang = language;
  }, [language]);

  /** Sends one PATCH with only the changed keys; reverts exactly those keys on failure. */
  const change = useCallback(
    async (next: EditableSettings) => {
      const before = view.current;
      if (!before) return;
      const patch = diffSettings(before, next);
      const keys = [
        ...(patch.language ? ['language'] : []),
        ...Object.keys(patch.notifications ?? {}).map((key) => `n:${key}`),
      ];
      if (keys.length === 0) return;
      setSaveError(null);
      show({
        language: patch.language ?? before.language,
        notifications: { ...before.notifications, ...(patch.notifications ?? {}) },
      });
      setPendingKeys((current) => [...current, ...keys]);
      try {
        await api.updateSettings(token, patch);
      } catch (err) {
        if (hasErrorCode(err, 'UNAUTHORIZED')) {
          onLogout();
          return;
        }
        setSaveError(describeError(err, 'settings'));
        // Put back exactly the keys this call changed; other controls keep their value.
        const now = view.current ?? before;
        const reverted: EditableSettings = {
          language: patch.language ? before.language : now.language,
          notifications: { ...now.notifications },
        };
        for (const key of Object.keys(patch.notifications ?? {})) {
          reverted.notifications[key] = before.notifications[key];
        }
        show(reverted);
      } finally {
        setPendingKeys((current) => current.filter((key) => !keys.includes(key)));
      }
    },
    [token, onLogout, show],
  );

  async function confirmLogoutAll() {
    if (logoutInFlight.current) return;
    logoutInFlight.current = true;
    setLogoutBusy(true);
    setLogoutError(null);
    try {
      await api.logoutAll(token);
      onLoggedOutEverywhere();
    } catch (err) {
      if (hasErrorCode(err, 'UNAUTHORIZED')) {
        onLogout();
        return;
      }
      setLogoutError(describeError(err, 'settings'));
      logoutInFlight.current = false;
      setLogoutBusy(false);
    }
  }

  function closeDialog() {
    setDialog(null);
    setLogoutError(null);
  }

  async function runExport(password: string) {
    const accepted = await api.requestExport(token, password);
    saveExportRequest(userId, accepted.requestId);
    setExportId(accepted.requestId);
    setExportReceived(true);
    setDownloadError(null);
    setDialog(null);
  }

  async function runDelete(password: string) {
    const accepted = await api.requestDeletion(token, password);
    onDeletionScheduled(accepted.scheduledPurgeAt);
  }

  async function download() {
    if (!exportId || downloadInFlight.current) return;
    downloadInFlight.current = true;
    setDownloadBusy(true);
    setDownloadError(null);
    try {
      const blob = await api.downloadExport(token, exportId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'my-data.json';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      if (hasErrorCode(err, 'UNAUTHORIZED')) {
        onLogout();
        return;
      }
      if (isGone(err)) {
        clearExportRequest(userId);
        setExportId(null);
        setExportReceived(false);
      }
      setDownloadError(describeError(err, 'export'));
    } finally {
      downloadInFlight.current = false;
      setDownloadBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-canvas text-brand-charcoal">
      <header className="border-b border-brand-border/80 bg-white/95">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3.5 sm:px-6">
          <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
            <Link to="/app">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Back to app
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        <h1 className="font-serif text-3xl font-bold text-brand-charcoal">Settings</h1>
        <p data-testid="privacy-statement" className="text-sm text-brand-muted">
          {NO_THIRD_PARTY_TEXT}
        </p>

        {loading ? <SettingsSkeleton /> : null}

        {!loading && loadError ? (
          <div className="space-y-3">
            <ErrorNotice error={loadError} testId="settings-load-error" />
            <Button type="button" data-testid="settings-retry" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </Button>
          </div>
        ) : null}

        {!loading && values ? (
          <>
            <ErrorNotice error={saveError} testId="settings-save-error" />

            <Card className="space-y-3 border-brand-border bg-white p-6">
              <h2 className="font-serif text-lg font-bold">Language</h2>
              <label htmlFor="settings-language" className="block text-sm text-brand-muted">
                Preferred language
              </label>
              <select
                id="settings-language"
                data-testid="settings-language"
                value={values.language}
                disabled={pendingKeys.includes('language')}
                onChange={(event) =>
                  void change({
                    ...(view.current ?? values),
                    language: event.target.value as SettingsLanguage,
                  })
                }
                className="w-full rounded-xl border border-brand-border bg-brand-canvas px-4 py-3 text-sm text-brand-charcoal focus:border-brand-primary focus:outline-none"
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Card>

            <Card className="space-y-3 border-brand-border bg-white p-6">
              <h2 className="font-serif text-lg font-bold">In-app notifications</h2>
              <ul className="divide-y divide-brand-border/60">
                {Object.entries(values.notifications).map(([key, on]) => {
                  const label = humanizeFlag(key);
                  return (
                    <li key={key} className="flex items-center justify-between gap-3 py-3">
                      <span className="min-w-0 text-sm">{label}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        aria-label={label}
                        data-testid={`switch-${key}`}
                        disabled={pendingKeys.includes(`n:${key}`)}
                        onClick={() =>
                          void change({
                            ...(view.current ?? values),
                            notifications: { ...(view.current ?? values).notifications, [key]: !on },
                          })
                        }
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-50 ${
                          on ? 'bg-brand-primary' : 'bg-brand-border'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                            on ? 'translate-x-5' : ''
                          }`}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <Card className="space-y-3 border-brand-border bg-white p-6">
              <h2 className="font-serif text-lg font-bold">Your data</h2>
              <p className="text-sm text-brand-muted">{NO_THIRD_PARTY_TEXT}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  data-testid="export-open"
                  onClick={() => setDialog('export')}
                >
                  Download my data
                </Button>
                {exportId ? (
                  <Button
                    type="button"
                    variant="outline"
                    data-testid="export-download"
                    disabled={downloadBusy}
                    onClick={() => void download()}
                  >
                    {downloadBusy ? 'Preparing...' : 'Download'}
                  </Button>
                ) : null}
              </div>
              {exportReceived ? (
                <p role="status" data-testid="export-received" className="text-sm font-medium">
                  Your export request was received.
                </p>
              ) : null}
              {exportId ? (
                <p data-testid="export-status" className="text-sm text-brand-muted">
                  Export status: pending. The download link is valid for 24 hours.
                </p>
              ) : null}
              <ErrorNotice error={downloadError} testId="export-download-error" />
            </Card>

            <Card className="space-y-3 border-brand-border bg-white p-6">
              <h2 className="font-serif text-lg font-bold">Sign out and delete</h2>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  data-testid="logout-all-open"
                  onClick={() => setDialog('logoutAll')}
                >
                  Log out of all devices
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  data-testid="delete-open"
                  onClick={() => setDialog('delete')}
                >
                  Delete my account
                </Button>
              </div>
            </Card>
          </>
        ) : null}
      </main>

      {dialog === 'logoutAll' ? (
        <ConfirmDialog
          title="Log out of all devices? You will need to sign in again everywhere."
          confirmLabel="Log out everywhere"
          cancelLabel="Stay signed in"
          busyLabel="Logging out..."
          busy={logoutBusy}
          error={logoutError}
          onConfirm={() => void confirmLogoutAll()}
          onClose={closeDialog}
        />
      ) : null}

      {dialog === 'export' ? (
        <StepUpDialog
          title="Download my data"
          confirmLabel="Request export"
          busyLabel="Requesting..."
          run={runExport}
          onClose={closeDialog}
          onLogout={onLogout}
        >
          <p>Enter your password to request a copy of your data.</p>
          <p>{NO_THIRD_PARTY_TEXT}</p>
          <p>The download link is valid for 24 hours.</p>
        </StepUpDialog>
      ) : null}

      {dialog === 'delete' ? (
        <StepUpDialog
          title="Delete your account"
          confirmLabel="Delete my account"
          busyLabel="Deleting..."
          run={runDelete}
          onClose={closeDialog}
          onLogout={onLogout}
        >
          <p>
            Your account will be hidden straight away and permanently deleted after{' '}
            {DELETION_COOLING_OFF_DAYS} days. You can cancel at any time during those{' '}
            {DELETION_COOLING_OFF_DAYS} days.
          </p>
          <p>{NO_THIRD_PARTY_TEXT}</p>
        </StepUpDialog>
      ) : null}
    </div>
  );
}

/** A 410 on download means the link expired, so the stored request id is useless. */
function isGone(err: unknown): boolean {
  return isApiError(err) && err.status === 410;
}
