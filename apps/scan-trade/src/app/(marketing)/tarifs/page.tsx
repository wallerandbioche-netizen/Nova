import type { Metadata } from 'next';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PricingCard } from '@/components/billing/pricing-card';
import { Disclaimer } from '@/components/layout/disclaimer';
import { getViewer } from '@/server/session';

export const metadata: Metadata = {
  title: 'Tarifs',
  description:
    'Scan Trade Pro : 19,90 € par mois, toutes les fonctionnalités, résiliation à tout moment. Paiement sécurisé par Stripe.',
  alternates: { canonical: '/tarifs' },
};

const FAQ = [
  {
    question: 'Puis-je résilier à tout moment ?',
    answer:
      'Oui. La résiliation se fait en deux clics depuis la page Abonnement, via le portail Stripe. Tu gardes l’accès jusqu’à la fin de la période déjà payée.',
  },
  {
    question: 'Y a-t-il une limite d’analyses ?',
    answer:
      'Non, l’abonnement Pro est sans limite d’analyses. Un usage manifestement automatisé reste soumis à une protection anti-abus.',
  },
  {
    question: 'Mes captures sont-elles visibles par d’autres utilisateurs ?',
    answer:
      'Non. Les images sont stockées dans un espace privé, servies via des liens temporaires et rattachées à ton seul compte. Supprimer une analyse supprime aussi son image.',
  },
  {
    question: 'Scan Trade passe-t-il des ordres à ma place ?',
    answer:
      'Jamais. Scan Trade ne se connecte à aucun broker et n’exécute aucun ordre. Le produit lit une image et en restitue une lecture structurée.',
  },
] as const;

export default async function PricingPage() {
  const viewer = await getViewer();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-display font-semibold text-content">Un seul abonnement, tout inclus</h1>
        <p className="mt-4 text-content-muted">
          Pas de palier, pas de crédits à acheter, pas d&apos;option cachée.
        </p>
      </div>

      <div className="mt-12">
        <PricingCard
          action={
            <ButtonLink href={viewer ? '/abonnement' : '/inscription'} size="lg" className="w-full">
              Commencer avec Scan Trade
            </ButtonLink>
          }
          note="Paiement sécurisé par Stripe. Aucune donnée bancaire n'est stockée par Scan Trade."
        />
      </div>

      <section aria-labelledby="faq-heading" className="mx-auto mt-20 max-w-3xl">
        <h2 id="faq-heading" className="text-heading font-semibold text-content">
          Questions fréquentes
        </h2>
        <dl className="mt-6 space-y-3">
          {FAQ.map((item) => (
            <Card key={item.question} className="p-5">
              <dt className="text-sm font-medium text-content">{item.question}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-content-muted">{item.answer}</dd>
            </Card>
          ))}
        </dl>
      </section>

      <Disclaimer className="mx-auto mt-16 max-w-3xl" />
    </div>
  );
}
