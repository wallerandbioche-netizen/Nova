import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { newId } from '@/lib/id';
import { logger } from '@/lib/logger';
import { USER_MESSAGES, describe } from '@/lib/errors';
import { prepareUploadDir } from '@/services/pipeline';
import type { UploadResponse } from '@/types/api';

const log = logger('api');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILES = 40;
const MAX_BYTES = 16 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/tiff': '.tif',
};

/**
 * Import direct de photos. C'est la voie qui fonctionne toujours, quelles que
 * soient les conditions d'accès aux annonces en ligne.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const form = await request.formData();
    const files = form
      .getAll('photos')
      .filter((entry): entry is File => entry instanceof File)
      .slice(0, MAX_FILES);

    if (files.length < 3) {
      return NextResponse.json(
        { error: { code: 'NOT_ENOUGH_PHOTOS', message: USER_MESSAGES.NOT_ENOUGH_PHOTOS } },
        { status: 400 },
      );
    }

    const uploadId = newId('up');
    const directory = await prepareUploadDir(uploadId);
    let stored = 0;

    for (const [index, file] of files.entries()) {
      const extension = EXTENSIONS[file.type];
      if (!extension || file.size > MAX_BYTES || file.size === 0) continue;
      const name = `photo_${String(index + 1).padStart(2, '0')}${extension}`;
      await fs.writeFile(path.join(directory, name), Buffer.from(await file.arrayBuffer()));
      stored += 1;
    }

    if (stored < 3) {
      await fs.rm(directory, { recursive: true, force: true });
      return NextResponse.json(
        { error: { code: 'NOT_ENOUGH_PHOTOS', message: USER_MESSAGES.NOT_ENOUGH_PHOTOS } },
        { status: 400 },
      );
    }

    const response: UploadResponse = { uploadId, photoCount: stored };
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    log.error('import en échec', describe(error));
    return NextResponse.json(
      { error: { code: 'UNKNOWN', message: USER_MESSAGES.UNKNOWN } },
      { status: 500 },
    );
  }
}
