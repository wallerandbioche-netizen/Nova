import { NextResponse } from 'next/server';
import { AppError } from '@/lib/errors';
import { getStorage } from '@/lib/storage';
import { prisma } from '@/lib/db/prisma';
import { requireViewer } from '@/server/session';
import { route } from '@/server/http';

export const runtime = 'nodejs';

type Context = { params: Promise<{ id: string }> };

/**
 * GET /api/analyses/:id/image
 *
 * The only way a chart screenshot reaches a browser. Ownership is checked
 * against the database on every request; the bucket itself is private, so a
 * leaked object key is not a leaked image (§37 / §42).
 */
export const GET = route('analyses.image', async (_request: Request, context: Context) => {
  const viewer = await requireViewer();
  const { id } = await context.params;

  const analysis = await prisma.analysis.findFirst({
    where: { id, userId: viewer.id },
    select: { imageKey: true, imageMimeType: true },
  });
  if (!analysis) throw AppError.notFound("Cette image n'existe pas ou a été supprimée.");

  const storage = getStorage();

  // A signing driver hands the browser a short-lived URL; otherwise we proxy.
  const signedUrl = await storage.createViewUrl(analysis.imageKey);
  if (signedUrl) {
    return NextResponse.redirect(signedUrl, { status: 307 });
  }

  const object = await storage.getObject(analysis.imageKey);
  return new NextResponse(new Uint8Array(object.data), {
    status: 200,
    headers: {
      'content-type': analysis.imageMimeType || object.contentType,
      'content-length': String(object.data.byteLength),
      'cache-control': 'private, no-store',
      'content-disposition': 'inline',
    },
  });
});
