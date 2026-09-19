import { z } from 'zod';
import { env } from '@/lib/env';
import { readImageStats } from '@/lib/images/stats';
import { toVisionPayload } from '@/lib/images/stats';
import { logger } from '@/lib/logger';
import { MOTION_TYPES, ROOM_TYPES, type MotionType, type RoomType } from '@/types/domain';
import { roomFromCaption } from './captions';
import { HeuristicVisionAnalyzer } from './heuristic';
import { compositionFromStats, qualityFromStats, suggestMotion } from './scoring';
import type { AnalyzeOptions, VisionAnalyzer, VisionInput, VisionOutput } from './types';

const log = logger('vision');

const photoSchema = z.object({
  index: z.number().int().min(0),
  room_type: z.enum(ROOM_TYPES as unknown as [RoomType, ...RoomType[]]),
  room_confidence: z.number().min(0).max(1),
  quality_score: z.number().min(0).max(1),
  composition_score: z.number().min(0).max(1),
  has_people: z.boolean(),
  has_text: z.boolean(),
  highlight: z.string().max(120).nullable(),
  focus_point: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
  recommended_motion: z.enum(MOTION_TYPES as unknown as [MotionType, ...MotionType[]]),
});

const reportSchema = z.object({ photos: z.array(photoSchema) });

const TOOL = {
  name: 'report_photos',
  description: "Renvoie l'analyse structurée de chaque photo du lot.",
  input_schema: {
    type: 'object',
    properties: {
      photos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            index: { type: 'integer', description: 'Numéro de la photo dans le lot.' },
            room_type: { type: 'string', enum: [...ROOM_TYPES] },
            room_confidence: { type: 'number' },
            quality_score: { type: 'number' },
            composition_score: { type: 'number' },
            has_people: { type: 'boolean' },
            has_text: { type: 'boolean' },
            highlight: {
              type: ['string', 'null'],
              description: "L'élément à ne jamais couper au recadrage (lit, îlot, piscine…).",
            },
            focus_point: {
              type: 'object',
              properties: { x: { type: 'number' }, y: { type: 'number' } },
              required: ['x', 'y'],
            },
            recommended_motion: { type: 'string', enum: [...MOTION_TYPES] },
          },
          required: [
            'index',
            'room_type',
            'room_confidence',
            'quality_score',
            'composition_score',
            'has_people',
            'has_text',
            'highlight',
            'focus_point',
            'recommended_motion',
          ],
        },
      },
    },
    required: ['photos'],
  },
} as const;

const SYSTEM_PROMPT = `Tu analyses les photos d'une annonce de location saisonnière pour un montage vidéo immobilier.

Pour chaque photo, renvoie :
- room_type : l'espace montré. Utilise "view" pour un panorama, "detail" pour un gros plan décoratif, "other" si tu hésites.
- room_confidence : ta confiance dans ce classement.
- quality_score : netteté, exposition, propreté du cadrage. Une photo floue, sombre ou encombrée est basse.
- composition_score : équilibre du cadrage, lisibilité du sujet, profondeur.
- has_people / has_text : présence de personnes reconnaissables, de texte incrusté ou de filigrane.
- highlight : en quelques mots, l'élément qu'un recadrage ne doit jamais amputer (le lit, l'îlot, la piscine, la baie vitrée).
- focus_point : centre de cet élément, en coordonnées normalisées (0,0 = haut gauche ; 1,1 = bas droite).
- recommended_motion : le mouvement de caméra qui met cet élément en valeur, très lentement.

Sois sévère sur quality_score : seules les meilleures photos seront retenues.`;

interface AnthropicContent {
  type: string;
  name?: string;
  input?: unknown;
}

