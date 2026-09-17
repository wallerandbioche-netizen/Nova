import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { confirmCheckoutSession } from '@/features/billing/service';
import { logger } from '@/lib/logger';
import { requireViewer } from '@/server/session';

export const metadata: Metadata = { title: 'Abonnement confirmé' };
export const dynamic = 'force-dynamic';

/**
 * Landing page after Stripe Checkout.
 *
 * The browser arriving here proves nothing, so the session is re-read from
 * Stripe server-side before anything is written (§24). The webhook remains the
 * authoritative path; this only closes the gap when the redirect beats it.
 */
export default async function CheckoutConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const viewer = await requireViewer();
  const { session_id: sessionId } = await searchParams;

  if (!sessionId) redirect('/abonnement');

  let confirmed = viewer.isSubscribed;
  if (!confirmed) {
    try {
      confirmed = await confirmCheckoutSession(viewer.id, sessionId);
    } catch (error) {
      logger.error('billing.confirmation_failed', { userId: viewer.id, error });
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg py-10">
      <Card tone="raised" className="px-6 py-10 text-center">
        {confirmed ? (
          <>
            <span
              aria-hidden="true"
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-accent-border bg-accent-soft text-accent"
            >
              <svg viewBox="0 0 20 20" className="h-6 w-6" fill="none">
                <path d="m5 10.5 3.5 3.5L15 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h1 className="mt-6 text-heading font-semibold text-content">Abonnement actif</h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-content-muted">
              Scan Trade Pro est activé sur ton compte. Tu peux lancer ton premier scan.
            </p>
            <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <ButtonLink href="/analyses/nouvelle" size="lg">
                Analyser mon chart
              </ButtonLink>
              <ButtonLink href="/dashboard" variant="secondary" size="lg">
                Aller au dashboard
              </ButtonLink>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-heading font-semibold text-content">Paiement en cours de confirmation</h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-content-muted">
              Stripe n&apos;a pas encore confirmé le paiement. Cela prend généralement quelques secondes : recharge
              cette page, ou consulte la page Abonnement dans un instant.
            </p>
            <div className="mt-8">
              <ButtonLink href="/abonnement" variant="secondary" size="lg">
                Voir mon abonnement
              </ButtonLink>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
