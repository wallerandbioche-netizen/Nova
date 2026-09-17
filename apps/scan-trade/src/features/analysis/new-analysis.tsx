'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { LoadingAnalysis } from '@/components/analysis/loading-analysis';
import { UploadZone } from '@/components/analysis/upload-zone';
import { apiRequest, type ApiFailure } from '@/features/auth/api-client';
import type { AnalysisDetail } from '@/types/analysis';

const MARKET_OPTIONS = [
  { value: 'CRYPTO', label: 'Crypto' },
  { value: 'FOREX', label: 'Forex' },
  { value: 'INDICES', label: 'Indices' },
  { value: 'STOCKS', label: 'Actions' },
  { value: 'COMMODITIES', label: 'Matières premières' },
  { value: 'OTHER', label: 'Autre' },
];

type Phase = 'idle' | 'uploading' | 'scanning';

export interface NewAnalysisProps {
  maxUploadBytes: number;
  isSubscribed: boolean;
}

/**
 * The upload → scan flow (§7).
 *
 * Two server calls, deliberately: the screenshot is stored first and the row
 * exists before the model is ever called. If the scan fails — or the tab is
 * closed mid-analysis — the analysis is still in the history with a readable
 * status, and can be retried without re-uploading.
 */
export function NewAnalysis({ maxUploadBytes, isSubscribed }: NewAnalysisProps) {
  const router = useRouter();
  const toast = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [asset, setAsset] = useState('');
  const [timeframe, setTimeframe] = useState('');
  const [market, setMarket] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  // Object URLs are a leak if they are not revoked when the choice changes.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function startScan() {
    if (!file) return;
    setFailure(null);
    setPhase('uploading');

    const form = new FormData();
    form.append('image', file);
    if (asset.trim()) form.append('asset', asset.trim());
    if (timeframe.trim()) form.append('timeframe', timeframe.trim());
    if (market) form.append('market', market);

    const created = await apiRequest<{ analysis: AnalysisDetail }>('/api/analyses', {
      method: 'POST',
      body: form,
    });

    if (!created.ok) {
      setFailure(created.error);
      setPhase('idle');
      return;
    }

    const analysisId = created.data.analysis.id;
    setPhase('scanning');

    const scanned = await apiRequest<{ analysis: AnalysisDetail }>(
      `/api/analyses/${analysisId}/scan`,
      {
        method: 'POST',
      },
    );

    if (!scanned.ok) {
      // The row exists either way, so the user is sent to it: the page explains
      // what went wrong and offers a retry that costs no second upload.
      toast.error(scanned.error.message);
      router.push(`/analyses/${analysisId}`);
      return;
    }

    router.push(`/analyses/${analysisId}`);
    router.refresh();
  }

  if (!isSubscribed) {
    return (
      <Card className="px-5 py-10 text-center sm:px-6">
        <h2 className="text-heading font-semibold text-content">Débloque Scan Trade</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-content-muted">
          Un abonnement Scan Trade Pro actif est nécessaire pour lancer un scan. 19,90 € par mois,
          résiliable à tout moment.
        </p>
        <div className="mt-8">
          <ButtonLink href="/abonnement" size="lg">
            Voir l&apos;abonnement
          </ButtonLink>
        </div>
      </Card>
    );
  }

  if (phase === 'scanning') {
    return <LoadingAnalysis />;
  }

  return (
    <div className="space-y-5">
      {failure && (
        <ErrorState
          title={
            failure.code === 'subscription_required' ? 'Abonnement requis' : 'Analyse impossible'
          }
          message={failure.message}
          action={
            failure.code === 'subscription_required' ? (
              <ButtonLink href="/abonnement" size="sm">
                Voir l&apos;abonnement
              </ButtonLink>
            ) : undefined
          }
        />
      )}

      <UploadZone onSelect={setFile} maxBytes={maxUploadBytes} disabled={phase !== 'idle'} />

      {previewUrl && (
        <Card className="overflow-hidden">
          <CardHeader
            title="Aperçu"
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFile(null)}
                disabled={phase !== 'idle'}
              >
                Changer d&apos;image
              </Button>
            }
          />
          <div className="mt-4 border-t border-border bg-black/40 p-4">
            <img
              src={previewUrl}
              alt="Aperçu de la capture importée"
              className="mx-auto max-h-[420px] w-full object-contain"
            />
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Contexte (optionnel)"
          description="Ces champs orientent la lecture. Si le graphique les contredit, l'image fait foi."
        />
        <div className="grid gap-4 px-5 pb-5 pt-4 sm:grid-cols-3 sm:px-6 sm:pb-6">
          <Input
            label="Actif"
            value={asset}
            onChange={(event) => setAsset(event.target.value)}
            placeholder="BTC/USDT"
            maxLength={40}
            disabled={phase !== 'idle'}
          />
          <Input
            label="Timeframe"
            value={timeframe}
            onChange={(event) => setTimeframe(event.target.value)}
            placeholder="4H"
            maxLength={20}
            disabled={phase !== 'idle'}
          />
          <Select
            label="Type de marché"
            value={market}
            onChange={(event) => setMarket(event.target.value)}
            options={MARKET_OPTIONS}
            placeholder="Non précisé"
            disabled={phase !== 'idle'}
          />
        </div>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-content-faint sm:max-w-md">
          Scan Trade lit uniquement ce qui est visible sur la capture. Aucun ordre n&apos;est
          transmis à un courtier.
        </p>
        <Button
          size="lg"
          onClick={() => void startScan()}
          disabled={!file}
          loading={phase === 'uploading'}
        >
          Lancer le Scan
        </Button>
      </div>
    </div>
  );
}
