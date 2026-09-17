import { randomUUID } from 'node:crypto';
import { AppError } from '@/lib/errors';
import {
  ACCEPTED_EXTENSIONS,
  ACCEPTED_MIME_TYPES,
  EXTENSION_BY_MIME,
  MIN_UPLOAD_BYTES,
  formatBytes,
  type AcceptedMimeType,
} from './upload-limits';

/**
 * Server-side upload validation (§42).
 *
 * A browser-declared MIME type is a suggestion, and a file extension is a
 * rumour. The real check is the magic-byte signature: what we hand the vision
 * model — and what we store — must actually be one of the three image formats
 * we support.
 */

export { ACCEPTED_EXTENSIONS, ACCEPTED_MIME_TYPES, formatBytes };
export type { AcceptedMimeType };

/** Detects the real format from the file header, ignoring the declared type. */
export function sniffImageMimeType(data: Buffer): AcceptedMimeType | null {
  if (data.length < 12) return null;

  // JPEG: FF D8 FF
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (PNG.every((byte, index) => data[index] === byte)) return 'image/png';

  // WEBP: "RIFF" .... "WEBP"
  if (data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP')
    return 'image/webp';

  return null;
}

export interface ValidatedUpload {
  data: Buffer;
  mimeType: AcceptedMimeType;
  bytes: number;
  /** Random, server-generated storage key. The client filename is never reused. */
  key: string;
}

export interface ValidateUploadOptions {
  userId: string;
  maxBytes: number;
  /** Filename as sent by the browser. Used for an early extension check only. */
  filename?: string | undefined;
  /** MIME type as declared by the browser. Used for an early check only. */
  declaredMimeType?: string | undefined;
}

export function validateUpload(data: Buffer, options: ValidateUploadOptions): ValidatedUpload {
  if (data.length > options.maxBytes) {
    throw new AppError(
      'upload_too_large',
      `Cette image fait ${formatBytes(data.length)}. La limite est de ${formatBytes(options.maxBytes)}.`,
    );
  }

  if (data.length < MIN_UPLOAD_BYTES) {
    throw new AppError(
      'upload_invalid',
      'Ce fichier est trop petit pour contenir un graphique lisible.',
    );
  }

  if (options.filename) {
    const extension = options.filename.split('.').pop()?.toLowerCase() ?? '';
    if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(extension)) {
      throw new AppError('upload_invalid', 'Formats acceptés : JPG, JPEG, PNG ou WEBP.');
    }
  }

  if (
    options.declaredMimeType &&
    !(ACCEPTED_MIME_TYPES as readonly string[]).includes(options.declaredMimeType)
  ) {
    throw new AppError('upload_invalid', 'Formats acceptés : JPG, JPEG, PNG ou WEBP.');
  }

  const mimeType = sniffImageMimeType(data);
  if (!mimeType) {
    throw new AppError(
      'upload_invalid',
      "Ce fichier n'est pas une image JPG, PNG ou WEBP valide. Vérifie le fichier puis réessaie.",
    );
  }

  return {
    data,
    mimeType,
    bytes: data.length,
    key: buildStorageKey(options.userId, mimeType),
  };
}

/**
 * `analyses/<userId>/<uuid>.<ext>`.
 *
 * The user id prefix makes bucket-level auditing trivial; the UUID means a key
 * is never guessable and never derived from anything the client controls.
 */
export function buildStorageKey(userId: string, mimeType: AcceptedMimeType): string {
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (safeUserId.length === 0)
    throw new AppError('internal_error', 'Identifiant utilisateur invalide.');
  return `analyses/${safeUserId}/${randomUUID()}.${EXTENSION_BY_MIME[mimeType]}`;
}
