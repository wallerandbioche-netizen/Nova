'use client';

import { useState } from 'react';
import { Brain } from 'lucide-react';
import type { MarketAnalysis } from '@/types/analysis';
import { Badge } from '@/components/ui/badge';
import { Tabs } from '@/components/ui/tabs';
import { cn } from '@/lib/utils/cn';
import { REGIME_LABEL, VOLATILITY_LABEL } from '@/lib/utils/labels';
import { ConfluencePanel } from './confluence-panel';
import { DataSourceNote } from './data-source-note';
import { IndicatorsPanel } from './indicators-panel';
import { LevelsPanel } from './levels-panel';
import { MultiTimeframePanel } from './mtf-panel';
import { NarrativePanel } from './narrative-panel';
import { NoTradePanel } from './no-trade-panel';
import { Paywall } from './paywall';
import { RiskCalculator } from './risk-calculator';
import { SetupPanel } from './setup-panel';
import { StructurePanel } from './structure-panel';
import { Verdict } from './verdict';

type PanelTab = 'lecture' | 'plan' | 'risque';

/** An analysis produced for illustration, not read from a capture. */
export function isDemonstration(analysis: MarketAnalysis): boolean {
  return analysis.dataSource.label.startsWith('Démonstration');
}

/** What the free plan does not show, listed on the lock itself. */
export const LOCKED_FEATURES = [
  'Zone d’entrée, stop et objectifs chiffrés',
  'Structure, niveaux clés et unités de temps',
  'Détail de la confluence et des indicateurs',
  'Raisonnement complet et taille de position',
];

/**
 * Right-hand panel of the Analyzer. Sits under the capture on small screens.
 *
 * On the free plan only the verdict is readable: everything the engine
 * computed sits behind one lock rather than being half revealed.
 */
export function AiPanel({
  analysis,
  headline,
  unlocked,
  accountSize,
  riskPercent,
  onRiskPersist,
  className,
}: {
  analysis: MarketAnalysis;
  headline?: string;
  unlocked: boolean;
  accountSize: number;
  riskPercent: number;
  onRiskPersist?: (values: { accountSize: number; riskPercent: number }) => void;
  className?: string;
}) {
  const [tab, setTab] = useState<PanelTab>('lecture');
  const setup = analysis.setup;

  return (
    <section
      className={cn(
        'flex min-h-0 flex-col rounded-[var(--radius-card)] border border-line bg-surface shadow-card',
        className,
      )}
      aria-label="Analyse de marché"
    >
      <header className="flex items-center justify-between gap-2 border-b border-line px-5 py-3">
        <h2 className="flex shrink-0 items-center gap-2 text-[14px] font-semibold whitespace-nowrap text-ink">
          <Brain className="h-4 w-4 text-brand" aria-hidden />
          Analyse de marché
        </h2>
        <div className="flex min-w-0 items-center gap-1.5">
          {isDemonstration(analysis) ? <Badge tone="warn">Démonstration</Badge> : null}
          <Badge tone="muted" className="min-w-0 truncate">
            {REGIME_LABEL[analysis.marketRegime]}
          </Badge>
        </div>
      </header>

      <Verdict analysis={analysis} {...(headline ? { headline } : {})} />

      {!unlocked ? (
        <div className="scroll-slim min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-5">
          <Paywall
            unlocked={false}
            features={LOCKED_FEATURES}
            preview={<LockedPreview analysis={analysis} />}
          />
          <DataSourceNote analysis={analysis} />
        </div>
      ) : (
        <>
          <div className="border-y border-line px-5 py-2.5">
            <Tabs
              label="Sections de l’analyse"
              value={tab}
              onChange={setTab}
              items={[
                { value: 'lecture', label: 'Lecture' },
                { value: 'plan', label: 'Plan' },
                { value: 'risque', label: 'Risque' },
              ]}
            />
          </div>

          <div className="scroll-slim min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
            {tab === 'lecture' ? (
              <>
                <Block title="Confluence">
                  <ConfluencePanel confluence={analysis.confluence} />
                </Block>
                <Block title="Structure de marché">
                  <StructurePanel analysis={analysis} />
                </Block>
                <Block title="Unités de temps">
                  <MultiTimeframePanel mtf={analysis.multiTimeframe} />
                </Block>
                <Block title="Niveaux clés">
                  <LevelsPanel levels={analysis.supportResistance} asset={analysis.asset} />
                </Block>
                <Block title="Momentum, volume et volatilité">
                  <div className="space-y-2">
                    <Line label="Momentum" value={analysis.momentum.description} />
                    <Line label="Volume" value={analysis.volume.description} />
                    <Line
                      label={VOLATILITY_LABEL[analysis.volatility.regime]}
                      value={analysis.volatility.description}
                    />
                  </div>
                </Block>
                <Block title="Indicateurs">
                  <IndicatorsPanel analysis={analysis} asset={analysis.asset} />
                </Block>
              </>
            ) : null}

            {tab === 'plan' ? (
              <>
                {setup ? (
                  <SetupPanel setup={setup} asset={analysis.asset} />
                ) : analysis.noTrade ? (
                  <NoTradePanel noTrade={analysis.noTrade} />
                ) : null}

                <Block title="Raisonnement">
                  <NarrativePanel narrative={analysis.narrative} />
                </Block>
              </>
            ) : null}

            {tab === 'risque' ? (
              setup ? (
                <RiskCalculator
                  asset={analysis.asset}
                  direction={setup.direction}
                  entry={(setup.entryZone.low + setup.entryZone.high) / 2}
                  stopLoss={setup.stopLoss}
                  riskProfile={analysis.riskProfile}
                  accountSize={accountSize}
                  riskPercent={riskPercent}
                  {...(setup.takeProfits[1] ? { takeProfit: setup.takeProfits[1].price } : {})}
                  {...(onRiskPersist ? { onPersist: onRiskPersist } : {})}
                />
              ) : (
                <p className="text-[12.5px] leading-5 text-ink-muted">
                  Aucun plan de trade n’a été retenu : il n’y a pas de taille de position à
                  calculer. Le calculateur redevient disponible dès qu’une configuration passe les
                  filtres.
                </p>
              )
            ) : null}

            {analysis.notes.length ? (
              <ul className="space-y-1">
                {analysis.notes.map((note) => (
                  <li key={note} className="text-[11.5px] leading-4 text-ink-subtle">
                    • {note}
                  </li>
                ))}
              </ul>
            ) : null}

            <DataSourceNote analysis={analysis} />
          </div>
        </>
      )}
    </section>
  );
}

/**
 * The real analysis, rendered compactly, so what the lock blurs is the actual
 * content the subscription reveals — not a decorative placeholder.
 */
export function LockedPreview({ analysis }: { analysis: MarketAnalysis }) {
  return (
    <div className="space-y-4 p-4">
      <ConfluencePanel confluence={analysis.confluence} />
      {analysis.setup ? (
        <SetupPanel setup={analysis.setup} asset={analysis.asset} />
      ) : analysis.noTrade ? (
        <NoTradePanel noTrade={analysis.noTrade} />
      ) : null}
      <NarrativePanel narrative={analysis.narrative} />
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold tracking-[0.07em] text-ink-subtle uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-[12.5px] leading-5 text-ink-muted">
      <span className="font-medium text-ink">{label} — </span>
      {value}
    </p>
  );
}
