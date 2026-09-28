import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import type { ReviewProfileResponse } from '../types';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Textarea } from '../components/ui/textarea';
import { Separator } from '../components/ui/separator';
import {
  ArrowLeft,
  Check,
  X,
  Shield,
  AlertCircle,
  Clock,
  User,
  Mail,
  Phone,
} from 'lucide-react';

interface ReviewPageProps {
  token: string;
}

export function ReviewPage({ token }: ReviewPageProps) {
  const navigate = useNavigate();
  const { userId = '' } = useParams();
  const [data, setData] = useState<ReviewProfileResponse | null>(null);
  const [reason, setReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const response = await api.getProfile(token, userId);
        setData(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      }
    }

    void load();
  }, [token, userId]);

  async function approve() {
    setActionLoading(true);
    setError('');
    try {
      await api.approveProfile(token, userId);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve profile');
      setActionLoading(false);
    }
  }

  async function reject() {
    if (!reason.trim()) {
      setError('Rejection reason is required.');
      return;
    }

    setActionLoading(true);
    setError('');
    try {
      await api.rejectProfile(token, userId, reason);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject profile');
      setActionLoading(false);
    }
  }

  const sections: [string, Record<string, unknown>][] = data?.profile
    ? [
        ['Personal Details', (data.profile.personalDetails as Record<string, unknown>) || {}],
        ['Religious & Astrology', (data.profile.religiousDetails as Record<string, unknown>) || {}],
        ['Location & Residency', (data.profile.locationDetails as Record<string, unknown>) || {}],
        ['Education & Career', (data.profile.professionalDetails as Record<string, unknown>) || {}],
        ['Lifestyle & Family', (data.profile.additionalDetails as Record<string, unknown>) || {}],
        [
          'Verification Checks',
          (data.profile.verificationFlags as Record<string, unknown>) || {
            photoVerified: (data.profile as Record<string, unknown>).photoVerified ? 'Yes' : 'No',
            idVerified: (data.profile as Record<string, unknown>).idVerified ? 'Yes' : 'No',
          },
        ],
      ]
    : [];

  return (
    <div className="min-h-screen bg-black text-white px-4 py-8 md:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Navigation & Actions Top Bar */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/')}
            className="gap-2 border-neutral-800 text-neutral-300 hover:bg-neutral-900 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Queue</span>
          </Button>
          <div className="flex items-center gap-2">
            <span className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1 font-mono text-xs text-neutral-400">
              AUDIT MODE
            </span>
          </div>
        </div>

        {error ? (
          <div className="flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900 p-4 text-xs text-neutral-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-white" />
            <span>{error}</span>
          </div>
        ) : null}

        {data ? (
          <>
            {/* Header Profile Summary */}
            <Card className="border-neutral-800 bg-neutral-950/80 shadow-elevated">
              <CardContent className="p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h1 className="text-2xl font-bold tracking-tight text-white">
                        {data.profile.user.name}
                      </h1>
                      <Badge variant="outline" className="font-mono text-xs">
                        {data.profile.profileUid ?? 'NO UID ASSIGNED'}
                      </Badge>
                      <Badge variant="pending" className="text-xs">
                        {data.profile.user.accountStatus}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-400">
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-neutral-500" />
                        <span>{data.profile.user.email}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-neutral-500" />
                        <span>{data.profile.user.mobile}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-neutral-500" />
                        <span className="capitalize">Created by: {data.profile.user.profileCreatedBy ?? 'Self'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-start md:items-end gap-1.5">
                    <span className="text-xs uppercase tracking-wider text-neutral-400">Completeness</span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-28 overflow-hidden rounded-full bg-neutral-800">
                        <div
                          className="h-full bg-white transition-all"
                          style={{ width: `${Math.min(data.profile.profileComplete, 100)}%` }}
                        />
                      </div>
                      <span className="font-mono text-sm font-semibold text-white">
                        {data.profile.profileComplete}%
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Profile Detail Sections Bento Grid */}
            <div className="grid gap-5 md:grid-cols-2">
              {sections.map(([title, values]) => (
                <Card
                  key={title}
                  className="border-neutral-800 bg-neutral-950/80 shadow-subtle"
                >
                  <CardHeader className="border-b border-neutral-800/60 pb-3">
                    <CardTitle className="text-sm font-medium uppercase tracking-wider text-neutral-400">
                      {title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {Object.entries(values || {}).length === 0 ? (
                      <p className="py-2 text-xs italic text-neutral-500">
                        No entries recorded for this section.
                      </p>
                    ) : (
                      <div className="space-y-3 text-xs">
                        {Object.entries(values || {}).map(([key, value]) => (
                          <div
                            key={key}
                            className="flex items-center justify-between gap-4 border-b border-neutral-900 pb-2.5 last:border-0 last:pb-0"
                          >
                            <span className="capitalize text-neutral-400">
                              {key.replace(/([A-Z])/g, ' $1')}
                            </span>
                            <span className="text-right font-medium text-white max-w-[60%] truncate">
                              {Array.isArray(value)
                                ? value.join(', ') || '—'
                                : typeof value === 'boolean'
                                ? value ? 'Yes' : 'No'
                                : String(value ?? '—')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Moderation Actions Card */}
            <Card className="border-neutral-800 bg-neutral-950/80 shadow-elevated">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-white" />
                  <CardTitle className="text-base font-semibold text-white">
                    Moderation Decision
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-neutral-400">
                  Approving activates candidate visibility in match feeds. Rejection flags the account and sends feedback to the user.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                    Rejection Feedback (Required if rejecting)
                  </label>
                  <Textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="E.g., Incomplete address details or unclear identity documents..."
                    rows={3}
                  />
                </div>

                <Separator className="bg-neutral-800" />

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    disabled={actionLoading}
                    onClick={() => void reject()}
                    className="gap-2 border-neutral-700 hover:bg-neutral-900 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                    <span>Reject Profile</span>
                  </Button>
                  <Button
                    variant="default"
                    disabled={actionLoading}
                    onClick={() => void approve()}
                    className="gap-2"
                  >
                    <Check className="h-4 w-4" />
                    <span>Approve & Activate Profile</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Clock className="h-8 w-8 animate-spin text-neutral-500" />
            <p className="mt-4 text-sm text-neutral-400">Loading applicant record...</p>
          </div>
        )}
      </div>
    </div>
  );
}
