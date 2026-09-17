import type { ReactNode } from 'react';

export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  /** Matches nested routes, e.g. /historique/... */
  prefix?: string;
}

const stroke = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const APP_NAV: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" aria-hidden="true">
        <path d="M3 10.5 10 4l7 6.5M5 9.5V16h10V9.5" {...stroke} />
      </svg>
    ),
  },
  {
    href: '/analyses/nouvelle',
    label: 'Nouvelle analyse',
    icon: (
      <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" aria-hidden="true">
        <path d="M10 4v12M4 10h12" {...stroke} />
      </svg>
    ),
  },
  {
    href: '/historique',
    label: 'Historique',
    prefix: '/analyses/',
    icon: (
      <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" aria-hidden="true">
        <path d="M10 5.5v5l3 1.75" {...stroke} />
        <circle cx="10" cy="10" r="6.25" {...stroke} />
      </svg>
    ),
  },
  {
    href: '/abonnement',
    label: 'Abonnement',
    icon: (
      <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" aria-hidden="true">
        <rect x="2.75" y="5" width="14.5" height="10" rx="2.5" {...stroke} />
        <path d="M2.75 8.5h14.5" {...stroke} />
      </svg>
    ),
  },
  {
    href: '/parametres',
    label: 'Paramètres',
    prefix: '/compte',
    icon: (
      <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" aria-hidden="true">
        <circle cx="10" cy="10" r="2.5" {...stroke} />
        <path
          d="M10 2.75v1.6M10 15.65v1.6M17.25 10h-1.6M4.35 10h-1.6M15.13 4.87l-1.13 1.13M6 14l-1.13 1.13M15.13 15.13 14 14M6 6 4.87 4.87"
          {...stroke}
        />
      </svg>
    ),
  },
];
