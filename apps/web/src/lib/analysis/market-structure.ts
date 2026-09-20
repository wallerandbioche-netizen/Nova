import type { Candle } from '@/types/market';
import type { MarketStructure, StructureBreak, StructureEvent, SwingPoint } from '@/types/analysis';

/**
 * Fractal swing detection: a pivot needs `lookback` lower highs (or higher
 * lows) on both sides. Nothing is inferred beyond what the candles show.
 */
export function detectSwings(candles: Candle[], lookback = 3): SwingPoint[] {
  const swings: SwingPoint[] = [];

  for (let index = lookback; index < candles.length - lookback; index += 1) {
    const candle = candles[index];
    if (!candle) continue;

    let isHigh = true;
    let isLow = true;
    for (let offset = 1; offset <= lookback; offset += 1) {
      const left = candles[index - offset];
      const right = candles[index + offset];
      if (!left || !right) {
        isHigh = false;
        isLow = false;
        break;
      }
      if (candle.high <= left.high || candle.high <= right.high) isHigh = false;
      if (candle.low >= left.low || candle.low >= right.low) isLow = false;
    }

    if (isHigh) swings.push({ index, time: candle.time, price: candle.high, kind: 'high' });
    else if (isLow) swings.push({ index, time: candle.time, price: candle.low, kind: 'low' });
  }

  return labelSwings(swings);
}

function labelSwings(swings: SwingPoint[]): SwingPoint[] {
  let previousHigh: number | null = null;
  let previousLow: number | null = null;

  return swings.map((swing) => {
    let label: StructureEvent | undefined;
    if (swing.kind === 'high') {
      if (previousHigh != null) label = swing.price > previousHigh ? 'HH' : 'LH';
      previousHigh = swing.price;
    } else {
      if (previousLow != null) label = swing.price > previousLow ? 'HL' : 'LL';
      previousLow = swing.price;
    }
    return label ? { ...swing, label } : swing;
  });
}

/**
 * Derive the structural state and the break events (BOS / CHoCH) from the
 * labelled swing sequence. When fewer than four labelled swings exist the
 * structure is reported as a range rather than guessed.
 */
export function analyseStructure(candles: Candle[], lookback = 3): MarketStructure {
  const swings = detectSwings(candles, lookback);
  const labelled = swings.filter((swing): swing is SwingPoint & { label: StructureEvent } =>
    Boolean(swing.label),
  );
  const sequence = labelled.slice(-4).map((swing) => swing.label);

  if (labelled.length < 3) {
    return {
      state: 'range',
      swings,
      events: [],
      sequence,
      description:
        'Pas assez de sommets et creux confirmés pour qualifier la structure : elle est traitée comme un range.',
    };
  }

  const recent = labelled.slice(-4);
  const bullishCount = recent.filter(
    (swing) => swing.label === 'HH' || swing.label === 'HL',
  ).length;
  const bearishCount = recent.filter(
    (swing) => swing.label === 'LH' || swing.label === 'LL',
  ).length;

  let state: MarketStructure['state'] = 'range';
  if (bullishCount >= 3) state = 'bullish';
  else if (bearishCount >= 3) state = 'bearish';

  const events = detectBreaks(labelled, candles);

  const description =
    state === 'bullish'
      ? `Séquence ${sequence.join(' → ')} : sommets et creux ascendants, structure haussière.`
      : state === 'bearish'
        ? `Séquence ${sequence.join(' → ')} : sommets et creux descendants, structure baissière.`
        : `Séquence ${sequence.join(' → ')} : pas de direction dominante, structure en range.`;

  return { state, swings, events, sequence, description };
}

function detectBreaks(
  labelled: (SwingPoint & { label: StructureEvent })[],
  candles: Candle[],
): StructureBreak[] {
  const events: StructureBreak[] = [];
  const lastCandle = candles[candles.length - 1];
  if (!lastCandle) return events;

  for (let index = 2; index < labelled.length; index += 1) {
    const current = labelled[index];
    const previous = labelled[index - 1];
    const beforePrevious = labelled[index - 2];
    if (!current || !previous || !beforePrevious) continue;

    // Break of structure: a new extreme continuing the prevailing direction.
    if (current.label === 'HH' && beforePrevious.label === 'HH') {
      events.push({
        type: 'BOS',
        direction: 'bullish',
        price: current.price,
        time: current.time,
        description: `Cassure haussière de structure au-dessus de ${beforePrevious.price}.`,
      });
    }
    if (current.label === 'LL' && beforePrevious.label === 'LL') {
      events.push({
        type: 'BOS',
        direction: 'bearish',
        price: current.price,
        time: current.time,
        description: `Cassure baissière de structure sous ${beforePrevious.price}.`,
      });
    }

    // Change of character: the sequence flips direction.
    if (
      (beforePrevious.label === 'HH' || beforePrevious.label === 'HL') &&
      current.label === 'LL' &&
      previous.label === 'LH'
    ) {
      events.push({
        type: 'CHoCH',
        direction: 'bearish',
        price: current.price,
        time: current.time,
        description:
          'Changement de caractère baissier : premier creux plus bas après une série haussière.',
      });
    }
    if (
      (beforePrevious.label === 'LL' || beforePrevious.label === 'LH') &&
      current.label === 'HH' &&
      previous.label === 'HL'
    ) {
      events.push({
        type: 'CHoCH',
        direction: 'bullish',
        price: current.price,
        time: current.time,
        description:
          'Changement de caractère haussier : premier sommet plus haut après une série baissière.',
      });
    }
  }

  return events.slice(-4);
}

/** Highest high / lowest low of the trailing window, used by range logic. */
export function rangeBounds(candles: Candle[], window = 40): { high: number; low: number } | null {
  const slice = candles.slice(-window);
  if (!slice.length) return null;
  return {
    high: Math.max(...slice.map((candle) => candle.high)),
    low: Math.min(...slice.map((candle) => candle.low)),
  };
}
