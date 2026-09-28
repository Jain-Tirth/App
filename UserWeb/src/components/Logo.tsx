import React from 'react';

interface LogoProps {
  variant?: 'navbar' | 'splash' | 'card';
  showTagline?: boolean;
  className?: string;
  theme?: 'dark' | 'light';
}

export function Logo({
  variant = 'navbar',
  showTagline = false,
  className = '',
  theme = 'light',
}: LogoProps) {
  const isDark = theme === 'dark';

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {/* Brand Emblem Icon */}
      <div className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm transition-transform hover:scale-105">
        <img
          src="/favicon.ico"
          alt="Dhobi Matrimony Emblem"
          className="h-full w-full object-cover"
        />
      </div>

      {/* Brand Wordmark */}
      <div className="flex flex-col leading-tight">
        <div className="flex items-center gap-1.5">
          <span
            className={`font-serif text-xl font-bold tracking-wider ${
              isDark ? 'text-white' : 'text-brand-charcoal'
            }`}
          >
            DHOBI MATRIMONY
          </span>
        </div>

        {/* Tagline is ONLY displayed when explicitly enabled (e.g. Splash screen) */}
        {showTagline && (
          <div className="mt-1 flex items-center gap-1.5">
            <span className="h-[0.5px] w-3 bg-brand-gold/60" />
            <span className="text-[9px] font-semibold tracking-[0.22em] text-brand-gold uppercase">
              Tradition • Trust • Togetherness
            </span>
            <span className="h-[0.5px] w-3 bg-brand-gold/60" />
          </div>
        )}
      </div>
    </div>
  );
}
