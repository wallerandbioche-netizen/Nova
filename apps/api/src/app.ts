import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import compress from '@fastify/compress';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { Logger } from 'pino';
import { corsOrigins, getEnv, isProduction, type Env } from './config/env.js';
import { buildContainer, type NovaContainer } from './container.js';
import { createCache, type Cache } from './infrastructure/cache/index.js';
import { getPrismaClient, type Database } from './infrastructure/database/prisma.js';
import { createLogger } from './infrastructure/logger.js';
import { authenticatePlugin } from './http/plugins/authenticate.js';
import { errorHandlerPlugin } from './http/plugins/error-handler.js';
import { rateLimitPlugin } from './http/plugins/rate-limit.js';
import { requestContextPlugin } from './http/plugins/request-context.js';
import { registerRoutes } from './http/routes.js';

export interface BuildAppOptions {
  env?: Env;
  db?: Database;
  cache?: Cache;
  logger?: Logger;
  /** Skips OpenAPI generation in tests, where it only costs time. */
  withDocs?: boolean;
}

const containerPlugin = (container: NovaContainer) =>
  fp(
    async (app: FastifyInstance) => {
      app.decorate('nova', container);
    },
    { name: 'container' },
  );

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const env = options.env ?? getEnv();
  const logger = options.logger ?? createLogger();
  const db = options.db ?? getPrismaClient();
  const cache = options.cache ?? createCache(env, logger);

  const container = buildContainer({ env, db, cache, logger });

  // Fastify parameterises its instance type on the concrete logger; our plugins are written
  // against the default instance type, so the instance is normalised once here.
  const app = Fastify({
    loggerInstance: logger,
    // Request logging is handled by our own onResponse hook, which adds the request id and
    // the route pattern. (`logController` in Fastify 6 will replace this flag.)
    disableRequestLogging: true,
    trustProxy: true,
    bodyLimit: 1_000_000,
    ajv: { customOptions: { removeAdditional: 'all' } },
  }) as unknown as FastifyInstance;

  /**
   * Keep the raw JSON body alongside the parsed one.
   *
   * A provider webhook signature covers the exact bytes that were sent: re-serialising the
   * parsed object would produce different bytes (key order, spacing) and the signature would
   * never verify. The body limit above bounds what this retains.
   */
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    (request as FastifyRequest & { rawBody?: string }).rawBody = body as string;
    try {
      done(null, (body as string).length > 0 ? JSON.parse(body as string) : {});
    } catch (error) {
      (error as Error & { statusCode?: number }).statusCode = 400;
      done(error as Error, undefined);
    }
  });

  await app.register(containerPlugin(container));
  await app.register(requestContextPlugin);
  await app.register(errorHandlerPlugin);

  await app.register(helmet, {
    // The API serves JSON to a native app; a strict CSP is harmless and blocks doc-page abuse.
    contentSecurityPolicy: isProduction(env)
      ? { directives: { defaultSrc: ["'self'"], frameAncestors: ["'none'"] } }
      : false,
    hsts: isProduction(env) ? { maxAge: 31_536_000, includeSubDomains: true } : false,
  });

  const origins = corsOrigins(env);
  await app.register(cors, {
    // No origin configured means native clients only, which do not send an Origin header.
    origin: origins.length > 0 ? origins : false,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  await app.register(compress, { global: true, threshold: 1024, encodings: ['gzip', 'br'] });
  await app.register(authenticatePlugin);
  await app.register(rateLimitPlugin);

  if (options.withDocs ?? env.NODE_ENV !== 'test') {
    await app.register(swagger, {
      openapi: {
        info: {
          title: 'NOVA API',
          description:
            'API de NOVA — copilote personnel pour comprendre ses investissements. Toutes les routes /v1 sauf indication contraire.',
          version: '0.1.0',
        },
        servers: [{ url: `http://localhost:${env.API_PORT}`, description: 'local' }],
        components: {
          securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          },
        },
      },
    });
    await app.register(swaggerUi, { routePrefix: '/docs', uiConfig: { docExpansion: 'list' } });
  }

  await registerRoutes(app);

  app.addHook('onClose', async () => {
    await cache.close();
  });

  return app;
}
