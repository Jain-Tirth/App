import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="max-w-5xl overflow-hidden p-0 md:grid md:grid-cols-[1.2fr,0.8fr]">
        <div className="bg-brand-maroon px-8 py-10 text-white">
          <p className="text-sm uppercase tracking-[0.35em] text-brand-gold">
            Tradition • Trust • Togetherness
          </p>
          <h1 className="mt-4 text-5xl font-semibold">Dhobi Matrimony</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-white/80">
            Verified profiles, guided registration, and a focused matching experience for the Dhobi community across web and mobile.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full border border-white/20 px-4 py-2">100% Verified Profiles</span>
            <span className="rounded-full border border-white/20 px-4 py-2">Trusted by Thousands</span>
            <span className="rounded-full border border-white/20 px-4 py-2">Privacy Assured</span>
          </div>
        </div>
        <div className="bg-brand-cream px-8 py-10">
          <p className="text-sm uppercase tracking-[0.3em] text-brand-maroon/70">Start Here</p>
          <h2 className="mt-3 text-3xl font-semibold text-brand-ink">Find your match with a guided profile flow</h2>
          <button
            onClick={() => navigate('/register')}
            className="mt-8 w-full rounded-2xl bg-brand-maroon px-5 py-3 text-sm font-semibold text-white"
          >
            Create Profile
          </button>
          <button
            onClick={() => navigate('/login')}
            className="mt-3 w-full rounded-2xl border border-brand-maroon px-5 py-3 text-sm font-semibold text-brand-maroon"
          >
            Login
          </button>
        </div>
      </Card>
    </div>
  );
}
