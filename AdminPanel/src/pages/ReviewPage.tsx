import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import {
  CHANGES_REASON_CODES,
  REASON_CODES,
  SECTIONS,
  type PendingProfile,
  type ReasonCode,
  type ReviewWorkspace,
  type Section,
  type SignedDocument,
} from '../types';
import { SlaBadge } from '../components/SlaBadge';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Textarea } from '../components/ui/textarea';
import { ArrowLeft, Check, X, Shield, AlertCircle, Clock, MessageSquareWarning } from 'lucide-react';

interface ReviewPageProps {
  token: string;
}

const NOTES_MAX = 500;
const selectClass =
  'w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white';

export function ReviewPage({ token }: ReviewPageProps) {
  const navigate = useNavigate();
  const { userId = '' } = useParams();
  const [queue, setQueue] = useState<PendingProfile[]>([]);
  const [workspace, setWorkspace] = useState<ReviewWorkspace | null>(null);
  const [idDocument, setIdDocument] = useState<SignedDocument | null>(null);
  const [reasonCode, setReasonCode] = useState<ReasonCode | ''>('');
  const [notes, setNotes] = useState('');
  const [sections, setSections] = useState<Section[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadQueue = useCallback(async () => {
    try {
      const response = await api.getPendingProfiles(token);
      setQueue(response.profiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the queue');
    }
  }, [token]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    setWorkspace(null);
    setIdDocument(null);
    setReasonCode('');
    setNotes('');
    setSections([]);

    if (!userId) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const loaded = await api.getWorkspace(token, userId);
        // Opening the workspace is an ID view, so the audited endpoint is called.
        const document = await api.openIdDocument(token, userId);

        if (!cancelled) {
          setWorkspace(loaded);
          setIdDocument(document);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load the submission');
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [token, userId]);

  async function submit(action: 'approve' | 'reject' | 'requestChanges') {
    setBusy(true);
    setError('');

    const body = {
      ...(reasonCode ? { reasonCode } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(action === 'requestChanges' ? { sections } : {}),
    };

    try {
      if (action === 'approve') {
        await api.approveProfile(token, userId, body);
      } else if (action === 'reject') {
        await api.rejectProfile(token, userId, body);
      } else {
        await api.requestChanges(token, userId, body);
      }

      await loadQueue();
      navigate('/profiles');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record the decision');
    } finally {
      setBusy(false);
    }
  }

  function toggleSection(section: Section) {
    setSections((current) =>
      current.includes(section)
        ? current.filter((item) => item !== section)
        : [...current, section],
    );
  }

  const reasonOptions = REASON_CODES;
  const reasonChosen = reasonCode !== '';
  const changesAllowed =
    reasonChosen &&
    CHANGES_REASON_CODES.includes(reasonCode as ReasonCode) &&
    notes.trim().length > 0 &&
    sections.length > 0;

  return (
    <div className="min-h-screen bg-black text-white px-4 py-8 md:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/')}
            className="gap-2 border-neutral-800 text-neutral-300 hover:bg-neutral-900 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Dashboard</span>
          </Button>
          <span className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1 font-mono text-xs text-neutral-400">
            AUDIT MODE
          </span>
        </div>

        {error ? (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900 p-4 text-xs text-neutral-200"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-white" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <Card className="border-neutral-800 bg-neutral-950/80" data-testid="review-queue">
            <CardHeader className="border-b border-neutral-800/60 pb-3">
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-neutral-400">
                Queue · oldest first
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-4">
              {queue.length === 0 ? (
                <p className="text-xs italic text-neutral-500">Nothing is awaiting review.</p>
              ) : (
                queue.map((item) => (
                  <button
                    key={item.userId}
                    type="button"
                    data-testid="queue-row"
                    onClick={() => navigate(`/profiles/${item.userId}`)}
                    className={`w-full rounded-md border p-3 text-left text-xs transition-colors hover:border-neutral-600 ${
                      item.userId === userId
                        ? 'border-white bg-neutral-900'
                        : 'border-neutral-800 bg-neutral-950'
                    }`}
                  >
                    <div className="font-medium text-white">{item.name}</div>
                    <div className="mt-0.5 font-mono text-neutral-500">
                      {item.profileUid ?? 'No UID'} · {new Date(item.submittedAt).toLocaleString()}
                    </div>
                    <div className="mt-2">
                      <SlaBadge state={item.slaState} remainingHours={item.slaRemainingHours} />
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          {workspace ? (
            <div className="space-y-6" data-testid="workspace">
              <Card className="border-neutral-800 bg-neutral-950/80">
                <CardContent className="space-y-3 p-6">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-2xl font-bold tracking-tight">{workspace.name}</h1>
                    <Badge variant="outline" className="font-mono text-xs">
                      {workspace.profileUid ?? 'NO UID ASSIGNED'}
                    </Badge>
                    <Badge
                      variant={workspace.ageCheck === 'pass' ? 'approved' : 'destructive'}
                      data-testid="age-check"
                    >
                      Age check: {workspace.ageCheck}
                    </Badge>
                  </div>
                  <dl className="grid gap-3 text-xs sm:grid-cols-4">
                    <div>
                      <dt className="text-neutral-500">Date of birth</dt>
                      <dd data-testid="dob">{workspace.dateOfBirth ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Age</dt>
                      <dd data-testid="age">{workspace.age ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Document type</dt>
                      <dd>{workspace.documentType ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">ID number</dt>
                      <dd className="font-mono" data-testid="masked-id">
                        {workspace.idNumberMasked ?? '—'}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              <div className="grid gap-5 md:grid-cols-2">
                <Card className="border-neutral-800 bg-neutral-950/80">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm uppercase tracking-wider text-neutral-400">
                      Member photo
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <img
                      data-testid="photo"
                      src={workspace.photo.url}
                      alt={`Photo submitted by ${workspace.name}`}
                      className="max-h-96 w-full rounded-md object-contain"
                    />
                  </CardContent>
                </Card>
                <Card className="border-neutral-800 bg-neutral-950/80">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm uppercase tracking-wider text-neutral-400">
                      Government ID
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {idDocument?.contentType === 'application/pdf' ? (
                      <iframe
                        data-testid="id-document"
                        src={idDocument.url}
                        title="Government ID"
                        className="h-96 w-full rounded-md"
                      />
                    ) : idDocument ? (
                      <img
                        data-testid="id-document"
                        src={idDocument.url}
                        alt={`ID document submitted by ${workspace.name}`}
                        className="max-h-96 w-full rounded-md object-contain"
                      />
                    ) : null}
                  </CardContent>
                </Card>
              </div>

              <Card className="border-neutral-800 bg-neutral-950/80">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    <CardTitle className="text-base font-semibold">Decision</CardTitle>
                  </div>
                  <CardDescription className="text-xs text-neutral-400">
                    Reject and Request changes need a reason code. Request changes also needs
                    a note and at least one flagged section.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <label className="block space-y-1.5 text-xs uppercase tracking-wider text-neutral-400">
                    Reason code
                    <select
                      data-testid="reason-code"
                      className={selectClass}
                      value={reasonCode}
                      onChange={(event) => setReasonCode(event.target.value as ReasonCode | '')}
                    >
                      <option value="">Select a reason…</option>
                      {reasonOptions.map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-1.5 text-xs uppercase tracking-wider text-neutral-400">
                    Notes ({notes.length}/{NOTES_MAX})
                    <Textarea
                      data-testid="notes"
                      value={notes}
                      maxLength={NOTES_MAX}
                      onChange={(event) => setNotes(event.target.value)}
                      rows={3}
                    />
                  </label>

                  <fieldset className="space-y-1.5">
                    <legend className="text-xs uppercase tracking-wider text-neutral-400">
                      Sections to fix (request changes)
                    </legend>
                    <div className="flex flex-wrap gap-3 text-xs">
                      {SECTIONS.map((section) => (
                        <label key={section} className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            data-testid={`section-${section}`}
                            checked={sections.includes(section)}
                            onChange={() => toggleSection(section)}
                          />
                          {section}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <Button
                      variant="outline"
                      data-testid="decision-reject"
                      disabled={busy || !reasonChosen}
                      onClick={() => void submit('reject')}
                      className="gap-2 border-neutral-700"
                    >
                      <X className="h-4 w-4" />
                      <span>Reject</span>
                    </Button>
                    <Button
                      variant="outline"
                      data-testid="decision-request-changes"
                      disabled={busy || !changesAllowed}
                      onClick={() => void submit('requestChanges')}
                      className="gap-2 border-neutral-700"
                    >
                      <MessageSquareWarning className="h-4 w-4" />
                      <span>Request changes</span>
                    </Button>
                    <Button
                      data-testid="decision-approve"
                      disabled={busy}
                      onClick={() => void submit('approve')}
                      className="gap-2"
                    >
                      <Check className="h-4 w-4" />
                      <span>Approve</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : userId ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Clock className="h-8 w-8 animate-spin text-neutral-500" />
              <p className="mt-4 text-sm text-neutral-400">Loading submission...</p>
            </div>
          ) : (
            <div className="flex items-center justify-center py-24 text-sm text-neutral-500">
              Select a submission from the queue.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
