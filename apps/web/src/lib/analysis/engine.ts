import type { Candle, Timeframe } from '@/types/market';
import type {
  AnalysisInput,
  AnalysisNarrative,
  MarketAnalysis,
  NoTradeVerdict,
} from '@/types/analysis';
import { NO_TRADE_LABEL } from '@/lib/utils/labels';
import { createId } from '@/lib/utils/id';
import { computeIndicatorSeries, lastIndicatorSnapshot } from './indicators';
import { analyseStructure } from './market-structure';
import { detectLevels } from './levels';
import { detectLiquidity } from './liquidity';
import { detectPatterns } from './patterns';
import { biasFromRegime, classifyRegime, readMomentum, readVolatility, readVolume } from './regime';
import { analyseMultiTimeframe } from './multi-timeframe';
import { computeConfluence } from './confluence';
import { buildSetup } from './setups';

export interface EngineOptions {
  /** Origin of the data, echoed on the analysis for the UI. */
  origin?: MarketAnalysis['origin'];
  dataSource?: MarketAnalysis['dataSource'];
  notes?: string[];
  id?: string;
  createdAt?: string;
}

/** Minimum number of candles before the engine will commit to a read. */
export const MIN_CANDLES = 60;

/**
 * Deterministic analysis pipeline:
 * indicators → structure → levels → liquidity → patterns → regime →
 * multi-timeframe → confluence → setup → risk gates.
 *
 * Every number the UI shows comes from this function. The reasoning layer only
 * turns these facts into sentences.
 */
export function runAnalysis(input: AnalysisInput, options: EngineOptions = {}): MarketAnalysis {
  const { asset, timeframe, candles, riskProfile } = input;
  const lastCandle = candles[candles.length - 1];
  const price = lastCandle?.close ?? 0;

  const series = computeIndicatorSeries(candles);
  const indicators = lastIndicatorSnapshot(candles, series);
  const structure = analyseStructure(candles);
  const levels = detectLevels(candles, structure.swings, timeframe, indicators.atr14);
  const liquidity = detectLiquidity(candles, structure.swings, indicators.atr14);
  const patterns = detectPatterns(candles, levels, indicators.atr14);
  const regime = classifyRegime(candles, series, indicators);
  const momentum = readMomentum(indicators, series);
  const volume = readVolume(candles, indicators);
  const volatility = readVolatility(candles, indicators);

  const higher = input.higherTimeframeCandles?.[0];
  const intermediate = input.higherTimeframeCandles?.[1];
  const multiTimeframe = analyseMultiTimeframe(
    { timeframe: higher?.timeframe ?? timeframe, candles: higher?.candles ?? candles },
    { timeframe: intermediate?.timeframe ?? timeframe, candles: intermediate?.candles ?? candles },
    { timeframe, candles },
  );

  const confluence = computeConfluence({
    structure,
    regime,
    levels,
    momentum,
    volume,
    volatility,
    patterns,
    liquidity,
    multiTimeframe,
    price,
  });

  const setupResult = buildSetup({
    candles,
    timeframe,
    riskProfile,
    structure,
    regime,
    levels,
    patterns,
    liquidity,
    momentum,
    volume,
    volatility,
    multiTimeframe,
    confluence,
    indicators,
    swings: structure.swings,
    price,
  });

  const notes = [...(options.notes ?? [])];
  if (candles.length < MIN_CANDLES) {
    notes.push(
      `Série de ${candles.length} bougies seulement : les lectures de structure et de volatilité sont partielles.`,
    );
  }

  const noTrade: NoTradeVerdict | null = setupResult.setup
    ? null
    : {
        codes: setupResult.rejections.length ? setupResult.rejections : ['no_setup'],
        reasons: setupResult.rejectionNotes.length
          ? setupResult.rejectionNotes
          : ["Aucune configuration suivie n'est présente sur cette unité de temps."],
      };

  const marketBias = biasFromRegime(regime);

  return {
    id: options.id ?? createId('an'),
    createdAt: options.createdAt ?? new Date().toISOString(),
    asset,
    timeframe,
    riskProfile,
    lastPrice: price,
    marketBias,
    marketRegime: regime,
    marketStructure: structure,
    supportResistance: levels,
    indicators,
    liquidity,
    patterns,
    momentum,
    volume,
    volatility,
    confluence,
    multiTimeframe,
    setup: setupResult.setup,
    noTrade,
    narrative: buildNarrative({
      asset: asset.symbol,
      timeframe,
      price,
      regimeDescription: structure.description,
      analysisParts: {
        structure,
        levels,
        momentum,
        volume,
        volatility,
        confluence,
        multiTimeframe,
      },
      setup: setupResult.setup,
      noTrade,
    }),
    dataSource: options.dataSource ?? {
      source: 'mock',
      label: 'Données simulées',
      candles: candles.length,
    },
    reasoningProvider: 'engine',
    origin: options.origin ?? 'market_data',
    notes,
  };
}

