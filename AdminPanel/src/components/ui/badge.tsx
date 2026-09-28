import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-white text-black hover:bg-neutral-200',
        secondary:
          'border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800',
        destructive:
          'border-neutral-700 bg-neutral-950 text-neutral-400',
        outline: 'text-neutral-300 border-neutral-800',
        pending: 'border-neutral-700 bg-neutral-900 text-white font-medium',
        approved: 'border-white bg-white text-black font-semibold',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
