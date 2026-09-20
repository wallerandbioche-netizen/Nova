'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useSettings } from '@/hooks/use-settings';
import { Logo } from './logo';
import { NAV_GROUPS } from './nav-items';
import { UpgradeCard } from './upgrade-card';

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const [settings] = useSettings();

  return (
    <aside
      className={cn(
        'flex h-full w-[212px] shrink-0 flex-col border-r border-line bg-surface',
        className,
      )}
    >
      <div className="px-4 py-4">
        <Link href="/" aria-label="SCAN TRADE — accueil">
          <Logo />
        </Link>
      </div>

      <nav aria-label="Navigation principale" className="scroll-slim flex-1 overflow-y-auto px-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="px-2.5 pb-1.5 text-[10px] font-semibold tracking-[0.12em] text-ink-subtle uppercase">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex h-9 items-center gap-2.5 rounded-[9px] px-2.5 text-[13.5px] font-medium transition-colors',
                        active
                          ? 'bg-brand-soft text-brand'
                          : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-3 px-3 pb-4">
        {settings.subscribed ? (
          <div className="rounded-[12px] border border-line bg-long-soft p-3">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-long">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              Abonnement actif
            </p>
            <p className="mt-1 text-[11px] leading-4 text-ink-muted">
              Analyses complètes débloquées.
            </p>
          </div>
        ) : (
          <UpgradeCard />
        )}

        <Link
          href="/profil"
          className="flex items-center gap-2.5 rounded-[10px] px-1.5 py-1.5 transition-colors hover:bg-surface-muted"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-soft text-[12px] font-semibold text-ink-muted">
            {settings.displayName.slice(0, 1).toUpperCase()}
          </span>
          <span className="truncate text-[12px] text-ink-muted">{settings.email}</span>
        </Link>
      </div>
    </aside>
  );
}
