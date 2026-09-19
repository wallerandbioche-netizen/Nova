import type { ErrorCode, ProjectError } from '@/types/domain';

/**
 * Erreur porteuse d'un message déjà rédigé pour l'utilisateur.
 * Tout ce qui remonte jusqu'à l'UI passe par cette classe : aucune trace
 * technique ne doit franchir la frontière.
 */
export class AtriumError extends Error {
  readonly code: ErrorCode;
  /** Détail technique, journalisé côté serveur, jamais renvoyé au client. */
  readonly detail: string | undefined;

  constructor(code: ErrorCode, message: string, detail?: string) {
    super(message);
    this.name = 'AtriumError';
    this.code = code;
    this.detail = detail;
  }

  toProjectError(): ProjectError {
    return { code: this.code, message: this.message };
  }
}

export const USER_MESSAGES: Record<ErrorCode, string> = {
  INVALID_URL: 'Ce lien ne semble pas être une annonce valide.',
  SOURCE_UNAVAILABLE: 'Nous n’avons pas pu récupérer les photos de cette annonce.',
  NOT_ENOUGH_PHOTOS:
    "Cette annonce ne contient pas suffisamment de photos pour créer une vidéo.",
  RENDER_FAILED: 'Une erreur est survenue. Veuillez réessayer.',
  FFMPEG_MISSING: 'Le moteur vidéo est indisponible. Veuillez réessayer plus tard.',
  UNKNOWN: 'Une erreur est survenue. Veuillez réessayer.',
};

export function atriumError(code: ErrorCode, detail?: string, message?: string): AtriumError {
  return new AtriumError(code, message ?? USER_MESSAGES[code], detail);
}

/** Ramène n'importe quelle exception à une erreur présentable. */
export function toProjectError(error: unknown): ProjectError {
  if (error instanceof AtriumError) return error.toProjectError();
  return { code: 'UNKNOWN', message: USER_MESSAGES.UNKNOWN };
}

export function describe(error: unknown): string {
  if (error instanceof Error) return error.stack ?? `${error.name}: ${error.message}`;
  return String(error);
}
