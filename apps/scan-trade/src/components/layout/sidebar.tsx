'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/brand/logo';
import { APP_NAV } from './nav-items';
import { cn } from '@/utils/cn';

export function isActivePath(pathname: string, href: string, prefix?: string): boolean {
  if (pathname === href) return true;
  if (href !== '/dashboard' && pathname.startsWith(`${href}/`)) return true;
  return prefix ? pathname.startsWith(prefix) : false;
}

/** Fixed desktop sidebar (§51). Hidden below `lg`, where the bottom bar takes over. */
export function Sidebar({ subscribed }: { subscribed: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-surface/50 lg:flex">
      <div className="flex h-16 items-center px-5">
        <Logo href="/dashboard" />
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Navigation de l'application">
        {APP_NAV.map((item) => {
          const active = isActivePath(pathname, item.href, item.prefix);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                active
                  ? 'bg-surface-raised text-content'
                  : 'text-content-muted hover:bg-surface-raised/60 hover:text-content',
              )}
            >
              <span className={active ? 'text-accent' : 'text-content-faint'}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {!subscribed && (
        <div className="m-3 rounded-xl border border-border bg-surface-raised p-4">
          <p className="text-sm font-medium text-content">Scan Trade Pro</p>
          <p className="mt-1 text-xs leading-relaxed text-content-muted">
            Active ton abonnement pour lancer des scans.
          </p>
          <Link
            href="/abonnement"
            className="mt-3 inline-flex text-xs font-semibold text-accent transition-opacity hover:opacity-80"
          >
            Voir l&apos;abonnement →
          </Link>
        </div>
      )}
    </aside>
  );
}
