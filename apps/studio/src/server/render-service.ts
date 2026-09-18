import type { GenerationJob, Prisma } from '@prisma/client';
import { prisma } from '../lib/db';
import { AppError, isAppError } from '../lib/errors';
import { creditService } from '../lib/credits/credit-service';
import { getStorage, storageKeys } from '../lib/storage';
import { buildStoryboard } from '../lib/video/storyboard';
import { getRenderer } from '../lib/video/renderer';
import type { ServedImage } from '../lib/video/image-server';
import type { Storyboard } from '../lib/video/types';
import { requireVideo } from './videos';

/**
 * The generation pipeline.
 *
 *   credits -> job -> queue -> [ storyboard -> render -> upload ] -> ready
 *
 * Credits are taken when the job is created and given back automatically if the render fails,
 * so a failed render never costs the user anything. Progress is only ever written from a real
 * signal: the storyboard being built, frames actually rendered, bytes actually uploaded.
 */

export interface EnqueueResult {
  job: GenerationJob;
  creditsSpent: number;
  balance: number;
}

export async function enqueueRender(userId: string, videoId: string): Promise<EnqueueResult> {
  // Throws unless this video belongs to this user: ownership is checked before anything else.
  await requireVideo(userId, videoId);

  const active = await prisma.generationJob.findFirst({
    where: { videoId, status: { in: ['QUEUED', 'PROCESSING', 'RENDERING', 'UPLOADING'] } },
  });
  if (active) throw new AppError('CONFLICT', 'Une génération est déjà en cours pour cette vidéo.');

  const cost = await creditService.costPerVideo();

  const job = await prisma.generationJob.create({
    data: { videoId, status: 'QUEUED', stage: 'queued', progress: 0 },
  });

  let balance = 0;
  if (cost > 0) {
    try {
      const result = await creditService.spend({
        userId,
        amount: cost,
        videoId,
        idempotencyKey: `generation:${job.id}`,
        description: 'Génération vidéo',
      });
      balance = result.balance;
    } catch (error) {
      await prisma.generationJob.delete({ where: { id: job.id } }).catch(() => {});
      throw error;
    }
  } else {
    balance = await creditService.getBalance(userId);
  }

  await prisma.video.update({
    where: { id: videoId },
    data: { status: 'QUEUED', errorCode: null, errorMessage: null },
  });

  return { job, creditsSpent: cost, balance };
}

export interface ProgressUpdate {
  status: 'PROCESSING' | 'RENDERING' | 'UPLOADING';
  stage: string;
  progress: number;
}

/**
 * Runs one job to completion. Safe to call from an in-process runner or a dedicated worker;
 * the only shared state is the database.
 */
