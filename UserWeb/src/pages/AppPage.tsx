import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProfileResponse, MatchProfile } from '../types';
import { api } from '../api';
import { Logo } from '../components/Logo';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import {
  ShieldCheck,
  LogOut,
  Sparkles,
  MapPin,
  Briefcase,
  Heart,
  Search,
  User,
  Check,
  ChevronRight,
  X,
  FileText,
  Clock,
  Filter,
  Users,
} from 'lucide-react';

interface AppPageProps {
  token: string;
  profile: ProfileResponse | null;
  onLogout: () => void;
  onProfileUpdate: (profile: ProfileResponse) => void;
}

function calculateAge(dobString: string | null): number | null {
  if (!dobString) return null;
  const birth = new Date(dobString);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age > 0 ? age : null;
}

function cmToFeetInches(cm: number | null): string {
  if (!cm || isNaN(cm)) return '';
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}'${inches}"`;
}

export function AppPage({ token, profile, onLogout }: AppPageProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'matches' | 'dossier'>('matches');
  const [matches, setMatches] = useState<MatchProfile[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [interestedIds, setInterestedIds] = useState<Set<string>>(new Set());
  const [selectedMatch, setSelectedMatch] = useState<MatchProfile | null>(null);

  const user = profile?.profile?.user;
  const userDetails = profile?.profile;

  // Load active matches from community
  useEffect(() => {
    async function loadMatches() {
      setLoadingMatches(true);
      try {
        const response = await api.getMatches(token);
        setMatches(response.matches || []);
      } catch (err) {
        console.error('Failed to load matches', err);
      } finally {
        setLoadingMatches(false);
      }
    }

    void loadMatches();
  }, [token]);

  // Filter matches based on search
  const filteredMatches = useMemo(() => {
    if (!searchQuery.trim()) return matches;
    const q = searchQuery.toLowerCase();
    return matches.filter(
      (m) =>
        m.name?.toLowerCase().includes(q) ||
        m.city?.toLowerCase().includes(q) ||
        m.state?.toLowerCase().includes(q) ||
        m.education?.toLowerCase().includes(q) ||
        m.occupation?.toLowerCase().includes(q) ||
        m.subcaste?.toLowerCase().includes(q)
    );
  }, [matches, searchQuery]);

  function toggleInterest(userId: string) {
    setInterestedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-brand-canvas text-brand-charcoal">
      {/* ── Top Navigation Bar ────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-brand-border/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab('matches')}
              className="text-left focus:outline-none"
            >
              <Logo variant="navbar" showTagline={false} />
            </button>

            {/* Navigation Tabs */}
            <nav className="hidden sm:flex items-center gap-2">
              <button
                onClick={() => setActiveTab('matches')}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                  activeTab === 'matches'
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'text-brand-muted hover:bg-brand-primary-soft hover:text-brand-primary'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Discover Matches</span>
                {matches.length > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 font-mono text-[10px] ${
                      activeTab === 'matches'
                        ? 'bg-white/20 text-white'
                        : 'bg-brand-border text-brand-charcoal'
                    }`}
                  >
                    {matches.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('dossier')}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                  activeTab === 'dossier'
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'text-brand-muted hover:bg-brand-primary-soft hover:text-brand-primary'
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>My Profile Dossier</span>
              </button>
            </nav>
          </div>

          {/* User Status & Sign Out */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <div className="flex items-center justify-end gap-1.5">
                <span className="text-xs font-semibold text-brand-charcoal">
                  {user?.name}
                </span>
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
              </div>
              <span className="font-mono text-[10px] text-brand-primary font-medium">
                {userDetails?.profileUid ?? 'Verified Member'}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={onLogout}
              className="gap-1.5 text-xs border-brand-border hover:bg-brand-primary-soft hover:text-brand-primary"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>

        {/* Mobile Navigation Tabs */}
        <div className="flex sm:hidden border-t border-brand-border/60 bg-brand-canvas px-4 py-2 gap-2">
          <button
            onClick={() => setActiveTab('matches')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg ${
              activeTab === 'matches'
                ? 'bg-brand-primary text-white'
                : 'text-brand-muted'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Matches ({matches.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('dossier')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg ${
              activeTab === 'dossier'
                ? 'bg-brand-primary text-white'
                : 'text-brand-muted'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>My Profile</span>
          </button>
        </div>
      </header>

      {/* ── Main Container ───────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Welcome Status Card */}
        <div className="relative overflow-hidden rounded-[2rem] border border-brand-border bg-gradient-to-r from-white via-brand-primary-soft/30 to-brand-gold-light/40 p-6 sm:p-8 shadow-soft">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  Active & Verified Community Member
                </span>
                {userDetails?.profileUid && (
                  <Badge variant="outline" className="font-mono text-xs">
                    UID: {userDetails.profileUid}
                  </Badge>
                )}
              </div>

              <h1 className="font-serif text-3xl sm:text-4xl font-bold text-brand-charcoal">
                Namaste, {user?.name}
              </h1>
              <p className="text-sm text-brand-muted max-w-2xl leading-relaxed">
                Your profile is active across Dhobi Matrimony. Connect with trusted, verified candidates from our community and initiate contact with families.
              </p>
            </div>

            {/* Quick Summary Pill */}
            <div className="flex items-center gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-brand-border p-4 shadow-sm self-start md:self-auto">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary text-white font-bold text-xl">
                {user?.name?.charAt(0) ?? 'D'}
              </div>
              <div>
                <span className="block text-xs uppercase tracking-wider text-brand-muted">
                  Community Dossier
                </span>
                <span className="block text-sm font-semibold text-brand-charcoal">
                  100% Complete & Approved
                </span>
                <button
                  onClick={() => setActiveTab('dossier')}
                  className="mt-0.5 text-xs text-brand-primary hover:underline font-medium"
                >
                  View Details &rarr;
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── TAB 1: DISCOVER MATCHES ──────────────────────────────────── */}
        {activeTab === 'matches' && (
          <div className="space-y-6">
            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-brand-muted" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by city, profession, degree, subcaste..."
                  className="pl-10 bg-white"
                />
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto text-xs text-brand-muted font-medium">
                <Filter className="h-3.5 w-3.5 text-brand-primary" />
                <span>Showing {filteredMatches.length} Verified Profiles</span>
              </div>
            </div>

            {/* Matches Grid */}
            {loadingMatches ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <Clock className="h-8 w-8 text-brand-primary animate-spin mb-3" />
                <p className="text-sm font-medium text-brand-muted">
                  Loading verified community matches...
                </p>
              </div>
            ) : filteredMatches.length === 0 ? (
              <Card className="p-12 text-center bg-white border-brand-border">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-primary-soft text-brand-primary mb-4">
                  <Sparkles className="h-8 w-8 text-brand-primary" />
                </div>
                <h3 className="font-serif text-2xl font-bold text-brand-charcoal">
                  {searchQuery ? 'No Matching Profiles Found' : 'You are a Founding Member!'}
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-brand-muted leading-relaxed">
                  {searchQuery
                    ? `No verified candidates matched "${searchQuery}". Try clearing your search query.`
                    : 'You are among the first approved members of Dhobi Matrimony. As new community candidates are audited and approved by our admin, their verified profiles will appear here.'}
                </p>
                {searchQuery && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchQuery('')}
                    className="mt-4"
                  >
                    Clear Filter
                  </Button>
                )}
              </Card>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredMatches.map((match) => {
                  const matchAge = calculateAge(match.dateOfBirth);
                  const matchHeight = cmToFeetInches(match.heightCm);
                  const hasExpressedInterest = interestedIds.has(match.userId);

                  return (
                    <Card
                      key={match.userId}
                      className="overflow-hidden border-brand-border bg-white transition-all hover:shadow-glow hover:-translate-y-1 flex flex-col justify-between"
                    >
                      <div>
                        {/* Card Header Profile Banner */}
                        <div className="bg-gradient-to-r from-brand-primary-soft to-brand-gold-light/60 p-5 border-b border-brand-border/60">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-mono text-xs font-bold text-brand-primary bg-white px-2.5 py-1 rounded-md border border-brand-border shadow-xs">
                              {match.profileUid ?? 'Verified'}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full">
                              <ShieldCheck className="h-3 w-3 text-emerald-600" />
                              Audited
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white border border-brand-border text-brand-primary font-bold text-xl shadow-sm">
                              {match.name?.charAt(0) ?? 'D'}
                            </div>
                            <div className="overflow-hidden">
                              <h3 className="truncate font-serif text-lg font-bold text-brand-charcoal">
                                {match.name}
                              </h3>
                              <p className="text-xs text-brand-muted truncate">
                                {matchAge ? `${matchAge} yrs` : ''}
                                {matchAge && matchHeight ? ' • ' : ''}
                                {matchHeight}
                                {(matchAge || matchHeight) && match.maritalStatus ? ' • ' : ''}
                                <span className="capitalize">{match.maritalStatus ?? ''}</span>
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Card Body Details */}
                        <div className="p-5 space-y-3 text-xs">
                          {/* Location */}
                          <div className="flex items-center gap-2 text-brand-muted">
                            <MapPin className="h-3.5 w-3.5 text-brand-primary shrink-0" />
                            <span className="truncate">
                              {[match.city, match.state].filter(Boolean).join(', ') || 'India'}
                            </span>
                          </div>

                          {/* Religion & Caste */}
                          <div className="flex items-center gap-2 text-brand-muted">
                            <Sparkles className="h-3.5 w-3.5 text-brand-gold shrink-0" />
                            <span className="truncate">
                              {[match.caste || 'Dhobi', match.subcaste].filter(Boolean).join(' • ')}
                            </span>
                          </div>

                          {/* Education & Career */}
                          <div className="flex items-center gap-2 text-brand-muted">
                            <Briefcase className="h-3.5 w-3.5 text-brand-charcoal/70 shrink-0" />
                            <span className="truncate">
                              {[match.occupation, match.education].filter(Boolean).join(' | ') || 'Professional'}
                            </span>
                          </div>

                          {/* Bio Excerpt */}
                          {match.aboutMyself && (
                            <p className="pt-2 border-t border-brand-border/60 text-xs text-brand-muted italic line-clamp-2">
                              &ldquo;{match.aboutMyself}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="p-5 pt-0 flex items-center gap-2">
                        <Button
                          variant={hasExpressedInterest ? 'secondary' : 'default'}
                          size="sm"
                          onClick={() => toggleInterest(match.userId)}
                          className="flex-1 gap-1.5 text-xs font-semibold"
                        >
                          {hasExpressedInterest ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                              <span className="text-emerald-800">Interest Sent</span>
                            </>
                          ) : (
                            <>
                              <Heart className="h-3.5 w-3.5" />
                              <span>Send Interest</span>
                            </>
                          )}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedMatch(match)}
                          className="text-xs px-3"
                        >
                          View
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: MY MATRIMONIAL DOSSIER ────────────────────────────── */}
        {activeTab === 'dossier' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-brand-border">
              <div>
                <h2 className="font-serif text-2xl font-bold text-brand-charcoal">
                  My Profile Dossier
                </h2>
                <p className="text-xs text-brand-muted">
                  Official community submission verified by administration.
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/register')}
                className="gap-1.5"
              >
                <span>Edit Profile</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Personal Details */}
              <Card className="p-6 border-brand-border bg-white">
                <h3 className="font-serif text-base font-bold text-brand-charcoal mb-4 flex items-center gap-2">
                  <User className="h-4 w-4 text-brand-primary" />
                  Personal Information
                </h3>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between border-b border-brand-border/60 pb-2">
                    <span className="text-brand-muted">Full Name</span>
                    <span className="font-medium text-brand-charcoal">{user?.name}</span>
                  </div>
                  <div className="flex justify-between border-b border-brand-border/60 pb-2">
                    <span className="text-brand-muted">Gender</span>
                    <span className="font-medium capitalize text-brand-charcoal">{user?.gender ?? '—'}</span>
                  </div>
                  <div className="flex justify-between border-b border-brand-border/60 pb-2">
                    <span className="text-brand-muted">Date of Birth</span>
                    <span className="font-medium text-brand-charcoal">
                      {(userDetails?.personalDetails?.dateOfBirth as string)?.slice(0, 10) ?? '—'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-brand-border/60 pb-2">
                    <span className="text-brand-muted">Height</span>
                    <span className="font-medium text-brand-charcoal">
                      {userDetails?.personalDetails?.heightCm
                        ? `${userDetails.personalDetails.heightCm} cm (${cmToFeetInches(
                            Number(userDetails.personalDetails.heightCm)
                          )})`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-brand-muted">Marital Status</span>
                    <span className="font-medium capitalize text-brand-charcoal">
                      {String(userDetails?.personalDetails?.maritalStatus ?? '—')}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Cultural & Astrological */}
              <Card className="p-6 border-brand-border bg-white">
                <h3 className="font-serif text-base font-bold text-brand-charcoal mb-4 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-brand-gold" />
                  Religious & Cultural
                </h3>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between border-b border-brand-border/60 pb-2">
                    <span className="text-brand-muted">Religion</span>
                    <span className="font-medium text-brand-charcoal">
                      {String(userDetails?.religiousDetails?.religion ?? 'Hindu')}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-brand-border/60 pb-2">
                    <span className="text-brand-muted">Caste</span>
                    <span className="font-medium text-brand-charcoal">
                      {String(userDetails?.religiousDetails?.caste ?? 'Dhobi / Rajaka')}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-brand-border/60 pb-2">
                    <span className="text-brand-muted">Subcaste</span>
                    <span className="font-medium text-brand-charcoal">
                      {String(userDetails?.religiousDetails?.subcaste ?? '—')}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-brand-border/60 pb-2">
                    <span className="text-brand-muted">Gothra</span>
                    <span className="font-medium text-brand-charcoal">
                      {String(userDetails?.religiousDetails?.gothra ?? '—')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-brand-muted">Manglik / Dosh</span>
                    <span className="font-medium capitalize text-brand-charcoal">
                      {String(userDetails?.religiousDetails?.dosh ?? 'No')}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Location & Contact */}
              <Card className="p-6 border-brand-border bg-white">
                <h3 className="font-serif text-base font-bold text-brand-charcoal mb-4 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-brand-primary" />
                  Location & Residence
                </h3>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between border-b border-brand-border/60 pb-2">
                    <span className="text-brand-muted">Current City</span>
                    <span className="font-medium text-brand-charcoal">
                      {String(userDetails?.locationDetails?.city ?? '—')}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-brand-border/60 pb-2">
                    <span className="text-brand-muted">State</span>
                    <span className="font-medium text-brand-charcoal">
                      {String(userDetails?.locationDetails?.state ?? '—')}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-brand-border/60 pb-2">
                    <span className="text-brand-muted">Country</span>
                    <span className="font-medium text-brand-charcoal">
                      {String(userDetails?.locationDetails?.country ?? 'India')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-brand-muted">Mobile (Private)</span>
                    <span className="font-mono text-brand-charcoal">{user?.mobile}</span>
                  </div>
                </div>
              </Card>

              {/* Professional & Education */}
              <Card className="p-6 border-brand-border bg-white">
                <h3 className="font-serif text-base font-bold text-brand-charcoal mb-4 flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-brand-charcoal" />
                  Education & Career
                </h3>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between border-b border-brand-border/60 pb-2">
                    <span className="text-brand-muted">Highest Qualification</span>
                    <span className="font-medium text-brand-charcoal">
                      {String(userDetails?.professionalDetails?.education ?? '—')}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-brand-border/60 pb-2">
                    <span className="text-brand-muted">Employment Sector</span>
                    <span className="font-medium capitalize text-brand-charcoal">
                      {String(userDetails?.professionalDetails?.employmentType ?? '—')}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-brand-border/60 pb-2">
                    <span className="text-brand-muted">Occupation</span>
                    <span className="font-medium text-brand-charcoal">
                      {String(userDetails?.professionalDetails?.occupation ?? '—')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-brand-muted">Annual Income</span>
                    <span className="font-medium text-brand-charcoal">
                      {String(userDetails?.professionalDetails?.annualIncomeRange ?? '—')}
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ── CANDIDATE PROFILE MODAL ─────────────────────────────────── */}
        {selectedMatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
            <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-brand-border bg-white shadow-soft max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-brand-border p-5 bg-brand-primary-soft/40">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary text-white font-bold">
                    {selectedMatch.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-serif text-lg font-bold text-brand-charcoal">
                      {selectedMatch.name}
                    </h3>
                    <span className="font-mono text-xs text-brand-primary font-semibold">
                      {selectedMatch.profileUid}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedMatch(null)}
                  className="rounded-full p-2 text-brand-muted hover:bg-white hover:text-brand-charcoal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="overflow-y-auto p-6 space-y-5 text-sm">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="rounded-xl border border-brand-border p-3">
                    <span className="block text-brand-muted">Age / Height</span>
                    <span className="font-semibold text-brand-charcoal text-sm">
                      {calculateAge(selectedMatch.dateOfBirth) ?? '—'} yrs |{' '}
                      {cmToFeetInches(selectedMatch.heightCm)}
                    </span>
                  </div>
                  <div className="rounded-xl border border-brand-border p-3">
                    <span className="block text-brand-muted">Location</span>
                    <span className="font-semibold text-brand-charcoal text-sm">
                      {[selectedMatch.city, selectedMatch.state].filter(Boolean).join(', ')}
                    </span>
                  </div>
                  <div className="rounded-xl border border-brand-border p-3">
                    <span className="block text-brand-muted">Community / Caste</span>
                    <span className="font-semibold text-brand-charcoal text-sm">
                      {selectedMatch.caste || 'Dhobi'} ({selectedMatch.subcaste || 'Any'})
                    </span>
                  </div>
                  <div className="rounded-xl border border-brand-border p-3">
                    <span className="block text-brand-muted">Profession</span>
                    <span className="font-semibold text-brand-charcoal text-sm">
                      {selectedMatch.occupation || selectedMatch.employmentType || '—'}
                    </span>
                  </div>
                </div>

                {selectedMatch.aboutMyself && (
                  <div className="rounded-xl border border-brand-border/60 bg-brand-canvas p-4 text-xs">
                    <span className="block font-semibold uppercase tracking-wider text-brand-charcoal mb-1">
                      About Candidate & Family:
                    </span>
                    <p className="text-brand-muted leading-relaxed">
                      {selectedMatch.aboutMyself}
                    </p>
                  </div>
                )}

                {selectedMatch.lookingFor && (
                  <div className="rounded-xl border border-brand-border/60 bg-brand-canvas p-4 text-xs">
                    <span className="block font-semibold uppercase tracking-wider text-brand-charcoal mb-1">
                      Partner Expectations:
                    </span>
                    <p className="text-brand-muted leading-relaxed">
                      {selectedMatch.lookingFor}
                    </p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="border-t border-brand-border p-4 bg-brand-canvas flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setSelectedMatch(null)}
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    toggleInterest(selectedMatch.userId);
                    setSelectedMatch(null);
                  }}
                  className="gap-2"
                >
                  <Heart className="h-4 w-4" />
                  <span>
                    {interestedIds.has(selectedMatch.userId)
                      ? 'Interest Sent ✓'
                      : 'Express Interest'}
                  </span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
