import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onFinish?: () => void;
  durationMs?: number;
}

export function SplashScreen({ onFinish, durationMs = 2500 }: SplashScreenProps) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setFading(true);
    }, durationMs - 500);

    const finishTimer = setTimeout(() => {
      onFinish?.();
    }, durationMs);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [durationMs, onFinish]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#94154B] bg-gradient-to-b from-[#C42369] via-[#A01B54] to-[#680C34] px-6 py-12 text-white transition-opacity duration-500 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Top subtle decorative pattern */}
      <div className="h-6" />

      {/* Central Full Logo with Tagline */}
      <div className="flex flex-col items-center text-center animate-fade-in">
        <div className="relative mb-6 h-36 w-36 overflow-hidden rounded-3xl border border-white/20 shadow-2xl sm:h-44 sm:w-44">
          <img
            src="/logo-full.jpeg"
            alt="Dhobi Matrimony — Tradition, Trust & Togetherness"
            className="h-full w-full object-cover"
          />
        </div>

        <h1 className="font-serif text-3xl font-bold tracking-wider text-white sm:text-4xl">
          DHOBI <span className="text-brand-gold">MATRIMONY</span>
        </h1>

        {/* Official Tagline strictly showcased on Splash Screen */}
        <div className="mt-3 flex items-center gap-2">
          <span className="h-[0.5px] w-4 bg-brand-gold/70" />
          <p className="text-xs font-semibold tracking-[0.25em] text-brand-gold uppercase sm:text-sm">
            Tradition • Trust • Togetherness
          </p>
          <span className="h-[0.5px] w-4 bg-brand-gold/70" />
        </div>
      </div>

      {/* Bottom Loading Indicator & Trust Seal */}
      <div className="flex flex-col items-center gap-3">
        <div className="h-1 w-28 overflow-hidden rounded-full bg-white/20">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-brand-gold" />
        </div>
        <p className="text-[11px] font-medium tracking-wider text-white/70">
          India&apos;s Trusted Community Matrimony
        </p>
      </div>
    </div>
  );
}
