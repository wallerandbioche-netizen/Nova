import type { ButtonHTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'quiet';
type Size = 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 font-medium tracking-[-0.011em] ' +
  'rounded-full select-none whitespace-nowrap ' +
  'transition-[background-color,color,border-color,transform,opacity] duration-quick ease-out-soft ' +
  'active:scale-[0.985] disabled:pointer-events-none disabled:opacity-40';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-canvas hover:bg-ink-soft',
  secondary: 'border border-line-strong bg-surface text-ink hover:border-ink/35 hover:bg-veil',
  quiet: 'text-muted hover:text-ink',
};

const SIZES: Record<Size, string> = {
  md: 'h-10 px-4 text-[0.9375rem]',
  lg: 'h-13 px-7 text-[0.9375rem]',
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  href,
  download,
}: CommonProps & { href: string; download?: boolean | string }) {
  const classes = cn(BASE, VARIANTS[variant], SIZES[size], className);
  // Un téléchargement passe par une ancre native : le routeur n'a rien à y faire.
  if (download !== undefined) {
    return (
      <a className={classes} href={href} download={download}>
        {children}
      </a>
    );
  }
  return (
    <Link className={classes} href={href}>
      {children}
    </Link>
  );
}