interface NarrativeInput {
  asset: string;
  timeframe: Timeframe;
  price: number;
  regimeDescription: string;
  analysisParts: {
    structure: MarketAnalysis['marketStructure'];
    levels: MarketAnalysis['supportResistance'];
    momentum: MarketAnalysis['momentum'];
    volume: MarketAnalysis['volume'];
    volatility: MarketAnalysis['volatility'];
    confluence: MarketAnalysis['confluence'];
    multiTimeframe: MarketAnalysis['multiTimeframe'];
  };
  setup: MarketAnalysis['setup'];
  noTrade: NoTradeVerdict | null;
}

/**
 * Factual narrative built strictly from the computed values. The optional model
 * provider rewrites these sections; it never introduces new numbers.
 */
function buildNarrative(input: NarrativeInput): AnalysisNarrative {
  const { analysisParts: parts, setup, noTrade } = input;
  const supports = parts.levels.filter((level) => level.type === 'support');
  const resistances = parts.levels.filter((level) => level.type === 'resistance');

  return {
    marketContext: `${input.asset} en ${input.timeframe} cote ${input.price}. ${parts.multiTimeframe.description}`,
    structure: parts.structure.description,
    keyLevels: parts.levels.length
      ? `Supports : ${supports.map((level) => `${level.zone.low} – ${level.zone.high}`).join(' | ') || 'aucun sous le prix'}. Résistances : ${
          resistances.map((level) => `${level.zone.low} – ${level.zone.high}`).join(' | ') ||
          'aucune au-dessus du prix'
        }.`
      : 'Aucune zone suffisamment testée pour être retenue.',
    momentum: parts.momentum.description,
    volume: parts.volume.description,
    setup: setup
      ? `${setup.label} en ${setup.direction === 'long' ? 'achat' : 'vente'}, confluence ${setup.confluenceScore.toFixed(1)}/10.`
      : `Aucun trade proposé : ${(noTrade?.codes ?? []).map((code) => NO_TRADE_LABEL[code]).join(', ')}.`,
    entry: setup
      ? `Zone d'entrée ${setup.entryZone.low} – ${setup.entryZone.high}, à traiter comme une zone et non comme un prix unique.`
      : "Pas de zone d'entrée : la configuration ne passe pas les filtres de risque.",
    riskManagement: setup
      ? `Stop à ${setup.stopLoss}, objectifs ${setup.takeProfits.map((takeProfit) => `${takeProfit.label} ${takeProfit.price}`).join(', ')}, rapport risque / rendement ${setup.riskReward}.`
      : 'La taille de position ne peut pas être calculée sans stop valide.',
    invalidation: setup ? setup.invalidation : (noTrade?.reasons[0] ?? ''),
  };
}

/** Utility used by the screenshot flow to refuse an analysis on thin data. */
export function hasEnoughData(candles: Candle[]): boolean {
  return candles.length >= MIN_CANDLES;
}
