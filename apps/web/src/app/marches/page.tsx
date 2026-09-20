import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { MarketTable, type MarketRow } from '@/components/markets/market-table';
import { Opportunities } from '@/components/dashboard/opportunities';
import { runAnalysis } from '@/lib/analysis/engine';
import { ASSETS, generateCandles, getQuotes, timeframeLadder } from '@/lib/market-data';
import type { Timeframe } from '@/types/market';

export const metadata: Metadata = {
  title: 'Marchés',
  description: 'Vue d’ensemble des instruments suivis et de leur biais courant.',
};

const SCAN_TIMEFRAME: Timeframe = '1H';

export default async function MarketsPage() {
  const quotes = await getQuotes();
  const ladder = timeframeLadder(SCAN_TIMEFRAME);

  const rows: MarketRow[] = ASSETS.map((asset) => {
    const candles = generateCandles({ assetId: asset.id, timeframe: SCAN_TIMEFRAME, count: 320 });
    const analysis = runAnalysis(
      {
        asset,
        timeframe: SCAN_TIMEFRAME,
        candles,
        riskProfile: 'modere',
        higherTimeframeCandles: [
          {
            timeframe: ladder.higher,
            candles: generateCandles({ assetId: asset.id, timeframe: ladder.higher, count: 200 }),
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
    const quote = quotes.find((item) => item.asset.id === asset.id);
    return { quote: quote ?? quotes[0]!, analysis };
  });

  const withSetup = rows.filter((row) => row.analysis.setup).map((row) => row.analysis);

  return (
    <AppShell>
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
          <MarketTable rows={rows} timeframe={SCAN_TIMEFRAME} />
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Configurations retenues"
            description="Seuls les instruments qui passent tous les filtres apparaissent ici."
          />
          <Opportunities analyses={withSetup} />
        </Card>
      </div>
    </AppShell>
  );
}
