import { randomUUID } from 'node:crypto';
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    /** Correlation id echoed to the client and present in every log line of the request. */
    requestId: string;
  }
}

/**
 * Attaches a request id and records request duration.
 *
 * The id is the only technical detail a user ever sees on a 500: it lets support find the
 * matching log without exposing an internal message (rule #44).
 */
export const requestContextPlugin = fp(async (app: FastifyInstance) => {
  app.addHook('onRequest', async (request, reply) => {
    const incoming = request.headers['x-request-id'];
    request.requestId =
      typeof incoming === 'string' && incoming.length <= 64 && /^[\w-]+$/.test(incoming)
        ? incoming
        : randomUUID();
    reply.header('x-request-id', request.requestId);
  });

  app.addHook('onResponse', async (request, reply) => {
    request.log.info(
      {
        requestId: request.requestId,
        method: request.method,
        route: request.routeOptions?.url ?? request.url,
        status: reply.statusCode,
        durationMs: Math.round(reply.elapsedTime),
      },
      'request completed',
    );
  });
}, { name: 'request-context' });
