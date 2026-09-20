import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { MobileNav } from './mobile-nav';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';

/**
 * Desktop: fixed sidebar + scrollable content.
 * Below `lg`: compact top bar + bottom navigation.
 */
export function AppShell({
  children,
  contentClassName,
}: {
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    <div className="flex min-h-dvh bg-canvas">
      <div className="sticky top-0 hidden h-dvh lg:block">
        <Sidebar className="h-dvh" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main
          className={cn(
            'mx-auto w-full max-w-[1320px] flex-1 px-4 pt-5 pb-24 sm:px-6 lg:px-8 lg:pb-10',
            contentClassName,
          )}
        >
          {children}
        </main>
        <MobileNav />
      </div>
    </div>
  );
}
