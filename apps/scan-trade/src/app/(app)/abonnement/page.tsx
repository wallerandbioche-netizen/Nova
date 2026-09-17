import type { Metadata } from 'next';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { PricingCard } from '@/components/billing/pricing-card';
import { Disclaimer } from '@/components/layout/disclaimer';
import { ManageSubscriptionButton, SubscribeButton } from '@/features/billing/billing-actions';
import { subscriptionDisplayState } from '@/features/billing/subscription';
import { isStripeConfigured } from '@/lib/env';
import { requireViewer } from '@/server/session';
import { getUsageSnapshot } from '@/server/usage';
import { formatDate } from '@/utils/format';

export const metadata: Metadata = { title: 'Abonnement' };
export const dynamic = 'force-dynamic';

const STATE_LABEL = {
  none: { label: 'Aucun abonnement', tone: 'muted' as const },
  active: { label: 'Actif', tone: 'accent' as const },
  canceling: { label: 'Résiliation programmée', tone: 'warning' as const },
  past_due: { label: 'Paiement en échec', tone: 'danger' as const },
  canceled: { label: 'Résilié', tone: 'muted' as const },
  paused: { label: 'En pause', tone: 'warning' as const },
};

export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const viewer = await requireViewer();
  const query = await searchParams;
  const [usage] = await Promise.all([getUsageSnapshot(viewer.id)]);

  const state = subscriptionDisplayState(viewer.subscription);
  const badge = STATE_LABEL[state];
  const stripeReady = isStripeConfigured();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-display font-semibold text-content">
          {viewer.isSubscribed ? 'Abonnement' : 'Débloque Scan Trade'}
        </h1>
        <p className="mt-2 text-sm text-content-muted">
          Un seul abonnement, toutes les fonctionnalités, résiliable à tout moment.
        </p>
      </div>

      {query.checkout === 'annule' && (
        <Card className="px-5 py-4 sm:px-6">
          <p className="text-sm text-content-muted">
            Paiement annulé — rien n&apos;a été débité. Tu peux relancer l&apos;abonnement quand tu
            veux.
          </p>
        </Card>
      )}

      {!stripeReady && (
        <Card className="border-warning-border bg-warning-soft px-5 py-4 sm:px-6">
          <p className="text-sm font-medium text-warning">
            Paiement non configuré sur ce déploiement
          </p>
          <p className="mt-1.5 text-sm text-content-muted">
            Les variables <code className="text-content">STRIPE_SECRET_KEY</code>,{' '}
            <code className="text-content">STRIPE_PRICE_ID</code> et{' '}
            <code className="text-content">STRIPE_WEBHOOK_SECRET</code> doivent être renseignées.
            Voir la section « Configuration Stripe » du README.
          </p>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <PricingCard
          className="max-w-none"
          action={
            viewer.isSubscribed ? (
              <ManageSubscriptionButton />
            ) : (
              <SubscribeButton label="S'abonner" />
            )
          }
          note="Paiement sécurisé par Stripe. Aucune donnée bancaire n'est stockée par Scan Trade."
        />

        <div className="space-y-5">
          <Card>
            <CardHeader title="Ton abonnement" />
            <dl className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
              <Row label="Statut" value={<Badge tone={badge.tone}>{badge.label}</Badge>} />
              <Row
                label="Plan"
                value={<span className="text-sm text-content">Scan Trade Pro</span>}
              />
              <Row
                label={
                  viewer.subscription?.cancelAtPeriodEnd
                    ? 'Accès jusqu’au'
                    : 'Prochain renouvellement'
                }
                value={
                  <span className="numeric text-sm text-content">
                    {viewer.subscription?.currentPeriodEnd
                      ? formatDate(viewer.subscription.currentPeriodEnd)
                      : '—'}
                  </span>
                }
              />
              <Row
                label="Montant"
                value={<span className="numeric text-sm text-content">19,90 € / mois</span>}
              />
            </dl>
            {viewer.isSubscribed && (
              <div className="hairline px-5 py-4 sm:px-6">
                <ManageSubscriptionButton />
                <p className="mt-2.5 text-center text-xs text-content-faint">
                  Ouvre le portail client Stripe : facture, moyen de paiement, résiliation.
                </p>
              </div>
            )}
          </Card>

          <Card className="px-5 py-5 sm:px-6">
            <p className="text-xs uppercase tracking-[0.12em] text-content-faint">Usage du mois</p>
            <p className="numeric mt-2 text-metric font-semibold text-content">
              {usage.used} <span className="text-sm font-normal text-content-muted">analyses</span>
            </p>
            <p className="mt-1.5 text-xs text-content-faint">
              {usage.limit == null
                ? 'Aucune limite sur le plan Pro. Le compteur repart le 1er de chaque mois.'
                : `${usage.remaining} analyses restantes sur ${usage.limit} pour la période.`}
            </p>
          </Card>
        </div>
      </div>

      <Disclaimer />
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0">
      <dt className="text-sm text-content-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
