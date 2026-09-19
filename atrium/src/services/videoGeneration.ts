import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '@/lib/env';
import { newId } from '@/lib/id';
import { storage } from '@/lib/storage/local';
import { exposurePlan } from '@/lib/video/grade';
import { videoRenderer, type RenderScene } from '@/lib/video/renderer';
import { FORMAT_DIMENSIONS, type Image, type Scene, type Video, type VideoFormat } from '@/types/domain';
import { absolutePath } from './ingest';

export interface GenerateVideoInput {
  projectId: string;
  images: Image[];
  scenes: Scene[];
  format: VideoFormat;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

/**
 * Assemble la vidéo à partir du storyboard et publie le fichier dans le
 * stockage du projet. Le nom du fichier porte le format : générer un autre
 * cadrage plus tard n'écrase pas le premier rendu.
 */
export async function generateVideo({
  projectId,
  images,
  scenes,
  format,
  onProgress,
  signal,
}: GenerateVideoInput): Promise<Video> {
  const store = storage();
  const byId = new Map(images.map((image) => [image.id, image]));

  const ordered = scenes.slice().sort((a, b) => a.order - b.order);

  // L'exposition s'harmonise à l'échelle de la séquence, qui est sa propre
  // référence : une série déjà homogène traverse l'étape sans être touchée.
  const exposures = exposurePlan(
    ordered.map((scene) => byId.get(scene.imageId)?.analysis?.brightness ?? 0.5),
  );

  const renderScenes: RenderScene[] = ordered.map((scene, index) => {
      const image = byId.get(scene.imageId);
      if (!image) throw new Error(`Photo ${scene.imageId} absente du projet`);
      return {
        imagePath: absolutePath(projectId, image),
        sourceWidth: image.width,
        sourceHeight: image.height,
        startRect: scene.startRect,
        endRect: scene.endRect,
        duration: scene.duration,
        transitionType: scene.transitionType,
        transitionDuration: scene.transitionDuration,
        exposure: exposures[index] ?? 1,
      };
    });

  const key = `video/atrium_${format.replace(':', 'x')}.mp4`;
  const outputPath = store.resolve(projectId, key);
  const workDir = path.join(await store.projectDir(projectId), 'work');

  const result = await videoRenderer().render({
    scenes: renderScenes,
    format,
    fps: env.fps,
    workDir,
    outputPath,
    ...(onProgress ? { onProgress } : {}),
    ...(signal ? { signal } : {}),
  });

  await fs.rm(workDir, { recursive: true, force: true });

  const { width, height } = FORMAT_DIMENSIONS[format];
  return {
    id: newId('vid'),
    projectId,
    url: store.publicUrl(projectId, key),
    path: key,
    format,
    width,
    height,
    duration: result.duration,
    sizeBytes: await store.size(projectId, key),
    sceneCount: result.sceneCount,
    createdAt: new Date().toISOString(),
  };
}
