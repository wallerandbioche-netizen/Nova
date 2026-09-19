import fs from 'node:fs/promises';
import { atriumError, describe, toProjectError } from '@/lib/errors';
import { newId } from '@/lib/id';
import { jobQueue } from '@/lib/jobs/queue';
import { projectRepository } from '@/lib/db/memory';
import { parseUserInput, resolveSource, type ListingInput } from '@/lib/listing';
import { logger } from '@/lib/logger';
import { storage } from '@/lib/storage/local';
import {
  STAGE_IDS,
  STAGE_WEIGHTS,
  type GenerationJob,
  type Listing,
  type Project,
  type StageId,
  type VideoFormat,
} from '@/types/domain';
import { env } from '@/lib/env';
import { analyzeImages, curateImages } from './imageAnalysis';
import { captionsByPosition, ingestListing } from './ingest';
import { buildStoryboard } from './storyboard';
import { generateVideo } from './videoGeneration';

const log = logger('pipeline');

// ── État du travail ──────────────────────────────────────────────────────────

function emptyJob(projectId: string): GenerationJob {
  const now = new Date().toISOString();
  return {
    id: newId('job'),
    projectId,
    status: 'queued',
    stages: STAGE_IDS.map((id) => ({
      id,
      status: 'pending',
      progress: 0,
      startedAt: null,
      endedAt: null,
    })),
    progress: 0,
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function recomputeProgress(job: GenerationJob): void {
  job.progress = job.stages.reduce((total, stage) => {
    const weight = STAGE_WEIGHTS[stage.id];
    const share = stage.status === 'done' ? 1 : stage.status === 'active' ? stage.progress : 0;
    return total + weight * share;
  }, 0);
  job.updatedAt = new Date().toISOString();
}

type Stage = (id: StageId, progress?: number) => Promise<void>;

/** Fabrique les deux rappels de progression utilisés par le pipeline. */
function stageReporter(projectId: string): { begin: Stage; advance: Stage; finish: Stage } {
  const repository = projectRepository();

  const mutate = async (
    id: StageId,
    change: (stage: Project['job']['stages'][number]) => void,
  ): Promise<void> => {
    await repository.update(projectId, (project) => {
      const stage = project.job.stages.find((candidate) => candidate.id === id);
      if (!stage) return;
      change(stage);
      recomputeProgress(project.job);
    });
  };

  return {
    begin: (id) =>
      mutate(id, (stage) => {
        stage.status = 'active';
        stage.progress = 0;
        stage.startedAt = new Date().toISOString();
      }),
    advance: (id, progress = 0) =>
      mutate(id, (stage) => {
        // La progression ne recule jamais : une barre qui revient en arrière
        // donne l'impression que le produit hésite.
        stage.progress = Math.max(stage.progress, Math.min(1, progress));
      }),
    finish: (id) =>
      mutate(id, (stage) => {
        stage.status = 'done';
        stage.progress = 1;
        stage.endedAt = new Date().toISOString();
      }),
  };
}

// ── Création ─────────────────────────────────────────────────────────────────

export interface CreateProjectInput {
  /** Saisie brute : URL d'annonce, ou `folder:/chemin`. */
  source?: string;
  /** Identifiant d'un import de photos. */
  uploadId?: string;
  format?: VideoFormat;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const listingInput: ListingInput = input.uploadId
    ? { kind: 'upload', uploadId: input.uploadId }
    : parseUserInput(input.source ?? '');

  // Valide la source immédiatement : une URL invalide doit être signalée
  // pendant que l'utilisateur regarde encore son champ de saisie.
  const source = resolveSource(listingInput);

  const id = newId();
  const now = new Date().toISOString();
  const project: Project = {
    id,
    userId: null,
    sourceId: source.id,
    sourceUrl: listingInput.kind === 'url' ? listingInput.url : null,
    status: 'queued',
    format: input.format ?? env.defaultFormat,
    listing: null,
    images: [],
    scenes: [],
    videos: [],
    job: emptyJob(id),
    error: null,
    createdAt: now,
    updatedAt: now,
  };

  await projectRepository().create(project);
  jobQueue().enqueue(id, (signal) => runPipeline(id, listingInput, signal));
  return project;
}

// ── Exécution ────────────────────────────────────────────────────────────────

async function runPipeline(
  projectId: string,
  listingInput: ListingInput,
  signal: AbortSignal,
): Promise<void> {
  const repository = projectRepository();
  const { begin, advance, finish } = stageReporter(projectId);

  await repository.update(projectId, (project) => {
    project.status = 'running';
    project.job.status = 'running';
    project.job.attempts += 1;
  });

  try {
    // 1 ─ Récupération des photos
    await begin('fetch');
    const source = resolveSource(listingInput);
    const rawListing = await source.fetchListing(listingInput, { projectId, ...(signal ? { signal } : {}) });
    const images = await ingestListing(projectId, rawListing, {
      signal,
      onProgress: (done, total) => void advance('fetch', done / total),
    });

    const listing: Listing = {
      id: newId('lst'),
      projectId,
      sourceId: rawListing.sourceId,
      sourceUrl: rawListing.sourceUrl,
      title: rawListing.title,
      photoCount: images.length,
      isDemo: rawListing.isDemo,
    };
    await repository.update(projectId, (project) => {
      project.listing = listing;
      project.images = images;
    });
    await finish('fetch');

    // 2 ─ Analyse des espaces
    await begin('analyze');
    await analyzeImages(projectId, images, captionsByPosition(rawListing), {
      signal,
      onProgress: (done, total) => void advance('analyze', done / total),
    });
    await finish('analyze');

    // 3 ─ Sélection
    await begin('select');
    curateImages(images);
    await repository.update(projectId, (project) => {
      project.images = images;
    });
    await finish('select');

    // 4 ─ Storyboard
    await begin('storyboard');
    const project = await repository.find(projectId);
    const format = project?.format ?? env.defaultFormat;
    const scenes = buildStoryboard({ projectId, images, format });
    await repository.update(projectId, (current) => {
      current.scenes = scenes;
    });
    await finish('storyboard');

    // 5 ─ Animation des photos
    await begin('animate');
    const video = await generateVideo({
      projectId,
      images,
      scenes,
      format,
      signal,
      onProgress: (done, total) => {
        void advance('animate', done / total);
        if (done === total) {
          void finish('animate');
          void begin('finalize');
          // L'encodage final n'expose pas d'avancement exploitable : on
          // affiche une progression prudente plutôt qu'un chiffre inventé.
          void advance('finalize', 0.35);
        }
      },
    });
    await finish('animate');

    // 6 ─ Finalisation
    await begin('finalize');
    await repository.update(projectId, (current) => {
      current.videos = [video, ...current.videos.filter((item) => item.format !== video.format)];
      current.status = 'ready';
      current.job.status = 'succeeded';
    });
    await finish('finalize');

    log.info('projet terminé', { projectId, duration: video.duration });
  } catch (error) {
    if (signal.aborted) {
      log.info('projet annulé', { projectId });
      return;
    }
    log.error('projet en échec', describe(error));
    await repository.update(projectId, (project) => {
      project.status = 'failed';
      project.error = toProjectError(error);
      project.job.status = 'failed';
      const active = project.job.stages.find((stage) => stage.status === 'active');
      if (active) {
        active.status = 'failed';
        active.endedAt = new Date().toISOString();
      }
      recomputeProgress(project.job);
    });
  }
}

// ── Re-rendu dans un autre format ────────────────────────────────────────────

/**
 * Régénère la vidéo dans un autre cadrage. Les photos et leur analyse sont
 * déjà là : seuls le storyboard — dont les cadres dépendent du format — et le
 * rendu sont refaits.
 */
export async function renderFormat(projectId: string, format: VideoFormat): Promise<Project> {
  const repository = projectRepository();
  const project = await repository.find(projectId);
  if (!project) throw atriumError('UNKNOWN', `Projet ${projectId} introuvable`);

  const existing = project.videos.find((video) => video.format === format);
  if (existing) {
    const updated = await repository.update(projectId, (current) => {
      current.format = format;
    });
    return updated ?? project;
  }

  if (project.status !== 'ready') {
    throw atriumError('UNKNOWN', `Projet ${projectId} non terminé`);
  }

  await repository.update(projectId, (current) => {
    current.format = format;
    current.status = 'running';
    current.job.status = 'running';
    for (const stage of current.job.stages) {
      const restart = stage.id === 'storyboard' || stage.id === 'animate' || stage.id === 'finalize';
      if (!restart) continue;
      stage.status = 'pending';
      stage.progress = 0;
      stage.endedAt = null;
    }
    recomputeProgress(current.job);
  });

  jobQueue().enqueue(`${projectId}:${format}`, async (signal) => {
    const { begin, advance, finish } = stageReporter(projectId);
    try {
      await begin('storyboard');
      const scenes = buildStoryboard({ projectId, images: project.images, format });
      await repository.update(projectId, (current) => {
        current.scenes = scenes;
      });
      await finish('storyboard');

      await begin('animate');
      const video = await generateVideo({
        projectId,
        images: project.images,
        scenes,
        format,
        signal,
        onProgress: (done, total) => void advance('animate', done / total),
      });
      await finish('animate');

      await begin('finalize');
      await repository.update(projectId, (current) => {
        current.videos = [video, ...current.videos.filter((item) => item.format !== format)];
        current.status = 'ready';
        current.job.status = 'succeeded';
      });
      await finish('finalize');
    } catch (error) {
      if (signal.aborted) return;
      log.error('re-rendu en échec', describe(error));
      await repository.update(projectId, (current) => {
        current.status = 'failed';
        current.error = toProjectError(error);
        current.job.status = 'failed';
      });
    }
  });

  return (await repository.find(projectId)) ?? project;
}

/** Supprime un projet et ses fichiers. */
export async function discardProject(projectId: string): Promise<void> {
  jobQueue().cancel(projectId);
  await projectRepository().remove(projectId);
  await storage().remove(projectId);
}

/** Espace de travail des imports de photos. */
export async function prepareUploadDir(uploadId: string): Promise<string> {
  const dir = `${env.storageDir}/uploads/${uploadId}`;
  await fs.mkdir(dir, { recursive: true });
  return dir;
}
