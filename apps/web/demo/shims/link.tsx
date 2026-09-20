import type { AnchorHTMLAttributes, ReactNode } from 'react';

/**
 * Stand-in for `next/link` inside the standalone demo bundle. The demo is
 * served as a single page, so every route becomes a hash fragment.
 */
export function toHash(href: string): string {
  if (href.startsWith('http') || href.startsWith('#')) return href;
  return `#${href}`;
}

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  children: ReactNode;
  prefetch?: boolean;
  replace?: boolean;
}

export default function Link({ href, children, prefetch: _p, replace: _r, ...rest }: LinkProps) {
  return (
    <a href={toHash(href)} {...rest}>
      {children}
    </a>
  );
}
