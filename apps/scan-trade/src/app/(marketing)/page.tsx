import type { Metadata } from 'next';
import Link from 'next/link';
import { ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PricingCard } from '@/components/billing/pricing-card';
import { DemoAnalysis } from '@/components/marketing/demo-analysis';
import { Disclaimer } from '@/components/layout/disclaimer';
import { getViewer } from '@/server/session';

export const metadata: Metadata = {
  title: "Scan Trade — Analyse tes charts avec l'IA",
  description:
    'Scan Trade analyse tes captures de graphiques et t’aide à identifier les niveaux clés et scénarios potentiels.',
  alternates: { canonical: '/' },
};

const STEPS = [
  {
    number: '01',
    title: 'Upload',
    description: 'Envoie une capture de ton graphique. JPG, PNG ou WEBP, depuis ton ordinateur ou ton téléphone.',
  },
  {
    number: '02',
    title: 'Scan',
    description:
      'Notre système analyse la structure et les éléments techniques visibles sur l’image, sans rien y ajouter.',
  },
  {
    number: '03',
    title: 'Plan',
    description:
      'Consulte les niveaux clés, le scénario potentiel, ses conditions de confirmation et son invalidation.',
  },
] as const;

const PRINCIPLES = [
  {
    title: 'Rien n’est inventé',
    description:
      'Si le ticker, le timeframe ou le prix ne sont pas lisibles sur la capture, ils restent « non identifiés ».',
  },
  {
    title: 'Le refus est une réponse',
    description:
      'Quand aucune configuration ne se justifie, Scan Trade répond NO TRADE et explique pourquoi, plutôt que de fabriquer un setup.',
  },
  {
    title: 'Aucune promesse de gain',
    description:
      'Pas de taux de réussite, pas de probabilité de gain. Un niveau de confiance qualitatif, et ses limites.',
  },
] as const;

export default async function LandingPage() {
  const viewer = await getViewer();

  return (
    <>
        {/* ---------------------------------------------------------------- Hero */}
        <section className="hero-glow relative overflow-hidden">
          <div className="grid-lines absolute inset-0 opacity-60" aria-hidden="true" />
          <div className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pb-24 sm:pt-24 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <Badge tone="muted" className="mb-6">
                Analyse de graphiques assistée par IA
              </Badge>

              <h1 className="text-display-lg font-semibold text-content">
                Scanne ton chart.
                <br className="hidden sm:block" /> Comprends le setup.{' '}
                <span className="text-content-muted">Prépare ton plan.</span>
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-content-muted sm:text-lg">
                Transforme une simple capture d&apos;écran en analyse structurée de ton graphique, avec les niveaux
                clés et un scénario potentiel.
              </p>

              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <ButtonLink href={viewer ? '/analyses/nouvelle' : '/inscription'} size="lg" className="w-full sm:w-auto">
                  Analyser mon chart
                </ButtonLink>
                <ButtonLink href="#fonctionnement" variant="secondary" size="lg" className="w-full sm:w-auto">
                  Découvrir Scan Trade
                </ButtonLink>
              </div>

              <p className="mt-5 text-xs text-content-faint">
                19,90 € / mois · Résiliation à tout moment · Aucune exécution d&apos;ordre
              </p>
            </div>

            <div className="mt-16 sm:mt-20">
              <DemoAnalysis />
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- How it works */}
        <section id="fonctionnement" className="border-t border-border py-20 sm:py-24">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-display font-semibold text-content">Comment ça marche</h2>
            <p className="mt-3 max-w-xl text-content-muted">
              Trois étapes, quelques secondes d&apos;attention, un plan lisible.
            </p>

            <ol className="mt-12 grid gap-4 md:grid-cols-3">
              {STEPS.map((step) => (
                <li key={step.number}>
                  <Card className="h-full p-6">
                    <p className="numeric text-sm font-semibold text-accent">{step.number}</p>
                    <h3 className="mt-3 text-lg font-semibold text-content">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-content-muted">{step.description}</p>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ----------------------------------------------------------- Principles */}
        <section className="border-t border-border bg-surface/30 py-20 sm:py-24">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-display font-semibold text-content">Ce que Scan Trade ne fera pas</h2>
            <p className="mt-3 max-w-xl text-content-muted">
              Un outil d&apos;analyse n&apos;a de valeur que s&apos;il sait dire ce qu&apos;il ne sait pas.
            </p>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {PRINCIPLES.map((principle) => (
                <Card key={principle.title} className="h-full p-6">
                  <h3 className="text-base font-semibold text-content">{principle.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-content-muted">{principle.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------------- Pricing */}
        <section id="tarifs" className="border-t border-border py-20 sm:py-24">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-display font-semibold text-content">Un seul abonnement</h2>
              <p className="mt-3 text-content-muted">
                Tout le produit, sans palier ni option. Résiliable à tout moment depuis ton compte.
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

            <p className="mt-8 text-center text-sm text-content-muted">
              Une question ?{' '}
              <Link href="/contact" className="text-accent underline-offset-4 hover:underline">
                Contacte-nous
              </Link>
              .
            </p>
          </div>
        </section>

        {/* ----------------------------------------------------------- Disclaimer */}
        <section className="border-t border-border py-12">
          <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
            <Disclaimer />
          </div>
        </section>
    </>
  );
}
