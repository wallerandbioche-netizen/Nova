'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Logo } from '@/components/brand/logo';
import { ButtonLink } from '@/components/ui/button';
import { cn } from '@/utils/cn';

const LINKS = [
  { href: '/#fonctionnement', label: 'Fonctionnement' },
  { href: '/tarifs', label: 'Tarifs' },
];

/** Public navigation (§52). Collapses to a disclosure menu below `sm`. */
export function PublicNav({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Logo />

        <nav className="hidden items-center gap-7 md:flex" aria-label="Navigation principale">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded text-sm text-content-muted transition-colors hover:text-content"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {isAuthenticated ? (
            <ButtonLink href="/dashboard" size="sm">
              Mon dashboard
            </ButtonLink>
          ) : (
            <>
              <ButtonLink href="/connexion" variant="ghost" size="sm">
                Connexion
              </ButtonLink>
              <ButtonLink href="/inscription" size="sm">
                Commencer
              </ButtonLink>
            </>
          )}
        </div>

        <button
          type="button"
          className="-mr-2 rounded-lg p-2 text-content-muted transition-colors hover:text-content md:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="public-mobile-nav"
          aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
            {open ? (
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      <div
        id="public-mobile-nav"
        className={cn('border-t border-border md:hidden', open ? 'block animate-slide-down' : 'hidden')}
      >
        <nav className="space-y-1 px-4 py-4" aria-label="Navigation mobile">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm text-content-muted transition-colors hover:bg-surface hover:text-content"
            >
              {link.label}
            </Link>
          ))}
          <div className="flex flex-col gap-2 pt-3">
            {isAuthenticated ? (
              <ButtonLink href="/dashboard">Mon dashboard</ButtonLink>
            ) : (
              <>
                <ButtonLink href="/connexion" variant="secondary">
                  Connexion
                </ButtonLink>
                <ButtonLink href="/inscription">Commencer</ButtonLink>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
