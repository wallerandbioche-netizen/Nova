import { z } from 'zod';

/**
 * Single source of truth for everything that costs money or credits.
 * Values live in code as defaults and can be overridden at runtime through the SystemConfig
 * table, so prices change without a deploy and never appear twice in the codebase.
 */
export const CONFIG_KEYS = {
  creditCostPerVideo: 'credits.cost_per_video',
  signupBonusCredits: 'credits.signup_bonus',
  plans: 'billing.plans',
  creditPacks: 'billing.credit_packs',
} as const;

export const planSchema = z.object({
  id: z.enum(['FREE', 'STARTER', 'PRO']),
  name: z.string(),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().default('eur'),
  interval: z.enum(['month', 'year', 'none']),
  monthlyCredits: z.number().int().nonnegative(),
  /** Env var holding the Stripe price id; empty for the free plan. */
  stripePriceEnv: z.string().optional(),
  features: z.array(z.string()),
});

export const creditPackSchema = z.object({
  id: z.string(),
  name: z.string(),
  credits: z.number().int().positive(),
  priceCents: z.number().int().positive(),
  currency: z.string().default('eur'),
  stripePriceEnv: z.string().optional(),
});

export type Plan = z.infer<typeof planSchema>;
export type CreditPack = z.infer<typeof creditPackSchema>;

export const DEFAULT_CREDIT_COST_PER_VIDEO = 1;
export const DEFAULT_SIGNUP_BONUS_CREDITS = 3;

export const DEFAULT_PLANS: Plan[] = [
  {
    id: 'FREE',
    name: 'Free',
    priceCents: 0,
    currency: 'eur',
    interval: 'none',
    monthlyCredits: 0,
    features: ['3 crédits offerts à l’inscription', 'Tous les styles', 'Export 1080p'],
  },
  {
    id: 'STARTER',
    name: 'Starter',
    priceCents: 1900,
    currency: 'eur',
    interval: 'month',
    monthlyCredits: 15,
    stripePriceEnv: 'STRIPE_PRICE_STARTER',
    features: ['15 vidéos par mois', 'Tous les formats', 'Rendu prioritaire'],
  },
  {
    id: 'PRO',
    name: 'Pro',
    priceCents: 4900,
    currency: 'eur',
    interval: 'month',
    monthlyCredits: 60,
    stripePriceEnv: 'STRIPE_PRICE_PRO',
    features: ['60 vidéos par mois', 'File de rendu dédiée', 'Support prioritaire'],
  },
];

export const DEFAULT_CREDIT_PACKS: CreditPack[] = [
  {
    id: 'pack-10',
    name: '10 crédits',
    credits: 10,
    priceCents: 1500,
    currency: 'eur',
    stripePriceEnv: 'STRIPE_PRICE_CREDITS_10',
  },
];

export function formatPrice(cents: number, currency = 'eur'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
