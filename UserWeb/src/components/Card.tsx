import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`rounded-brand border border-brand-border bg-white/95 p-6 shadow-card backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}
