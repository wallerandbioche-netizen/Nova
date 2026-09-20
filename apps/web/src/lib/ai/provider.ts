import type { MarketAnalysis } from '@/types/analysis';
import type { ReasoningPayload } from './schema';

/** Facts handed to the reasoning layer. Nothing else may be invented from them. */
export interface ReasoningRequest {
  analysis: MarketAnalysis;
  /** Free-text context typed by the trader, if any. */
  userContext?: string;
  language: 'fr';
}

export interface ReasoningProvider {
  readonly id: string;
  readonly label: string;
  /** Whether the provider can run right now (credentials present, etc.). */
  isAvailable(): boolean;
  reason(request: ReasoningRequest): Promise<ReasoningPayload>;
}

let provider: ReasoningProvider | null = null;

export function setReasoningProvider(next: ReasoningProvider): void {
  provider = next;
}

export function getReasoningProvider(): ReasoningProvider | null {
  return provider;
}
