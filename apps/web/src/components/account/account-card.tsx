'use client';

import { useState } from 'react';
import { CreditCard, LogOut } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useAccount } from '@/hooks/use-account';
import { useToast } from '@/components/ui/toast';
import { formatDate } from '@/lib/utils/format';
import { SignInForm } from './sign-in-form';

const PLAN_LABEL = { mensuelle: 'Mensuelle', annuelle: 'Annuelle' } as const;

/** Account, subscription and the entry point to Stripe's own portal. */
export function AccountCard() {
  const { accountsEnabled, billingEnabled, account, subscription, loading, signOut } = useAccount();
  const toast = useToast();
  const [opening, setOpening] = useState(false);

  const openPortal = async () => {
    setOpening(true);
    try {
      const response = await fetch('/api/billing/portal', { method: 'POST' });
      const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
      if (payload.url) {
        window.location.href = payload.url;
        return;
      }
      toast.push({
        tone: 'warning',
        title: 'Espace de gestion indisponible',
        description: payload.error ?? 'Réessayez dans un instant.',
      });
    } finally {
      setOpening(false);
    }
  };

  if (loading) return null;

  if (!accountsEnabled) {
    return (
      <Card>
        <CardHeader
          title="Compte"
          description="Ce déploiement fonctionne sans comptes : l’abonnement y est une simple bascule de démonstration."
        />
      </Card>
    );
  }

  if (!account) {
    return (
      <Card>
        <CardHeader
          title="Connexion"
          description="Connectez-vous pour retrouver votre abonnement et votre journal sur tous vos appareils."
        />
        <CardContent>
          <SignInForm />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Compte"
        description={account.email}
        action={
          <Badge tone={subscription.active ? 'long' : 'muted'}>
            {subscription.active
              ? (PLAN_LABEL[subscription.plan ?? 'mensuelle'] ?? 'Actif')
              : 'Gratuit'}
          </Badge>
        }
      />
      <CardContent className="space-y-3">
        {subscription.active ? (
          <p className="text-[13px] leading-5 text-ink-muted">
            Abonnement actif
            {subscription.currentPeriodEnd
              ? subscription.cancelAtPeriodEnd
                ? `, jusqu’au ${formatDate(subscription.currentPeriodEnd)} (résiliation programmée).`
                : `, renouvellement le ${formatDate(subscription.currentPeriodEnd)}.`
              : '.'}
          </p>
        ) : (
          <p className="text-[13px] leading-5 text-ink-muted">
            Aucun abonnement actif : le verdict directionnel reste visible, le détail est réservé
            aux abonnés.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {billingEnabled && subscription.status !== 'none' ? (
            <Button variant="secondary" onClick={openPortal} disabled={opening}>
              <CreditCard className="h-4 w-4" aria-hidden />
              {opening ? 'Ouverture…' : 'Gérer l’abonnement'}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={signOut}>
            <LogOut className="h-4 w-4" aria-hidden />
            Se déconnecter
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
