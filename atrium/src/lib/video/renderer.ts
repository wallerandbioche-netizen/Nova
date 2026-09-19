import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import {
  FORMAT_DIMENSIONS,
  type NormalizedRect,
  type TransitionType,
  type VideoFormat,
} from '@/types/domain';
import { runFfmpeg } from './ffmpeg';
import { buildShotFilter, planShot, prepareShotImage } from './shot';

const log = logger('render');

/** Correspondance avec les transitions d'ffmpeg : rien de tape-à-l'œil. */
const XFADE_TRANSITIONS: Record<TransitionType, string> = {
  cross_dissolve: 'fade',
  fade: 'fade',
  soft_zoom: 'fadeblack',
  continuous: 'fade',
};

/**
 * Pas d'ouverture au noir : la première image de la vidéo est une photo. Une
 * vignette noire ferait une mauvaise affiche dans un lecteur, et l'ouverture
 * en fondu n'apporte rien que le mouvement de caméra ne donne déjà.
 */
const CLOSING_FADE = 0.8;

export interface RenderScene {
  imagePath: string;
  sourceWidth: number;
  sourceHeight: number;
  startRect: NormalizedRect;
  endRect: NormalizedRect;
  duration: number;
  /** Transition vers la scène suivante ; `null` sur la dernière. */
  transitionType: TransitionType | null;
  transitionDuration: number;
}

export interface RenderRequest {
  scenes: RenderScene[];
  format: VideoFormat;
  fps: number;
  /** Répertoire des fichiers intermédiaires, nettoyé en fin de rendu. */
  workDir: string;
  outputPath: string;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

export interface RenderResult {
  width: number;
  height: number;
  duration: number;
  sceneCount: number;
}

export interface VideoRenderer {
  readonly id: string;
  render(request: RenderRequest): Promise<RenderResult>;
}

/**
 * Rendu en deux temps.
 *
 * 1. Chaque photo devient un segment animé, encodé en qualité quasi visuelle
 *    sans perte. Découper le travail par plan donne une progression honnête à
 *    l'interface et isole les erreurs.
 * 2. Les segments sont enchaînés par des fondus, avec une ouverture et une
 *    fermeture au noir. C'est la seule passe qui compresse pour de bon.
 *
 * Le choix de ffmpeg plutôt que d'un moteur de rendu par navigateur tient à ce
 * que la vidéo ne contient ni texte, ni interface, ni composition React : rien
 * qui justifie de payer un rendu image par image dans un Chromium.
 */
export class FfmpegRenderer implements VideoRenderer {
  readonly id = 'ffmpeg';

  async render(request: RenderRequest): Promise<RenderResult> {
    const { width, height } = FORMAT_DIMENSIONS[request.format];
    const { scenes, fps, workDir } = request;
    if (scenes.length === 0) throw new Error('Aucune scène à rendre');

    await fs.mkdir(workDir, { recursive: true });
    const segments: string[] = [];
    const durations: number[] = [];

    for (const [index, scene] of scenes.entries()) {
      request.signal?.throwIfAborted();
      const plan = planShot({
        sourceWidth: scene.sourceWidth,
        sourceHeight: scene.sourceHeight,
        startRect: scene.startRect,
        endRect: scene.endRect,
        outputWidth: width,
        outputHeight: height,
        duration: scene.duration,
        fps,
      });

      const slug = String(index).padStart(2, '0');
      const workImage = path.join(workDir, `shot_${slug}.jpg`);
      const segment = path.join(workDir, `shot_${slug}.mp4`);

      await prepareShotImage(scene.imagePath, plan, workImage);
      await runFfmpeg(
        [
          '-y',
          '-loglevel', 'error',
          '-loop', '1',
          '-framerate', String(fps),
          '-i', workImage,
          '-vf', buildShotFilter(plan, width, height, fps),
          '-frames:v', String(plan.frames),
          '-c:v', 'libx264',
          // Les segments sont réencodés ensuite : on reste large sur la qualité.
          '-crf', '14',
          '-preset', 'veryfast',
          '-pix_fmt', 'yuv420p',
          '-an',
          segment,
        ],
        request.signal ? { signal: request.signal } : {},
      );

      await fs.rm(workImage, { force: true });
      segments.push(segment);
      durations.push(plan.duration);
      request.onProgress?.(index + 1, scenes.length);
    }

    const duration = await this.compose(request, segments, durations);
    await Promise.all(segments.map((segment) => fs.rm(segment, { force: true })));

    log.info('vidéo assemblée', { scenes: scenes.length, duration, format: request.format });
    return { width, height, duration, sceneCount: scenes.length };
  }

  private async compose(
    request: RenderRequest,
    segments: string[],
    durations: number[],
  ): Promise<number> {
    const { scenes, fps } = request;
    const inputs = segments.flatMap((segment) => ['-i', segment]);
    const steps: string[] = [];

    // Une base de temps commune évite les décalages de fondu entre segments.
    segments.forEach((_, index) => steps.push(`[${index}:v]settb=AVTB[s${index}]`));

    let label = 's0';
    let total = durations[0] ?? 0;

    for (let index = 1; index < segments.length; index += 1) {
      const previous = scenes[index - 1]!;
      const transition = XFADE_TRANSITIONS[previous.transitionType ?? 'cross_dissolve'];
      // Une transition ne peut pas dévorer un plan entier.
      const maximum = Math.min(durations[index - 1]!, durations[index]!) * 0.6;
      const length = Math.max(0.2, Math.min(previous.transitionDuration, maximum));
      const offset = total - length;
      const next = `x${index}`;
      steps.push(
        `[${label}][s${index}]xfade=transition=${transition}` +
          `:duration=${length.toFixed(3)}:offset=${offset.toFixed(3)}[${next}]`,
      );
      label = next;
      total = total + durations[index]! - length;
    }

    // Seule la fermeture au noir est conservée : c'est le point final du film.
    const closing = Math.max(0, total - CLOSING_FADE);
    steps.push(
      `[${label}]fade=t=out:st=${closing.toFixed(3)}:d=${CLOSING_FADE}` +
        `,format=yuv420p,setsar=1[out]`,
    );

    await fs.mkdir(path.dirname(request.outputPath), { recursive: true });
    await runFfmpeg(
      [
        '-y',
        '-loglevel', 'error',
        ...inputs,
        '-filter_complex', steps.join(';'),
        '-map', '[out]',
        '-c:v', 'libx264',
        '-crf', String(env.crf),
        '-preset', env.preset,
        '-profile:v', 'high',
        '-pix_fmt', 'yuv420p',
        '-r', String(fps),
        '-movflags', '+faststart',
        '-an',
        request.outputPath,
      ],
      request.signal ? { signal: request.signal } : {},
    );

    return total;
  }
}

let singleton: VideoRenderer | null = null;

export function videoRenderer(): VideoRenderer {
  singleton ??= new FfmpegRenderer();
  return singleton;
}
