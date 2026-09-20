import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardHeader, SectionTitle } from '@/components/ui/card';
import { MarketOverview } from '@/components/dashboard/market-overview';
import { Opportunities } from '@/components/dashboard/opportunities';
import { OverviewStats } from '@/components/dashboard/overview-stats';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { RecentAnalyses } from '@/components/dashboard/recent-analyses';
import { buildOpportunities } from '@/lib/mock-data/opportunities';
import { getQuotes } from '@/lib/market-data';

export default async function HomePage() {
  const [quotes, opportunities] = await Promise.all([
    getQuotes(['BTCUSDT', 'ETHUSDT', 'XAUUSD', 'NAS100', 'EURUSD']),
    Promise.resolve(buildOpportunities()),
  ]);

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.03em] text-ink sm:text-[30px] sm:leading-9">
          Bienvenue sur SCAN TRADE
        </h1>
        <p className="mt-1.5 max-w-2xl text-[14px] leading-6 text-ink-muted">
          Votre assistant d’analyse graphique. Chaque lecture est structurée, chiffrée et expliquée
          — y compris lorsqu’elle conclut qu’il n’y a rien à faire.
        </p>
      </header>

      <div className="space-y-6">
        <QuickActions />

        <OverviewStats opportunityCount={opportunities.length} />

        <RecentAnalyses />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <CardHeader
              title="Opportunités de marché"
              description="Instruments où une configuration passe tous les filtres."
              action={
                <Link
                  href="/marches"
                  className="inline-flex items-center gap-1 text-[13px] font-medium text-brand hover:underline"
                >
                  Marchés
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              }
            />
            <Opportunities analyses={opportunities.map((item) => item.analysis)} />
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title="Aperçu des marchés"
              description="Données simulées — pas un flux en direct."
            />
            <MarketOverview quotes={quotes} />
          </Card>
        </div>

        <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card">
          <SectionTitle>Une analyse, pas un signal</SectionTitle>
          <p className="mt-1.5 max-w-3xl text-[13px] leading-5 text-ink-muted">
            SCAN TRADE calcule la structure, les niveaux, le momentum et le risque, puis explique
            son raisonnement. Le score de confluence mesure l’accord entre les facteurs : ce n’est
            pas une probabilité de gain, et aucune direction n’est garantie.
          </p>
          <Link
            href="/analyser"
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Lancer une analyse
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
