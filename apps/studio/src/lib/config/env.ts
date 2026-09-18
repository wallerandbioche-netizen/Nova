import { z } from 'zod';

/**
 * Environment contract.
 *
 * Everything optional has a development default that keeps the product runnable with zero
 * external services: local disk storage, in-process job queue, no Stripe, no vision API.
 * Nothing here is ever a secret literal — values always come from the environment.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url().default('http://localhost:3100'),

  DATABASE_URL: z.string().min(1).default('postgresql://studio:studio@localhost:5432/studio_dev'),

  /** Signing key for session cookies. Required in production. */
  AUTH_SECRET: z.string().min(16).default('dev-only-insecure-secret-change-me'),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('.storage'),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_REGION: z.string().default('auto'),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
  STORAGE_FORCE_PATH_STYLE: z.coerce.boolean().default(true),

  REDIS_URL: z.string().optional(),
  /** When true the API renders videos in-process (dev); otherwise a worker consumes the queue. */
  INLINE_RENDER: z.coerce.boolean().default(true),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_STARTER: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional(),
  STRIPE_PRICE_CREDITS_10: z.string().optional(),

  /** Optional vision provider used only to classify rooms / refine framing. */
  AI_API_KEY: z.string().optional(),
  AI_BASE_URL: z.string().default('https://api.anthropic.com/v1'),
  AI_MODEL: z.string().default('claude-opus-5'),

  /** Chromium used by the Remotion renderer. Falls back to Remotion's own download. */
  REMOTION_BROWSER_EXECUTABLE: z.string().optional(),
  REMOTION_CONCURRENCY: z.coerce.number().int().positive().default(2),

  /** Hard limits for uploads. */
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(15 * 1024 * 1024),
  MAX_IMAGES_PER_LISTING: z.coerce.number().int().positive().default(40),

  /** Identifies our crawler to the sites we read public metadata from. */
  IMPORT_USER_AGENT: z
    .string()
    .default('NovaStudioBot/0.1 (+https://nova.studio/bot; respects robots.txt)'),
  IMPORT_TIMEOUT_MS: z.coerce.number().int().positive().default(12_000),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ');
    throw new Error(`Invalid environment configuration:\n  ${issues}`);
  }
  if (parsed.data.NODE_ENV === 'production') {
    assertProductionSafety(parsed.data);
  }
  cached = parsed.data;
  return cached;
}

function assertProductionSafety(env: Env): void {
  const problems: string[] = [];
  if (env.AUTH_SECRET === 'dev-only-insecure-secret-change-me') {
    problems.push('AUTH_SECRET must be set to a real secret in production');
  }
  if (env.STORAGE_DRIVER === 's3') {
    for (const key of ['STORAGE_BUCKET', 'STORAGE_ACCESS_KEY', 'STORAGE_SECRET_KEY'] as const) {
      if (!env[key]) problems.push(`${key} is required when STORAGE_DRIVER=s3`);
    }
  }
  if (problems.length > 0) {
    throw new Error(`Unsafe production configuration:\n  ${problems.join('\n  ')}`);
  }
}

/** Test helper: forget the memoised environment. */
export function resetEnvCache(): void {
  cached = null;
}
