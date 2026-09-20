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

/**
 * Right-hand panel of the Analyzer. Sits under the chart on small screens.
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
        <Badge tone="muted" className="min-w-0 truncate">
          {REGIME_LABEL[analysis.marketRegime]}
        </Badge>
      </header>

      <Verdict analysis={analysis} {...(headline ? { headline } : {})} />

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
              <Paywall
                unlocked={unlocked}
                preview={<SetupPanel setup={setup} asset={analysis.asset} className="p-4" />}
              >
                <SetupPanel setup={setup} asset={analysis.asset} />
              </Paywall>
            ) : analysis.noTrade ? (
              <NoTradePanel noTrade={analysis.noTrade} />
            ) : null}

            <Block title="Raisonnement">
              <Paywall
                unlocked={unlocked}
                title="Raisonnement complet réservé aux abonnés"
                description="Le détail section par section est disponible avec l’abonnement."
                preview={<NarrativePanel narrative={analysis.narrative} className="p-4" />}
              >
                <NarrativePanel narrative={analysis.narrative} />
              </Paywall>
            </Block>
          </>
        ) : null}

        {tab === 'risque' ? (
          setup ? (
            <Paywall
              unlocked={unlocked}
              title="Calculateur réservé aux abonnés"
              description="Taille de position, exposition et pertes potentielles sont incluses dans l’abonnement."
              preview={<div className="h-64 bg-surface-muted" />}
            >
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
            </Paywall>
          ) : (
            <p className="text-[12.5px] leading-5 text-ink-muted">
              Aucun plan de trade n’a été retenu : il n’y a pas de taille de position à calculer. Le
              calculateur redevient disponible dès qu’une configuration passe les filtres.
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
    </section>
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
