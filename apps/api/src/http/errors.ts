import type { ApiErrorCode } from '@nova/types';

/**
 * Application error carrying the HTTP status and the public error code.
 *
 * `publicMessage` is what the user sees; anything diagnostic goes to `details` (logged, and
 * only echoed for validation errors). A 500 never leaks an internal message (rule #44).
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ApiErrorCode;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(
    code: ApiErrorCode,
    message: string,
    statusCode: number,
    options: { details?: unknown; expose?: boolean; cause?: unknown } = {},
  ) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = options.details;
    this.expose = options.expose ?? statusCode < 500;
  }
}

export const badRequest = (message = 'Requête invalide', details?: unknown) =>
  new AppError('VALIDATION_ERROR', message, 400, { details });

export const unauthorized = (message = 'Authentification requise') =>
  new AppError('UNAUTHORIZED', message, 401);

export const forbidden = (message = 'Accès refusé') => new AppError('FORBIDDEN', message, 403);

export const notFound = (message = 'Ressource introuvable') =>
  new AppError('NOT_FOUND', message, 404);

export const conflict = (message = 'Conflit avec l’état actuel de la ressource') =>
  new AppError('CONFLICT', message, 409);

export const rateLimited = (message = 'Trop de requêtes. Réessayez dans quelques instants.') =>
  new AppError('RATE_LIMITED', message, 429);

export const featureNotAvailable = (
  message = 'Cette fonctionnalité nécessite un abonnement NOVA Premium.',
) => new AppError('FEATURE_NOT_AVAILABLE', message, 403);

export const upstreamUnavailable = (
  message = 'Le service de données est momentanément indisponible.',
  cause?: unknown,
) => new AppError('UPSTREAM_UNAVAILABLE', message, 503, { cause });

export const internalError = (cause?: unknown) =>
  new AppError('INTERNAL_ERROR', 'Une erreur est survenue.', 500, { cause, expose: false });

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
