/**
 * Application error taxonomy.
 *
 * Every error that can reach a client carries a stable `code`, an HTTP status
 * and a French sentence written for a human. Stack traces stay server-side
 * (§46).
 */

export type AppErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'validation_error'
  | 'conflict'
  | 'rate_limited'
  | 'subscription_required'
  | 'quota_exceeded'
  | 'upload_invalid'
  | 'upload_too_large'
  | 'ai_unavailable'
  | 'ai_timeout'
  | 'ai_invalid_response'
  | 'analysis_in_progress'
  | 'storage_error'
  | 'billing_error'
  | 'configuration_error'
  | 'internal_error';

const STATUS: Record<AppErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  validation_error: 422,
  conflict: 409,
  rate_limited: 429,
  subscription_required: 402,
  quota_exceeded: 429,
  upload_invalid: 415,
  upload_too_large: 413,
  ai_unavailable: 503,
  ai_timeout: 504,
  ai_invalid_response: 502,
  analysis_in_progress: 409,
  storage_error: 502,
  billing_error: 502,
  configuration_error: 500,
  internal_error: 500,
};

const DEFAULT_MESSAGE: Record<AppErrorCode, string> = {
  unauthenticated: 'Ta session a expiré. Reconnecte-toi pour continuer.',
  forbidden: "Tu n'as pas accès à cette ressource.",
  not_found: "Cette ressource n'existe pas ou a été supprimée.",
  validation_error: 'Certaines informations envoyées sont invalides.',
  conflict: 'Cette action entre en conflit avec l’état actuel du compte.',
  rate_limited: 'Trop de requêtes en peu de temps. Réessaie dans un instant.',
  subscription_required: 'Un abonnement Scan Trade Pro actif est nécessaire pour lancer un scan.',
  quota_exceeded: "Tu as atteint la limite d'analyses de la période en cours.",
  upload_invalid: "Ce fichier n'est pas une image de graphique exploitable (JPG, PNG ou WEBP attendus).",
  upload_too_large: 'Cette image est trop lourde. Réduis sa taille puis réessaie.',
  ai_unavailable: "Le service d'analyse est momentanément indisponible. Réessaie dans quelques minutes.",
  ai_timeout: "L'analyse a pris trop de temps. Réessaie avec une capture plus lisible.",
  ai_invalid_response: 'Analyse indisponible — les données générées sont incohérentes.',
  analysis_in_progress: 'Cette analyse est déjà en cours de traitement.',
  storage_error: "Impossible d'accéder à l'image pour le moment. Réessaie dans un instant.",
  billing_error: "La facturation est momentanément indisponible. Réessaie dans quelques minutes.",
  configuration_error: "Le service n'est pas correctement configuré. L'équipe a été alertée.",
  internal_error: "Une erreur inattendue s'est produite. Réessaie dans un instant.",
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  /** Extra, non-sensitive context returned to the client (field errors, retry hints). */
  readonly details: Record<string, unknown> | undefined;

  constructor(code: AppErrorCode, message?: string, details?: Record<string, unknown>) {
    super(message ?? DEFAULT_MESSAGE[code]);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }

  static unauthenticated(message?: string): AppError {
    return new AppError('unauthenticated', message);
  }

  static forbidden(message?: string): AppError {
    return new AppError('forbidden', message);
  }

  static notFound(message?: string): AppError {
    return new AppError('not_found', message);
  }

  static validation(message?: string, details?: Record<string, unknown>): AppError {
    return new AppError('validation_error', message, details);
  }

  toJSON(): { error: { code: AppErrorCode; message: string; details?: Record<string, unknown> } } {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

export function defaultMessageFor(code: AppErrorCode): string {
  return DEFAULT_MESSAGE[code];
}
