/**
 * Standalone demo bundle.
 *
 * The product is a Next.js application; this entry re-mounts the very same
 * components as a single page with hash routing, so the interface can be
 * opened from a static host. The analysis engine already runs in the browser,
 * so nothing is faked here: every screen shows real engine output on the
 * simulated market data the app ships with.
 */
import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { usePathname } from './shims/navigation';

import '../src/app/globals.css';

import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { ThemeSync } from '@/components/layout/theme-sync';
import { ToastProvider } from '@/components/ui/toast';
import { Card, CardHeader, SectionTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { OverviewStats } from '@/components/dashboard/overview-stats';
import { RecentAnalyses } from '@/components/dashboard/recent-analyses';
import { Opportunities } from '@/components/dashboard/opportunities';
import { MarketOverview } from '@/components/dashboard/market-overview';
import { MarketTable, type MarketRow } from '@/components/markets/market-table';
import { JournalTable } from '@/components/history/journal-table';
import { AnalyzerView } from '@/app/analyser/analyzer-view';
import { AnalysisView } from '@/app/analyse/[id]/analysis-view';
import { Plans } from '@/app/abonnement/plans';
import { ProfileView } from '@/app/profil/profile-view';
import Link from './shims/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { buildOpportunities } from '@/lib/mock-data/opportunities';
import { runAnalysis } from '@/lib/analysis/engine';
import { ASSETS, generateCandles, getQuotes, timeframeLadder } from '@/lib/market-data';
import type { MarketQuote, Timeframe } from '@/types/market';

const SCAN_TIMEFRAME: Timeframe = '1H';

function HomeView() {
  const [quotes, setQuotes] = useState<MarketQuote[] | null>(null);
  const opportunities = useMemo(() => buildOpportunities(), []);

  useEffect(() => {
    let active = true;
    getQuotes(['BTCUSDT', 'ETHUSDT', 'XAUUSD', 'NAS100', 'EURUSD']).then((result) => {
      if (active) setQuotes(result);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
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
            {quotes ? (
              <MarketOverview quotes={quotes} />
            ) : (
              <div className="space-y-2 px-5 pb-5">
                {Array.from({ length: 5 }).map((_value, index) => (
                  <Skeleton key={index} className="h-10" />
                ))}
              </div>
            )}
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
    </>
  );
}

function MarketsView() {
  const [rows, setRows] = useState<MarketRow[] | null>(null);

  useEffect(() => {
    let active = true;
    // Eight full engine runs: deferred so the shell paints first.
    const timer = window.setTimeout(async () => {
      const quotes = await getQuotes();
      const ladder = timeframeLadder(SCAN_TIMEFRAME);
      const computed: MarketRow[] = ASSETS.map((asset) => {
        const candles = generateCandles({
          assetId: asset.id,
          timeframe: SCAN_TIMEFRAME,
          count: 320,
        });
        const analysis = runAnalysis(
          {
            asset,
            timeframe: SCAN_TIMEFRAME,
            candles,
            riskProfile: 'modere',
            higherTimeframeCandles: [
              {
                timeframe: ladder.higher,
                candles: generateCandles({
                  assetId: asset.id,
                  timeframe: ladder.higher,
                  count: 200,
                }),
              },
              {
                timeframe: ladder.intermediate,
                candles: generateCandles({
                  assetId: asset.id,
                  timeframe: ladder.intermediate,
                  count: 240,
                }),
              },
            ],
          },
          {
            id: `scan_${asset.id}`,
            dataSource: { source: 'mock', label: 'Données simulées', candles: candles.length },
          },
        );
        const quote = quotes.find((item) => item.asset.id === asset.id) ?? quotes[0];
        return { quote: quote!, analysis };
      });
      if (active) setRows(computed);
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  const withSetup = (rows ?? []).filter((row) => row.analysis.setup).map((row) => row.analysis);

  return (
    <>
      <PageHeader
        title="Marchés"
        description={`Balayage des instruments suivis en ${SCAN_TIMEFRAME}. Données simulées — pas un flux de marché en direct.`}
      />
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <CardHeader
            title="Instruments suivis"
            description="Chaque ligne est une lecture complète du moteur, pas une liste de signaux."
          />
          {rows ? (
            <MarketTable rows={rows} timeframe={SCAN_TIMEFRAME} />
          ) : (
            <div className="space-y-2 px-5 pb-5">
              {Array.from({ length: 8 }).map((_value, index) => (
                <Skeleton key={index} className="h-11" />
              ))}
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Configurations retenues"
            description="Seuls les instruments qui passent tous les filtres apparaissent ici."
          />
          {rows ? <Opportunities analyses={withSetup} /> : <Skeleton className="mx-5 mb-5 h-20" />}
        </Card>
      </div>
    </>
  );
}

function Routes() {
  const pathname = usePathname();

  if (pathname.startsWith('/analyser')) {
    return (
      <>
        <PageHeader
          title="Analyser"
          description="Lecture structurée d’un graphique : contexte, niveaux, configuration et gestion du risque."
          backHref="/"
          backLabel="Retour à l’accueil"
        />
        <AnalyzerView initialAssetId="XAUUSD" initialTimeframe="15m" />
      </>
    );
  }

  if (pathname.startsWith('/marches')) return <MarketsView />;

  if (pathname.startsWith('/journal')) {
    return (
      <>
        <PageHeader
          title="Journal"
          description="Historique de vos analyses et de leurs statistiques. Les performances passées ne préjugent pas des performances futures."
        />
        <JournalTable />
      </>
    );
  }

  if (pathname.startsWith('/analyse/')) {
    const id = decodeURIComponent(pathname.slice('/analyse/'.length));
    return (
      <>
        <PageHeader
          title="Résultat d’analyse"
          description="Verdict directionnel, niveaux clés et plan d’exécution."
          backHref="/journal"
          backLabel="Retour au journal"
        />
        <AnalysisView analysisId={id} />
      </>
    );
  }

  if (pathname.startsWith('/abonnement')) {
    return (
      <>
        <PageHeader
          title="Abonnement"
          description="Accédez au détail des analyses et aux fonctionnalités avancées."
          backHref="/profil"
          backLabel="Retour au profil"
        />
        <div className="max-w-3xl">
          <Plans />
        </div>
      </>
    );
  }

  if (pathname.startsWith('/profil')) {
    return (
      <>
        <PageHeader title="Profil" description="Compte, abonnement, apparence et calibrage." />
        <ProfileView />
      </>
    );
  }

  return <HomeView />;
}

function DemoApp() {
  // Scroll back to the top on every route change, like a real navigation.
  const pathname = usePathname();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <ToastProvider>
      <ThemeSync />
      <AppShell>
        <Routes />
      </AppShell>
    </ToastProvider>
  );
}

/**
 * The host can stamp its own theme on the document before the bundle boots.
 * A first-time visitor inherits it; a stored preference always wins.
 */
function adoptHostTheme(): void {
  try {
    if (window.localStorage.getItem('scantrade.settings.v1')) return;
    const stamped = document.documentElement.dataset.theme;
    const theme = stamped === 'dark' || stamped === 'light' ? stamped : 'auto';
    window.localStorage.setItem('scantrade.settings.v1', JSON.stringify({ theme }));
  } catch {
    // Storage unavailable: the default light theme applies.
  }
}

adoptHostTheme();

const container = document.getElementById('root');
if (container) {
  container.innerHTML = '';
  createRoot(container).render(
    <StrictMode>
      <DemoApp />
    </StrictMode>,
  );
}
