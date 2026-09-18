import { z } from 'zod';

/** Every request body the API accepts is described here, once. */

export const emailSchema = z.string().trim().toLowerCase().email("Adresse e-mail invalide");
export const passwordSchema = z
  .string()
  .min(10, 'Le mot de passe doit contenir au moins 10 caractères')
  .max(200);

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().max(80).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const importListingSchema = z.object({
  url: z.string().trim().min(3).max(2000),
});

export const styleSchema = z.enum(['CINEMATIC', 'MODERN', 'LUXURY', 'DYNAMIC']);
export const aspectRatioSchema = z.enum(['VERTICAL', 'HORIZONTAL', 'SQUARE']);
export const durationSchema = z.enum(['AUTO', 'S15', 'S30', 'S45']);

export const createVideoSchema = z.object({
  listingId: z.string().min(1),
  imageIds: z.array(z.string().min(1)).min(3, 'Il faut au moins 3 photos').max(40),
  name: z.string().trim().max(120).optional(),
  style: styleSchema.default('CINEMATIC'),
  aspectRatio: aspectRatioSchema.default('VERTICAL'),
  duration: durationSchema.default('AUTO'),
});

export const updateVideoSchema = z.object({
  name: z.string().trim().max(120).optional(),
  style: styleSchema.optional(),
  aspectRatio: aspectRatioSchema.optional(),
  duration: durationSchema.optional(),
  imageIds: z.array(z.string().min(1)).min(3).max(40).optional(),
});

export const reorderImagesSchema = z.object({
  imageIds: z.array(z.string().min(1)).min(1).max(60),
});

export const checkoutSchema = z.object({
  planId: z.enum(['STARTER', 'PRO']).optional(),
  packId: z.string().optional(),
});
