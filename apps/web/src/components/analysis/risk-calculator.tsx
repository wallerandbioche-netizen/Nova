'use client';

import { useMemo, useState } from 'react';
import { Calculator, TriangleAlert } from 'lucide-react';
import type { Asset } from '@/types/market';
import type { Direction, RiskProfile } from '@/types/analysis';
import { computePositionSize, RISK_PROFILES } from '@/lib/analysis/risk';
import { Field, Input } from '@/components/ui/input';
import { formatMoney, formatPrice, formatRatio } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

export interface RiskCalculatorProps {
  asset: Asset;
  direction: Direction;
  entry: number;
  stopLoss: number;
  takeProfit?: number;
  riskProfile: RiskProfile;
  accountSize: number;
  riskPercent: number;
  onPersist?: (values: { accountSize: number; riskPercent: number }) => void;
  className?: string;
}

/** Position sizing from the account, the risk budget and the trade levels. */
export function RiskCalculator({
  asset,
  direction,
  entry,
  stopLoss,
  takeProfit,
  riskProfile,
  accountSize: initialAccount,
  riskPercent: initialRisk,
  onPersist,
  className,
}: RiskCalculatorProps) {
  const [accountSize, setAccountSize] = useState(initialAccount);
  const [riskPercent, setRiskPercent] = useState(initialRisk);
  const [entryPrice, setEntryPrice] = useState(entry);
  const [stopPrice, setStopPrice] = useState(stopLoss);
  const [targetPrice, setTargetPrice] = useState(takeProfit ?? 0);

  const profile = RISK_PROFILES[riskProfile];

  const result = useMemo(
    () =>
      computePositionSize({
        accountSize,
        riskPercent,
        entry: entryPrice,
        stopLoss: stopPrice,
        direction,
        asset,
        ...(targetPrice ? { takeProfit: targetPrice } : {}),
      }),
    [accountSize, riskPercent, entryPrice, stopPrice, targetPrice, direction, asset],
  );

  const commit = (nextAccount: number, nextRisk: number) => {
    onPersist?.({ accountSize: nextAccount, riskPercent: nextRisk });
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Capital" htmlFor="account-size">
          <Input
            id="account-size"
            type="number"
            inputMode="decimal"
            min={0}
            value={accountSize}
            onChange={(event) => {
              const next = Number(event.target.value);
              setAccountSize(next);
              commit(next, riskPercent);
            }}
          />
        </Field>
        <Field
          label="Risque par trade (%)"
          htmlFor="risk-percent"
          hint={`Profil ${riskProfile} : ${profile.defaultRiskPercent} % conseillé, ${profile.maxRiskPercent} % maximum.`}
        >
          <Input
            id="risk-percent"
            type="number"
            inputMode="decimal"
            min={0}
            step={0.1}
            value={riskPercent}
            onChange={(event) => {
              const next = Number(event.target.value);
              setRiskPercent(next);
              commit(accountSize, next);
            }}
          />
        </Field>
        <Field label="Entrée" htmlFor="entry-price">
          <Input
            id="entry-price"
            type="number"
            inputMode="decimal"
            value={entryPrice}
            onChange={(event) => setEntryPrice(Number(event.target.value))}
          />
        </Field>
        <Field label="Stop loss" htmlFor="stop-price">
          <Input
            id="stop-price"
            type="number"
            inputMode="decimal"
            value={stopPrice}
            onChange={(event) => setStopPrice(Number(event.target.value))}
          />
        </Field>
        <Field label="Objectif" htmlFor="target-price" className="col-span-2">
          <Input
            id="target-price"
            type="number"
            inputMode="decimal"
            value={targetPrice}
            onChange={(event) => setTargetPrice(Number(event.target.value))}
          />
        </Field>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[12px] border border-line bg-line">
        <Cell label="Risque maximum" value={formatMoney(result.maximumRisk)} />
        <Cell
          label="Taille de position"
          value={`${result.positionSize.toFixed(result.positionSize < 10 ? 4 : 2)} ${asset.assetClass === 'forex' ? 'lots' : 'unités'}`}
        />
        <Cell label="Exposition" value={formatMoney(result.notional)} />
        <Cell
          label="Distance au stop"
          value={`${formatPrice(result.stopDistance, asset)} (${result.stopDistancePercent.toFixed(2)} %)`}
        />
        <Cell label="Perte potentielle" value={formatMoney(-result.potentialLoss)} tone="short" />
        <Cell
          label="Gain potentiel"
          value={result.potentialProfit != null ? formatMoney(result.potentialProfit) : '—'}
          tone="long"
        />
        <Cell
          label="Risque / rendement"
          value={result.riskReward ? formatRatio(result.riskReward) : '—'}
          className="col-span-2"
        />
      </dl>

      {result.warnings.length ? (
        <ul className="space-y-1.5">
          {result.warnings.map((warning) => (
            <li
              key={warning}
              className="flex items-start gap-2 rounded-[10px] bg-warn-soft px-3 py-2"
            >
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" aria-hidden />
              <span className="text-[12px] leading-4 text-ink">{warning}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="flex items-start gap-1.5 text-[11.5px] leading-4 text-ink-subtle">
        <Calculator className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        La taille est calculée à partir de la distance au stop. Elle ne tient pas compte des frais,
        du slippage ni de l’effet de levier de votre courtier.
      </p>
    </div>
  );
}

function Cell({
  label,
  value,
  tone = 'default',
  className,
}: {
  label: string;
  value: string;
  tone?: 'default' | 'long' | 'short';
  className?: string;
}) {
  return (
    <div className={cn('bg-surface px-3 py-2.5', className)}>
      <dt className="text-[11px] font-medium text-ink-subtle">{label}</dt>
      <dd
        className={cn(
          'mt-0.5 text-[13.5px] font-semibold tabular',
          tone === 'long' && 'text-long',
          tone === 'short' && 'text-short',
          tone === 'default' && 'text-ink',
        )}
      >
        {value}
      </dd>
    </div>
  );
}
