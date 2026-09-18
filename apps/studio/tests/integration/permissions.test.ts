import { afterEach, describe, expect, it } from 'vitest';
import { AppError } from '@/lib/errors';
import { createManualListing, deleteListing, requireListing } from '@/server/listings';
import { createVideo, deleteVideo, duplicateVideo, listVideos, requireVideo, updateVideo } from '@/server/videos';
import { enqueueRender } from '@/server/render-service';
import { ingestImage } from '@/server/images';
import { renderDemoPhoto, DEMO_PHOTOS } from '@/lib/demo/assets';
import { createTestUser, cleanupUser } from './helpers';

const created: string[] = [];

afterEach(async () => {
  await Promise.all(created.splice(0).map(cleanupUser));
});

async function account(credits = 5) {
  const user = await createTestUser(credits);
  created.push(user.id);
  return user;
}

/** A small listing with three real, analysed photos. */
async function listingWithPhotos(userId: string) {
  const listing = await createManualListing(userId, 'Villa test');
  const specs = DEMO_PHOTOS.slice(0, 3);
  const imageIds: string[] = [];
  for (const [index, spec] of specs.entries()) {
    const image = await ingestImage({
      userId,
      listingId: listing.id,
      buffer: await renderDemoPhoto({ ...spec, width: 960, height: 640 }),
      hint: spec.hint,
      sortOrder: index,
    });
    imageIds.push(image.id);
  }
  return { listing, imageIds };
}

describe('per-user authorization', () => {
  it('hides another user’s listing', async () => {
    const owner = await account();
    const intruder = await account();
    const { listing } = await listingWithPhotos(owner.id);

    await expect(requireListing(intruder.id, listing.id)).rejects.toThrow(AppError);
    await expect(deleteListing(intruder.id, listing.id)).rejects.toThrow(AppError);
    await expect(requireListing(owner.id, listing.id)).resolves.toBeTruthy();
  });

  it('hides another user’s video from every operation', async () => {
    const owner = await account();
    const intruder = await account();
    const { listing, imageIds } = await listingWithPhotos(owner.id);
    const video = await createVideo({
      userId: owner.id,
      listingId: listing.id,
      imageIds,
      style: 'CINEMATIC',
      aspectRatio: 'VERTICAL',
      duration: 'AUTO',
    });

    await expect(requireVideo(intruder.id, video.id)).rejects.toThrow(AppError);
    await expect(updateVideo(intruder.id, video.id, { name: 'volé' })).rejects.toThrow(AppError);
    await expect(duplicateVideo(intruder.id, video.id)).rejects.toThrow(AppError);
    await expect(deleteVideo(intruder.id, video.id)).rejects.toThrow(AppError);
    await expect(enqueueRender(intruder.id, video.id)).rejects.toThrow(AppError);

    expect(await listVideos(intruder.id)).toHaveLength(0);
    expect(await listVideos(owner.id)).toHaveLength(1);
  });

  it('refuses to build a video from photos that belong to someone else', async () => {
    const owner = await account();
    const intruder = await account();
    const { imageIds } = await listingWithPhotos(owner.id);
    const intruderListing = await createManualListing(intruder.id);

    await expect(
      createVideo({
        userId: intruder.id,
        listingId: intruderListing.id,
        imageIds,
        style: 'CINEMATIC',
        aspectRatio: 'VERTICAL',
        duration: 'AUTO',
      }),
    ).rejects.toThrow(AppError);
  });

  it('refuses a video with fewer than three photos', async () => {
    const owner = await account();
    const { listing, imageIds } = await listingWithPhotos(owner.id);

    await expect(
      createVideo({
        userId: owner.id,
        listingId: listing.id,
        imageIds: imageIds.slice(0, 2),
        style: 'CINEMATIC',
        aspectRatio: 'VERTICAL',
        duration: 'AUTO',
      }),
    ).rejects.toThrow(AppError);
  });

  it('refuses to queue two renders of the same video at once', async () => {
    const owner = await account();
    const { listing, imageIds } = await listingWithPhotos(owner.id);
    const video = await createVideo({
      userId: owner.id,
      listingId: listing.id,
      imageIds,
      style: 'CINEMATIC',
      aspectRatio: 'VERTICAL',
      duration: 'AUTO',
    });

    await enqueueRender(owner.id, video.id);
    await expect(enqueueRender(owner.id, video.id)).rejects.toThrow(AppError);
  });

  it('refuses to render without credits, and does not create a job', async () => {
    const broke = await account(0);
    const { listing, imageIds } = await listingWithPhotos(broke.id);
    const video = await createVideo({
      userId: broke.id,
      listingId: listing.id,
      imageIds,
      style: 'CINEMATIC',
      aspectRatio: 'VERTICAL',
      duration: 'AUTO',
    });

    await expect(enqueueRender(broke.id, video.id)).rejects.toMatchObject({
      code: 'INSUFFICIENT_CREDITS',
    });

    const { prisma } = await import('@/lib/db');
    expect(await prisma.generationJob.count({ where: { videoId: video.id } })).toBe(0);
  });
});
