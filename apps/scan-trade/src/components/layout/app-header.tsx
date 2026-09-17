'use client';

import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/brand/logo';
import { Dropdown } from '@/components/ui/dropdown';
import { APP_NAV } from './nav-items';
import { isActivePath } from './sidebar';
import { cn } from '@/utils/cn';

export interface AppHeaderProps {
  email: string;
  name: string | null;
}

/** Top bar: brand on mobile, account menu everywhere. */
export function AppHeader({ email, name }: AppHeaderProps) {
  const initial = (name?.trim()?.[0] ?? email[0] ?? '?').toUpperCase();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="lg:hidden">
          <Logo href="/dashboard" />
        </div>
        <div className="hidden lg:block" />

        <Dropdown
          label="Menu du compte"
          trigger={
            <>
              <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border-strong bg-surface-raised text-xs font-semibold text-content"
              >
                {initial}
              </span>
              <span className="hidden max-w-40 truncate text-sm text-content-muted sm:block">{email}</span>
            </>
          }
          items={[
            { label: 'Mon compte', href: '/compte' },
            { label: 'Paramètres', href: '/parametres' },
            { label: 'Abonnement', href: '/abonnement' },
            { label: 'Se déconnecter', onSelect: () => void signOut({ callbackUrl: '/' }), tone: 'danger' },
          ]}
        />
      </div>
    </header>
  );
}

/** Bottom navigation for phones and tablets (§31). */
export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-5">
        {APP_NAV.map((item) => {
          const active = isActivePath(pathname, item.href, item.prefix);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-16 flex-col items-center justify-center gap-1 px-1 text-[10px] leading-tight transition-colors',
                  active ? 'text-accent' : 'text-content-faint hover:text-content-muted',
                )}
              >
                {item.icon}
                <span className="max-w-full truncate">{item.label.split(' ')[0]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
