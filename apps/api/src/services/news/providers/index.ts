import type { Logger } from 'pino';
import type { Env } from '../../../config/env.js';
import { DemoNewsProvider } from './demo-news.provider.js';
import { HttpNewsProvider } from './http-news.provider.js';
import type { NewsProvider } from './news-provider.js';

export * from './news-provider.js';
export { DemoNewsProvider } from './demo-news.provider.js';
export { HttpNewsProvider } from './http-news.provider.js';

export function createNewsProvider(env: Env, logger: Logger): NewsProvider {
  if (env.NEWS_PROVIDER === 'http') return new HttpNewsProvider(env, logger);
  logger.info('news: using the demo provider — all items will be labelled DEMO DATA');
  return new DemoNewsProvider();
}
