import { getEnv } from '../config/env';
import { HeuristicImageAnalyzer } from './heuristic';
import { VisionImageAnalyzer } from './vision';
import type { ImageAnalyzer } from './types';

export type { ImageAnalyzer, ImageAnalysis, AnalyzerInput } from './types';
export { HeuristicImageAnalyzer, qualityScore, focalPoint, gradientEnergy } from './heuristic';
export { VisionImageAnalyzer } from './vision';
export * from './phash';
export * from './rooms';

let analyzer: ImageAnalyzer | null = null;

/** Vision when a key is configured, local analysis otherwise. Both satisfy the same contract. */
export function getImageAnalyzer(): ImageAnalyzer {
  if (analyzer) return analyzer;
  const env = getEnv();
  const heuristic = new HeuristicImageAnalyzer();
  analyzer = env.AI_API_KEY ? new VisionImageAnalyzer(heuristic, env.AI_API_KEY) : heuristic;
  return analyzer;
}

export function setImageAnalyzer(next: ImageAnalyzer | null): void {
  analyzer = next;
}
