'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, Loader2, Sparkles, Upload, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhotoGrid } from '@/components/studio/photo-grid';
import { UploadZone } from '@/components/studio/upload-zone';
import { OptionPicker } from '@/components/studio/option-picker';
import { ImportSteps, type StepState } from '@/components/studio/import-steps';
import { api, ApiRequestError, type SerialisedListing, type SerialisedVideo } from '@/lib/api-client';

type Phase = 'url' | 'importing' | 'photos';

interface ImportPayload {
  listing: SerialisedListing;
  suggestedSelection: string[];
}

function requestImport(url: string): Promise<ImportPayload> {
  return api<ImportPayload>('/api/listings/import', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

interface CreateFlowProps {
  initialUrl?: string;
  maxUploadBytes: number;
  credits: number;
  costPerVideo: number;
}

const STYLE_OPTIONS = [
  { value: 'CINEMATIC' as const, label: 'Cinematic', hint: 'Lent, premium' },
  { value: 'MODERN' as const, label: 'Modern', hint: 'Vif, contemporain' },
  { value: 'LUXURY' as const, label: 'Luxury', hint: 'Plans longs' },
  { value: 'DYNAMIC' as const, label: 'Dynamic', hint: 'Rythme rapide' },
];

const FORMAT_OPTIONS = [
  { value: 'VERTICAL' as const, label: '9:16', hint: 'Reels, TikTok' },
  { value: 'HORIZONTAL' as const, label: '16:9', hint: 'YouTube, web' },
  { value: 'SQUARE' as const, label: '1:1', hint: 'Fil social' },
];

const DURATION_OPTIONS = [
  { value: 'AUTO' as const, label: 'Auto', hint: 'Selon les photos' },
  { value: 'S15' as const, label: '15 s' },
  { value: 'S30' as const, label: '30 s' },
  { value: 'S45' as const, label: '45 s' },
];

/**
 * URL -> photos -> style -> format -> generate.
 *
 * One screen, no wizard: everything after the import is visible at once, because the whole
 * product has to be understandable in ten seconds.
 */
export function CreateFlow({ initialUrl, maxUploadBytes, credits, costPerVideo }: CreateFlowProps) {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>(initialUrl ? 'importing' : 'url');
  const [url, setUrl] = useState(initialUrl ?? '');
  const [listing, setListing] = useState<SerialisedListing | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [error, setError] = useState<{ message: string; recovery?: string | null } | null>(null);
  const [importStep, setImportStep] = useState(initialUrl ? 1 : 0);
  const [showUpload, setShowUpload] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [name, setName] = useState('');
  const [style, setStyle] = useState<(typeof STYLE_OPTIONS)[number]['value']>('CINEMATIC');
  const [format, setFormat] = useState<(typeof FORMAT_OPTIONS)[number]['value']>('VERTICAL');
  const [duration, setDuration] = useState<(typeof DURATION_OPTIONS)[number]['value']>('AUTO');

  const applyListing = useCallback(
    (payload: { listing: SerialisedListing; suggestedSelection: string[] }) => {
      setListing(payload.listing);
      setSuggested(payload.suggestedSelection);
      setSelection(payload.suggestedSelection);
      setName((current) => current || payload.listing.title || '');
      setPhase('photos');
    },
    [],
  );

  const handleImportFailure = useCallback((importError: unknown) => {
    const apiError = importError instanceof ApiRequestError ? importError.error : null;
    setError({
      message: apiError?.message ?? "L'import a échoué.",
      recovery: apiError?.recovery ?? 'MANUAL_UPLOAD',
    });
    setPhase('url');
    setShowUpload(apiError?.recovery === 'MANUAL_UPLOAD');
  }, []);

  const runImport = useCallback(
    async (value: string) => {
      setError(null);
      setPhase('importing');
      setImportStep(1);

      try {
        const payload = await requestImport(value);
        setImportStep(4);
        applyListing(payload);
      } catch (importError) {
        handleImportFailure(importError);
      }
    },
    [applyListing, handleImportFailure],
  );

  // A URL handed over by the landing page is imported on mount. The component already starts in
  // the `importing` phase, so this effect only awaits the request and applies its result.
  useEffect(() => {
    if (!initialUrl) return;
    let cancelled = false;

    void requestImport(initialUrl)
      .then((payload) => {
        if (cancelled) return;
        setImportStep(4);
        applyListing(payload);
      })
      .catch((importError: unknown) => {
        if (!cancelled) handleImportFailure(importError);
      });

    return () => {
      cancelled = true;
    };
  }, [initialUrl, applyListing, handleImportFailure]);

  // Visual progress for the import: each step flips when its work actually starts.
  useEffect(() => {
    if (phase !== 'importing') return;
    const timers = [
      setTimeout(() => setImportStep((step) => Math.max(step, 2)), 1200),
      setTimeout(() => setImportStep((step) => Math.max(step, 3)), 3200),
    ];
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  const startManualUpload = async () => {
    setError(null);
    const payload = await api<{ listing: SerialisedListing }>('/api/listings/manual', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    setListing(payload.listing);
    setSuggested([]);
    setSelection([]);
    setPhase('photos');
    setShowUpload(true);
  };

  const uploadFiles = async (files: File[]) => {
    if (!listing) return;
    const form = new FormData();
    for (const file of files) form.append('files', file);

    const payload = await api<{ listing: SerialisedListing; suggestedSelection: string[] }>(
      `/api/listings/${listing.id}/images`,
      { method: 'POST', body: form },
    );
    setListing(payload.listing);
    setSuggested(payload.suggestedSelection);
    setSelection((current) => (current.length === 0 ? payload.suggestedSelection : current));
  };

  const deleteImage = async (imageId: string) => {
    if (!listing) return;
    const payload = await api<{ listing: SerialisedListing; suggestedSelection: string[] }>(
      `/api/listings/${listing.id}/images?imageId=${imageId}`,
      { method: 'DELETE' },
    );
    setListing(payload.listing);
    setSuggested(payload.suggestedSelection);
    setSelection((current) => current.filter((id) => id !== imageId));
  };

  const generate = async () => {
    if (!listing) return;
    setGenerating(true);
    setError(null);

    try {
      const created = await api<{ video: SerialisedVideo }>('/api/videos', {
        method: 'POST',
        body: JSON.stringify({
          listingId: listing.id,
          imageIds: selection,
          name: name || undefined,
          style,
          aspectRatio: format,
          duration,
        }),
      });
      await api(`/api/videos/${created.video.id}/regenerate`, { method: 'POST' });
      router.push(`/dashboard/videos/${created.video.id}`);
    } catch (generateError) {
      const apiError = generateError instanceof ApiRequestError ? generateError.error : null;
      setError({
        message: apiError?.message ?? 'La génération a échoué.',
        recovery: apiError?.recovery,
      });
      setGenerating(false);
    }
  };

  if (phase === 'importing') {
    const steps: { label: string; state: StepState }[] = [
      { label: 'Analyse du lien', state: importStep > 1 ? 'done' : 'active' },
      {
        label: 'Recherche des photos',
        state: importStep > 2 ? 'done' : importStep === 2 ? 'active' : 'pending',
      },
      {
        label: 'Organisation des images',
        state: importStep > 3 ? 'done' : importStep === 3 ? 'active' : 'pending',
      },
      { label: 'Préparation de la vidéo', state: importStep > 3 ? 'active' : 'pending' },
    ];
    return <ImportSteps title="Analyse de votre annonce…" steps={steps} />;
  }

  if (phase === 'url') {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-950">Créer une vidéo</h1>
        <p className="mt-2 text-ink-500">
          Collez le lien de votre annonce. Nous récupérons les photos publiques disponibles.
        </p>

        <form
          className="mt-6 flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            if (url.trim()) void runImport(url.trim());
          }}
        >
          <Input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.airbnb.fr/rooms/..."
            aria-label="Lien de l'annonce"
            className="h-13 flex-1 text-base"
            inputMode="url"
          />
          <Button type="submit" size="lg" variant="accent">
            Analyser l’annonce
            <ArrowRight />
          </Button>
        </form>

        {error ? (
          <div role="alert" className="mt-5 rounded-[var(--radius-card)] border border-amber-200 bg-amber-50 p-5">
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm text-amber-900">{error.message}</p>
                {error.recovery === 'MANUAL_UPLOAD' ? (
                  <Button size="sm" variant="outline" className="mt-3" onClick={startManualUpload}>
                    <Upload />
                    Importer les photos
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-8 border-t border-ink-200 pt-6">
          <p className="text-sm text-ink-500">
            Vous préférez partir de vos propres fichiers ?{' '}
            <button
              type="button"
              onClick={startManualUpload}
              className="font-medium text-ink-900 underline underline-offset-4"
            >
              Importer des photos
            </button>
          </p>
          <p className="mt-2 text-sm text-ink-400">
            Pour tester le produit sans annonce réelle, utilisez le lien{' '}
            <button
              type="button"
              onClick={() => void runImport('https://demo.nova.studio/villa')}
              className="font-medium text-ink-600 underline underline-offset-4"
            >
              https://demo.nova.studio/villa
            </button>
          </p>
        </div>
      </div>
    );
  }

  const enoughPhotos = selection.length >= 3;
  const enoughCredits = credits >= costPerVideo;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-950">
            {listing?.title ?? 'Vos photos'}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {listing?.images.length ?? 0} photos disponibles · {selection.length} sélectionnées
            {listing?.notice ? ` · ${listing.notice}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelection(suggested)} disabled={suggested.length === 0}>
            <Sparkles />
            Optimiser automatiquement
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelection(listing?.images.map((image) => image.id) ?? [])}
          >
            Tout sélectionner
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelection([])}>
            Tout désélectionner
          </Button>
        </div>
      </div>

      {listing && listing.images.length > 0 ? (
        <PhotoGrid
          images={listing.images}
          selection={selection}
          onSelectionChange={setSelection}
          onDelete={(id) => void deleteImage(id)}
        />
      ) : null}

      {showUpload || (listing?.images.length ?? 0) === 0 ? (
        <UploadZone onFiles={uploadFiles} maxBytes={maxUploadBytes} />
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowUpload(true)}>
          <Upload />
          Ajouter des photos
        </Button>
      )}

      <div className="grid gap-6 rounded-[var(--radius-card)] border border-ink-200 bg-white p-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div>
            <label htmlFor="video-name" className="mb-3 block text-sm font-medium text-ink-700">
              Nom du projet
            </label>
            <Input
              id="video-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Villa avec piscine"
            />
            <p className="mt-2 text-xs text-ink-400">
              Ce nom sert uniquement à organiser vos projets. Il n’apparaît pas dans la vidéo.
            </p>
          </div>
          <OptionPicker label="Style" options={STYLE_OPTIONS} value={style} onChange={setStyle} />
        </div>

        <div className="space-y-6">
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
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error.message}
        </p>
      ) : null}

      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-card)] border border-ink-200 bg-white/95 p-4 shadow-[var(--shadow-lift)] backdrop-blur">
        <p className="text-sm text-ink-500">
          {enoughPhotos
            ? `${selection.length} photos · ${costPerVideo} crédit${costPerVideo > 1 ? 's' : ''} · ${credits} disponible${credits > 1 ? 's' : ''}`
            : 'Sélectionnez au moins 3 photos pour continuer.'}
        </p>
        <Button
          size="lg"
          variant="accent"
          disabled={!enoughPhotos || !enoughCredits || generating}
          onClick={() => void generate()}
        >
          {generating ? <Loader2 className="animate-spin" /> : <Wand2 />}
          {enoughCredits ? 'Générer la vidéo' : 'Crédits insuffisants'}
        </Button>
      </div>
    </div>
  );
}
