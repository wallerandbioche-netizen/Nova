import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage/local';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONTENT_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/**
 * Sert les fichiers produits pour un projet.
 *
 * Les requêtes partielles sont prises en charge : sans elles, Safari refuse de
 * lire une vidéo et aucun navigateur ne permet de se déplacer dedans.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path: segments } = await context.params;
  const [projectId, ...rest] = segments;
  if (!projectId || rest.length === 0) return new NextResponse(null, { status: 404 });

  let absolute: string;
  try {
    // `resolve` refuse toute clé qui sortirait du répertoire du projet.
    absolute = storage().resolve(projectId, rest.join('/'));
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const stat = await fs.stat(absolute).catch(() => null);
  if (!stat?.isFile()) return new NextResponse(null, { status: 404 });

  const contentType = CONTENT_TYPES[path.extname(absolute).toLowerCase()] ?? 'application/octet-stream';
  const headers = new Headers({
    'content-type': contentType,
    'accept-ranges': 'bytes',
    'cache-control': 'private, max-age=3600',
  });

  if (request.method === 'HEAD') {
    headers.set('content-length', String(stat.size));
    return new NextResponse(null, { status: 200, headers });
  }

  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '');
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
    if (Number.isNaN(start) || start > end || start >= stat.size) {
      headers.set('content-range', `bytes */${stat.size}`);
      return new NextResponse(null, { status: 416, headers });
    }

    headers.set('content-range', `bytes ${start}-${end}/${stat.size}`);
    headers.set('content-length', String(end - start + 1));
    const stream = Readable.toWeb(
      createReadStream(absolute, { start, end }),
    ) as unknown as ReadableStream;
    return new NextResponse(stream, { status: 206, headers });
  }

  headers.set('content-length', String(stat.size));
  const stream = Readable.toWeb(createReadStream(absolute)) as unknown as ReadableStream;
  return new NextResponse(stream, { status: 200, headers });
}

export { GET as HEAD };
