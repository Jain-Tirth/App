import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-brand-canvas text-brand-charcoal selection:bg-brand-primary selection:text-white">
      {/* ── Top Navigation Bar ────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-brand-border/80 bg-brand-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          {/* Logo strictly omits tagline in the website navigation */}
          <button
            onClick={() => navigate('/')}
            className="text-left focus:outline-none"
            aria-label="Dhobi Matrimony Home"
          >
            <Logo variant="navbar" showTagline={false} />
          </button>

          {/* Center Navigation Links (Hidden on small mobile) */}
          <nav className="hidden items-center gap-8 md:flex text-sm font-medium text-brand-charcoal/80">
            <a href="#why-us" className="transition-colors hover:text-brand-primary">
              Why Us
            </a>
            <a href="#trust" className="transition-colors hover:text-brand-primary">
              Trust & Safety
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-brand-primary">
              How It Works
            </a>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="rounded-full px-4 py-2 text-sm font-semibold text-brand-charcoal transition-colors hover:text-brand-primary"
            >
              Login
            </button>
            <button
              onClick={() => navigate('/register')}
              className="rounded-full bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white shadow-button transition-all hover:bg-brand-primary-hover hover:shadow-lg"
            >
              Register Free
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero Section ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-8 pb-16 lg:py-20">
        {/* Subtle Ambient Background Warmth */}
        <div className="pointer-events-none absolute -top-40 right-0 h-96 w-96 rounded-full bg-brand-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute top-1/2 left-0 h-96 w-96 rounded-full bg-brand-gold/10 blur-3xl" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-8">
            {/* Left Column: Hero Content & Match Search */}
            <div className="lg:col-span-7">

              {/* Main Headline */}
              <h1 className="mt-5 font-serif text-4xl font-bold tracking-tight text-brand-charcoal sm:text-5xl lg:text-6xl lg:leading-[1.15]">
                Find Your Perfect <br className="hidden sm:inline" />
                <span className="text-brand-primary italic">Life Partner</span>
              </h1>

              {/* Subtitle */}
              <p className="mt-4 max-w-xl text-base leading-relaxed text-brand-muted sm:text-lg">
                India&apos;s most trusted Dhobi Matrimony service for your happy and blessed future. Connecting families with dignity, privacy, and verified profiles.
              </p>

              {/* Primary CTAs */}
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <button
                  onClick={() => navigate('/register')}
                  className="rounded-full bg-brand-primary px-8 py-3.5 text-base font-semibold text-white shadow-button transition-all hover:bg-brand-primary-hover hover:scale-[1.02]"
                >
                  Register Free
                </button>
              </div>

              {/* 3 Core Trust Pillars (from splash screen) */}
              <div id="trust" className="mt-10 grid grid-cols-1 gap-4 pt-6 border-t border-brand-border/80 sm:grid-cols-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-primary-soft text-brand-primary">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-brand-charcoal">100% Verified</h4>
                    <p className="text-xs text-brand-muted">Profiles audited by admin</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-gold/15 text-brand-gold">
                    <svg className="h-5 w-5 text-[#B89025]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-brand-charcoal">Trusted by Thousands</h4>
                    <p className="text-xs text-brand-muted">Dhobi community families</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-primary-soft text-brand-primary">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-brand-charcoal">Privacy Assured</h4>
                    <p className="text-xs text-brand-muted">Your contact stays safe</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Inspired Ceremonial Wedding Visual (No Mockup Frames) */}
            <div className="lg:col-span-5">
              <div className="relative mx-auto max-w-md lg:max-w-none">
                {/* Decorative border frame */}
                <div className="absolute -inset-2 rounded-[2.5rem] border border-brand-gold/30 bg-gradient-to-tr from-brand-gold/10 to-brand-primary/10 -rotate-1" />

                {/* Main Hero Photographic Image */}
                <div className="relative overflow-hidden rounded-[2.25rem] border-2 border-white bg-white shadow-soft">
                  <img
                    src="/hero-wedding.jpg"
                    alt="Two hearts united in sacred Indian matrimonial vows"
                    className="h-[460px] w-full object-cover object-center transition-transform duration-700 hover:scale-105"
                  />

                  {/* Gradient overlay for text contrast */}
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-charcoal/80 via-transparent to-transparent" />

                  {/* Sacred Ceremony Caption Badge */}
                  <div className="absolute bottom-5 left-5 right-5 rounded-2xl bg-white/95 p-4 backdrop-blur-md border border-brand-border/60">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-primary">
                          Sacred Matrimony
                        </p>
                        <p className="font-serif text-base font-bold text-brand-charcoal">
                          Tradition, Trust &amp; Togetherness
                        </p>
                      </div>
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-primary text-white">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Community Features Section ───────────────────────────────── */}
      <section id="why-us" className="border-t border-brand-border/80 bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-primary">
              Why Dhobi Matrimony
            </p>
            <h2 className="mt-2 font-serif text-3xl font-bold text-brand-charcoal sm:text-4xl">
              Thoughtfully Built for Our Community
            </h2>
            <p className="mt-3 text-sm text-brand-muted">
              We combine traditional values with modern verification technology to help you find your life partner with complete peace of mind.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-brand-border bg-brand-canvas/60 p-6 transition-all hover:border-brand-primary/40 hover:bg-white hover:shadow-card">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary text-white">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="mt-5 font-serif text-xl font-bold text-brand-charcoal">
                100% Verified Profiles
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-brand-muted">
                Every registration goes through mandatory mobile verification and manual administrative review before appearing in search results.
              </p>
            </div>

            <div className="rounded-2xl border border-brand-border bg-brand-canvas/60 p-6 transition-all hover:border-brand-primary/40 hover:bg-white hover:shadow-card">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-gold text-white">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
              <h3 className="mt-5 font-serif text-xl font-bold text-brand-charcoal">
                Community Focused
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-brand-muted">
                Customized search filters for family background, sub-caste traditions, profession, location, and horoscope compatibility.
              </p>
            </div>

            <div className="rounded-2xl border border-brand-border bg-brand-canvas/60 p-6 transition-all hover:border-brand-primary/40 hover:bg-white hover:shadow-card">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary text-white">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="mt-5 font-serif text-xl font-bold text-brand-charcoal">
                Strict Privacy Control
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-brand-muted">
                Your photos and contact details are shielded. Choose who views your phone number and family bio through mutual consent.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-brand-border bg-brand-canvas py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            {/* Logo in footer without tagline */}
            <Logo variant="navbar" showTagline={false} />

            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-brand-muted">
              <a href="#why-us" className="hover:text-brand-primary">About Us</a>
              <a href="#trust" className="hover:text-brand-primary">Privacy Policy</a>
              <a href="#trust" className="hover:text-brand-primary">Terms of Service</a>
            </div>

            <p className="text-xs text-brand-muted">
              &copy; {new Date().getFullYear()} Dhobi Matrimony. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
