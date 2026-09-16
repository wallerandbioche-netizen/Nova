import type { AnalysisHints, ValidatedAnalysis } from '@/types/analysis';

export interface ChartImage {
  data: Buffer;
  mimeType: string;
}

export interface AnalyzeChartInput {
  image: ChartImage;
  hints: AnalysisHints;
}

export interface ProviderResult {
  /** Raw, unvalidated payload as returned by the provider. */
  raw: unknown;
  model: string;
  provider: string;
  usage?: { inputTokens?: number; outputTokens?: number } | undefined;
}

/**
 * The seam that keeps the rest of the codebase provider-agnostic (§34).
 * Adding a provider means adding one file here — nothing else changes.
 */
export interface AIAnalysisProvider {
  readonly name: string;
  analyze(input: AnalyzeChartInput, signal: AbortSignal): Promise<ProviderResult>;
}

export interface AnalyzeChartResult {
  analysis: ValidatedAnalysis;
  model: string;
  provider: string;
  durationMs: number;
}

export class AIProviderError extends Error {
  readonly kind: 'timeout' | 'unavailable' | 'invalid_response';
  readonly status: number | undefined;

  constructor(kind: AIProviderError['kind'], message: string, status?: number) {
    super(message);
    this.name = 'AIProviderError';
    this.kind = kind;
    this.status = status;
  }
}
