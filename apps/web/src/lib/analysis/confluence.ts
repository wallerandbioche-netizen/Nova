import type {
  ConfluenceFactor,
  ConfluenceResult,
  Direction,
  LevelZone,
  LiquidityEvent,
  MarketRegime,
  MarketStructure,
  MomentumRead,
  MultiTimeframeRead,
  PatternMatch,
  Strength,
  VolatilityRead,
  VolumeRead,
} from '@/types/analysis';

const STRENGTH_WEIGHT: Record<Strength, number> = { weak: 0.5, medium: 1, strong: 1.5 };

export interface ConfluenceInput {
  structure: MarketStructure;
  regime: MarketRegime;
  levels: LevelZone[];
  momentum: MomentumRead;
  volume: VolumeRead;
  volatility: VolatilityRead;
  patterns: PatternMatch[];
  liquidity: LiquidityEvent[];
  multiTimeframe: MultiTimeframeRead;
  price: number;
}

/**
 * Aggregate every independent read into one signed score. The magnitude is a
 * measure of agreement between factors — explicitly **not** a win probability.
 */
export function computeConfluence(input: ConfluenceInput): ConfluenceResult {
  const factors: ConfluenceFactor[] = [
    structureFactor(input.structure),
    trendFactor(input.regime),
    levelsFactor(input.levels, input.price),
    volumeFactor(input.volume),
    momentumFactor(input.momentum),
    volatilityFactor(input.volatility),
    priceActionFactor(input.patterns),
    liquidityFactor(input.liquidity),
    higherTimeframeFactor(input.multiTimeframe),
  ];

  const net = factors.reduce((total, factor) => total + factor.weight, 0);
  const gross = factors.reduce((total, factor) => total + Math.abs(factor.weight), 0);
  const agreement = gross > 0 ? Math.abs(net) / gross : 0;

  // Score 0–10: magnitude of the net signal, tempered by how much the factors
  // actually agree with each other.
  const rawScore = Math.min(Math.abs(net) / 6.5, 1) * 10 * (0.55 + agreement * 0.45);
  const score = Math.round(Math.min(rawScore, 10) * 10) / 10;

  // The net sign says where the evidence leans; `direction` is only committed
  // to when the score clears the noise floor.
  const lean: Direction = net > 0 ? 'long' : net < 0 ? 'short' : 'none';
  const direction: Direction = score < 2 ? 'none' : lean;

  // Conflicts are reported even when the score is too low to pick a side —
  // that disagreement is precisely what a NO TRADE verdict has to explain.
  const conflicts = factors
    .filter((factor) => factor.direction !== 'none' && lean !== 'none' && factor.direction !== lean)
    .map((factor) => `${factor.label} : ${factor.explanation}`);

  return { factors, score, direction, agreement, conflicts };
}

function factor(
  key: ConfluenceFactor['key'],
  label: string,
  direction: Direction,
  strength: Strength,
  explanation: string,
  multiplier = 1,
): ConfluenceFactor {
  const magnitude = STRENGTH_WEIGHT[strength] * multiplier;
  const weight = direction === 'long' ? magnitude : direction === 'short' ? -magnitude : 0;
  const signal: ConfluenceFactor['signal'] =
    direction === 'long' ? 'bullish' : direction === 'short' ? 'bearish' : 'neutral';
  return { key, label, signal, direction, strength, weight, explanation };
}

function structureFactor(structure: MarketStructure): ConfluenceFactor {
  if (structure.state === 'range') {
    return factor(
      'structure',
      'Structure',
      'none',
      'weak',
      'Sommets et creux sans direction dominante.',
      1.4,
    );
  }
  const hasChoch = structure.events.some((event) => event.type === 'CHoCH');
  const direction = structure.state === 'bullish' ? 'long' : 'short';
  return factor(
    'structure',
    'Structure',
    direction,
    hasChoch ? 'medium' : 'strong',
    structure.description,
    1.4,
  );
}

function trendFactor(regime: MarketRegime): ConfluenceFactor {
  const map: Record<MarketRegime, { direction: Direction; strength: Strength; text: string }> = {
    strong_bullish: {
      direction: 'long',
      strength: 'strong',
      text: 'Moyennes mobiles empilées à la hausse et pente positive.',
    },
    bullish: {
      direction: 'long',
      strength: 'medium',
      text: 'Prix au-dessus des moyennes mobiles de référence.',
    },
    range: {
      direction: 'none',
      strength: 'weak',
      text: 'Prix qui oscille autour de ses moyennes mobiles.',
    },
    bearish: {
      direction: 'short',
      strength: 'medium',
      text: 'Prix sous les moyennes mobiles de référence.',
    },
    strong_bearish: {
      direction: 'short',
      strength: 'strong',
      text: 'Moyennes mobiles empilées à la baisse et pente négative.',
    },
  };
  const entry = map[regime];
  return factor('trend', 'Tendance', entry.direction, entry.strength, entry.text, 1.2);
}

