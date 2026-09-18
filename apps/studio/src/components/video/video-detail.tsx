'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Copy, Images, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OptionPicker } from '@/components/studio/option-picker';
import { RenderProgress } from '@/components/video/render-progress';
import { VideoPlayer } from '@/components/video/video-player';
import { api, ApiRequestError, type SerialisedVideo } from '@/lib/api-client';
import { formatBytes, formatDuration } from '@/lib/utils';

const STYLE_OPTIONS = [
  { value: 'CINEMATIC' as const, label: 'Cinematic' },
  { value: 'MODERN' as const, label: 'Modern' },
  { value: 'LUXURY' as const, label: 'Luxury' },
  { value: 'DYNAMIC' as const, label: 'Dynamic' },
];
const FORMAT_OPTIONS = [
  { value: 'VERTICAL' as const, label: '9:16' },
  { value: 'HORIZONTAL' as const, label: '16:9' },
  { value: 'SQUARE' as const, label: '1:1' },
];
const DURATION_OPTIONS = [
  { value: 'AUTO' as const, label: 'Auto' },
  { value: 'S15' as const, label: '15 s' },
  { value: 'S30' as const, label: '30 s' },
  { value: 'S45' as const, label: '45 s' },
];

const ACTIVE_STATUSES = ['QUEUED', 'PROCESSING', 'RENDERING', 'UPLOADING'];

export function VideoDetail({ initial }: { initial: SerialisedVideo }) {
  const router = useRouter();
  const [video, setVideo] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial.name);
  const [style, setStyle] = useState(initial.style as (typeof STYLE_OPTIONS)[number]['value']);
  const [format, setFormat] = useState(
    initial.aspectRatio as (typeof FORMAT_OPTIONS)[number]['value'],
  );
  const [duration, setDuration] = useState(
    initial.duration as (typeof DURATION_OPTIONS)[number]['value'],
  );

  const active = ACTIVE_STATUSES.includes(video.status);

  // While a render is running, poll its real progress. Polling stops the moment it is not.
  const refresh = useCallback(async () => {
    try {
      const payload = await api<{ video: SerialisedVideo }>(`/api/videos/${video.id}`);
      setVideo(payload.video);
    } catch {
      // A transient failure must not break the page; the next tick will retry.
    }
  }, [video.id]);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => void refresh(), 2000);
    return () => clearInterval(timer);
  }, [active, refresh]);

  const regenerate = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = await api<{ video: SerialisedVideo }>(
        `/api/videos/${video.id}/regenerate`,
        {
          method: 'POST',
          body: JSON.stringify({ name, style, aspectRatio: format, duration }),
        },
      );
      setVideo(payload.video);
      router.refresh();
    } catch (regenerateError) {
      setError(
        regenerateError instanceof ApiRequestError
          ? regenerateError.error.message
          : 'La régénération a échoué.',
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Supprimer définitivement cette vidéo ?')) return;
    await api(`/api/videos/${video.id}`, { method: 'DELETE' });
    router.push('/dashboard/videos');
    router.refresh();
  };

  const duplicate = async () => {
    const payload = await api<{ video: SerialisedVideo }>(`/api/videos/${video.id}/duplicate`, {
      method: 'POST',
    });
    router.push(`/dashboard/videos/${payload.video.id}`);
  };

  const download = () => {
    if (!video.videoUrl) return;
    const url = new URL(video.videoUrl, window.location.origin);
    url.searchParams.set('download', '1');
    window.location.href = url.toString();
  };

  const settingsChanged =
    style !== video.style || format !== video.aspectRatio || duration !== video.duration;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        {video.status === 'COMPLETED' && video.videoUrl ? (
          <>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-ink-950">
                Votre vidéo est prête.
              </h1>
              <p className="mt-1 text-sm text-ink-500">
                {video.width}×{video.height} ·{' '}
                {video.aspectRatio === 'VERTICAL' ? '9:16' : video.aspectRatio === 'SQUARE' ? '1:1' : '16:9'}
                {video.durationSeconds ? ` · ${formatDuration(video.durationSeconds)}` : ''}
                {video.bytes ? ` · ${formatBytes(video.bytes)}` : ''}
              </p>
            </div>
            <VideoPlayer
              src={video.videoUrl}
              poster={video.posterUrl}
              aspectRatio={video.aspectRatio}
              onDownload={download}
            />
          </>
        ) : active ? (
          <RenderProgress job={video.job} />
        ) : video.status === 'FAILED' ? (
          <div className="rounded-[var(--radius-card)] border border-red-200 bg-red-50 p-6">
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="font-medium text-red-900">La génération a échoué</p>
                <p className="mt-1 text-sm text-red-700">
                  {video.error?.message ?? 'Une erreur est survenue pendant le rendu.'}
                </p>
                <Button size="sm" variant="outline" className="mt-4" onClick={() => void regenerate()}>
                  <RefreshCw />
                  Réessayer
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-[var(--radius-card)] border border-dashed border-ink-200 bg-white p-12 text-center">
            <p className="text-ink-500">Ce projet n’a pas encore été généré.</p>
            <Button className="mt-4" size="sm" onClick={() => void regenerate()} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              Générer la vidéo
            </Button>
          </div>
        )}
      </div>

      <aside className="space-y-6">
        <div className="rounded-[var(--radius-card)] border border-ink-200 bg-white p-5">
          <label htmlFor="video-name" className="mb-2 block text-sm font-medium text-ink-700">
            Nom du projet
          </label>
          <Input
            id="video-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => {
              if (name !== video.name) {
                void api(`/api/videos/${video.id}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ name }),
                }).then(() => router.refresh());
              }
            }}
          />
          <p className="mt-2 text-xs text-ink-400">Ce nom n’apparaît pas dans la vidéo.</p>
        </div>

        <div className="space-y-5 rounded-[var(--radius-card)] border border-ink-200 bg-white p-5">
          <OptionPicker label="Style" options={STYLE_OPTIONS} value={style} onChange={setStyle} />
          <OptionPicker
            label="Format"
            options={FORMAT_OPTIONS}
            value={format}
            onChange={setFormat}
            columns={3}
          />
          <OptionPicker
            label="Durée"
            options={DURATION_OPTIONS}
            value={duration}
            onChange={setDuration}
            columns={4}
          />

          {error ? (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <Button
            className="w-full"
            variant={settingsChanged ? 'accent' : 'primary'}
            disabled={busy || active}
            onClick={() => void regenerate()}
          >
            {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Regénérer
          </Button>
          <p className="text-xs text-ink-400">
            Les photos déjà importées ne sont ni retéléchargées ni réanalysées.
          </p>
        </div>

        <div className="space-y-2 rounded-[var(--radius-card)] border border-ink-200 bg-white p-5">
          <Button asChild variant="ghost" size="sm" className="w-full justify-start">
            <a href={`/dashboard/listings/${video.listingId}`}>
              <Images />
              Modifier les photos
            </a>
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => void duplicate()}>
            <Copy />
            Dupliquer
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start text-red-600" onClick={() => void remove()}>
            <Trash2 />
            Supprimer
          </Button>
        </div>
      </aside>
    </div>
  );
}
