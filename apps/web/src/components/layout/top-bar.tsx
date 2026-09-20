'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { useSettings } from '@/hooks/use-settings';
import { Logo } from './logo';

/** Compact header shown on mobile and tablet, where the sidebar is hidden. */
export function TopBar() {
  const [settings] = useSettings();

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur lg:hidden">
      <Link href="/" aria-label="SCAN TRADE — accueil">
        <Logo />
      </Link>
      {settings.subscribed ? null : (
        <Link
          href="/abonnement"
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-soft px-3 text-[12px] font-semibold text-brand"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          S’abonner
        </Link>
      )}
    </header>
  );
}
