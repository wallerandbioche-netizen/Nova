'use client';

import { AnimatePresence, motion } from 'motion/react';
import { ErrorPanel } from '@/components/project/ErrorPanel';
import { ProgressPanel } from '@/components/project/ProgressPanel';
import { useProject } from '@/components/project/useProject';
import { VideoStage } from '@/components/video/VideoStage';
import type { ProjectView } from '@/types/api';
import type { VideoFormat } from '@/types/domain';

const FADE = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const },
};

export function ProjectClient({ id }: { id: string }) {
  const { project, missing, resume } = useProject(id);

  async function changeFormat(format: VideoFormat): Promise<void> {
    const response = await fetch(`/api/projects/${id}/format`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ format }),
    });
    if (!response.ok) return;
    resume((await response.json()) as ProjectView);
  }

  const state = missing
    ? 'missing'
    : project?.status === 'ready' && project.video
      ? 'ready'
      : project?.status === 'failed'
        ? 'failed'
        : 'running';

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={state} className="flex w-full justify-center" {...FADE}>
        {state === 'ready' && project ? (
          <VideoStage project={project} onFormatChange={changeFormat} />
        ) : state === 'failed' ? (
          <ErrorPanel error={project?.error ?? null} />
        ) : state === 'missing' ? (
          <ErrorPanel
            error={{ code: 'UNKNOWN', message: "Ce projet n'est plus disponible." }}
          />
        ) : (
          <ProgressPanel project={project} />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