async function callModel(
  inputs: VisionInput[],
  signal: AbortSignal | undefined,
): Promise<z.infer<typeof reportSchema>> {
  const content: unknown[] = [
    {
      type: 'text',
      text: `Analyse ${inputs.length} photo(s). Renvoie un objet par photo, dans l'ordre, avec son index.`,
    },
  ];

  for (const [index, input] of inputs.entries()) {
    const payload = await toVisionPayload(input.path);
    const caption = input.caption ? ` Légende de l'annonce : « ${input.caption} ».` : '';
    content.push({ type: 'text', text: `Photo index ${index}.${caption}` });
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: payload.mediaType, data: payload.base64 },
    });
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: env.anthropicVisionModel,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL.name },
      messages: [{ role: 'user', content }],
    }),
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    throw new Error(`Réponse ${response.status} du modèle de vision`);
  }

  const body = (await response.json()) as { content?: AnthropicContent[] };
  const toolUse = body.content?.find((item) => item.type === 'tool_use' && item.name === TOOL.name);
  if (!toolUse) throw new Error('Le modèle de vision n\'a pas renvoyé de résultat structuré');

  return reportSchema.parse(toolUse.input);
}

/**
 * Analyse par modèle de vision multimodal, par lots.
 *
 * Deux garde-fous : la réponse est validée par schéma, et les mesures
 * purement physiques (luminosité, netteté) restent celles calculées
 * localement — un modèle n'a aucun avantage pour les estimer. En cas
 * d'échec d'un lot, ce lot bascule sur l'analyse locale : une annonce n'est
 * jamais perdue à cause d'un appel réseau.
 */
export class AnthropicVisionAnalyzer implements VisionAnalyzer {
  readonly id = 'vision' as const;
  private readonly fallback = new HeuristicVisionAnalyzer();

  async analyze(inputs: VisionInput[], options?: AnalyzeOptions): Promise<VisionOutput[]> {
    const batches: VisionInput[][] = [];
    for (let i = 0; i < inputs.length; i += env.visionBatchSize) {
      batches.push(inputs.slice(i, i + env.visionBatchSize));
    }

    const results: VisionOutput[] = [];
    let done = 0;

    for (const batch of batches) {
      options?.signal?.throwIfAborted();
      try {
        const report = await callModel(batch, options?.signal);
        for (const [index, input] of batch.entries()) {
          const entry = report.photos.find((photo) => photo.index === index);
          if (!entry) throw new Error(`Photo ${index} absente de la réponse`);
          const stats = await readImageStats(input.path);
          const captioned = roomFromCaption(input.caption);

          results.push({
            imageId: input.imageId,
            // La légende de l'annonce tranche lorsqu'elle contredit un
            // classement peu assuré du modèle.
            roomType: captioned && entry.room_confidence < 0.6 ? captioned : entry.room_type,
            roomConfidence: Math.max(entry.room_confidence, captioned ? 0.75 : 0),
            // Moyenne du jugement du modèle et de la mesure locale : le
            // premier voit la scène, la seconde ne se trompe pas sur la netteté.
            qualityScore: entry.quality_score * 0.65 + qualityFromStats(stats) * 0.35,
            compositionScore:
              entry.composition_score * 0.7 + compositionFromStats(stats) * 0.3,
            brightness: stats.brightness,
            sharpness: stats.sharpness,
            hasPeople: entry.has_people,
            hasText: entry.has_text,
            highlight: entry.highlight,
            focusPoint: entry.focus_point,
            recommendedMotion: entry.recommended_motion,
            analyzer: 'vision',
          });
        }
      } catch (error) {
        log.warn('lot analysé localement après échec du modèle', String(error));
        const fallbackOptions = options?.signal ? { signal: options.signal } : {};
        results.push(...(await this.fallback.analyze(batch, fallbackOptions)));
      }

      done += batch.length;
      options?.onProgress?.(done, inputs.length);
    }

    // L'ordre des lots est préservé, mais on réaligne sur l'entrée par sûreté.
    const byId = new Map(results.map((result) => [result.imageId, result]));
    return inputs.map((input) => {
      const found = byId.get(input.imageId);
      if (found) return found;
      throw new Error(`Analyse manquante pour ${input.imageId}`);
    });
  }
}

/** Ré-export pratique : le mouvement suggéré reste calculable sans modèle. */
export { suggestMotion };
