import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import { Disclaimer } from './disclaimer';

const LINKS = [
  { href: '/', label: 'Accueil' },
  { href: '/tarifs', label: 'Tarifs' },
  { href: '/conditions', label: 'Conditions' },
  { href: '/confidentialite', label: 'Confidentialité' },
  { href: '/contact', label: 'Contact' },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <Logo />
            <p className="max-w-xs text-sm text-content-muted">
              Transforme une capture de graphique en analyse structurée : niveaux clés, scénario
              potentiel et zones de risque.
            </p>
          </div>

          <nav aria-label="Pied de page">
            <ul className="grid grid-cols-2 gap-x-10 gap-y-2.5 sm:grid-cols-1">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="rounded text-sm text-content-muted transition-colors hover:text-content"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <Disclaimer className="mt-10" />

        <p className="mt-6 text-xs text-content-faint">
          © {new Date().getFullYear()} Scan Trade. Tous droits réservés.
        </p>
      </div>
    </footer>
  );
}
