import type { Asset, Timeframe } from '@/types/market';

/**
 * Catalogue of instruments the prototype can analyse. `reference` is only used
 * by the simulated data generator so the series ends on a plausible price.
 */
interface AssetSeed extends Asset {
  reference: number;
  /** Daily volatility used to scale the simulated candles. */
  dailyVolatility: number;
  /** Long term drift of the simulated macro scenario. */
  macroDrift: number;
  baseVolume: number;
}

export const ASSET_SEEDS: AssetSeed[] = [
  {
    id: 'BTCUSDT',
    symbol: 'BTC/USDT',
    name: 'Bitcoin / Tether',
    assetClass: 'crypto',
    precision: 1,
    quote: 'USDT',
    pipSize: 1,
    reference: 105_420,
    dailyVolatility: 0.028,
    macroDrift: 0.16,
    baseVolume: 1_850,
  },
  {
    id: 'ETHUSDT',
    symbol: 'ETH/USDT',
    name: 'Ethereum / Tether',
    assetClass: 'crypto',
    precision: 2,
    quote: 'USDT',
    pipSize: 0.1,
    reference: 3_412.5,
    dailyVolatility: 0.033,
    macroDrift: -0.08,
    baseVolume: 12_400,
  },
  {
    id: 'SOLUSDT',
    symbol: 'SOL/USDT',
    name: 'Solana / Tether',
    assetClass: 'crypto',
    precision: 2,
    quote: 'USDT',
    pipSize: 0.01,
    reference: 186.4,
    dailyVolatility: 0.045,
    macroDrift: 0.22,
    baseVolume: 48_000,
  },
  {
    id: 'EURUSD',
    symbol: 'EUR/USD',
    name: 'Euro / Dollar américain',
    assetClass: 'forex',
    precision: 5,
    quote: 'USD',
    pipSize: 0.0001,
    reference: 1.0842,
    dailyVolatility: 0.005,
    macroDrift: 0.02,
    baseVolume: 96_000,
  },
  {
    id: 'GBPUSD',
    symbol: 'GBP/USD',
    name: 'Livre sterling / Dollar américain',
    assetClass: 'forex',
    precision: 5,
    quote: 'USD',
    pipSize: 0.0001,
    reference: 1.2714,
    dailyVolatility: 0.0055,
    macroDrift: -0.03,
    baseVolume: 74_000,
  },
  {
    id: 'XAUUSD',
    symbol: 'XAU/USD',
    name: 'Or / Dollar',
    assetClass: 'metal',
    precision: 2,
    quote: 'USD',
    pipSize: 0.1,
    reference: 5_084.6,
    dailyVolatility: 0.011,
    macroDrift: 0.12,
    baseVolume: 31_500,
  },
  {
    id: 'NAS100',
    symbol: 'NASDAQ',
    name: 'Nasdaq 100',
    assetClass: 'index',
    precision: 1,
    quote: 'USD',
    pipSize: 0.5,
    reference: 21_640,
    dailyVolatility: 0.012,
    macroDrift: 0.1,
    baseVolume: 58_000,
  },
  {
    id: 'SPX500',
    symbol: 'S&P 500',
    name: 'S&P 500',
    assetClass: 'index',
    precision: 1,
    quote: 'USD',
    pipSize: 0.25,
    reference: 5_912,
    dailyVolatility: 0.009,
    macroDrift: 0.07,
    baseVolume: 42_000,
  },
];

export const ASSETS: Asset[] = ASSET_SEEDS.map(
  ({ reference: _reference, dailyVolatility: _v, macroDrift: _d, baseVolume: _b, ...asset }) =>
    asset,
);

export function getAssetSeed(id: string): AssetSeed {
  const seed = ASSET_SEEDS.find((item) => item.id === id) ?? ASSET_SEEDS[0];
  if (!seed) throw new Error('No asset configured');
  return seed;
}

export function getAsset(id: string): Asset {
  const {
    reference: _r,
    dailyVolatility: _v,
    macroDrift: _d,
    baseVolume: _b,
    ...asset
  } = getAssetSeed(id);
  return asset;
}

export function findAssetBySymbol(symbol: string): Asset | undefined {
  const normalised = symbol.replace(/[^a-z0-9]/gi, '').toUpperCase();
  const seed = ASSET_SEEDS.find(
    (item) =>
      item.id === normalised || item.symbol.replace(/[^a-z0-9]/gi, '').toUpperCase() === normalised,
  );
  return seed ? getAsset(seed.id) : undefined;
}

export const ASSET_CLASS_LABEL: Record<Asset['assetClass'], string> = {
  crypto: 'Crypto',
  forex: 'Forex',
  metal: 'Métaux',
  index: 'Indices',
};

/** Duration of one candle, in minutes. */
export const TIMEFRAME_MINUTES: Record<Timeframe, number> = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '30m': 30,
  '1H': 60,
  '4H': 240,
  '1D': 1_440,
  '1W': 10_080,
};

/**
 * Default multi-timeframe ladder: context, structure, setup, execution.
 * The Analyzer lets the trader change the execution timeframe; the rest is
 * derived from it so the ladder always keeps its ordering.
 */
export function timeframeLadder(execution: Timeframe): {
  higher: Timeframe;
  intermediate: Timeframe;
  execution: Timeframe;
} {
  const ladder: Record<Timeframe, { higher: Timeframe; intermediate: Timeframe }> = {
    '1m': { higher: '1H', intermediate: '15m' },
    '5m': { higher: '4H', intermediate: '1H' },
    '15m': { higher: '1D', intermediate: '4H' },
    '30m': { higher: '1D', intermediate: '4H' },
    '1H': { higher: '1D', intermediate: '4H' },
    '4H': { higher: '1W', intermediate: '1D' },
    '1D': { higher: '1W', intermediate: '1D' },
    '1W': { higher: '1W', intermediate: '1W' },
  };
  const pair = ladder[execution];
  return { higher: pair.higher, intermediate: pair.intermediate, execution };
}
