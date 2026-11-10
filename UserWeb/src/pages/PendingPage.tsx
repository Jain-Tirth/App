import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProfileResponse } from '../types';
import { api } from '../api';
import { Logo } from '../components/Logo';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  LogOut,
  ArrowRight,
  ShieldCheck,
  Edit3,
} from 'lucide-react';

interface PendingPageProps {
  token: string | null;
  profile: ProfileResponse | null;
  onProfileUpdate: (profile: ProfileResponse) => void;
  onLogout: () => void;
}

export function PendingPage({
  token,
  profile,
  onProfileUpdate,
  onLogout,
}: PendingPageProps) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  const accountStatus = profile?.profile?.user?.accountStatus ?? 'pending';
  const rejectionReason = profile?.profile?.user?.rejectionReason;
  const isApproved = accountStatus === 'active';
  const isRejected = accountStatus === 'rejected';

  // Real-time polling every 4 seconds to detect when admin approves/rejects
  useEffect(() => {
    if (!token || isApproved) return;

    const interval = setInterval(async () => {
      try {
        const latest = await api.getMyProfile(token);
        onProfileUpdate(latest);
        setLastChecked(new Date());
        if (latest.profile?.user?.accountStatus === 'active') {
          navigate('/app', { replace: true });
        }
      } catch {
        // Network retry silent
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [token, isApproved, onProfileUpdate, navigate]);

  // If already approved on render, redirect to app
  useEffect(() => {
    if (isApproved) {
      const timer = setTimeout(() => {
        navigate('/app', { replace: true });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isApproved, navigate]);

  async function handleManualCheck() {
    if (!token) return;
    setChecking(true);
    try {
      const latest = await api.getMyProfile(token);
      onProfileUpdate(latest);
      setLastChecked(new Date());
      if (latest.profile?.user?.accountStatus === 'active') {
        navigate('/app', { replace: true });
      }
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-12">
      <Card className="w-full p-8 text-center sm:p-10 border-brand-border bg-white shadow-soft">
        <div className="flex justify-center mb-6">
          <Logo variant="navbar" showTagline={false} />
        </div>

        {/* ── Case 1: Approved! ── */}
        {isApproved ? (
          <div className="space-y-5 animate-in fade-in zoom-in-95 duration-300">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 animate-bounce" />
            </div>

            <div>
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 font-semibold mb-2">
                Approval Confirmed
              </Badge>
              <h1 className="font-serif text-3xl font-bold text-brand-charcoal">
                Welcome to Dhobi Matrimony!
              </h1>
              <p className="mt-2 text-sm text-brand-muted">
                Your profile has been audited and approved by the administration team. You now have full access to discover community matches.
              </p>
            </div>

            {profile?.profile?.profileUid && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs font-mono font-semibold text-emerald-900">
                Permanent Reference UID: {profile.profile.profileUid}
              </div>
            )}

            <Button
              onClick={() => navigate('/app', { replace: true })}
              className="w-full gap-2 text-base py-6 shadow-glow"
            >
              <span>Enter Community App</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ) : isRejected ? (
          /* ── Case 2: Rejected with feedback ── */
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-red-600 ring-8 ring-red-50/50">
              <XCircle className="h-10 w-10 text-red-600" />
            </div>

            <div>
              <Badge variant="secondary" className="bg-red-100 text-red-800 font-semibold mb-2">
                Action Required
              </Badge>
              <h1 className="font-serif text-3xl font-bold text-brand-charcoal">
                Profile Needs Revision
              </h1>
              <p className="mt-2 text-sm text-brand-muted">
                Our moderation team reviewed your submission and requested adjustments before activating your profile.
              </p>
            </div>

            {rejectionReason && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-left text-xs text-red-900">
                <span className="block font-semibold uppercase tracking-wider text-red-700 mb-1">
                  Reason for Revision:
                </span>
                <p className="italic">{rejectionReason}</p>
              </div>
            )}

            <div className="pt-2 flex flex-col gap-3">
              <Button
                onClick={() => navigate('/register')}
                className="w-full gap-2"
              >
                <Edit3 className="h-4 w-4" />
                <span>Update Profile Details</span>
              </Button>
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
        ) : (
          /* ── Case 3: Pending Verification ── */
          <div className="space-y-6">
            <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-primary-soft text-brand-primary">
              <Clock className="h-9 w-9 text-brand-primary animate-pulse" />
              <div className="absolute inset-0 rounded-full border-2 border-brand-primary/30 animate-ping" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 mb-3">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
                <span>Verification In Progress</span>
              </div>
              <h1 className="font-serif text-3xl font-bold text-brand-charcoal">
                Profile Under Review
              </h1>
              <p className="mt-2 text-sm text-brand-muted leading-relaxed">
                Thank you for completing your registration ({profile?.completion?.percentage ?? 100}% complete). Our administration team verifies all submissions to safeguard authenticity across our community.
              </p>
            </div>

            {profile?.profile?.profileUid && (
              <div className="rounded-xl border border-brand-border bg-brand-canvas p-3 text-xs text-brand-charcoal font-medium">
                Reference UID:{' '}
                <span className="font-mono font-bold text-brand-primary">
                  {profile.profile.profileUid}
                </span>
              </div>
            )}

            <div className="rounded-xl border border-brand-border/60 bg-brand-canvas/60 p-4 text-xs text-brand-muted text-left space-y-2">
              <div className="flex items-center gap-2 text-brand-charcoal font-semibold">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>What happens next?</span>
              </div>
              <p>
                1. Our admin checks candidate background, community details, and contact numbers.
              </p>
              <p>
                2. Once approved, this screen will update automatically and unlock full member access.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={checking}
                onClick={() => void handleManualCheck()}
                className="w-full sm:w-auto gap-2"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />
                <span>{checking ? 'Checking Status...' : 'Check Approval Status'}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onLogout}
                className="w-full sm:w-auto gap-2 text-brand-muted hover:text-brand-charcoal"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </Button>
            </div>

            <p className="text-[11px] text-brand-muted">
              Auto-checking approval status in real-time (last checked:{' '}
              {lastChecked.toLocaleTimeString()})
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
