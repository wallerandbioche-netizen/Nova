import type { Logger } from 'pino';
import type { Env } from '../../../config/env.js';
import { DemoMarketDataProvider } from './demo-market-data.provider.js';
import { HttpMarketDataProvider } from './http-market-data.provider.js';
import type { MarketDataProvider } from './market-data-provider.js';

export * from './market-data-provider.js';
export { DemoMarketDataProvider } from './demo-market-data.provider.js';
export { HttpMarketDataProvider } from './http-market-data.provider.js';

export function createMarketDataProvider(env: Env, logger: Logger): MarketDataProvider {
  if (env.MARKET_DATA_PROVIDER === 'http') return new HttpMarketDataProvider(env, logger);
  logger.info('market data: using the demo provider — all prices will be labelled DEMO DATA');
  return new DemoMarketDataProvider();
}
