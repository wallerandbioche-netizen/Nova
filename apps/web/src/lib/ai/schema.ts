import { z } from 'zod';

/**
 * Strict contract for the model output. The reasoning layer may only return
 * text that comments on facts the engine computed; every price, level and
 * score stays owned by the deterministic pipeline.
 */
export const reasoningSchema = z.object({
  headline: z.string().min(10).max(240),
  narrative: z.object({
    marketContext: z.string().min(10).max(900),
    structure: z.string().min(10).max(900),
    keyLevels: z.string().min(10).max(900),
    momentum: z.string().min(10).max(900),
    volume: z.string().min(10).max(900),
    setup: z.string().min(10).max(900),
    entry: z.string().min(10).max(900),
    riskManagement: z.string().min(10).max(900),
    invalidation: z.string().min(10).max(900),
  }),
  reasons: z.array(z.string().min(5).max(320)).max(8),
  warnings: z.array(z.string().min(5).max(320)).max(6).default([]),
});

export type ReasoningPayload = z.infer<typeof reasoningSchema>;

/**
 * Schema for a full analysis emitted by an external model. It is only used when
 * a provider returns a complete analysis instead of commentary; the values are
 * still cross-checked against the engine before anything is displayed.
 */
export const modelAnalysisSchema = z.object({
  marketBias: z.enum(['bullish', 'bearish', 'neutral']),
  marketRegime: z.enum(['trending', 'ranging', 'volatile']),
  direction: z.enum(['long', 'short', 'none']),
  setup: z.string().max(64).nullable(),
  confluenceScore: z.number().min(0).max(10),
  entryZone: z.object({ low: z.number(), high: z.number() }).nullable(),
  stopLoss: z.number().nullable(),
  takeProfits: z.array(z.number()).max(3),
  riskReward: z.number().min(0).nullable(),
  invalidation: z.string().max(400),
  reasons: z.array(z.string().max(320)).max(8),
  noTradeConditions: z.array(z.string().max(320)).max(8),
});

export type ModelAnalysis = z.infer<typeof modelAnalysisSchema>;

/** Result of reading a chart screenshot. */
export const visionExtractionSchema = z.object({
  /** False whenever the image does not carry enough readable information. */
  readable: z.boolean(),
  symbol: z.string().max(32).nullable(),
  timeframe: z.string().max(8).nullable(),
  /** Candles the model could actually read, in chronological order. */
  candles: z
    .array(
      z.object({
        open: z.number(),
        high: z.number(),
        low: z.number(),
        close: z.number(),
        volume: z.number().nonnegative().optional(),
      }),
    )
    .max(400)
    .default([]),
  observations: z.array(z.string().max(320)).max(10).default([]),
  missing: z.array(z.string().max(160)).max(10).default([]),
});

export type VisionExtraction = z.infer<typeof visionExtractionSchema>;
