'use client';

import { motion } from 'motion/react';
import { useState } from 'react';
import { ButtonLink } from '@/components/ui/Button';
import { FormatPicker } from '@/components/video/FormatPicker';
import type { ProjectView } from '@/types/api';
import type { VideoFormat } from '@/types/domain';

interface VideoStageProps {
  project: ProjectView;
  onFormatChange: (format: VideoFormat) => Promise<void>;
}

export function VideoStage({ project, onFormatChange }: VideoStageProps) {
  const [switching, setSwitching] = useState(false);
  const video = project.video;
  if (!video) return null;

  // Le lecteur occupe la hauteur disponible sans jamais déborder de l'écran.
  const ratio = video.width / video.height;

  return (
    <div className="flex w-full flex-col items-center">
      <motion.h1
        className="text-title text-balance"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        Votre vidéo est prête.
      </motion.h1>

      <motion.div
        className="mt-8 w-full"
        initial={{ opacity: 0, scale: 0.985 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className="mx-auto overflow-hidden rounded-xl border border-line bg-ink shadow-film"
          style={{
            aspectRatio: `${video.width} / ${video.height}`,
            maxHeight: 'min(54dvh, 620px)',
            width: `min(100%, calc(min(54dvh, 620px) * ${ratio}))`,
          }}
        >
          <video
            key={video.url}
            src={video.url}
            className="h-full w-full"
            controls
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          />
        </div>
      </motion.div>

      <motion.div
        className="mt-7 flex flex-col items-center gap-5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.32 }}
      >
        <div className="flex flex-wrap items-center justify-center gap-3">
          <ButtonLink
            href={video.url}
            download={`atrium-${video.format.replace(':', 'x')}.mp4`}
            variant="primary"
            size="lg"
          >
            Télécharger
          </ButtonLink>
          <ButtonLink href="/" variant="secondary" size="lg">
            Nouvelle vidéo
          </ButtonLink>
        </div>

        <FormatPicker
          value={project.format}
          rendered={project.renderedFormats}
          disabled={switching}
          onSelect={(format) => {
            setSwitching(true);
            void onFormatChange(format).finally(() => setSwitching(false));
          }}
        />

        <p className="text-caption text-faint">
          {video.sceneCount} plans · {video.duration.toFixed(0)} secondes ·{' '}
          {(video.sizeBytes / 1024 / 1024).toFixed(1)} Mo
        </p>
      </motion.div>
    </div>
  );
}
