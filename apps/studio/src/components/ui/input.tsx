import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'h-11 w-full rounded-xl border border-ink-200 bg-white px-4 text-sm text-ink-900 placeholder:text-ink-400',
        'transition-colors focus:border-ink-400 focus:outline-none focus:ring-4 focus:ring-ink-900/5',
        'disabled:cursor-not-allowed disabled:bg-ink-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
