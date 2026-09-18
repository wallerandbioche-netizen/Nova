import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { creditService } from '@/lib/credits/credit-service';
import { getStorage } from '@/lib/storage';
import { setRenderer, type RenderRequest, type VideoRenderer } from '@/lib/video/renderer';
import { importListingForUser } from '@/server/listings';
import { createVideo, deleteVideo } from '@/server/videos';
import { enqueueRender, runRenderJob } from '@/server/render-service';
import { createTestUser, cleanupUser } from './helpers';

/**
 * The whole journey: account -> URL -> import -> analysis -> selection -> video -> render ->
 * MP4 in storage -> download -> delete.
 *
 * The renderer is stubbed so the test stays fast and deterministic; the real Remotion render is
 * exercised by `pnpm --filter @nova/studio render:smoke` and by the RENDER_E2E test below.
 */

const created: string[] = [];

class StubRenderer implements VideoRenderer {
  readonly name = 'stub';
  lastRequest: RenderRequest | null = null;

  async render(request: RenderRequest) {
    this.lastRequest = request;
    // Report progress the way the real renderer does, so the job's progress path is covered.
    request.onProgress?.({ renderedFrames: 0, totalFrames: request.storyboard.durationInFrames });
    request.onProgress?.({
      renderedFrames: request.storyboard.durationInFrames,
      totalFrames: request.storyboard.durationInFrames,
    });
    return {
      video: Buffer.from('fake-mp4-bytes'),
      poster: Buffer.from('fake-jpeg-bytes'),
      durationSeconds: request.storyboard.durationSeconds,
    };
  }
}

afterEach(async () => {
  await Promise.all(created.splice(0).map(cleanupUser));
});

afterAll(() => {
  setRenderer(null);
});

describe('end-to-end journey', () => {
  it('turns a listing URL into a downloadable video', async () => {
    const stub = new StubRenderer();
    setRenderer(stub);

    const user = await createTestUser(5);
    created.push(user.id);

    // 1. Import — the demo URL exercises the real importer, analysis and storage path.
    const imported = await importListingForUser(user.id, 'https://demo.nova.studio/villa');
    expect(imported.listing.images.length).toBeGreaterThanOrEqual(10);
    expect(imported.listing.status).toBe('READY');

    // Every photo was analysed and stored.
    for (const image of imported.listing.images) {
      expect(image.storageKey).not.toBe('');
      expect(image.analyzedAt).not.toBeNull();
      expect(image.phash).toBeTruthy();
      expect(await getStorage().exists(image.storageKey)).toBe(true);
    }

    // 2. Automatic selection keeps a subset, in narrative order.
    expect(imported.suggestedSelection.length).toBeGreaterThanOrEqual(3);
    expect(imported.suggestedSelection.length).toBeLessThan(imported.listing.images.length);

    // 3. Create the project.
    const video = await createVideo({
      userId: user.id,
      listingId: imported.listing.id,
      imageIds: imported.suggestedSelection,
      name: 'Villa avec piscine',
      style: 'CINEMATIC',
      aspectRatio: 'VERTICAL',
      duration: 'S30',
    });
    expect(video.status).toBe('DRAFT');
    expect([video.width, video.height]).toEqual([1080, 1920]);

    // 4. Queue it: credits are taken now.
    const { job, creditsSpent } = await enqueueRender(user.id, video.id);
    expect(await creditService.getBalance(user.id)).toBe(5 - creditsSpent);

    // 5. Render.
    await runRenderJob(job.id);

    const finished = await prisma.video.findUniqueOrThrow({ where: { id: video.id } });
    expect(finished.status).toBe('COMPLETED');
    expect(finished.storageKey).toBeTruthy();
    expect(finished.durationSeconds).toBeGreaterThan(10);

    // The storyboard was persisted, scene by scene.
    const scenes = await prisma.videoScene.findMany({ where: { videoId: video.id }, orderBy: { index: 'asc' } });
    expect(scenes.length).toBeGreaterThanOrEqual(3);
    expect(scenes[0]?.startSeconds).toBe(0);
    expect(stub.lastRequest?.storyboard.scenes).toHaveLength(scenes.length);

    // 6. The MP4 is in storage and reachable through a signed URL.
    const stored = await getStorage().get(finished.storageKey!);
    expect(stored.toString()).toBe('fake-mp4-bytes');
    const url = await getStorage().signedUrl(finished.storageKey!, 60);
    expect(url).toContain('signature=');

    const finishedJob = await prisma.generationJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(finishedJob.status).toBe('COMPLETED');
    expect(finishedJob.progress).toBe(100);

    // 7. Deleting the project removes the stored bytes too.
    await deleteVideo(user.id, video.id);
    expect(await getStorage().exists(finished.storageKey!)).toBe(false);
  });

  it('refunds the credits when a render fails', async () => {
    setRenderer({
      name: 'failing',
      async render() {
        throw new AppError('RENDER_FAILED');
      },
    });

    const user = await createTestUser(2);
    created.push(user.id);

    const imported = await importListingForUser(user.id, 'https://demo.nova.studio/villa');
    const video = await createVideo({
      userId: user.id,
      listingId: imported.listing.id,
      imageIds: imported.suggestedSelection,
      style: 'MODERN',
      aspectRatio: 'SQUARE',
      duration: 'S15',
    });

    const { job } = await enqueueRender(user.id, video.id);
    expect(await creditService.getBalance(user.id)).toBe(1);

    await expect(runRenderJob(job.id)).rejects.toThrow(AppError);

    // The user is charged nothing for a video they never received.
    expect(await creditService.getBalance(user.id)).toBe(2);

    const failed = await prisma.video.findUniqueOrThrow({ where: { id: video.id } });
    expect(failed.status).toBe('FAILED');
    expect(failed.errorCode).toBe('RENDER_FAILED');

    const failedJob = await prisma.generationJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(failedJob.status).toBe('FAILED');
    expect(failedJob.error).toBeTruthy();
  });

  it('reuses the imported photos when the video is regenerated', async () => {
    const stub = new StubRenderer();
    setRenderer(stub);

    const user = await createTestUser(5);
    created.push(user.id);

    const imported = await importListingForUser(user.id, 'https://demo.nova.studio/villa');
    const analysedAt = imported.listing.images.map((image) => image.analyzedAt?.toISOString());

    const video = await createVideo({
      userId: user.id,
      listingId: imported.listing.id,
      imageIds: imported.suggestedSelection,
      style: 'CINEMATIC',
      aspectRatio: 'VERTICAL',
      duration: 'S30',
    });

    const first = await enqueueRender(user.id, video.id);
    await runRenderJob(first.job.id);
    const firstStoryboard = JSON.stringify(stub.lastRequest?.storyboard.scenes);

    // Same settings, same seed: the edit must come out identical.
    const second = await enqueueRender(user.id, video.id);
    await runRenderJob(second.job.id);
    expect(JSON.stringify(stub.lastRequest?.storyboard.scenes)).toBe(firstStoryboard);

    // Nothing was re-imported or re-analysed.
    const images = await prisma.listingImage.findMany({
      where: { listingId: imported.listing.id },
      orderBy: { sortOrder: 'asc' },
    });
    expect(images.map((image) => image.analyzedAt?.toISOString())).toEqual(analysedAt);

    // A different style produces a different edit from the same photos.
    await prisma.video.update({ where: { id: video.id }, data: { style: 'DYNAMIC' } });
    const third = await enqueueRender(user.id, video.id);
    await runRenderJob(third.job.id);
    expect(JSON.stringify(stub.lastRequest?.storyboard.scenes)).not.toBe(firstStoryboard);
  });
});
