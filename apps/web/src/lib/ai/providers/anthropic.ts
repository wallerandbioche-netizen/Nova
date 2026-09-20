import 'server-only';

import type { ReasoningProvider, ReasoningRequest } from '../provider';
import {
  reasoningSchema,
  visionExtractionSchema,
  type ReasoningPayload,
  type VisionExtraction,
} from '../schema';
import { SYSTEM_PROMPT, buildUserPrompt } from '../prompt';
import { deterministicProvider } from './deterministic';

const API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-5';

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[];
}

function apiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY;
}

async function callModel(
  system: string,
  content: unknown,
  maxTokens = 1_600,
): Promise<string | null> {
  const key = apiKey();
  if (!key) return null;

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.SCANTRADE_MODEL ?? DEFAULT_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!response.ok) {
    console.error('[scan-trade] model call failed', response.status);
    return null;
  }

  const payload = (await response.json()) as AnthropicResponse;
  const text = payload.content?.find((block) => block.type === 'text')?.text;
  return text ?? null;
}

function parseJson(raw: string): unknown {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object in model output');
  return JSON.parse(raw.slice(start, end + 1));
}

/**
 * Model-backed reasoning layer. It only rewrites the commentary; the schema
 * rejects anything else and the engine narrative is used as a fallback, so a
 * malformed or unavailable model degrades instead of producing fiction.
 */
export const anthropicProvider: ReasoningProvider = {
  id: 'anthropic',
  label: 'Analyse rédigée par un modèle',
  isAvailable: () => Boolean(apiKey()),
  async reason(request: ReasoningRequest): Promise<ReasoningPayload> {
    const fallback = await deterministicProvider.reason(request);
    try {
      const raw = await callModel(
        SYSTEM_PROMPT,
        buildUserPrompt(request.analysis, request.userContext),
      );
      if (!raw) return fallback;
      const parsed = reasoningSchema.safeParse(parseJson(raw));
      if (!parsed.success) {
        console.warn('[scan-trade] model output rejected by schema');
        return fallback;
      }
      return parsed.data;
    } catch (error) {
      console.error('[scan-trade] reasoning failed', error);
      return fallback;
    }
  },
};

const VISION_SYSTEM_PROMPT = [
  "Tu lis une capture d'écran de graphique financier.",
  "Tu ne dois extraire que ce qui est réellement lisible sur l'image.",
  "Si les prix, l'échelle ou les bougies ne sont pas lisibles, renvoie readable: false et liste ce qui manque.",
  "N'invente jamais une valeur, un actif ou une unité de temps.",
  'Réponds uniquement avec un objet JSON : { readable, symbol, timeframe, candles: [{open, high, low, close, volume?}], observations: [], missing: [] }.',
].join('\n');

/**
 * Vision extraction. Without credentials the function reports that no visual
 * data could be read — it never falls back to invented candles.
 */
export async function extractFromScreenshot(
  base64Image: string,
  mediaType: string,
): Promise<VisionExtraction> {
  if (!apiKey()) {
    return {
      readable: false,
      symbol: null,
      timeframe: null,
      candles: [],
      observations: [],
      missing: ["Aucun modèle de vision configuré : l'image ne peut pas être lue."],
    };
  }

  try {
    const raw = await callModel(
      VISION_SYSTEM_PROMPT,
      [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Image } },
        { type: 'text', text: 'Extrais les informations lisibles de ce graphique.' },
      ],
      4_000,
    );
    if (!raw) {
      return {
        readable: false,
        symbol: null,
        timeframe: null,
        candles: [],
        observations: [],
        missing: ["Le service de lecture d'image n'a pas répondu."],
      };
    }
    const parsed = visionExtractionSchema.safeParse(parseJson(raw));
    if (!parsed.success) {
      return {
        readable: false,
        symbol: null,
        timeframe: null,
        candles: [],
        observations: [],
        missing: ['La lecture de l’image n’a pas produit de données exploitables.'],
      };
    }
    return parsed.data;
  } catch (error) {
    console.error('[scan-trade] vision extraction failed', error);
    return {
      readable: false,
      symbol: null,
      timeframe: null,
      candles: [],
      observations: [],
      missing: ["Erreur pendant la lecture de l'image."],
    };
  }
}
