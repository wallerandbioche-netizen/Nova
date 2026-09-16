import { z } from 'zod';

/**
 * Server-side configuration.
 *
 * Configuration is read lazily and per domain. A missing Stripe key must not
 * stop the landing page from rendering, and `next build` must not require a
 * populated `.env` — but an endpoint that genuinely needs a key fails loudly
 * with a message that names the variable (§61: never silently simulate).
 */

export class ConfigurationError extends Error {
  readonly variables: string[];

  constructor(message: string, variables: string[] = []) {
    super(message);
    this.name = 'ConfigurationError';
    this.variables = variables;
  }
}

const bool = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((value) => (value == null || value === '' ? fallback : value === 'true' || value === '1'));

const int = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((value) => (value == null || value === '' ? fallback : Number(value)))
    .pipe(z.number().int().nonnegative());

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

const coreSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  MAX_UPLOAD_BYTES: int(8 * 1024 * 1024),
  ANALYSIS_MONTHLY_LIMIT: int(0),
  RATE_LIMIT_DRIVER: z.enum(['database', 'memory']).default('database'),
});

export type CoreEnv = z.infer<typeof coreSchema>;

let coreCache: CoreEnv | null = null;

export function getCoreEnv(): CoreEnv {
  if (coreCache) return coreCache;
  const parsed = coreSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    APP_URL: process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL,
    LOG_LEVEL: process.env.LOG_LEVEL,
    MAX_UPLOAD_BYTES: process.env.MAX_UPLOAD_BYTES,
    ANALYSIS_MONTHLY_LIMIT: process.env.ANALYSIS_MONTHLY_LIMIT,
    RATE_LIMIT_DRIVER: process.env.RATE_LIMIT_DRIVER,
  });
  if (!parsed.success) {
    throw new ConfigurationError(
      `Configuration invalide : ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`,
      parsed.error.issues.map((i) => String(i.path[0] ?? '')),
    );
  }
  coreCache = parsed.data;
  return coreCache;
}

/** Test helper: forget every cached configuration block. */
export function resetEnvCache(): void {
  coreCache = null;
  aiCache = null;
  stripeCache = null;
  storageCache = null;
}

function required(name: string, hint: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new ConfigurationError(`${name} n'est pas configuré. ${hint}`, [name]);
  }
  return value;
}

// ---------------------------------------------------------------------------
// AI provider
// ---------------------------------------------------------------------------

export interface AIConfig {
  provider: 'anthropic';
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
  maxOutputTokens: number;
}

let aiCache: AIConfig | null = null;

export function getAIConfig(): AIConfig {
  if (aiCache) return aiCache;
  const provider = (process.env.AI_PROVIDER ?? 'anthropic').toLowerCase();
  if (provider !== 'anthropic') {
    throw new ConfigurationError(
      `AI_PROVIDER="${provider}" n'est pas supporté. Fournisseur disponible : "anthropic". ` +
        'Ajoutez une implémentation de AIAnalysisProvider dans src/lib/ai/providers/ pour en brancher un autre.',
      ['AI_PROVIDER'],
    );
  }
  aiCache = {
    provider: 'anthropic',
    apiKey: required('AI_API_KEY', 'Ajoutez votre clé dans .env — voir README « Fournisseur IA ».'),
    model: process.env.AI_MODEL ?? 'claude-opus-5',
    baseUrl: process.env.AI_BASE_URL ?? 'https://api.anthropic.com',
    timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 90_000),
    maxOutputTokens: Number(process.env.AI_MAX_OUTPUT_TOKENS ?? 4096),
  };
  return aiCache;
}

export function isAIConfigured(): boolean {
  try {
    getAIConfig();
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Stripe
// ---------------------------------------------------------------------------

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  priceId: string;
}

let stripeCache: StripeConfig | null = null;

export function getStripeConfig(): StripeConfig {
  if (stripeCache) return stripeCache;
  stripeCache = {
    secretKey: required('STRIPE_SECRET_KEY', 'Voir README « Configuration Stripe ».'),
    webhookSecret: required('STRIPE_WEBHOOK_SECRET', 'Obtenue via `stripe listen` ou le dashboard.'),
    priceId: required('STRIPE_PRICE_ID', 'Identifiant du prix récurrent 19,90 €/mois.'),
  };
  return stripeCache;
}

export function isStripeConfigured(): boolean {
  try {
    getStripeConfig();
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export type StorageConfig =
  | {
      driver: 's3';
      bucket: string;
      region: string;
      endpoint: string | undefined;
      accessKeyId: string;
      secretAccessKey: string;
      forcePathStyle: boolean;
      signedUrlTtlSeconds: number;
    }
  | { driver: 'local'; directory: string };

let storageCache: StorageConfig | null = null;

export function getStorageConfig(): StorageConfig {
  if (storageCache) return storageCache;
  const driver = (process.env.STORAGE_DRIVER ?? 'local').toLowerCase();

  if (driver === 'local') {
    storageCache = {
      driver: 'local',
      directory: process.env.STORAGE_LOCAL_DIR ?? '.storage',
    };
    return storageCache;
  }

  if (driver !== 's3') {
    throw new ConfigurationError(
      `STORAGE_DRIVER="${driver}" est inconnu. Valeurs acceptées : "s3" (production) ou "local" (développement).`,
      ['STORAGE_DRIVER'],
    );
  }

  const parsedTtl = z.coerce.number().int().min(30).max(3600).safeParse(process.env.STORAGE_SIGNED_URL_TTL ?? 300);

  storageCache = {
    driver: 's3',
    bucket: required('STORAGE_BUCKET', 'Nom du bucket privé qui reçoit les captures.'),
    region: process.env.STORAGE_REGION ?? 'auto',
    endpoint: process.env.STORAGE_ENDPOINT || undefined,
    accessKeyId: required('STORAGE_ACCESS_KEY_ID', 'Identifiant S3 du bucket privé.'),
    secretAccessKey: required('STORAGE_SECRET_ACCESS_KEY', 'Clé secrète S3 du bucket privé.'),
    forcePathStyle: bool(true).parse(process.env.STORAGE_FORCE_PATH_STYLE),
    signedUrlTtlSeconds: parsedTtl.success ? parsedTtl.data : 300,
  };
  return storageCache;
}

// ---------------------------------------------------------------------------
// Optional integrations
// ---------------------------------------------------------------------------

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function getAuthSecret(): string {
  return required(
    'AUTH_SECRET',
    'Générez-la avec `openssl rand -base64 48`. Elle signe les sessions.',
  );
}
