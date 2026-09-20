'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import type { MarketAnalysis } from '@/types/analysis';
import { DEFAULT_INDICATORS } from '@/types/chart';
import { AnalysisProgress } from '@/components/analysis/analysis-progress';
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
import { useSettings } from '@/hooks/use-settings';
import { generateCandles } from '@/lib/market-data';
import { RISK_PROFILE_LABEL } from '@/lib/utils/labels';

const PriceChart = dynamic(
  () => import('@/components/charts/price-chart').then((module) => module.PriceChart),
  { ssr: false, loading: () => <Skeleton className="h-[380px] w-full rounded-none" /> },
);

export function AnalysisView({ analysisId }: { analysisId: string }) {
  const { entries, ready } = useHistory();
  const [settings, updateSettings] = useSettings();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const entry = entries.find((item) => item.analysis.id === analysisId);

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
          action={<ButtonLink href="/analyser">Lancer une nouvelle analyse</ButtonLink>}
        />
      </Card>
    );
  }

  const analysis: MarketAnalysis = entry.analysis;
  const candles = generateCandles({
    assetId: analysis.asset.id,
    timeframe: analysis.timeframe,
    count: 320,
  });
  const setup = analysis.setup;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <Verdict analysis={analysis} />
        <div className="border-t border-line">
          <PriceChart
            candles={analysis.origin === 'screenshot' ? candles : candles}
            precision={analysis.asset.precision}
            indicators={{ ...DEFAULT_INDICATORS, volume: true }}
            setup={setup}
            levels={analysis.supportResistance}
            swings={analysis.marketStructure.swings}
            theme={settings.theme === 'dark' ? 'dark' : 'light'}
            height={380}
          />
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
                <Paywall
                  unlocked={settings.subscribed}
                  preview={<SetupPanel setup={setup} asset={analysis.asset} className="p-4" />}
                >
                  <SetupPanel setup={setup} asset={analysis.asset} />
                </Paywall>
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
              <Paywall
                unlocked={settings.subscribed}
                title="Raisonnement complet réservé aux abonnés"
                description="Le détail section par section est disponible avec l’abonnement."
                preview={<NarrativePanel narrative={analysis.narrative} className="p-4" />}
              >
                <NarrativePanel narrative={analysis.narrative} />
              </Paywall>
            </CardContent>
          </Card>

          {setup ? (
            <Card>
              <CardHeader title="Calculateur de risque" />
              <CardContent>
                <Paywall
                  unlocked={settings.subscribed}
                  title="Calculateur réservé aux abonnés"
                  description="Taille de position et pertes potentielles sont incluses dans l’abonnement."
                  preview={<div className="h-64 bg-surface-muted" />}
                >
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
                </Paywall>
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

          <p className="px-1 text-[11.5px] leading-4 text-ink-subtle">
            SCAN TRADE fournit une analyse, pas une recommandation d’investissement. Aucun résultat
            n’est garanti.{' '}
            <Link href="/journal" className="text-brand hover:underline">
              Voir le journal
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
