/**
 * Every failure the user can hit has a stable code and a sentence they can act on.
 * The UI never shows a stack trace, and never invents a reason.
 */
export type AppErrorCode =
  | 'INVALID_URL'
  | 'UNSUPPORTED_PLATFORM'
  | 'IMPORT_BLOCKED'
  | 'NO_IMAGES_FOUND'
  | 'IMAGES_UNREACHABLE'
  | 'RESOLUTION_TOO_LOW'
  | 'NOT_ENOUGH_IMAGES'
  | 'RENDER_FAILED'
  | 'RENDER_TIMEOUT'
  | 'STORAGE_UNAVAILABLE'
  | 'INSUFFICIENT_CREDITS'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'RATE_LIMITED'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'CONFLICT'
  | 'INTERNAL';

const MESSAGES: Record<AppErrorCode, string> = {
  INVALID_URL: "Ce lien n'est pas une URL valide. Vérifiez qu'il commence par https://",
  UNSUPPORTED_PLATFORM:
    "Nous ne reconnaissons pas encore cette plateforme. Vous pouvez importer les photos manuellement pour continuer.",
  IMPORT_BLOCKED:
    "Nous n'avons pas réussi à récupérer automatiquement les photos de cette annonce. Vous pouvez les importer manuellement pour continuer.",
  NO_IMAGES_FOUND:
    "Aucune photo exploitable n'a été trouvée sur cette page. Importez vos photos manuellement pour continuer.",
  IMAGES_UNREACHABLE:
    "Les photos de cette annonce ne sont pas accessibles depuis nos serveurs. Importez-les manuellement pour continuer.",
  RESOLUTION_TOO_LOW:
    'Ces photos sont trop petites pour une vidéo de qualité (minimum 640 px de large).',
  NOT_ENOUGH_IMAGES: 'Il faut au moins 3 photos pour créer une vidéo.',
  RENDER_FAILED: "Le rendu de la vidéo a échoué. Vos crédits n'ont pas été débités.",
  RENDER_TIMEOUT: "Le rendu a pris trop de temps et a été interrompu. Vos crédits n'ont pas été débités.",
  STORAGE_UNAVAILABLE: 'Le stockage est momentanément indisponible. Réessayez dans un instant.',
  INSUFFICIENT_CREDITS: "Vous n'avez pas assez de crédits pour générer cette vidéo.",
  UNAUTHORIZED: 'Connectez-vous pour continuer.',
  FORBIDDEN: "Vous n'avez pas accès à cette ressource.",
  NOT_FOUND: 'Cette ressource est introuvable.',
  VALIDATION_FAILED: 'Les informations envoyées sont invalides.',
  RATE_LIMITED: 'Trop de requêtes. Patientez quelques instants avant de réessayer.',
  FILE_TOO_LARGE: 'Ce fichier dépasse la taille maximale autorisée.',
  UNSUPPORTED_FILE_TYPE: 'Formats acceptés : JPG, JPEG, PNG et WebP.',
  CONFLICT: 'Cette action entre en conflit avec une opération en cours.',
  INTERNAL: "Une erreur inattendue s'est produite. Réessayez dans un instant.",
};

const STATUS: Partial<Record<AppErrorCode, number>> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_FAILED: 422,
  RATE_LIMITED: 429,
  FILE_TOO_LARGE: 413,
  UNSUPPORTED_FILE_TYPE: 415,
  INSUFFICIENT_CREDITS: 402,
  INTERNAL: 500,
  RENDER_FAILED: 500,
  STORAGE_UNAVAILABLE: 503,
};

export interface AppErrorOptions {
  /** Optional action the UI can offer, e.g. a manual upload fallback. */
  recovery?: 'MANUAL_UPLOAD' | 'BUY_CREDITS' | 'RETRY' | null;
  details?: unknown;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly recovery: AppErrorOptions['recovery'];
  readonly details: unknown;

  constructor(code: AppErrorCode, message?: string, options: AppErrorOptions = {}) {
    super(message ?? MESSAGES[code], options.cause ? { cause: options.cause } : undefined);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS[code] ?? 400;
    this.recovery = options.recovery ?? defaultRecovery(code);
    this.details = options.details;
  }

  toJSON() {
    return {
      error: { code: this.code, message: this.message, recovery: this.recovery ?? undefined },
    };
  }
}

function defaultRecovery(code: AppErrorCode): AppErrorOptions['recovery'] {
  switch (code) {
    case 'UNSUPPORTED_PLATFORM':
    case 'IMPORT_BLOCKED':
    case 'NO_IMAGES_FOUND':
    case 'IMAGES_UNREACHABLE':
      return 'MANUAL_UPLOAD';
    case 'INSUFFICIENT_CREDITS':
      return 'BUY_CREDITS';
    case 'RENDER_FAILED':
    case 'RENDER_TIMEOUT':
    case 'STORAGE_UNAVAILABLE':
      return 'RETRY';
    default:
      return null;
  }
}

export function messageForCode(code: AppErrorCode): string {
  return MESSAGES[code];
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
