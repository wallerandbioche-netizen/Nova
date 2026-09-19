import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { DEMO_FOLDER } from '@/lib/listing/demo';
import { ensureSamplePhotos } from '@/lib/samples/generate';

export const runtime = 'nodejs';

/**
 * Sert les photos de démonstration utilisées par la page d'accueil. Elles sont
 * générées à la volée : rien d'autre que du code n'est versionné.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ file: string }> },
): Promise<Response> {
  const { file } = await context.params;
  if (!/^photo_\d{2}\.jpg$/.test(file)) return new NextResponse(null, { status: 404 });

  await ensureSamplePhotos(DEMO_FOLDER);
  const data = await fs.readFile(path.join(DEMO_FOLDER, file)).catch(() => null);
  if (!data) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(data), {
    headers: {
      'content-type': 'image/jpeg',
      'cache-control': 'public, max-age=86400, immutable',
    },
  });
}
