import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/comment-ca-marche"
            className="rounded-full px-3 py-2 text-[0.875rem] text-muted transition-colors duration-quick hover:text-ink"
          >
            Comment ça marche
          </Link>
          <span className="hidden h-4 w-px bg-line sm:block" aria-hidden="true" />
          <Link
            href="/comment-ca-marche#compte"
            className="hidden rounded-full px-3 py-2 text-[0.875rem] text-muted transition-colors duration-quick hover:text-ink sm:block"
          >
            Connexion
          </Link>
        </nav>
      </div>
    </header>
  );
}
