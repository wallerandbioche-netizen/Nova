'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import type { LevelZone, MarketAnalysis, SwingPoint } from '@/types/analysis';
import { DEFAULT_INDICATORS } from '@/types/chart';
import { AnalysisProgress } from '@/components/analysis/analysis-progress';
import { LOCKED_FEATURES, LockedPreview, isDemonstration } from '@/components/analysis/ai-panel';
import { ConfluencePanel } from '@/components/analysis/confluence-panel';
import { DataSourceNote } from '@/components/analysis/data-source-note';
import { IndicatorsPanel } from '@/components/analysis/indicators-panel';
import { LevelsPanel } from '@/components/analysis/levels-panel';
import { MultiTimeframePanel } from '@/components/analysis/mtf-panel';
import { NarrativePanel } from '@/components/analysis/narrative-panel';
import { NoTradePanel } from '@/components/analysis/no-trade-panel';
import { Paywall } from '@/components/analysis/paywall';
import { RiskCalculator } from '@/components/analysis/risk-calculator';
import { SetupPanel } from '@/components/analysis/setup-panel';
import { StructurePanel } from '@/components/analysis/structure-panel';
import { Verdict } from '@/components/analysis/verdict';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ButtonLink } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { useHistory } from '@/hooks/use-history';
import { useAccount } from '@/hooks/use-account';
import { useSettings } from '@/hooks/use-settings';
import { generateCandles } from '@/lib/market-data';
import { RISK_PROFILE_LABEL } from '@/lib/utils/labels';

/** Stable empty props: a fresh literal would restart the chart on every render. */
const CHART_INDICATORS = { ...DEFAULT_INDICATORS, volume: true };
const NO_LEVELS: LevelZone[] = [];
const NO_SWINGS: SwingPoint[] = [];

const PriceChart = dynamic(
  () => import('@/components/charts/price-chart').then((module) => module.PriceChart),
  { ssr: false, loading: () => <Skeleton className="h-[380px] w-full rounded-none" /> },
);

export function AnalysisView({ analysisId }: { analysisId: string }) {
  const { entries, ready } = useHistory();
  const [settings, updateSettings] = useSettings();
  const account = useAccount();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const entry = entries.find((item) => item.analysis.id === analysisId);
  const analysisAsset = entry?.analysis.asset.id;
  const analysisTimeframe = entry?.analysis.timeframe;
  const candles = useMemo(
    () =>
      analysisAsset && analysisTimeframe
        ? generateCandles({ assetId: analysisAsset, timeframe: analysisTimeframe, count: 320 })
        : [],
    [analysisAsset, analysisTimeframe],
  );

  if (!ready || !mounted) {
    return (
      <Card className="p-5">
        <AnalysisProgress />
      </Card>
    );
  }

  if (!entry) {
    return (
      <Card>
        <EmptyState
          icon={<FileQuestion className="h-4 w-4" aria-hidden />}
          title="Analyse introuvable"
          description="Cette analyse n’existe plus dans ce navigateur. Le journal est stocké localement."
          action={<ButtonLink href="/analyser">Analyser une capture</ButtonLink>}
        />
      </Card>
    );
  }

  const analysis: MarketAnalysis = entry.analysis;
  const setup = analysis.setup;
  const unlocked = account.unlocked;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        {isDemonstration(analysis) ? (
          <p className="border-b border-warn/30 bg-warn-soft px-5 py-2 text-[12px] font-medium text-ink">
            Analyse de démonstration — produite sur des données simulées, pas sur une capture.
          </p>
        ) : null}
        <Verdict analysis={analysis} />

        <div className="border-t border-line">
          {entry.screenshot ? (
            /* The capture the reading was made from — a data URL, so no optimizer. */
            <img
              src={entry.screenshot}
              alt="Capture du graphique analysé"
              className="max-h-[420px] w-full bg-surface-muted object-contain"
            />
          ) : (
            <PriceChart
              candles={candles}
              precision={analysis.asset.precision}
              indicators={CHART_INDICATORS}
              setup={unlocked ? setup : null}
              levels={unlocked ? analysis.supportResistance : NO_LEVELS}
              swings={unlocked ? analysis.marketStructure.swings : NO_SWINGS}
              theme={settings.theme === 'dark' ? 'dark' : 'light'}
              height={380}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
          <DataSourceNote analysis={analysis} />
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-ink-muted">Niveau de risque</span>
            <Segmented
              label="Niveau de risque"
              size="sm"
              value={settings.riskProfile}
              onChange={(value) => updateSettings({ riskProfile: value })}
              options={[
                { value: 'prudent' as const, label: RISK_PROFILE_LABEL.prudent },
                { value: 'modere' as const, label: RISK_PROFILE_LABEL.modere },
                { value: 'agressif' as const, label: RISK_PROFILE_LABEL.agressif },
              ]}
            />
          </div>
        </div>
      </Card>

      {!unlocked ? (
        <Card>
          <CardHeader
            title="Analyse complète"
            description="Le verdict directionnel est offert. Le détail est réservé aux abonnés."
          />
          <CardContent>
            <Paywall
              unlocked={false}
              features={LOCKED_FEATURES}
              preview={<LockedPreview analysis={analysis} />}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <Card>
              <CardHeader
                title="Confluence"
                description="Accord entre les facteurs — pas une probabilité de gain."
              />
              <CardContent>
                <ConfluencePanel confluence={analysis.confluence} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Structure de marché" />
              <CardContent>
                <StructurePanel analysis={analysis} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Unités de temps" />
              <CardContent>
                <MultiTimeframePanel mtf={analysis.multiTimeframe} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Niveaux clés" />
              <CardContent>
                <LevelsPanel levels={analysis.supportResistance} asset={analysis.asset} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Indicateurs" />
              <CardContent>
                <IndicatorsPanel analysis={analysis} asset={analysis.asset} />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader title={setup ? 'Plan de trade' : 'Verdict'} />
              <CardContent>
                {setup ? (
                  <SetupPanel setup={setup} asset={analysis.asset} />
                ) : analysis.noTrade ? (
                  <NoTradePanel noTrade={analysis.noTrade} />
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader
                title="Raisonnement"
                description="Section par section, à partir des valeurs calculées."
              />
              <CardContent>
                <NarrativePanel narrative={analysis.narrative} />
              </CardContent>
            </Card>

            {setup ? (
              <Card>
                <CardHeader title="Calculateur de risque" />
                <CardContent>
                  <RiskCalculator
                    asset={analysis.asset}
                    direction={setup.direction}
                    entry={(setup.entryZone.low + setup.entryZone.high) / 2}
                    stopLoss={setup.stopLoss}
                    riskProfile={analysis.riskProfile}
                    accountSize={settings.accountSize}
                    riskPercent={settings.riskPercent}
                    {...(setup.takeProfits[1] ? { takeProfit: setup.takeProfits[1].price } : {})}
                    onPersist={(values) => updateSettings(values)}
                  />
                </CardContent>
              </Card>
            ) : null}

            {analysis.notes.length ? (
              <Card>
                <CardHeader title="Réserves" />
                <CardContent>
                  <ul className="space-y-1.5">
                    {analysis.notes.map((note) => (
                      <li key={note} className="text-[12.5px] leading-5 text-ink-muted">
                        • {note}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      )}

      <p className="px-1 text-[11.5px] leading-4 text-ink-subtle">
        SCAN TRADE fournit une analyse, pas une recommandation d’investissement. Aucun résultat
        n’est garanti.{' '}
        <Link href="/journal" className="text-brand hover:underline">
          Voir le journal
        </Link>
      </p>
    </div>
  );
}
