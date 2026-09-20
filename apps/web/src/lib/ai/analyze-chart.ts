import type { AnalysisInput, MarketAnalysis } from '@/types/analysis';
import { runAnalysis, type EngineOptions } from '@/lib/analysis/engine';
import { deterministicProvider } from './providers/deterministic';
import { getReasoningProvider, type ReasoningProvider } from './provider';
import type { ReasoningPayload } from './schema';

export interface AnalyzeChartOptions extends EngineOptions {
  provider?: ReasoningProvider;
}

export interface AnalyzeChartResult {
  analysis: MarketAnalysis;
  reasoning: ReasoningPayload;
}

/**
 * Single entry point used by the API routes and the client. The deterministic
 * engine always runs first; the reasoning provider only formats its output.
 */
export async function analyzeChart(
  input: AnalysisInput,
  options: AnalyzeChartOptions = {},
): Promise<AnalyzeChartResult> {
  const provider = options.provider ?? getReasoningProvider() ?? deterministicProvider;
  const usable = provider.isAvailable() ? provider : deterministicProvider;

  const analysis = runAnalysis(input, options);
  const reasoning = await usable.reason({
    analysis,
    language: 'fr',
    ...(input.context ? { userContext: input.context } : {}),
  });

  return {
    analysis: {
      ...analysis,
      narrative: reasoning.narrative,
      reasoningProvider: usable.id,
      notes: [...analysis.notes, ...reasoning.warnings],
    },
    reasoning,
  };
}
