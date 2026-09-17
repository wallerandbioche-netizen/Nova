import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import { Disclaimer } from '@/components/layout/disclaimer';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** Centred, single-column shell for the four credential screens. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid-lines flex min-h-dvh flex-col">
      <header className="px-4 py-6 sm:px-8">
        <Logo />
      </header>

      <main id="contenu" className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="px-4 pb-8 sm:px-8">
        <div className="mx-auto max-w-md space-y-4">
          <Disclaimer variant="compact" />
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-content-faint">
            <Link href="/" className="hover:text-content-muted">
              Accueil
            </Link>
            <Link href="/conditions" className="hover:text-content-muted">
              Conditions
            </Link>
            <Link href="/confidentialite" className="hover:text-content-muted">
              Confidentialité
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
