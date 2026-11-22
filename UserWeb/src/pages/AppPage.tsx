import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ProfileResponse } from '../types';
import { DiscoverySection } from '../components/DiscoverySection';
import { InstallPrompt } from '../components/InstallPrompt';
import { Logo } from '../components/Logo';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import {
  ShieldCheck,
  LogOut,
  Sparkles,
  MapPin,
  Briefcase,
  User,
  ChevronRight,
  FileText,
  Users,
} from 'lucide-react';

interface AppPageProps {
  token: string;
  profile: ProfileResponse | null;
  onLogout: () => void;
  onProfileUpdate: (profile: ProfileResponse) => void;
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
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [activeTab, setActiveTab] = useState<'matches' | 'dossier'>('matches');

  const user = profile?.profile?.user;
  const userDetails = profile?.profile;

  return (
    <div className="min-h-screen bg-brand-canvas text-brand-charcoal">
      {/* ── Top Navigation Bar ────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-brand-border/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <button
              type="button"
              aria-label="Dhobi Matrimony home"
              onClick={() => setActiveTab('matches')}
              className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded-lg"
            >
              <Logo variant="navbar" showTagline={false} />
            </button>

            {/* Navigation Tabs */}
            <nav aria-label="Sections" className="hidden sm:flex items-center gap-2">
              <button
                type="button"
                aria-pressed={activeTab === 'matches'}
                onClick={() => setActiveTab('matches')}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                  activeTab === 'matches'
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'text-brand-muted hover:bg-brand-primary-soft hover:text-brand-primary'
                }`}
              >
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Discover Matches</span>
              </button>

              <button
                type="button"
                aria-pressed={activeTab === 'dossier'}
                onClick={() => setActiveTab('dossier')}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                  activeTab === 'dossier'
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'text-brand-muted hover:bg-brand-primary-soft hover:text-brand-primary'
                }`}
              >
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                <span>My Profile</span>
              </button>
            </nav>
          </div>

          {/* User Status & Sign Out */}
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <div className="flex items-center justify-end gap-1.5">
                <span className="text-xs font-semibold text-brand-charcoal">
                  {user?.name}
                </span>
                <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              </div>
            </div>

            <Button
              asChild
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs border-brand-border hover:bg-brand-primary-soft hover:text-brand-primary"
            >
              <Link to="/interests">Interests</Link>
            </Button>

            <Button
              asChild
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs border-brand-border hover:bg-brand-primary-soft hover:text-brand-primary"
            >
              <Link to="/shortlists">Shortlists</Link>
            </Button>

            <Button
              asChild
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs border-brand-border hover:bg-brand-primary-soft hover:text-brand-primary"
            >
              <Link to="/settings">Settings</Link>
            </Button>

            <Button
              variant="outline"
              size="sm"
              aria-label="Sign out"
              onClick={onLogout}
              className="gap-1.5 text-xs border-brand-border hover:bg-brand-primary-soft hover:text-brand-primary"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>

        {/* Mobile Navigation Tabs */}
        <nav
          aria-label="Sections"
          className="flex sm:hidden border-t border-brand-border/60 bg-brand-canvas px-4 py-2 gap-2"
        >
          <button
            type="button"
            aria-pressed={activeTab === 'matches'}
            onClick={() => setActiveTab('matches')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg ${
              activeTab === 'matches'
                ? 'bg-brand-primary text-white'
                : 'text-brand-muted'
            }`}
          >
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Matches</span>
          </button>
          <button
            type="button"
            aria-pressed={activeTab === 'dossier'}
            onClick={() => setActiveTab('dossier')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg ${
              activeTab === 'dossier'
                ? 'bg-brand-primary text-white'
                : 'text-brand-muted'
            }`}
          >
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            <span>My Profile</span>
          </button>
        </nav>
      </header>

      {/* ── Main Container ───────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <InstallPrompt token={token} returnFocusRef={headingRef} />
        {/* Welcome Status Card */}
              <h1
                ref={headingRef}
                tabIndex={-1}
                data-testid="page-heading"
                className="rounded-md font-serif text-3xl sm:text-4xl font-bold text-brand-charcoal focus:outline-none focus:ring-4 focus:ring-brand-charcoal/60 focus:ring-offset-2"
              >
                Namaste, {user?.name}
              </h1>

        {/* ── TAB 1: DISCOVER MATCHES ──────────────────────────────────── */}
        {activeTab === 'matches' && <DiscoverySection token={token} onLogout={onLogout} />}

        {/* ── TAB 2: MY MATRIMONIAL DOSSIER ────────────────────────────── */}
        {activeTab === 'dossier' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-brand-border">
              <div>
                <h2 className="font-serif text-2xl font-bold text-brand-charcoal">
                  My Profile
                </h2>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/register')}
                className="gap-1.5"
              >
                <span>Edit Profile</span>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
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
      </main>
    </div>
  );
}
