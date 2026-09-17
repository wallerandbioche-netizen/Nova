import { logger } from '@/lib/logger';
import { getAIConfig } from '@/lib/env';
import { AnthropicVisionProvider } from './providers/anthropic';
import { AnalysisValidationError, validateAnalysisResponse } from './validate';
import {
  AIProviderError,
  type AIAnalysisProvider,
  type AnalyzeChartInput,
  type AnalyzeChartResult,
} from './types';

export { AnalysisValidationError, validateAnalysisResponse } from './validate';
export { AIProviderError } from './types';
export type {
  AIAnalysisProvider,
  AnalyzeChartInput,
  AnalyzeChartResult,
  ChartImage,
} from './types';

/**
 * `AIAnalysisService` is the single entry point the rest of the app uses to
 * analyse a chart (§34). It owns the timeout, the logging and — crucially — the
 * validation gate, so no caller can accidentally persist an unvalidated payload.
 */
export class AIAnalysisService {
  private readonly provider: AIAnalysisProvider;
  private readonly timeoutMs: number;

  constructor(provider: AIAnalysisProvider, timeoutMs: number) {
    this.provider = provider;
    this.timeoutMs = timeoutMs;
  }

  async analyzeChart(input: AnalyzeChartInput): Promise<AnalyzeChartResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const startedAt = Date.now();

    try {
      const result = await this.provider.analyze(input, controller.signal);
      const durationMs = Date.now() - startedAt;

      const analysis = validateAnalysisResponse(result.raw);

      logger.info('ai.analysis.completed', {
        provider: result.provider,
        model: result.model,
        durationMs,
        status: analysis.status,
        bias: analysis.bias,
        warningCount: analysis.warnings.length,
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
      });

      return { analysis, model: result.model, provider: result.provider, durationMs };
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      if (error instanceof AnalysisValidationError) {
        logger.warn('ai.analysis.rejected', { durationMs, reasons: error.reasons });
      } else if (error instanceof AIProviderError) {
        logger.error('ai.analysis.provider_error', {
          durationMs,
          kind: error.kind,
          status: error.status,
        });
      } else {
        logger.error('ai.analysis.failed', { durationMs, error });
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}

let cached: AIAnalysisService | null = null;

/**
 * Builds the configured service.
 *
 * @throws {ConfigurationError} when no provider credentials are present — the
 * app never falls back to a simulated analysis (§61).
 */
export function getAIAnalysisService(): AIAnalysisService {
  if (cached) return cached;
  const config = getAIConfig();
  cached = new AIAnalysisService(new AnthropicVisionProvider(), config.timeoutMs);
  return cached;
}

/** Test helper. */
export function resetAIAnalysisService(): void {
  cached = null;
}
