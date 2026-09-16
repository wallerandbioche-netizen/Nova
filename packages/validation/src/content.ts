import { z } from 'zod';
import {
  contentDepthSchema,
  convictionSchema,
  freeTextSchema,
  investmentHorizonSchema,
  journalActionSchema,
  lessonDifficultySchema,
  newsCategorySchema,
  paginationSchema,
  priceRangeSchema,
  priceSchema,
  quantitySchema,
  uuidSchema,
} from './primitives.js';

export const listNewsQuerySchema = paginationSchema.extend({
  category: newsCategorySchema.optional(),
  personalized: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((value) => value === true || value === 'true')
    .default(true),
});

export const priceSeriesQuerySchema = z.object({
  range: priceRangeSchema.default('1M'),
});

export const briefHistoryQuerySchema = paginationSchema;

export const aiChatSchema = z.object({
  message: freeTextSchema(1000, 'Votre question'),
  conversationId: uuidSchema.optional(),
  depth: contentDepthSchema.default('simple'),
  /** Optional context so the answer can reference what the user is looking at. */
  context: z
    .object({
      newsId: uuidSchema.optional(),
      assetId: uuidSchema.optional(),
      portfolioId: uuidSchema.optional(),
    })
    .optional(),
});
export type AiChatInput = z.infer<typeof aiChatSchema>;

export const explainNewsSchema = z.object({
  newsId: uuidSchema,
  depth: contentDepthSchema.default('simple'),
});

export const explainPortfolioSchema = z.object({
  portfolioId: uuidSchema,
  question: freeTextSchema(500, 'Votre question').optional(),
  depth: contentDepthSchema.default('simple'),
});

export const listLessonsQuerySchema = z.object({
  difficulty: lessonDifficultySchema.optional(),
  category: z.string().trim().max(40).optional(),
});

export const completeLessonSchema = z
  .object({
    quizScore: z.number().int().min(0).max(100).optional(),
  })
  .default({});

export const createJournalEntrySchema = z.object({
  portfolioId: uuidSchema.optional(),
  assetId: uuidSchema.optional(),
  action: journalActionSchema,
  quantity: quantitySchema.optional(),
  price: priceSchema.optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  reason: freeTextSchema(2000, 'Votre raison'),
  horizon: investmentHorizonSchema.optional(),
  conviction: convictionSchema.optional(),
  occurredAt: z.coerce.date().optional(),
});
export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;

export const updateJournalEntrySchema = createJournalEntrySchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Aucune modification fournie');

export const listNotificationsQuerySchema = paginationSchema.extend({
  unreadOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((value) => value === true || value === 'true')
    .default(false),
});

export const registerDeviceSchema = z.object({
  token: z.string().trim().min(10).max(400),
  platform: z.enum(['ios', 'android', 'web']),
});

export const checkoutSchema = z.object({
  plan: z.enum(['premium']),
  interval: z.enum(['month', 'year']).default('month'),
  successUrl: z.string().url().max(500).optional(),
  cancelUrl: z.string().url().max(500).optional(),
});
