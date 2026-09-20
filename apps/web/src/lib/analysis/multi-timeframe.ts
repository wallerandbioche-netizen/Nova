import type { Candle, Timeframe } from '@/types/market';
import type { MultiTimeframeRead, TimeframeRead } from '@/types/analysis';
import { computeIndicatorSeries, lastIndicatorSnapshot } from './indicators';
import { analyseStructure } from './market-structure';
import { biasFromRegime, classifyRegime } from './regime';

export interface TimeframeInput {
  timeframe: Timeframe;
  candles: Candle[];
}

/** Summarise one timeframe: regime, bias and the structural note behind it. */
export function readTimeframe({ timeframe, candles }: TimeframeInput): TimeframeRead {
  if (candles.length < 60) {
    return {
      timeframe,
      bias: 'neutral',
      regime: 'range',
      note: 'Historique insuffisant sur cette unité de temps.',
    };
  }

  const series = computeIndicatorSeries(candles);
  const snapshot = lastIndicatorSnapshot(candles, series);
  const regime = classifyRegime(candles, series, snapshot);
  const structure = analyseStructure(candles);

  return {
    timeframe,
    bias: biasFromRegime(regime),
    regime,
    note: structure.description,
  };
}

/**
 * Combine the context (higher), structure (intermediate) and execution reads.
 * Alignment is the gate the setup engine uses before proposing a direction.
 */
export function analyseMultiTimeframe(
  higher: TimeframeInput,
  intermediate: TimeframeInput,
  execution: TimeframeInput,
): MultiTimeframeRead {
  const higherRead = readTimeframe(higher);
  const intermediateRead = readTimeframe(intermediate);
  const executionRead = readTimeframe(execution);

  const biases = [higherRead.bias, intermediateRead.bias, executionRead.bias];
  const bullish = biases.filter((bias) => bias === 'bullish').length;
  const bearish = biases.filter((bias) => bias === 'bearish').length;

  let alignment: MultiTimeframeRead['alignment'] = 'partial';
  if (bullish === 3 || bearish === 3) alignment = 'strong';
  else if (bullish > 0 && bearish > 0) alignment = 'conflicting';

  const description =
    alignment === 'strong'
      ? `Les trois unités de temps pointent dans la même direction (${higherRead.bias === 'bullish' ? 'haussière' : 'baissière'}).`
      : alignment === 'conflicting'
        ? `Le contexte ${higher.timeframe} et l'exécution ${execution.timeframe} ne pointent pas dans la même direction : priorité au contexte.`
        : 'Alignement partiel : au moins une unité de temps est neutre, la taille de position doit en tenir compte.';

  return {
    higher: higherRead,
    intermediate: intermediateRead,
    execution: executionRead,
    alignment,
    description,
  };
}