export async function runRenderJob(jobId: string): Promise<void> {
  const job = await prisma.generationJob.findUnique({
    where: { id: jobId },
    include: { video: { include: { listing: { include: { images: true } } } } },
  });
  if (!job) throw new AppError('NOT_FOUND');
  if (job.status === 'COMPLETED') return;

  const video = job.video;
  const storage = getStorage();

  const report = async (update: ProgressUpdate) => {
    await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: update.status, stage: update.stage, progress: Math.round(update.progress) },
    });
    await prisma.video.update({ where: { id: video.id }, data: { status: update.status } });
  };

  try {
    await prisma.generationJob.update({
      where: { id: job.id },
      data: { startedAt: new Date(), attempts: { increment: 1 } },
    });
    await report({ status: 'PROCESSING', stage: 'preparing_photos', progress: 2 });

    const selected = orderImages(video.listing.images, video.imageOrder);
    if (selected.length < 3) throw new AppError('NOT_ENOUGH_IMAGES');

    const storyboard = buildStoryboard({
      images: selected.map((image) => ({
        id: image.id,
        width: image.width,
        height: image.height,
        focalX: image.focalX,
        focalY: image.focalY,
        quality: image.quality,
      })),
      style: video.style,
      aspectRatio: video.aspectRatio,
      duration: video.duration,
      fps: video.fps,
      seed: video.seed,
    });

    await persistStoryboard(video.id, storyboard);
    await report({ status: 'PROCESSING', stage: 'building_edit', progress: 8 });

    // Load exactly the photos the storyboard uses, once.
    const sources: Record<string, ServedImage> = {};
    for (const scene of storyboard.scenes) {
      const image = selected.find((candidate) => candidate.id === scene.imageId);
      if (!image) throw new AppError('IMAGES_UNREACHABLE');
      sources[image.id] = {
        buffer: await storage.get(image.storageKey),
        contentType: 'image/jpeg',
      };
    }

    await report({ status: 'RENDERING', stage: 'rendering', progress: 10 });

    let lastReported = 10;
    const result = await getRenderer().render({
      storyboard,
      sources,
      onProgress: ({ renderedFrames, totalFrames }) => {
        // 10 % -> 85 % maps to frames actually written by the renderer.
        const progress = 10 + (renderedFrames / Math.max(1, totalFrames)) * 75;
        if (progress - lastReported < 2) return;
        lastReported = progress;
        void prisma.generationJob
          .update({ where: { id: job.id }, data: { progress: Math.round(progress) } })
          .catch(() => {});
      },
    });

    await report({ status: 'UPLOADING', stage: 'uploading', progress: 88 });

    const videoKey = storageKeys.video(video.userId, video.id);
    const posterKey = storageKeys.videoPoster(video.userId, video.id);
    await storage.put({ key: videoKey, body: result.video, contentType: 'video/mp4' });
    await storage.put({ key: posterKey, body: result.poster, contentType: 'image/jpeg' });

    await prisma.$transaction([
      prisma.video.update({
        where: { id: video.id },
        data: {
          status: 'COMPLETED',
          storageKey: videoKey,
          thumbnailKey: posterKey,
          bytes: result.video.byteLength,
          durationSeconds: result.durationSeconds,
          completedAt: new Date(),
          errorCode: null,
          errorMessage: null,
        },
      }),
      prisma.generationJob.update({
        where: { id: job.id },
        data: { status: 'COMPLETED', stage: 'completed', progress: 100, finishedAt: new Date() },
      }),
    ]);
  } catch (error) {
    const code = isAppError(error) ? error.code : 'RENDER_FAILED';
    const message = isAppError(error)
      ? error.message
      : "Le rendu de la vidéo a échoué. Vos crédits n'ont pas été débités.";

    await prisma.generationJob
      .update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          stage: 'failed',
          errorCode: code,
          error: message.slice(0, 500),
          finishedAt: new Date(),
        },
      })
      .catch(() => {});
    await prisma.video
      .update({
        where: { id: video.id },
        data: { status: 'FAILED', errorCode: code, errorMessage: message.slice(0, 500) },
      })
      .catch(() => {});

    // The user paid for a video they did not get: give the credits back.
    const cost = await creditService.costPerVideo();
    if (cost > 0) {
      await creditService
        .refundGeneration(video.userId, video.id, job.id, cost)
        .catch(() => undefined);
    }

    throw error;
  }
}

/** Stores the storyboard on the video and mirrors its scenes into queryable rows. */
async function persistStoryboard(videoId: string, storyboard: Storyboard): Promise<void> {
  await prisma.$transaction([
    prisma.videoScene.deleteMany({ where: { videoId } }),
    prisma.video.update({
      where: { id: videoId },
      data: {
        storyboard: storyboard as unknown as Prisma.InputJsonValue,
        durationSeconds: storyboard.durationSeconds,
      },
    }),
    prisma.videoScene.createMany({
      data: storyboard.scenes.map((scene) => ({
        videoId,
        imageId: scene.imageId,
        index: scene.index,
        startSeconds: scene.startSeconds,
        durationSeconds: scene.durationSeconds,
        animation: scene.animation,
        transitionIn: scene.transitionIn,
        transitionDurationSeconds: scene.transitionDurationSeconds,
        startRect: scene.startRect as unknown as Prisma.InputJsonValue,
        endRect: scene.endRect as unknown as Prisma.InputJsonValue,
      })),
    }),
  ]);
}

/** Keeps the user's chosen order; anything unknown is dropped rather than guessed at. */
function orderImages<T extends { id: string }>(images: T[], order: string[]): T[] {
  const byId = new Map(images.map((image) => [image.id, image]));
  return order.flatMap((id) => {
    const image = byId.get(id);
    return image ? [image] : [];
  });
}

export const STAGE_LABELS: Record<string, string> = {
  queued: 'En file d’attente',
  preparing_photos: 'Préparation des photos',
  building_edit: 'Création du montage',
  rendering: 'Rendu vidéo',
  uploading: 'Finalisation',
  completed: 'Votre vidéo est prête',
  failed: 'Échec',
};
