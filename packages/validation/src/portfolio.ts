import { z } from 'zod';
import {
  currencySchema,
  freeTextSchema,
  paginationSchema,
  priceSchema,
  quantitySchema,
  uuidSchema,
} from './primitives.js';

export const createPortfolioSchema = z.object({
  name: freeTextSchema(60, 'Le nom du portefeuille'),
  baseCurrency: currencySchema.default('EUR'),
});
export type CreatePortfolioInput = z.infer<typeof createPortfolioSchema>;

export const updatePortfolioSchema = z
  .object({
    name: freeTextSchema(60, 'Le nom du portefeuille').optional(),
    baseCurrency: currencySchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Aucune modification fournie');

/**
 * A position is created either from a known asset id or from a symbol the user typed.
 * Requiring exactly one of the two keeps the server in control of asset resolution.
 */
export const createPositionSchema = z
  .object({
    assetId: uuidSchema.optional(),
    symbol: z.string().trim().min(1).max(20).toUpperCase().optional(),
    quantity: quantitySchema,
    averagePrice: priceSchema,
    currency: currencySchema.optional(),
  })
  .refine(
    (value) => Boolean(value.assetId) !== Boolean(value.symbol),
    'Fournissez soit un actif existant, soit un symbole',
  );
export type CreatePositionInput = z.infer<typeof createPositionSchema>;

export const updatePositionSchema = z
  .object({
    quantity: quantitySchema.optional(),
    averagePrice: priceSchema.optional(),
    currency: currencySchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Aucune modification fournie');

export const listAssetsQuerySchema = paginationSchema.extend({
  query: z.string().trim().min(1).max(60).optional(),
  type: z.string().trim().max(20).optional(),
});

export const onboardingPortfolioSchema = z.object({
  name: freeTextSchema(60, 'Le nom du portefeuille').default('Mon portefeuille'),
  baseCurrency: currencySchema.default('EUR'),
  positions: z
    .array(
      z.object({
        symbol: z.string().trim().min(1).max(20).toUpperCase(),
        name: z.string().trim().max(120).optional(),
        quantity: quantitySchema,
        averagePrice: priceSchema,
        currency: currencySchema.default('EUR'),
      }),
    )
    .max(50, 'Trop de positions pour un premier import')
    .default([]),
});
export type OnboardingPortfolioInput = z.infer<typeof onboardingPortfolioSchema>;
