import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError, isAppError } from '../errors.js';

/**
 * Single error funnel.
 *
 * Client errors carry a readable French message; server errors return a generic message plus
 * the request id, and the real cause is logged. No stack trace, SQL fragment or upstream
 * payload ever reaches the client.
 */
export const errorHandlerPlugin = fp(async (app: FastifyInstance) => {
  app.setNotFoundHandler(async (request, reply) => {
    return reply.status(404).send({
      error: {
        code: 'NOT_FOUND',
        message: 'Ressource introuvable',
        requestId: request.requestId,
      },
    });
  });

  app.setErrorHandler(async (error, request, reply) => {
    if (isAppError(error)) {
      if (error.statusCode >= 500) {
        request.log.error({ err: error, requestId: request.requestId }, error.message);
      } else {
        request.log.debug({ code: error.code, requestId: request.requestId }, error.message);
      }
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.expose ? error.message : 'Une erreur est survenue.',
          requestId: request.requestId,
          ...(error.details ? { details: error.details } : {}),
        },
      });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Requête invalide',
          requestId: request.requestId,
          details: error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
      });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002: unique constraint. Surface it as a conflict rather than a 500, but never echo
      // the column names, which would describe the schema to an attacker.
      if (error.code === 'P2002') {
        request.log.warn({ prismaCode: error.code, requestId: request.requestId }, 'unique conflict');
        return reply.status(409).send({
          error: {
            code: 'CONFLICT',
            message: 'Cette ressource existe déjà.',
            requestId: request.requestId,
          },
        });
      }
      if (error.code === 'P2025') {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Ressource introuvable',
            requestId: request.requestId,
          },
        });
      }
    }

    const statusCode = typeof (error as { statusCode?: unknown }).statusCode === 'number'
      ? ((error as { statusCode: number }).statusCode)
      : null;

    if (statusCode === 429) {
      return reply.status(429).send({
        error: {
          code: 'RATE_LIMITED',
          message: 'Trop de requêtes. Réessayez dans quelques instants.',
          requestId: request.requestId,
        },
      });
    }

    if (statusCode !== null && statusCode >= 400 && statusCode < 500) {
      return reply.status(statusCode).send({
        error: {
          code: statusCode === 401 ? 'UNAUTHORIZED' : 'VALIDATION_ERROR',
          message: (error as Error).message || 'Requête invalide',
          requestId: request.requestId,
        },
      });
    }

    request.log.error({ err: error, requestId: request.requestId }, 'unhandled error');
    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Une erreur est survenue.',
        requestId: request.requestId,
      },
    });
  });

  app.decorate('AppError', AppError);
}, { name: 'error-handler' });
