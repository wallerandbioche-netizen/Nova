import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { forbidden, unauthorized } from '../errors.js';
import { verifyAccessToken } from '../../modules/auth/tokens.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Set only by `authenticate`; the identity always comes from the verified token. */
    user?: AuthenticatedUser;
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
    optionalAuthenticate: (request: FastifyRequest) => Promise<void>;
  }
}

function extractBearer(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header || typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

/**
 * Authentication.
 *
 * `request.user` is derived exclusively from the signed token. A `userId` present in a body,
 * a query string or a header is never trusted (rule #31).
 */
export const authenticatePlugin = fp(async (app: FastifyInstance) => {
  const { env, db } = app.nova;

  app.decorate('authenticate', async (request: FastifyRequest) => {
    const token = extractBearer(request);
    if (!token) throw unauthorized('Authentification requise');

    const claims = await verifyAccessToken(env, token);

    // A deleted account keeps valid tokens until they expire; check the account each time.
    const user = await db.user.findFirst({
      where: { id: claims.sub, deletedAt: null },
      select: { id: true, email: true },
    });
    if (!user) throw unauthorized('Session invalide. Reconnectez-vous.');

    request.user = user;
  });

  app.decorate('optionalAuthenticate', async (request: FastifyRequest) => {
    if (!extractBearer(request)) return;
    try {
      await app.authenticate(request);
    } catch {
      // An invalid token on a public route means "anonymous", not an error.
      request.user = undefined;
    }
  });
}, { name: 'authenticate' });

/** Returns the authenticated user or throws — never returns undefined to a handler. */
export function requireUser(request: FastifyRequest): AuthenticatedUser {
  if (!request.user) throw unauthorized('Authentification requise');
  return request.user;
}

/** Ownership guard used by every resource lookup. */
export function assertOwnership(resourceUserId: string, requestUserId: string): void {
  if (resourceUserId !== requestUserId) {
    // 404 rather than 403 would hide existence, but the resource id is already a UUID the
    // caller had to know; an explicit 403 is clearer and is audited.
    throw forbidden('Vous n’avez pas accès à cette ressource.');
  }
}
