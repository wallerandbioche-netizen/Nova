import { STAGE_LABELS, type Project, type VideoFormat } from '@/types/domain';
import type { ProjectView } from '@/types/api';

/** Projette un projet du domaine vers la vue transmise au navigateur. */
export function toProjectView(project: Project): ProjectView {
  const video =
    project.videos.find((candidate) => candidate.format === project.format) ??
    project.videos[0] ??
    null;

  return {
    id: project.id,
    status: project.status,
    progress: Math.min(1, Math.max(0, project.job.progress)),
    format: project.format,
    stages: project.job.stages.map((stage) => ({
      id: stage.id,
      label: STAGE_LABELS[stage.id],
      status: stage.status,
      progress: stage.progress,
    })),
    listing: project.listing
      ? {
          title: project.listing.title,
          photoCount: project.listing.photoCount,
          isDemo: project.listing.isDemo,
        }
      : null,
    photos: {
      total: project.images.length,
      selected: project.images.filter((image) => image.selected).length,
      duplicates: project.images.filter((image) => image.duplicateOf !== null).length,
    },
    video: video
      ? {
          url: video.url,
          format: video.format,
          width: video.width,
          height: video.height,
          duration: video.duration,
          sizeBytes: video.sizeBytes,
          sceneCount: video.sceneCount,
        }
      : null,
    renderedFormats: project.videos.map((item) => item.format) as VideoFormat[],
    error: project.error,
  };
}
