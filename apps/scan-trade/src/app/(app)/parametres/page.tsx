import type { Metadata } from 'next';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Disclaimer } from '@/components/layout/disclaimer';
import { ManageSubscriptionButton, SubscribeButton } from '@/features/billing/billing-actions';
import {
  DeleteAccountSection,
  PasswordForm,
  ProfileForm,
  SignOutButton,
} from '@/features/settings/settings-forms';
import { subscriptionDisplayState } from '@/features/billing/subscription';
import { requireViewer } from '@/server/session';
import { formatDate } from '@/utils/format';

export const metadata: Metadata = { title: 'Paramètres' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const viewer = await requireViewer();
  const state = subscriptionDisplayState(viewer.subscription);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-display font-semibold text-content">Paramètres</h1>
        <p className="mt-2 text-sm text-content-muted">
          Compte, préférences, sécurité et abonnement.
        </p>
      </div>

      <Card>
        <CardHeader title="Account" description="Ton identité sur Scan Trade." />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="E-mail" value={viewer.email} />
            <Field label="Membre depuis" value={formatDate(viewer.createdAt)} />
          </div>
          <p className="text-xs leading-relaxed text-content-faint">
            L&apos;adresse e-mail identifie ton compte et ne peut pas être modifiée depuis cette
            page. Écris-nous depuis la page Contact si tu dois en changer.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Preferences" description="Comment l'analyse est formulée." />
        <CardBody>
          <ProfileForm
            name={viewer.name}
            marketPreference={viewer.marketPreference}
            tradingStyle={viewer.tradingStyle}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Security" description="Mot de passe et sessions." />
        <CardBody className="space-y-6">
          <PasswordForm hasPassword={viewer.hasPassword} />
          <div className="hairline pt-5">
            <SignOutButton />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Subscription" description="Géré par Stripe." />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Statut"
              value={
                state === 'active'
                  ? 'Actif'
                  : state === 'canceling'
                    ? 'Résiliation programmée'
                    : state === 'past_due'
                      ? 'Paiement en échec'
                      : state === 'paused'
                        ? 'En pause'
                        : state === 'canceled'
                          ? 'Résilié'
                          : 'Aucun abonnement'
              }
            />
            <Field
              label={viewer.subscription?.cancelAtPeriodEnd ? 'Accès jusqu’au' : 'Renouvellement'}
              value={
                viewer.subscription?.currentPeriodEnd
                  ? formatDate(viewer.subscription.currentPeriodEnd)
                  : '—'
              }
            />
          </div>
          <div className="max-w-xs">
            {viewer.isSubscribed ? (
              <ManageSubscriptionButton />
            ) : (
              <SubscribeButton label="S'abonner" />
            )}
          </div>
        </CardBody>
      </Card>

      <Card className="border-danger-border">
        <CardHeader title={<span className="text-danger">Danger Zone</span>} />
        <CardBody>
          <DeleteAccountSection email={viewer.email} />
        </CardBody>
      </Card>

      <Disclaimer />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.12em] text-content-faint">{label}</p>
      <p className="mt-1.5 truncate text-sm text-content" title={value}>
        {value}
      </p>
    </div>
  );
}
