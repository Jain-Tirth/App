import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`rounded-[2rem] border border-brand-gold/35 bg-white/90 p-6 shadow-soft ${className}`}>
      {children}
    </div>
  );
}
