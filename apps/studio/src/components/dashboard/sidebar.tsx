'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Clapperboard, Coins, LayoutDashboard, LogOut, Settings, Video, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/new', label: 'Créer une vidéo', icon: Wand2 },
  { href: '/dashboard/videos', label: 'Mes vidéos', icon: Video },
  { href: '/dashboard/credits', label: 'Crédits', icon: Coins },
  { href: '/dashboard/settings', label: 'Paramètres', icon: Settings },
];

export function Sidebar({ credits }: { credits: number }) {
  const pathname = usePathname();
  const router = useRouter();

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  };

  return (
    <aside className="flex shrink-0 flex-col gap-1 border-ink-200 bg-white md:h-screen md:w-60 md:border-r md:p-4">
      <Link href="/" className="mb-6 hidden items-center gap-2 px-2 py-1 font-semibold md:flex">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-900 text-ink-50">
          <Clapperboard className="h-4 w-4" />
        </span>
        Nova Studio
      </Link>

      <nav className="flex gap-1 overflow-x-auto border-b border-ink-200 p-2 md:flex-col md:overflow-visible md:border-0 md:p-0">
        {LINKS.map((link) => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm transition-colors',
                active ? 'bg-ink-100 font-medium text-ink-900' : 'text-ink-500 hover:bg-ink-50',
              )}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto hidden space-y-3 md:block">
        <div className="rounded-xl border border-ink-200 p-3">
          <p className="text-xs text-ink-400">Crédits restants</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink-900">{credits}</p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-ink-500 transition-colors hover:bg-ink-50"
        >
          <LogOut className="h-4 w-4" />
          Se déconnecter
        </button>
      </div>
    </aside>
  );
}
