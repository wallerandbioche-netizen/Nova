import type { Logger } from 'pino';
import { z } from 'zod';
import { NEWS_CATEGORIES } from '@nova/types';
import type { Env } from '../../../config/env.js';
import { upstreamUnavailable } from '../../../http/errors.js';
import type { NewsProvider, RawNewsItem } from './news-provider.js';

const itemSchema = z.object({
  id: z.string().optional().nullable(),
  title: z.string().min(1).max(500),
  summary: z.string().max(4000).optional().default(''),
  body: z.string().max(40_000).nullable().optional().default(null),
  source: z.string().min(1).max(160),
  url: z.string().url().nullable().optional().default(null),
  publishedAt: z.coerce.date(),
  language: z.enum(['fr', 'en']).optional().default('fr'),
  category: z.enum(NEWS_CATEGORIES).nullable().optional().default(null),
  symbols: z.array(z.string().max(20)).max(30).optional().default([]),
});

const responseSchema = z.object({ items: z.array(itemSchema) });

/**
 * Generic HTTP news provider against the contract documented in docs/08-providers.md.
 * Items that do not validate are dropped with a log line rather than ingested half-parsed.
 */
export class HttpNewsProvider implements NewsProvider {
  readonly name: string;
  readonly isDemo = false;
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;

  constructor(
    env: Env,
    private readonly logger: Logger,
  ) {
    this.baseUrl = (env.NEWS_API_URL ?? '').replace(/\/$/, '');
    this.apiKey = env.NEWS_API_KEY;
    this.name = new URL(this.baseUrl).hostname;
  }

  async fetchLatest({
    since,
    limit = 50,
  }: {
    since?: Date;
    limit?: number;
  }): Promise<RawNewsItem[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (since) params.set('since', since.toISOString());

    const response = await fetch(`${this.baseUrl}/news?${params.toString()}`, {
      headers: {
        accept: 'application/json',
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw upstreamUnavailable(`News provider responded ${response.status}`);
    }

    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) {
      this.logger.error(
        { issues: parsed.error.issues },
        'news provider returned an unexpected payload',
      );
      throw upstreamUnavailable('Réponse inattendue du fournisseur d’actualités');
    }

    return parsed.data.items.map((item) => ({
      externalId: item.id ?? null,
      title: item.title,
      summary: item.summary,
      body: item.body,
      source: item.source,
      sourceUrl: item.url,
      publishedAt: item.publishedAt,
      language: item.language,
      category: item.category,
      symbols: item.symbols,
    }));
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(3000) });
      return response.ok;
    } catch {
      return false;
    }
  }
}
