import type { FastifyInstance } from 'fastify';
import {
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
} from '@nova/validation';
import { parseInput } from '../../http/validate.js';
import { requireUser } from '../../http/plugins/authenticate.js';
import { hashIp } from './tokens.js';
import { rateLimitConfig } from '../../http/plugins/rate-limit.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const { auth, env, analytics, users } = app.nova;

  const contextOf = (request: Parameters<typeof requireUser>[0]) => ({
    ipHash: hashIp(request.ip, env.JWT_SECRET),
    userAgent: request.headers['user-agent'] ?? null,
  });

  app.post(
    '/auth/register',
    { config: rateLimitConfig(env, 'register') },
    async (request, reply) => {
      const input = parseInput(registerSchema, request.body);
      const result = await auth.register(input, contextOf(request));
      await analytics.track({ event: 'signup_completed', userRef: result.user.id });
      return reply.status(201).send(result);
    },
  );

  app.post('/auth/login', { config: rateLimitConfig(env, 'login') }, async (request) => {
    const input = parseInput(loginSchema, request.body);
    return auth.login(input, contextOf(request));
  });

  app.post('/auth/refresh', async (request) => {
    const input = parseInput(refreshSchema, request.body);
    return auth.refresh(input.refreshToken, contextOf(request));
  });

  app.post('/auth/logout', async (request, reply) => {
    const input = parseInput(logoutSchema, request.body ?? {});
    await app.optionalAuthenticate(request);
    await auth.logout(input.refreshToken, request.user?.id ?? null);
    return reply.status(204).send();
  });

  app.post(
    '/auth/forgot-password',
    { config: rateLimitConfig(env, 'passwordReset') },
    async (request, reply) => {
      const input = parseInput(forgotPasswordSchema, request.body);
      await app.nova.users.requestPasswordReset(input.email, contextOf(request).ipHash);
      // Always 202 with the same body: the response must not reveal whether an account exists.
      return reply.status(202).send({
        message:
          'Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d’être envoyé.',
      });
    },
  );

  app.post(
    '/auth/reset-password',
    { config: rateLimitConfig(env, 'passwordReset') },
    async (request, reply) => {
      const input = parseInput(resetPasswordSchema, request.body);
      await users.resetPassword(input.token, input.password);
      return reply.status(204).send();
    },
  );

  app.get('/auth/me', { onRequest: app.authenticate }, async (request) => {
    const user = requireUser(request);
    const [session, subscription] = await Promise.all([
      auth.getSession(user.id),
      app.nova.subscriptions.getState(user.id),
    ]);
    return { ...session, subscription };
  });
}
