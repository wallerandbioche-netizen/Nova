import { z } from 'zod';
import {
  assetTypeSchema,
  contentDepthSchema,
  experienceLevelSchema,
  firstNameSchema,
  investmentGoalSchema,
  investmentHorizonSchema,
  localeSchema,
  riskToleranceSchema,
  themePreferenceSchema,
} from './primitives.js';

export const updateProfileSchema = z
  .object({
    firstName: firstNameSchema.optional(),
    locale: localeSchema.optional(),
    theme: themePreferenceSchema.optional(),
    contentDepth: contentDepthSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Aucune modification fournie');
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const investorProfileSchema = z.object({
  investmentGoal: investmentGoalSchema,
  investmentHorizon: investmentHorizonSchema,
  experienceLevel: experienceLevelSchema,
  riskTolerance: riskToleranceSchema,
  knowledgeLevel: experienceLevelSchema.optional(),
  interestedAssetTypes: z
    .array(assetTypeSchema)
    .min(1, 'Sélectionnez au moins un type d’actif')
    .max(7),
});
export type InvestorProfileInput = z.infer<typeof investorProfileSchema>;

export const updateInvestorProfileSchema = investorProfileSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Aucune modification fournie');

export const notificationPreferencesSchema = z
  .object({
    dailyBrief: z.boolean().optional(),
    importantNews: z.boolean().optional(),
    learning: z.boolean().optional(),
    quietHoursStart: z.number().int().min(0).max(23).optional(),
    quietHoursEnd: z.number().int().min(0).max(23).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Aucune modification fournie');

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Mot de passe requis').max(200),
  confirmation: z.literal('SUPPRIMER', {
    errorMap: () => ({ message: 'Saisissez SUPPRIMER pour confirmer' }),
  }),
});
