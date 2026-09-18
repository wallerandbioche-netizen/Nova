'use client';

import { useRef, useState } from 'react';
import { Download, Maximize2, Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** A quiet player: the video is the subject, the controls stay out of the way. */
export function VideoPlayer({
  src,
  poster,
  aspectRatio,
  onDownload,
}: {
  src: string;
  poster: string | null;
  aspectRatio: string;
  onDownload: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  };

  const restart = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    void video.play();
  };

  return (
    <div>
      <div
        className={cn(
          'relative mx-auto overflow-hidden rounded-[var(--radius-card)] bg-ink-950 shadow-[var(--shadow-lift)]',
          aspectRatio === 'VERTICAL' && 'aspect-9/16 max-w-[380px]',
          aspectRatio === 'HORIZONTAL' && 'aspect-video w-full',
          aspectRatio === 'SQUARE' && 'aspect-square max-w-[560px]',
        )}
      >
        <video
          ref={videoRef}
          src={src}
          poster={poster ?? undefined}
          playsInline
          controls
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          className="h-full w-full"
        />
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button variant="outline" size="sm" onClick={toggle}>
          {playing ? <Pause /> : <Play />}
          {playing ? 'Pause' : 'Lecture'}
        </Button>
        <Button variant="outline" size="sm" onClick={restart}>
          <RotateCcw />
          Recommencer
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void videoRef.current?.requestFullscreen?.()}
        >
          <Maximize2 />
          Plein écran
        </Button>
        <Button variant="accent" size="sm" onClick={onDownload}>
          <Download />
          Télécharger le MP4
        </Button>
      </div>
    </div>
  );
}
