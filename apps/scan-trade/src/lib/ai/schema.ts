import { z } from 'zod';

/**
 * The wire contract the model must respect (§39).
 *
 * Everything optional is `nullable`, never absent-and-meaningful: the model is
 * asked to say "null" explicitly rather than omit a field, which makes
 * "not visible on the chart" distinguishable from "forgot to answer".
 */

const finiteNumber = z
  .number()
  .refine((value) => Number.isFinite(value), { message: 'valeur numérique non finie' });

const nullableNumber = finiteNumber.nullable().catch(null);
const nullableText = z.string().trim().min(1).max(600).nullable().catch(null);

export const aiLevelTypeSchema = z.enum([
  'support_primary',
  'support_secondary',
  'resistance_primary',
  'resistance_secondary',
  'entry_zone',
  'invalidation',
  'take_profit_1',
  'take_profit_2',
]);

export const aiTechnicalAreaSchema = z.enum([
  'trend',
  'market_structure',
  'support_resistance',
  'momentum',
  'indicators',
  'volume',
  'other',
]);

export const aiReasoningCategorySchema = z.enum([
  'observation',
  'interpretation',
  'confirmation',
  'invalidation',
  'confidence',
  'limitation',
]);

export const aiMarketSchema = z.enum(['crypto', 'forex', 'indices', 'stocks', 'commodities', 'other']);

export const aiAnalysisResponseSchema = z.object({
  status: z.enum(['analysis', 'no_trade', 'insufficient_data']),
  asset: nullableText,
  timeframe: nullableText,
  market: aiMarketSchema.nullable().catch(null),
  chart_type: nullableText,
  approximate_price: nullableNumber,
  market_bias: z.enum(['long', 'short', 'neutral']).nullable().catch(null),
  entry: z
    .object({ min: nullableNumber, max: nullableNumber })
    .nullable()
    .catch(null),
  stop_loss: nullableNumber,
  take_profit_1: nullableNumber,
  take_profit_2: nullableNumber,
  risk_reward: nullableNumber,
  confidence: z.enum(['low', 'medium', 'high']).nullable().catch(null),
  key_levels: z
    .array(
      z.object({
        type: aiLevelTypeSchema,
        price: nullableNumber,
        price_max: nullableNumber,
        label: nullableText,
      }),
    )
    .max(24)
    .default([]),
  technical_analysis: z
    .array(
      z.object({
        category: aiTechnicalAreaSchema,
        title: z.string().trim().min(1).max(120),
        detail: z.string().trim().min(1).max(800),
      }),
    )
    .max(12)
    .default([]),
  reasoning: z
    .array(
      z.object({
        category: aiReasoningCategorySchema,
        content: z.string().trim().min(1).max(600),
      }),
    )
    .max(20)
    .default([]),
  summary: z.string().trim().min(1).max(800),
  invalidation: z.string().trim().max(800).nullable().catch(null),
  warnings: z.array(z.string().trim().min(1).max(400)).max(12).default([]),
});

export type AIAnalysisResponse = z.infer<typeof aiAnalysisResponseSchema>;

/** JSON Schema handed to the provider so the model emits the shape above. */
export const AI_RESPONSE_JSON_SCHEMA = {
  type: 'object',
  required: [
    'status',
    'asset',
    'timeframe',
    'market',
    'chart_type',
    'approximate_price',
    'market_bias',
    'entry',
    'stop_loss',
    'take_profit_1',
    'take_profit_2',
    'risk_reward',
    'confidence',
    'key_levels',
    'technical_analysis',
    'reasoning',
    'summary',
    'invalidation',
    'warnings',
  ],
  additionalProperties: false,
  properties: {
    status: {
      type: 'string',
      enum: ['analysis', 'no_trade', 'insufficient_data'],
      description:
        '"analysis" only when a justified scenario exists. "no_trade" when the chart is readable but offers no clear setup. "insufficient_data" when the screenshot cannot be read reliably.',
    },
    asset: { type: ['string', 'null'], description: 'Ticker exactly as written on the chart, else null.' },
    timeframe: { type: ['string', 'null'], description: 'Timeframe exactly as written on the chart, else null.' },
    market: { type: ['string', 'null'], enum: ['crypto', 'forex', 'indices', 'stocks', 'commodities', 'other', null] },
    chart_type: { type: ['string', 'null'], description: 'e.g. "candlestick", "line", "heikin ashi". Null if unclear.' },
    approximate_price: { type: ['number', 'null'], description: 'Last price if legible on the axis or the price tag, else null.' },
    market_bias: { type: ['string', 'null'], enum: ['long', 'short', 'neutral', null] },
    entry: {
      type: ['object', 'null'],
      additionalProperties: false,
      required: ['min', 'max'],
      properties: { min: { type: ['number', 'null'] }, max: { type: ['number', 'null'] } },
    },
    stop_loss: { type: ['number', 'null'] },
    take_profit_1: { type: ['number', 'null'] },
    take_profit_2: { type: ['number', 'null'] },
    risk_reward: { type: ['number', 'null'], description: 'Reward divided by risk. The server recomputes it anyway.' },
    confidence: { type: ['string', 'null'], enum: ['low', 'medium', 'high', null] },
    key_levels: {
      type: 'array',
      maxItems: 24,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'price', 'price_max', 'label'],
        properties: {
          type: {
            type: 'string',
            enum: [
              'support_primary',
              'support_secondary',
              'resistance_primary',
              'resistance_secondary',
              'entry_zone',
              'invalidation',
              'take_profit_1',
              'take_profit_2',
            ],
          },
          price: { type: ['number', 'null'] },
          price_max: { type: ['number', 'null'], description: 'Upper bound when the level is a zone.' },
          label: { type: ['string', 'null'] },
        },
      },
    },
    technical_analysis: {
      type: 'array',
      maxItems: 12,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['category', 'title', 'detail'],
        properties: {
          category: {
            type: 'string',
            enum: ['trend', 'market_structure', 'support_resistance', 'momentum', 'indicators', 'volume', 'other'],
          },
          title: { type: 'string' },
          detail: { type: 'string' },
        },
      },
    },
    reasoning: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['category', 'content'],
        properties: {
          category: {
            type: 'string',
            enum: ['observation', 'interpretation', 'confirmation', 'invalidation', 'confidence', 'limitation'],
          },
          content: { type: 'string' },
        },
      },
    },
    summary: { type: 'string', description: 'Two or three sentences, French, no promise of outcome.' },
    invalidation: { type: ['string', 'null'] },
    warnings: { type: 'array', maxItems: 12, items: { type: 'string' } },
  },
} as const;
