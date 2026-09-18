import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { clientKey, ok, route } from '@/lib/http';
import { RATE_LIMITS, rateLimit } from '@/lib/rate-limit';
import { requireUser } from '@/lib/auth/session';
import { getEnv } from '@/lib/config/env';
import { requireListing, suggestSelection } from '@/server/listings';
import { assertUploadAcceptable, ingestImage, markDuplicates } from '@/server/images';
import { serialiseListing } from '@/server/serializers';
import { getStorage } from '@/lib/storage';

interface Context {
  params: Promise<{ id: string }>;
}

/** POST /api/listings/:id/images — manual upload, the fallback when an import cannot work. */
export const POST = route(async (request: NextRequest, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;
  rateLimit(clientKey(request, `upload:${user.id}`), RATE_LIMITS.upload);

  const listing = await requireListing(user.id, id);
  const env = getEnv();

  const form = await request.formData();
  const files = form.getAll('files').filter((entry): entry is File => entry instanceof File);
  if (files.length === 0) throw new AppError('VALIDATION_FAILED', 'Aucun fichier reçu.');
  if (listing.images.length + files.length > env.MAX_IMAGES_PER_LISTING) {
    throw new AppError(
      'VALIDATION_FAILED',
      `Maximum ${env.MAX_IMAGES_PER_LISTING} photos par annonce.`,
    );
  }

  let sortOrder = listing.images.length;
  for (const file of files) {
    assertUploadAcceptable({ size: file.size, type: file.type });
    await ingestImage({
      userId: user.id,
      listingId: listing.id,
      buffer: Buffer.from(await file.arrayBuffer()),
      hint: file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' '),
      sortOrder,
    });
    sortOrder += 1;
  }

  await markDuplicates(listing.id);
  if (listing.status !== 'READY') {
    await prisma.listing.update({
      where: { id: listing.id },
      data: { status: 'READY', importedAt: listing.importedAt ?? new Date() },
    });
  }

  const updated = await requireListing(user.id, id);
  return ok(
    {
      listing: await serialiseListing(updated),
      suggestedSelection: suggestSelection(updated.images),
    },
    201,
  );
});

/** DELETE /api/listings/:id/images?imageId=... — removes one photo and its stored bytes. */
export const DELETE = route(async (request: NextRequest, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;
  const imageId = new URL(request.url).searchParams.get('imageId');
  if (!imageId) throw new AppError('VALIDATION_FAILED', 'imageId manquant.');

  const image = await prisma.listingImage.findFirst({
    where: { id: imageId, listing: { id, userId: user.id } },
  });
  if (!image) throw new AppError('NOT_FOUND');

  const storage = getStorage();
  await storage.delete(image.storageKey).catch(() => {});
  if (image.thumbnailKey) await storage.delete(image.thumbnailKey).catch(() => {});
  await prisma.listingImage.delete({ where: { id: image.id } });

  const updated = await requireListing(user.id, id);
  return ok({
    listing: await serialiseListing(updated),
    suggestedSelection: suggestSelection(updated.images),
  });
});
