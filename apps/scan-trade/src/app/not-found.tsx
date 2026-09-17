import type { Metadata } from 'next';
import { ButtonLink } from '@/components/ui/button';
import { Logo } from '@/components/brand/logo';

export const metadata: Metadata = {
  title: 'Page introuvable',
  robots: { index: false, follow: false },
};

/** 404 (§53). */
export default function NotFound() {
  return (
    <main className="grid-lines flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Logo />
      <p className="numeric mt-10 text-display-lg font-semibold tracking-tight text-content">404</p>
      <h1 className="mt-3 text-heading font-semibold text-content">Cette page n&apos;existe pas.</h1>
      <p className="mt-2 max-w-sm text-sm text-content-muted">
        Le lien est peut-être obsolète, ou l&apos;analyse que tu cherches a été supprimée.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/dashboard">Retour au dashboard</ButtonLink>
        <ButtonLink href="/" variant="secondary">
          Accueil
        </ButtonLink>
      </div>
    </main>
  );
}
