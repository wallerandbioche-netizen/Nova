'use client';

import { useEffect } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';

/**
 * Global error boundary.
 * The user gets a sentence; the stack stays in the browser console and, for
 * server errors, in the structured server log.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[scan-trade] unhandled UI error', error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <h1 className="text-heading font-semibold text-content">Une erreur inattendue s&apos;est produite</h1>
      <p className="mt-2 max-w-sm text-sm text-content-muted">
        Réessaie dans un instant. Si le problème persiste, reviens au dashboard.
      </p>
      {error.digest && <p className="mt-3 text-xs text-content-faint">Référence : {error.digest}</p>}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Réessayer</Button>
        <ButtonLink href="/dashboard" variant="secondary">
          Retour au dashboard
        </ButtonLink>
      </div>
    </main>
  );
}
