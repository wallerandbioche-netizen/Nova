import Anthropic from '@anthropic-ai/sdk';
import type { RoomType } from '@prisma/client';
import sharp from 'sharp';
import { getEnv } from '../config/env';
import { detectRoomFromHint } from './rooms';
import type { AnalyzerInput, ImageAnalysis, ImageAnalyzer } from './types';

const ROOM_VALUES: RoomType[] = [
  'EXTERIOR',
  'LIVING_ROOM',
  'KITCHEN',
  'DINING',
  'BEDROOM',
  'BATHROOM',
  'TERRACE',
  'POOL',
  'GARDEN',
  'VIEW',
  'OTHER',
];

/**
 * Optional vision pass.
 *
 * It wraps the local analyzer and only refines two things: which room the photo shows, and where
 * the subject sits in the frame. It never alters, generates or retouches the photo itself — the
 * video always shows the owner's real images.
 *
 * Without AI_API_KEY the product runs entirely on the local analyzer.
 */
export class VisionImageAnalyzer implements ImageAnalyzer {
  readonly name = 'vision';
  private readonly client: Anthropic;

  constructor(
    private readonly base: ImageAnalyzer,
    apiKey: string,
  ) {
    this.client = new Anthropic({ apiKey, baseURL: getEnv().AI_BASE_URL });
  }

  async analyze(input: AnalyzerInput): Promise<ImageAnalysis> {
    const analysis = await this.base.analyze(input);
    try {
      const refinement = await this.classify(input.buffer, input.hint);
      if (!refinement) return analysis;
      return {
        ...analysis,
        room: refinement.room,
        roomConfidence: refinement.confidence,
        focalX: refinement.focalX ?? analysis.focalX,
        focalY: refinement.focalY ?? analysis.focalY,
      };
    } catch {
      // A vision outage degrades the framing, it never fails an import.
      return analysis;
    }
  }

  private async classify(
    buffer: Buffer,
    hint: string | undefined,
  ): Promise<{ room: RoomType; confidence: number; focalX?: number; focalY?: number } | null> {
    const env = getEnv();
    // A small copy is enough to name a room, and keeps the call cheap.
    const thumbnail = await sharp(buffer).resize(640, 640, { fit: 'inside' }).jpeg({ quality: 70 }).toBuffer();

    const response = await this.client.messages.create({
      model: env.AI_MODEL,
      max_tokens: 256,
      output_config: { effort: 'low' },
      system:
        'Tu classes des photos immobilières. Réponds uniquement par un objet JSON ' +
        '{"room": <ROOM>, "confidence": <0..1>, "focalX": <0..1>, "focalY": <0..1>} où ROOM est ' +
        `l'une de : ${ROOM_VALUES.join(', ')}. focalX/focalY désignent le centre du sujet ` +
        "principal. Si tu n'es pas sûr, réponds OTHER avec une confiance basse. N'invente rien.",
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: thumbnail.toString('base64') },
            },
            {
              type: 'text',
              text: hint ? `Légende fournie par l'annonce : « ${hint} »` : 'Aucune légende fournie.',
            },
          ],
        },
      ],
    });

    if (response.stop_reason === 'refusal') return null;
    const text = response.content.find((block) => block.type === 'text')?.text ?? '';
    return parseClassification(text) ?? fallback(hint);
  }
}

/** Tolerant parsing: the model is an assistant here, not a trusted schema. */
export function parseClassification(
  text: string,
): { room: RoomType; confidence: number; focalX?: number; focalY?: number } | null {
  const match = /\{[\s\S]*\}/.exec(text);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    const room = String(parsed.room ?? '').toUpperCase() as RoomType;
    if (!ROOM_VALUES.includes(room)) return null;
    const confidence = Number(parsed.confidence);
    const focalX = Number(parsed.focalX);
    const focalY = Number(parsed.focalY);
    return {
      room,
      confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0.5,
      ...(focalX >= 0 && focalX <= 1 ? { focalX } : {}),
      ...(focalY >= 0 && focalY <= 1 ? { focalY } : {}),
    };
  } catch {
    return null;
  }
}

function fallback(hint: string | undefined) {
  const detected = detectRoomFromHint(hint);
  return { room: detected.room, confidence: detected.confidence };
}
