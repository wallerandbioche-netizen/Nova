'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { SignInForm } from '@/components/account/sign-in-form';
import { useAccount } from '@/hooks/use-account';
import { formatDate } from '@/lib/utils/format';

type PlanId = 'mensuelle' | 'annuelle';

const FEATURES = [
  'Zone d’entrée, stop et objectifs chiffrés',
  'Niveaux tracés directement sur la capture analysée',
  'Rapport risque / rendement et taille de position',
  'Raisonnement complet et plan d’exécution',
  'Analyses illimitées et journal de fiabilité',
];

export function Plans() {
  const { accountsEnabled, billingEnabled, account, subscription, unlocked, setDemoUnlocked } =
    useAccount();
  const toast = useToast();
  const [pending, setPending] = useState<PlanId | null>(null);

  /** Hands over to Stripe Checkout; the webhook is what grants access. */
  const subscribe = async (plan: PlanId) => {
    if (!billingEnabled) {
      setDemoUnlocked(true);
      toast.push({
        tone: 'info',
        title: 'Mode démonstration',
        description: 'Les paiements ne sont pas configurés sur ce déploiement.',
      });
      return;
    }

    setPending(plan);
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string };

      if (payload.url) {
        window.location.href = payload.url;
        return;
      }
      toast.push({
        tone: 'warning',
        title: 'Paiement indisponible',
        description: payload.error ?? 'Réessayez dans un instant.',
      });
    } finally {
      setPending(null);
    }
  };

  const needsSignIn = billingEnabled && !account;

  return (
    <div className="space-y-4">
      {subscription.active ? (
        <Card>
          <CardHeader
            title="Abonnement actif"
            description={
              subscription.currentPeriodEnd
                ? subscription.cancelAtPeriodEnd
                  ? `Accès ouvert jusqu’au ${formatDate(subscription.currentPeriodEnd)}.`
                  : `Renouvellement le ${formatDate(subscription.currentPeriodEnd)}.`
                : 'Vos analyses complètes sont débloquées.'
            }
            action={<Badge tone="long">Actif</Badge>}
          />
          <CardContent>
            <Link href="/profil" className="text-[13px] font-medium text-brand hover:underline">
              Gérer l’abonnement, changer de carte ou résilier
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {needsSignIn ? (
        <Card>
          <CardHeader
            title="Connectez-vous d’abord"
            description="L’abonnement est rattaché à votre adresse e-mail : c’est ce qui vous permet de le retrouver sur vos autres appareils."
          />
          <CardContent>
            <SignInForm />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Formule gratuite"
          description="Analyses illimitées — verdict directionnel visible, le reste flouté."
          action={<span className="text-[15px] font-semibold text-ink">0 €</span>}
        />
        <CardContent>
          <Button
            variant="secondary"
            fullWidth
            /* With accounts, only Stripe can end a subscription. */
            disabled={!unlocked || accountsEnabled}
            onClick={() => setDemoUnlocked(false)}
          >
            {unlocked && !accountsEnabled ? 'Revenir à la formule gratuite' : 'Formule actuelle'}
          </Button>
          {accountsEnabled && subscription.active ? (
            <p className="mt-2 text-[12px] leading-4 text-ink-muted">
              La résiliation se fait depuis l’espace de gestion Stripe, sur la page Profil : votre
              accès reste ouvert jusqu’à la fin de la période déjà payée.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <PlanCard
          title="Mensuelle"
          price="29,99 €"
          period="par mois"
          note="Sans engagement, résiliable à tout moment."
          onSubscribe={() => subscribe('mensuelle')}
          pending={pending === 'mensuelle'}
          active={subscription.active && subscription.plan === 'mensuelle'}
          disabled={needsSignIn}
        />
        <PlanCard
          title="Annuelle"
          price="199,99 €"
          period="par an"
          note="Soit 16,67 € par mois."
          badge="2 mois offerts"
          highlighted
          onSubscribe={() => subscribe('annuelle')}
          pending={pending === 'annuelle'}
          active={subscription.active && subscription.plan === 'annuelle'}
          disabled={needsSignIn}
        />
      </div>

      <Card>
        <CardHeader title="Inclus dans l’abonnement" />
        <CardContent>
          <ul className="space-y-2">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-[13px] leading-5 text-ink">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                {feature}
              </li>
            ))}
          </ul>

          <p className="mt-4 text-[11.5px] leading-4 text-ink-subtle">
            L’abonnement donne accès à une analyse détaillée. Il ne garantit aucun résultat : SCAN
            TRADE fournit une lecture structurée, la décision et le risque restent les vôtres.
            {billingEnabled
              ? ' Le paiement est traité par Stripe ; aucune donnée de carte ne transite par SCAN TRADE.'
              : accountsEnabled
                ? ' Les paiements ne sont pas encore configurés sur ce déploiement.'
                : ' Ce déploiement fonctionne en mode démonstration : aucun paiement n’est traité.'}
          </p>

          <Link
            href="/analyser"
            className="mt-3 inline-block text-[13px] font-medium text-brand hover:underline"
          >
            Continuer en gratuit
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function PlanCard({
  title,
  price,
  period,
  note,
  badge,
  highlighted,
  onSubscribe,
  pending,
  active,
  disabled,
}: {
  title: string;
  price: string;
  period: string;
  note: string;
  badge?: string;
  highlighted?: boolean;
  onSubscribe: () => void;
  pending: boolean;
  active: boolean;
  disabled: boolean;
}) {
  return (
    <Card
      className={
        highlighted ? 'relative flex flex-col border-brand shadow-raised' : 'relative flex flex-col'
      }
    >
      <CardHeader
        title={title}
        description={note}
        action={badge ? <Badge tone="brand">{badge}</Badge> : undefined}
      />
      <CardContent className="mt-auto">
        <p className="text-[26px] leading-8 font-semibold tracking-[-0.02em] text-ink">{price}</p>
        <p className="text-[12.5px] text-ink-muted">{period}</p>
        <Button
          fullWidth
          className="mt-4"
          variant={highlighted ? 'primary' : 'secondary'}
          onClick={onSubscribe}
          disabled={active || pending || disabled}
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          {active
            ? 'Formule actuelle'
            : pending
              ? 'Ouverture du paiement…'
              : 'Choisir cette formule'}
        </Button>
      </CardContent>
    </Card>
  );
}
