import type { NewsProvider, RawNewsItem } from './news-provider.js';
import { DEMO_NEWS } from '../demo-news-dataset.js';

/**
 * Demonstration news provider.
 *
 * Items are plausible, clearly fictional financial events, dated relative to "now" so the
 * product can be demonstrated any day. They are flagged `isDemo` end-to-end and the UI labels
 * them "DEMO DATA" — NOVA never presents fabricated news as real reporting.
 */
export class DemoNewsProvider implements NewsProvider {
  readonly name = 'NOVA demo dataset';
  readonly isDemo = true;

  constructor(private readonly now: () => Date = () => new Date()) {}

  async fetchLatest({ since, limit = 40 }: { since?: Date; limit?: number }): Promise<RawNewsItem[]> {
    const reference = this.now();
    const items = DEMO_NEWS.map((item, index) => {
      const publishedAt = new Date(reference.getTime() - item.hoursAgo * 3_600_000);
      return {
        externalId: `nova-demo-${publishedAt.toISOString().slice(0, 10)}-${index}`,
        title: item.title,
        summary: item.summary,
        body: item.body,
        source: item.source,
        sourceUrl: item.sourceUrl,
        publishedAt,
        language: 'fr' as const,
        category: item.category,
        symbols: item.symbols,
      } satisfies RawNewsItem;
    });

    const filtered = since ? items.filter((item) => item.publishedAt > since) : items;
    return filtered
      .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
      .slice(0, limit);
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
