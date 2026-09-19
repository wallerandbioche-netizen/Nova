import { env, resolvedVisionProvider } from '@/lib/env';
import { AnthropicVisionAnalyzer } from './anthropic';
import { HeuristicVisionAnalyzer } from './heuristic';
import type { VisionAnalyzer } from './types';

export type { VisionAnalyzer, VisionInput, VisionOutput } from './types';

/**
 * Sélectionne l'analyseur : modèle multimodal si une clé est disponible,
 * analyse locale sinon. Aucun appel de la couche métier ne change.
 */
export function visionAnalyzer(): VisionAnalyzer {
  if (resolvedVisionProvider() === 'anthropic' && env.anthropicApiKey) {
    return new AnthropicVisionAnalyzer();
  }
  return new HeuristicVisionAnalyzer();
}