function levelsFactor(levels: LevelZone[], price: number): ConfluenceFactor {
  if (!levels.length) {
    return factor(
      'levels',
      'Niveaux clés',
      'none',
      'weak',
      'Aucune zone significative identifiée.',
    );
  }
  const nearest = [...levels].sort(
    (a, b) => Math.abs(a.price - price) - Math.abs(b.price - price),
  )[0];
  if (!nearest) {
    return factor(
      'levels',
      'Niveaux clés',
      'none',
      'weak',
      'Aucune zone significative identifiée.',
    );
  }

  const distance = Math.abs(nearest.distancePercent);
  if (distance < 0.35) {
    return factor(
      'levels',
      'Niveaux clés',
      'none',
      'medium',
      `Prix collé à une ${nearest.type === 'support' ? 'zone de support' : 'zone de résistance'} (${distance.toFixed(2)} %) : réaction à attendre avant d'agir.`,
    );
  }

  const direction: Direction = nearest.type === 'support' ? 'long' : 'short';
  return factor(
    'levels',
    'Niveaux clés',
    direction,
    nearest.strength,
    `${nearest.type === 'support' ? 'Support' : 'Résistance'} ${nearest.strength === 'strong' ? 'majeur' : 'secondaire'} à ${distance.toFixed(2)} % avec ${nearest.reactions} réaction(s).`,
  );
}

function volumeFactor(volume: VolumeRead): ConfluenceFactor {
  const direction: Direction =
    volume.bias === 'bullish' ? 'long' : volume.bias === 'bearish' ? 'short' : 'none';
  return factor('volume', 'Volume', direction, volume.strength, volume.description, 0.9);
}

function momentumFactor(momentum: MomentumRead): ConfluenceFactor {
  const direction: Direction =
    momentum.bias === 'bullish' ? 'long' : momentum.bias === 'bearish' ? 'short' : 'none';
  return factor('momentum', 'Momentum', direction, momentum.strength, momentum.description, 1.1);
}

function volatilityFactor(volatility: VolatilityRead): ConfluenceFactor {
  // Volatility never picks a side; it only tells whether execution is viable.
  const strength: Strength = volatility.regime === 'normal' ? 'medium' : 'weak';
  return factor('volatility', 'Volatilité', 'none', strength, volatility.description);
}

function priceActionFactor(patterns: PatternMatch[]): ConfluenceFactor {
  if (!patterns.length) {
    return factor(
      'price_action',
      'Price action',
      'none',
      'weak',
      'Aucune figure notable sur les dernières bougies.',
    );
  }
  const recent = patterns.slice(-3);
  const bullish = recent.filter((pattern) => pattern.direction === 'bullish').length;
  const bearish = recent.filter((pattern) => pattern.direction === 'bearish').length;
  const strongest = recent.reduce<PatternMatch>(
    (best, current) =>
      STRENGTH_WEIGHT[current.strength] > STRENGTH_WEIGHT[best.strength] ? current : best,
    recent[0] as PatternMatch,
  );

  const direction: Direction = bullish > bearish ? 'long' : bearish > bullish ? 'short' : 'none';
  return factor(
    'price_action',
    'Price action',
    direction,
    direction === 'none' ? 'weak' : strongest.strength,
    recent.map((pattern) => pattern.label).join(', '),
    1.1,
  );
}

function liquidityFactor(liquidity: LiquidityEvent[]): ConfluenceFactor {
  if (!liquidity.length) {
    return factor(
      'liquidity',
      'Liquidité',
      'none',
      'weak',
      'Aucun balayage ni extrême équivalent détecté.',
    );
  }
  const last = liquidity[liquidity.length - 1];
  if (!last) {
    return factor('liquidity', 'Liquidité', 'none', 'weak', 'Aucun événement de liquidité retenu.');
  }
  const direction: Direction = last.direction === 'bullish' ? 'long' : 'short';
  return factor('liquidity', 'Liquidité', direction, last.confidence, last.description);
}

function higherTimeframeFactor(mtf: MultiTimeframeRead): ConfluenceFactor {
  const direction: Direction =
    mtf.higher.bias === 'bullish' ? 'long' : mtf.higher.bias === 'bearish' ? 'short' : 'none';
  const strength: Strength =
    mtf.alignment === 'strong' ? 'strong' : mtf.alignment === 'partial' ? 'medium' : 'weak';
  return factor(
    'higher_timeframe',
    'Unité supérieure',
    mtf.alignment === 'conflicting' ? 'none' : direction,
    strength,
    `${mtf.higher.timeframe} ${mtf.higher.bias === 'bullish' ? 'haussier' : mtf.higher.bias === 'bearish' ? 'baissier' : 'neutre'} — ${mtf.description}`,
    1.3,
  );
}
