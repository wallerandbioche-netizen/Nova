import { readImageStats, type ImageStats } from '@/lib/images/stats';
import type { FocusPoint, RoomType } from '@/types/domain';
import { roomFromCaption } from './captions';
import { compositionFromStats, qualityFromStats, suggestMotion } from './scoring';
import type { AnalyzeOptions, VisionAnalyzer, VisionInput, VisionOutput } from './types';

/**
 * Classement d'espace à partir des seuls pixels. Volontairement prudent :
 * il ne renvoie un type que lorsqu'un signal franc le porte, et laisse
 * `other` avec une confiance basse sinon. Le modèle de vision reste le
 * chemin de référence ; ceci garantit que le produit tourne sans réseau.
 */
function roomFromPixels(stats: ImageStats): { room: RoomType; confidence: number } {
  const { greenRatio, blueRatio, brightness, saturation, highlightRatio, saliency } = stats;

  if (blueRatio > 0.3 && saliency.y > 0.5) return { room: 'pool', confidence: 0.55 };
  if (greenRatio > 0.34) return { room: 'garden', confidence: 0.5 };
  if (blueRatio > 0.22 && saliency.y < 0.45 && highlightRatio > 0.05) {
    return { room: 'view', confidence: 0.45 };
  }
  if (greenRatio > 0.16 && blueRatio > 0.12) return { room: 'exterior', confidence: 0.4 };
  if (brightness > 0.66 && saturation < 0.12) return { room: 'bathroom', confidence: 0.32 };
  if (stats.orientation === 'landscape' && brightness > 0.5 && saturation < 0.24) {
    return { room: 'living_room', confidence: 0.28 };
  }
  return { room: 'other', confidence: 0.2 };
}

function focusFrom(stats: ImageStats): FocusPoint {
  // On ramène le point focal vers le centre quand la saillance est diffuse :
  // mieux vaut un cadrage neutre qu'un cadrage confiant et faux.
  const pull = 1 - Math.min(1, stats.saliencyStrength + 0.25);
  return {
    x: stats.saliency.x + (0.5 - stats.saliency.x) * pull,
    y: stats.saliency.y + (0.5 - stats.saliency.y) * pull,
  };
}

export class HeuristicVisionAnalyzer implements VisionAnalyzer {
  readonly id = 'heuristic' as const;

  async analyze(inputs: VisionInput[], options?: AnalyzeOptions): Promise<VisionOutput[]> {
    const results: VisionOutput[] = [];

    for (const [index, input] of inputs.entries()) {
      options?.signal?.throwIfAborted();
      const stats = await readImageStats(input.path);
      const captioned = roomFromCaption(input.caption);
      const guessed = roomFromPixels(stats);
      const room = captioned ?? guessed.room;
      const confidence = captioned ? 0.8 : guessed.confidence;
      const focusPoint = focusFrom(stats);

      results.push({
        imageId: input.imageId,
        roomType: room,
        roomConfidence: confidence,
        qualityScore: qualityFromStats(stats),
        compositionScore: compositionFromStats(stats),
        brightness: stats.brightness,
        sharpness: stats.sharpness,
        hasPeople: false,
        hasText: false,
        highlight: null,
        focusPoint,
        recommendedMotion: suggestMotion(room, focusPoint, stats),
        analyzer: 'heuristic',
      });

      options?.onProgress?.(index + 1, inputs.length);
    }

    return results;
  }
}
