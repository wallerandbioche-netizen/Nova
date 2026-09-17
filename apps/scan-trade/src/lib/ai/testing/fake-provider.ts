import { AIAnalysisService } from '../index';
import type { AIProviderError } from '../types';
import type { AIAnalysisProvider, ProviderResult } from '../types';

/**
 * Test-only provider.
 *
 * Deliberately not registered in `getAIAnalysisService()`: production has one
 * provider and no fallback, so a missing API key fails loudly instead of
 * quietly returning a fabricated analysis (§61). Tests import this directly.
 */
export class FakeAIProvider implements AIAnalysisProvider {
  readonly name = 'fake';
  readonly calls: Array<{ mimeType: string; bytes: number }> = [];

  constructor(
    private readonly outcome: { raw: unknown } | { error: AIProviderError },
    private readonly model = 'fake-model',
  ) {}

  async analyze(input: { image: { data: Buffer; mimeType: string } }): Promise<ProviderResult> {
    this.calls.push({ mimeType: input.image.mimeType, bytes: input.image.data.length });
    if ('error' in this.outcome) throw this.outcome.error;
    return { raw: this.outcome.raw, model: this.model, provider: this.name };
  }
}

export function fakeAIService(
  outcome: { raw: unknown } | { error: AIProviderError },
): AIAnalysisService {
  return new AIAnalysisService(new FakeAIProvider(outcome), 5000);
}

/** A well-formed LONG scenario that passes every coherence check. */
export function validLongResponse(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    status: 'analysis',
    asset: 'BTC/USDT',
    timeframe: '4H',
    market: 'crypto',
    chart_type: 'candlestick',
    approximate_price: 61740,
    market_bias: 'long',
    entry: { min: 61250, max: 61900 },
    stop_loss: 59800,
    take_profit_1: 65400,
    take_profit_2: 68200,
    risk_reward: 2.8,
    confidence: 'medium',
    key_levels: [
      {
        type: 'support_primary',
        price: 59800,
        price_max: null,
        label: 'Base de la dernière impulsion',
      },
      { type: 'resistance_primary', price: 65400, price_max: null, label: 'Deux rejets visibles' },
      { type: 'entry_zone', price: 61250, price_max: 61900, label: 'Mèches basses alignées' },
    ],
    technical_analysis: [
      { category: 'trend', title: 'Tendance haussière', detail: 'Les corps haussiers dominent.' },
    ],
    reasoning: [
      { category: 'observation', content: 'Plus hauts et plus bas ascendants.' },
      { category: 'limitation', content: 'Une seule image, un seul timeframe.' },
    ],
    summary: 'Structure haussière lisible et zone de réaction identifiable.',
    invalidation: 'Une clôture sous 59 800 annule le scénario.',
    warnings: ['Le volume n’est pas affiché sur la capture.'],
    ...overrides,
  };
}
