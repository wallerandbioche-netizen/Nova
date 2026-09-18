import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { bundle as bundleFunction } from '@remotion/bundler';
import { getEnv } from '../config/env';
import { AppError } from '../errors';
import { serveImages, type ServedImage } from './image-server';
import type { Storyboard } from './types';

export interface RenderRequest {
  storyboard: Storyboard;
  /** The photo bytes for every image id in the storyboard, keyed by id. */
  sources: Record<string, ServedImage>;
  /** Reported with real values from the renderer; never a simulated percentage. */
  onProgress?: (progress: { renderedFrames: number; totalFrames: number }) => void;
}

export interface RenderResult {
  video: Buffer;
  poster: Buffer;
  durationSeconds: number;
}

/**
 * Rendering is behind this interface so the work can move to a dedicated worker, a container or
 * a serverless renderer without changing a single call site.
 */
export interface VideoRenderer {
  readonly name: string;
  render(request: RenderRequest): Promise<RenderResult>;
}

let bundleCache: { promise: Promise<string>; key: string } | null = null;

/**
 * Remotion renderer.
 *
 * The composition bundle is built once per process and reused: bundling is the expensive part,
 * and a regeneration should only pay for the frames.
 */
export class RemotionRenderer implements VideoRenderer {
  readonly name = 'remotion';

  async render(request: RenderRequest): Promise<RenderResult> {
    // Imported lazily: @remotion/renderer pulls in native binaries that must never be bundled
    // into the Next.js server build.
    const { bundle } = await import('@remotion/bundler');
    const { renderMedia, renderStill, selectComposition } = await import('@remotion/renderer');

    const env = getEnv();
    const images = await serveImages(request.sources);
    const storyboard = hydrate(request.storyboard, images.urls);
    const workDir = await mkdtemp(path.join(tmpdir(), 'nova-studio-render-'));
    const videoPath = path.join(workDir, 'video.mp4');
    const posterPath = path.join(workDir, 'poster.jpg');

    try {
      const serveUrl = await this.getBundle(bundle);
      const inputProps = { storyboard } as unknown as Record<string, unknown>;

      const composition = await selectComposition({
        serveUrl,
        id: 'PropertyVideo',
        inputProps,
        ...(env.REMOTION_BROWSER_EXECUTABLE
          ? { browserExecutable: env.REMOTION_BROWSER_EXECUTABLE }
          : {}),
      });

      await renderMedia({
        composition,
        serveUrl,
        codec: 'h264',
        outputLocation: videoPath,
        inputProps,
        // No audio anywhere in the product: the output has no audio track at all.
        muted: true,
        crf: 20,
        imageFormat: 'jpeg',
        jpegQuality: 92,
        concurrency: env.REMOTION_CONCURRENCY,
        ...(env.REMOTION_BROWSER_EXECUTABLE
          ? { browserExecutable: env.REMOTION_BROWSER_EXECUTABLE }
          : {}),
        onProgress: ({ renderedFrames }) => {
          request.onProgress?.({
            renderedFrames,
            totalFrames: composition.durationInFrames,
          });
        },
      });

      // The poster is a real frame of the video, taken a second in, not a generated thumbnail.
      await renderStill({
        composition,
        serveUrl,
        output: posterPath,
        inputProps,
        imageFormat: 'jpeg',
        jpegQuality: 88,
        frame: Math.min(composition.durationInFrames - 1, Math.round(composition.fps)),
        ...(env.REMOTION_BROWSER_EXECUTABLE
          ? { browserExecutable: env.REMOTION_BROWSER_EXECUTABLE }
          : {}),
      });

      const [video, poster] = await Promise.all([readFile(videoPath), readFile(posterPath)]);
      return { video, poster, durationSeconds: storyboard.durationSeconds };
    } catch (cause) {
      throw new AppError('RENDER_FAILED', undefined, { cause });
    } finally {
      await images.close().catch(() => {});
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  private getBundle(bundleFn: typeof bundleFunction): Promise<string> {
    const entry = path.resolve(process.cwd(), 'src/remotion/index.ts');
    if (bundleCache?.key === entry) return bundleCache.promise;
    const promise = bundleFn({
      entryPoint: entry,
      onProgress: () => undefined,
    });
    bundleCache = { key: entry, promise };
    return promise;
  }
}

/** Attaches a resolved source URL to every scene; a missing source is a hard error. */
export function hydrate(storyboard: Storyboard, sources: Record<string, string>): Storyboard {
  return {
    ...storyboard,
    scenes: storyboard.scenes.map((scene) => {
      const src = sources[scene.imageId];
      if (!src) {
        throw new AppError('IMAGES_UNREACHABLE', "Une photo du montage est introuvable.");
      }
      return { ...scene, src };
    }),
  };
}

let renderer: VideoRenderer | null = null;

export function getRenderer(): VideoRenderer {
  renderer ??= new RemotionRenderer();
  return renderer;
}

export function setRenderer(next: VideoRenderer | null): void {
  renderer = next;
}
