import { z } from 'zod';
import {
  ASSET_TYPES,
  CONTENT_DEPTHS,
  CONVICTION_LEVELS,
  EXPERIENCE_LEVELS,
  INVESTMENT_GOALS,
  INVESTMENT_HORIZONS,
  JOURNAL_ACTIONS,
  LESSON_DIFFICULTIES,
  MARKET_THEMES,
  NEWS_CATEGORIES,
  PRICE_RANGES,
  REGIONS,
  RISK_TOLERANCES,
  SUPPORTED_CURRENCIES,
  SUPPORTED_LOCALES,
  THEME_PREFERENCES,
  TIME_HORIZONS,
} from '@nova/types';

/** Minimum password policy. Length is the dominant factor, so we require a real passphrase. */
export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 200;

export const uuidSchema = z.string().uuid('Identifiant invalide');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, 'Adresse e-mail invalide')
  .max(254, 'Adresse e-mail trop longue')
  .email('Adresse e-mail invalide');

export const passwordSchema = z
  .string()
  .min(
    MIN_PASSWORD_LENGTH,
    `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères`,
  )
  .max(MAX_PASSWORD_LENGTH, 'Le mot de passe est trop long')
  .refine((value) => /[a-zA-Z]/.test(value), 'Le mot de passe doit contenir au moins une lettre')
  .refine((value) => /[0-9]/.test(value), 'Le mot de passe doit contenir au moins un chiffre');

export const firstNameSchema = z
  .string()
  .trim()
  .min(1, 'Le prénom est requis')
  .max(60, 'Le prénom est trop long');

export const currencySchema = z.enum(SUPPORTED_CURRENCIES);
export const localeSchema = z.enum(SUPPORTED_LOCALES);
export const themePreferenceSchema = z.enum(THEME_PREFERENCES);
export const contentDepthSchema = z.enum(CONTENT_DEPTHS);
export const assetTypeSchema = z.enum(ASSET_TYPES);
export const regionSchema = z.enum(REGIONS);
export const experienceLevelSchema = z.enum(EXPERIENCE_LEVELS);
export const investmentGoalSchema = z.enum(INVESTMENT_GOALS);
export const investmentHorizonSchema = z.enum(INVESTMENT_HORIZONS);
export const riskToleranceSchema = z.enum(RISK_TOLERANCES);
export const newsCategorySchema = z.enum(NEWS_CATEGORIES);
export const timeHorizonSchema = z.enum(TIME_HORIZONS);
export const marketThemeSchema = z.enum(MARKET_THEMES);
export const journalActionSchema = z.enum(JOURNAL_ACTIONS);
export const convictionSchema = z.enum(CONVICTION_LEVELS);
export const lessonDifficultySchema = z.enum(LESSON_DIFFICULTIES);
export const priceRangeSchema = z.enum(PRICE_RANGES);

/**
 * Monetary quantity. Accepts a number or a numeric string (mobile inputs send strings)
 * and rejects anything that is not finite — a NaN silently flowing into a portfolio
 * computation is a correctness bug we refuse at the boundary.
 */
export const decimalSchema = (options: { min?: number; max?: number; label?: string } = {}) => {
  const { min = 0, max = 1_000_000_000_000, label = 'La valeur' } = options;
  return z
    .union([z.number(), z.string().trim().min(1)])
    .transform((value, ctx) => {
      const parsed = typeof value === 'number' ? value : Number(value.replace(',', '.'));
      if (!Number.isFinite(parsed)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} doit être un nombre` });
        return z.NEVER;
      }
      return parsed;
    })
    .refine((value) => value >= min, `${label} doit être supérieure ou égale à ${min}`)
    .refine((value) => value <= max, `${label} est trop grande`);
};

export const quantitySchema = decimalSchema({
  min: 0.00000001,
  max: 1_000_000_000,
  label: 'La quantité',
});

export const priceSchema = decimalSchema({ min: 0, max: 100_000_000, label: 'Le prix' });

export const scoreSchema = z.number().int().min(0).max(100);
export const confidenceSchema = z.number().min(0).max(1);

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(200).optional(),
});
export type PaginationQuery = z.infer<typeof paginationSchema>;

/** Free text written by a human. Trimmed, bounded, and never interpreted as markup. */
export const freeTextSchema = (max: number, label = 'Le texte') =>
  z.string().trim().min(1, `${label} est requis`).max(max, `${label} est trop long`);
