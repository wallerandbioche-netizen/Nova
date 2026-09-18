import type { NextRequest } from 'next/server';
import { getEnv } from '@/lib/config/env';
import { AppError } from '@/lib/errors';
import { route } from '@/lib/http';
import { getStorage, verifyKeySignature } from '@/lib/storage';

interface Context {
  params: Promise<{ key: string[] }>;
}

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp4: 'video/mp4',
};

/**
 * Serves privately stored files behind a short-lived HMAC signature.
 *
 * Local storage has no presigned URLs of its own, so this route provides the same guarantee:
 * the link expires, cannot be forged, and cannot be pointed at another user's object — the
 * signature covers the exact key.
 */
export const GET = route(async (request: NextRequest, context: Context) => {
  const { key: segments } = await context.params;
  const key = segments.map(decodeURIComponent).join('/');
  const url = new URL(request.url);
  const expires = Number(url.searchParams.get('expires') ?? '0');
  const signature = url.searchParams.get('signature') ?? '';

  if (!verifyKeySignature(getEnv().AUTH_SECRET, key, expires, signature)) {
    throw new AppError('FORBIDDEN', 'Lien expiré ou invalide.');
  }

  const body = await getStorage().get(key);
  const extension = key.split('.').pop()?.toLowerCase() ?? '';
  const isDownload = url.searchParams.get('download') === '1';

  return new Response(new Uint8Array(body), {
    headers: {
      'content-type': CONTENT_TYPES[extension] ?? 'application/octet-stream',
      'content-length': String(body.byteLength),
      'cache-control': 'private, max-age=600',
      ...(isDownload
        ? { 'content-disposition': `attachment; filename="${key.split('/').pop() ?? 'fichier'}"` }
        : {}),
    },
  });
});
