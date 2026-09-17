import type { Metadata } from 'next';
import { ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Disclaimer } from '@/components/layout/disclaimer';
import { ManageSubscriptionButton, SubscribeButton } from '@/features/billing/billing-actions';
import { SignOutButton } from '@/features/settings/settings-forms';
import { subscriptionDisplayState } from '@/features/billing/subscription';
import { requireViewer } from '@/server/session';
import { getUsageSnapshot } from '@/server/usage';
import { MARKET_LABEL, STYLE_LABEL, formatDate } from '@/utils/format';

export const metadata: Metadata = { title: 'Mon compte' };
export const dynamic = 'force-dynamic';

const STATE = {
  none: { label: 'Aucun abonnement', tone: 'muted' as const },
  active: { label: 'Actif', tone: 'accent' as const },
  canceling: { label: 'Résiliation programmée', tone: 'warning' as const },
  past_due: { label: 'Paiement en échec', tone: 'danger' as const },
  canceled: { label: 'Résilié', tone: 'muted' as const },
  paused: { label: 'En pause', tone: 'warning' as const },
};

export default async function AccountPage() {
  const viewer = await requireViewer();
  const usage = await getUsageSnapshot(viewer.id);
  const badge = STATE[subscriptionDisplayState(viewer.subscription)];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-display font-semibold text-content">Mon compte</h1>
        <p className="mt-2 text-sm text-content-muted">Informations, abonnement et actions rapides.</p>
      </div>

      <Card>
        <CardHeader title="Informations" />
        <CardBody>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Item label="E-mail" value={viewer.email} />
            <Item label="Prénom" value={viewer.name ?? 'Non renseigné'} />
            <Item label="Date d'inscription" value={formatDate(viewer.createdAt)} />
            <Item
              label="Marché principal"
              value={viewer.marketPreference ? MARKET_LABEL[viewer.marketPreference] : 'Non précisé'}
            />
            <Item
              label="Style de trading"
              value={viewer.tradingStyle ? STYLE_LABEL[viewer.tradingStyle] : 'Non précisé'}
            />
            <Item label="Analyses ce mois" value={String(usage.used)} />
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Abonnement" action={<Badge tone={badge.tone}>{badge.label}</Badge>} />
        <CardBody className="space-y-4">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Item label="Plan" value="Scan Trade Pro — 19,90 € / mois" />
            <Item
              label={viewer.subscription?.cancelAtPeriodEnd ? 'Accès jusqu’au' : 'Renouvellement'}
              value={viewer.subscription?.currentPeriodEnd ? formatDate(viewer.subscription.currentPeriodEnd) : '—'}
            />
          </dl>
          <div className="max-w-xs">
            {viewer.isSubscribed ? <ManageSubscriptionButton /> : <SubscribeButton label="S'abonner" />}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Actions" />
        <CardBody className="flex flex-wrap gap-3">
          <ButtonLink href="/parametres" variant="secondary">
            Paramètres
          </ButtonLink>
          <ButtonLink href="/historique" variant="secondary">
            Mon historique
          </ButtonLink>
          <SignOutButton />
        </CardBody>
      </Card>

      <Disclaimer />
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.12em] text-content-faint">{label}</dt>
      <dd className="mt-1.5 truncate text-sm text-content" title={value}>
        {value}
      </dd>
    </div>
  );
}
