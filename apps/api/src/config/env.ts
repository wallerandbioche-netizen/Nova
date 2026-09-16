import { z } from 'zod';

/**
 * Environment configuration.
 *
 * Every variable is validated at boot: an API that starts with a missing JWT secret or an
 * unparsable rate limit is a security incident waiting to happen, so we fail fast instead.
 * No value defined here is ever sent to the client.
 */
const booleanish = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((value) => value === true || value === 'true' || value === '1');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
    API_HOST: z.string().default('0.0.0.0'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    CORS_ORIGINS: z.string().default(''),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    TEST_DATABASE_URL: z.string().optional(),
    REDIS_URL: z.string().optional(),

    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_ACCESS_TTL: z.string().default('15m'),
    JWT_REFRESH_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(1440).default(30),

    RATE_LIMIT_GLOBAL_MAX: z.coerce.number().int().min(1).default(300),
    RATE_LIMIT_GLOBAL_WINDOW: z.string().default('1 minute'),
    RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().min(1).default(10),
    RATE_LIMIT_LOGIN_WINDOW: z.string().default('15 minutes'),
    RATE_LIMIT_REGISTER_MAX: z.coerce.number().int().min(1).default(5),
    RATE_LIMIT_REGISTER_WINDOW: z.string().default('15 minutes'),
    RATE_LIMIT_PASSWORD_RESET_MAX: z.coerce.number().int().min(1).default(5),
    RATE_LIMIT_PASSWORD_RESET_WINDOW: z.string().default('1 hour'),
    RATE_LIMIT_AI_MAX: z.coerce.number().int().min(1).default(20),
    RATE_LIMIT_AI_WINDOW: z.string().default('1 hour'),

    MARKET_DATA_PROVIDER: z.enum(['demo', 'http']).default('demo'),
    MARKET_DATA_API_URL: z.string().optional(),
    MARKET_DATA_API_KEY: z.string().optional(),

    NEWS_PROVIDER: z.enum(['demo', 'http']).default('demo'),
    NEWS_API_URL: z.string().optional(),
    NEWS_API_KEY: z.string().optional(),

    LLM_PROVIDER: z.enum(['demo', 'anthropic', 'openai-compatible']).default('demo'),
    LLM_API_URL: z.string().optional(),
    LLM_API_KEY: z.string().optional(),
    LLM_MODEL: z.string().default('claude-sonnet-5'),
    LLM_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(20000),
    LLM_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(100).max(8000).default(1200),

    MAIL_PROVIDER: z.enum(['log', 'http']).default('log'),
    MAIL_API_URL: z.string().optional(),
    MAIL_API_KEY: z.string().optional(),
    MAIL_FROM: z.string().default('NOVA <no-reply@nova.app>'),
    APP_DEEP_LINK_BASE: z.string().default('nova://'),

    NOTIFICATION_PROVIDER: z.enum(['demo', 'expo']).default('demo'),
    EXPO_ACCESS_TOKEN: z.string().optional(),

    PAYMENT_PROVIDER: z.enum(['none', 'stripe']).default('none'),
    PAYMENT_SECRET: z.string().optional(),
    PAYMENT_WEBHOOK_SECRET: z.string().optional(),
    PAYMENT_PREMIUM_PRICE_ID: z.string().optional(),

    STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
    STORAGE_BUCKET: z.string().optional(),
    STORAGE_REGION: z.string().optional(),
    STORAGE_ENDPOINT: z.string().optional(),
    STORAGE_ACCESS_KEY_ID: z.string().optional(),
    STORAGE_SECRET_ACCESS_KEY: z.string().optional(),

    ANALYTICS_PROVIDER: z.enum(['none', 'http']).default('none'),
    ANALYTICS_API_URL: z.string().optional(),
    ANALYTICS_API_KEY: z.string().optional(),

    DAILY_BRIEF_CRON: z.string().default('0 6 * * *'),
    JOBS_TIMEZONE: z.string().default('Europe/Paris'),
    JOBS_ENABLED: booleanish.default(true),
  })
  .superRefine((env, ctx) => {
    // A provider selected without its endpoint would silently degrade to demo data in
    // production, which is exactly the situation absolute rule #58 forbids.
    const requireUrl = (provider: string, selected: string, url: string | undefined, key: string) => {
      if (provider === selected && !url) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required when the provider is "${selected}"`,
        });
      }
    };
    requireUrl(env.MARKET_DATA_PROVIDER, 'http', env.MARKET_DATA_API_URL, 'MARKET_DATA_API_URL');
    requireUrl(env.NEWS_PROVIDER, 'http', env.NEWS_API_URL, 'NEWS_API_URL');
    requireUrl(env.MAIL_PROVIDER, 'http', env.MAIL_API_URL, 'MAIL_API_URL');

    if (env.LLM_PROVIDER !== 'demo' && !env.LLM_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['LLM_API_KEY'],
        message: `LLM_API_KEY is required when LLM_PROVIDER is "${env.LLM_PROVIDER}"`,
      });
    }
    if (env.PAYMENT_PROVIDER === 'stripe' && !env.PAYMENT_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PAYMENT_SECRET'],
        message: 'PAYMENT_SECRET is required when PAYMENT_PROVIDER is "stripe"',
      });
    }
    if (env.NODE_ENV === 'production') {
      if (env.JWT_SECRET.includes('change-me') || env.JWT_SECRET.includes('development')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_SECRET'],
          message: 'JWT_SECRET still holds a placeholder value; generate a real secret',
        });
      }
      if (env.MAIL_PROVIDER === 'log') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['MAIL_PROVIDER'],
          message:
            'MAIL_PROVIDER=log cannot be used in production: password reset emails would never be delivered',
        });
      }
      if (!env.REDIS_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['REDIS_URL'],
          message: 'REDIS_URL is required in production (in-memory cache is single-process only)',
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}

let cached: Env | null = null;

/** Parsed environment, memoised. Tests can inject their own via `setEnv`. */
export function getEnv(): Env {
  if (!cached) cached = parseEnv();
  return cached;
}

export function setEnv(env: Env): void {
  cached = env;
}

export function corsOrigins(env: Env): string[] {
  return env.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isProduction(env: Env): boolean {
  return env.NODE_ENV === 'production';
}
