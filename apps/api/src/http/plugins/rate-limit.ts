import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Env } from '../../config/env.js';

/**
 * Rate limiting.
 *
 * Global protection plus tighter budgets on the expensive or abusable routes (login, register,
 * password reset, AI). All limits come from the environment (rule #34), so they can be tuned
 * per deployment without a release.
 */
export type RateLimitName = 'login' | 'register' | 'passwordReset' | 'ai';

export function rateLimitConfig(env: Env, name: RateLimitName) {
  const limits: Record<RateLimitName, { max: number; timeWindow: string }> = {
    login: { max: env.RATE_LIMIT_LOGIN_MAX, timeWindow: env.RATE_LIMIT_LOGIN_WINDOW },
    register: { max: env.RATE_LIMIT_REGISTER_MAX, timeWindow: env.RATE_LIMIT_REGISTER_WINDOW },
    passwordReset: {
      max: env.RATE_LIMIT_PASSWORD_RESET_MAX,
      timeWindow: env.RATE_LIMIT_PASSWORD_RESET_WINDOW,
    },
    ai: { max: env.RATE_LIMIT_AI_MAX, timeWindow: env.RATE_LIMIT_AI_WINDOW },
  };
  return { rateLimit: limits[name] };
}

export const rateLimitPlugin = fp(async (app: FastifyInstance) => {
  const { env } = app.nova;

  await app.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_GLOBAL_MAX,
    timeWindow: env.RATE_LIMIT_GLOBAL_WINDOW,
    // Authenticated traffic is counted per user; anonymous traffic per IP.
    keyGenerator: (request: FastifyRequest) => request.user?.id ?? request.ip,
    // Rate limiting must never be the reason a legitimate request fails open silently.
    skipOnError: false,
    errorResponseBuilder: (request, context) => ({
      error: {
        code: 'RATE_LIMITED',
        message: `Trop de requêtes. Réessayez dans ${context.after}.`,
        requestId: request.requestId,
      },
    }),
  });
}, { name: 'rate-limit', dependencies: ['request-context'] });
