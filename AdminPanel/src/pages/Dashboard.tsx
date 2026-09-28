import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { DashboardStats, PendingProfile } from '../types';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '../components/ui/table';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Users,
  LogOut,
  ArrowRight,
  Shield,
  RefreshCw,
} from 'lucide-react';

interface DashboardProps {
  token: string;
  adminName: string;
  onLogout: () => void;
}

export function Dashboard({ token, adminName, onLogout }: DashboardProps) {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [profiles, setProfiles] = useState<PendingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [statsResponse, profilesResponse] = await Promise.all([
        api.getStats(token),
        api.getPendingProfiles(token),
      ]);
      setStats(statsResponse);
      setProfiles(profilesResponse.profiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [token]);

  const statItems = [
    {
      label: 'Pending Verification',
      value: stats?.pendingProfiles ?? 0,
      icon: Clock,
      description: 'Profiles awaiting admin action',
    },
    {
      label: 'Approved Profiles',
      value: stats?.approvedProfiles ?? 0,
      icon: CheckCircle2,
      description: 'Live and active in discovery',
    },
    {
      label: 'Rejected Profiles',
      value: stats?.rejectedProfiles ?? 0,
      icon: XCircle,
      description: 'Returned for revisions',
    },
    {
      label: 'Total Registered',
      value: stats?.totalProfiles ?? 0,
      icon: Users,
      description: 'All system accounts',
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white px-4 py-8 md:px-10">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Navigation Bar */}
        <header className="flex flex-col gap-4 border-b border-neutral-800 pb-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-950 text-white">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold tracking-tight">Dhobi Matrimony</span>
                <span className="rounded border border-neutral-800 bg-neutral-900 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">
                  ADMIN
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Logged in as <span className="font-medium text-white">{adminName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadData()}
              disabled={loading}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onLogout}
              className="gap-1.5 border-neutral-800 text-neutral-300 hover:bg-neutral-900 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </Button>
          </div>
        </header>

        {/* Bento Stats Row */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statItems.map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.label}
                className="border-neutral-800 bg-neutral-950/80 p-5 transition-colors hover:border-neutral-700"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                    {item.label}
                  </span>
                  <Icon className="h-4 w-4 text-neutral-500" />
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-semibold tracking-tight text-white font-mono">
                    {item.value}
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">{item.description}</p>
                </div>
              </Card>
            );
          })}
        </section>

        {/* Pending Queue Section */}
        <Card className="border-neutral-800 bg-neutral-950/80 shadow-elevated">
          <CardHeader className="flex flex-col gap-2 border-b border-neutral-800/80 pb-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <CardTitle className="text-lg font-semibold tracking-tight text-white">
                  Verification Queue
                </CardTitle>
                <Badge variant="pending" className="font-mono text-xs">
                  {profiles.length} Pending
                </Badge>
              </div>
              <CardDescription className="text-xs text-neutral-400 mt-1">
                Candidate registrations requiring identity & profile moderation before public listing.
              </CardDescription>
            </div>
          </CardHeader>

          {error ? (
            <div className="m-6 rounded-md border border-neutral-700 bg-neutral-900 p-4 text-xs text-neutral-200">
              {error}
            </div>
          ) : null}

          <CardContent className="p-0">
            {profiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-neutral-400">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-white">Queue is clear</h3>
                <p className="mt-1 max-w-sm text-xs text-neutral-400">
                  There are currently no candidate profiles awaiting review.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30%]">Applicant</TableHead>
                    <TableHead>Profile UID</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Completeness</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => (
                    <TableRow key={profile.userId}>
                      <TableCell>
                        <div className="font-medium text-white">{profile.name}</div>
                        <div className="font-mono text-xs text-neutral-400">{profile.email}</div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-neutral-300">
                          {profile.profileUid ?? 'Pending UID'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="capitalize text-neutral-300">
                          {profile.gender ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="capitalize text-neutral-300">
                          {profile.profileCreatedBy ?? 'Self'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-800">
                            <div
                              className="h-full bg-white transition-all"
                              style={{ width: `${Math.min(profile.profileComplete, 100)}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs text-neutral-400">
                            {profile.profileComplete}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/profiles/${profile.userId}`)}
                          className="gap-1 hover:bg-white hover:text-black"
                        >
                          <span>Review</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
