/**
 * Upload rules shared by the browser and the server.
 *
 * Kept free of any Node import so the client bundle can state the same limits
 * the server enforces, without pulling `node:crypto` into the browser build.
 * The real validation still happens server-side in `./upload`.
 */

export type AcceptedMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export const ACCEPTED_MIME_TYPES: readonly AcceptedMimeType[] = ['image/jpeg', 'image/png', 'image/webp'];

export const ACCEPTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;

/** Anything smaller than this cannot hold a readable chart. */
export const MIN_UPLOAD_BYTES = 1024;

export const EXTENSION_BY_MIME: Record<AcceptedMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
