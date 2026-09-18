import { Coins } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireUser } from '@/lib/auth/session';
import { creditService } from '@/lib/credits/credit-service';
import { getCreditPacks, getCreditCostPerVideo, getPlans } from '@/lib/config/system-config';
import { formatPrice } from '@/lib/config/pricing';
import { isStripeConfigured } from '@/lib/stripe/client';
import { formatDate } from '@/lib/utils';
import { CheckoutButton } from '@/components/dashboard/checkout-button';

const TYPE_LABELS: Record<string, string> = {
  PURCHASE: 'Achat',
  GENERATION: 'Génération',
  REFUND: 'Remboursement',
  BONUS: 'Bonus',
};

export default async function CreditsPage() {
  const user = await requireUser();
  const [balance, cost, history, plans, packs] = await Promise.all([
    creditService.getBalance(user.id),
    getCreditCostPerVideo(),
    creditService.history(user.id, 25),
    getPlans(),
    getCreditPacks(),
  ]);
  const stripeReady = isStripeConfigured();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-950">Crédits</h1>
        <p className="mt-1 text-sm text-ink-500">
          {cost} crédit{cost > 1 ? 's' : ''} par vidéo générée. Un rendu qui échoue est remboursé
          automatiquement.
        </p>
      </div>

      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-ink-900 text-ink-50">
            <Coins className="h-5 w-5" />
          </span>
          <div>
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{balance}</p>
            <p className="text-sm text-ink-500">crédits disponibles</p>
          </div>
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-4 text-lg font-medium text-ink-900">Offres</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.name}</CardTitle>
                  {plan.id === 'FREE' ? <Badge>Actuel</Badge> : null}
                </div>
                <p className="text-2xl font-semibold text-ink-900">
                  {plan.priceCents === 0 ? 'Gratuit' : formatPrice(plan.priceCents, plan.currency)}
                  {plan.interval === 'month' ? (
                    <span className="text-sm font-normal text-ink-400"> /mois</span>
                  ) : null}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-1.5 text-sm text-ink-500">
                  {plan.features.map((feature) => (
                    <li key={feature}>· {feature}</li>
                  ))}
                </ul>
                {plan.id !== 'FREE' ? (
                  <CheckoutButton planId={plan.id as 'STARTER' | 'PRO'} disabled={!stripeReady} />
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>

        {packs.length > 0 ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {packs.map((pack) => (
              <Card key={pack.id}>
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="font-medium text-ink-900">{pack.name}</p>
                    <p className="text-sm text-ink-500">
                      {formatPrice(pack.priceCents, pack.currency)}
                    </p>
                  </div>
                  <CheckoutButton packId={pack.id} disabled={!stripeReady} />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}

        {!stripeReady ? (
          <p className="mt-4 text-sm text-ink-400">
            Le paiement n’est pas configuré sur cette instance (STRIPE_SECRET_KEY absent).
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-medium text-ink-900">Historique</h2>
        {history.length === 0 ? (
          <p className="text-sm text-ink-400">Aucun mouvement pour le moment.</p>
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-ink-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 text-right font-medium">Montant</th>
                  <th className="px-5 py-3 text-right font-medium">Solde</th>
                </tr>
              </thead>
              <tbody>
                {history.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-ink-100 last:border-0">
                    <td className="px-5 py-3 text-ink-500">{formatDate(transaction.createdAt)}</td>
                    <td className="px-5 py-3 text-ink-700">
                      {TYPE_LABELS[transaction.type] ?? transaction.type}
                    </td>
                    <td
                      className={`px-5 py-3 text-right tabular-nums ${
                        transaction.amount > 0 ? 'text-emerald-600' : 'text-ink-700'
                      }`}
                    >
                      {transaction.amount > 0 ? '+' : ''}
                      {transaction.amount}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-ink-500">
                      {transaction.balanceAfter}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
