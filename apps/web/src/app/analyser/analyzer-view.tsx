'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CandlestickChart, Image as ImageIcon, Sparkles } from 'lucide-react';
import type { Candle, Timeframe } from '@/types/market';
import type { MarketAnalysis, RiskProfile } from '@/types/analysis';
import {
  DEFAULT_INDICATORS,
  DRAWING_TOOL_POINTS,
  type Drawing,
  type DrawingPoint,
  type DrawingTool,
  type IndicatorToggles,
} from '@/types/chart';
import { AiPanel } from '@/components/analysis/ai-panel';
import { AnalysisProgress } from '@/components/analysis/analysis-progress';
import { ChartToolbar } from '@/components/charts/chart-toolbar';
import { DrawingToolbar } from '@/components/charts/drawing-toolbar';
import { ScreenshotDropzone } from '@/components/upload/screenshot-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Field, Textarea } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { useHistory } from '@/hooks/use-history';
import { useSettings } from '@/hooks/use-settings';
import { ASSETS, generateCandles } from '@/lib/market-data';
import { RISK_PROFILE_LABEL } from '@/lib/utils/labels';
import { createId } from '@/lib/utils/id';
import { cn } from '@/lib/utils/cn';

const PriceChart = dynamic(
  () => import('@/components/charts/price-chart').then((module) => module.PriceChart),
  { ssr: false, loading: () => <Skeleton className="h-[460px] w-full rounded-none" /> },
);

const RISK_OPTIONS: { value: RiskProfile; label: string }[] = [
  { value: 'prudent', label: RISK_PROFILE_LABEL.prudent },
  { value: 'modere', label: RISK_PROFILE_LABEL.modere },
  { value: 'agressif', label: RISK_PROFILE_LABEL.agressif },
];

type Mode = 'marche' | 'capture';

interface ScreenshotRefusal {
  message: string;
  missing: string[];
}

export function AnalyzerView({
  initialAssetId,
  initialTimeframe,
}: {
  initialAssetId: string;
  initialTimeframe: Timeframe;
}) {
  const [settings, updateSettings] = useSettings();
  const { add } = useHistory();
  const toast = useToast();

  const [mode, setMode] = useState<Mode>('marche');
  const [assetId, setAssetId] = useState(initialAssetId);
  const [timeframe, setTimeframe] = useState<Timeframe>(initialTimeframe);
  const [riskProfile, setRiskProfile] = useState<RiskProfile>(settings.riskProfile);
  const [indicators, setIndicators] = useState<IndicatorToggles>(DEFAULT_INDICATORS);
  const [tool, setTool] = useState<DrawingTool>('cursor');
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [pending, setPending] = useState<DrawingPoint[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const [context, setContext] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<MarketAnalysis | null>(null);
  const [headline, setHeadline] = useState<string | undefined>(undefined);
  const [analyzing, setAnalyzing] = useState(false);
  const [refusal, setRefusal] = useState<ScreenshotRefusal | null>(null);
  const [chartCandles, setChartCandles] = useState<Candle[] | null>(null);
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => setRiskProfile(settings.riskProfile), [settings.riskProfile]);

  // Simulated series are deterministic, so the chart and the engine see the
  // exact same candles without an extra round trip.
  const candles = useMemo(
    () => chartCandles ?? generateCandles({ assetId, timeframe, count: 320 }),
    [chartCandles, assetId, timeframe],
  );

  const asset = ASSETS.find((item) => item.id === assetId) ?? ASSETS[0]!;
  const matchesAnalysis =
    analysis !== null && analysis.asset.id === assetId && analysis.timeframe === timeframe;

  const resetAnalysis = useCallback(() => {
    setAnalysis(null);
    setHeadline(undefined);
    setRefusal(null);
    setChartCandles(null);
  }, []);

  const runMarketAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setRefusal(null);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ assetId, timeframe, riskProfile, context: context || undefined }),
      });
      if (!response.ok) throw new Error('analyse indisponible');
      const payload = (await response.json()) as {
        analysis: MarketAnalysis;
        reasoning: { headline: string };
        candles: Candle[];
      };
      setAnalysis(payload.analysis);
      setHeadline(payload.reasoning.headline);
      setChartCandles(payload.candles);
      add(payload.analysis);
      toast.push({
        tone: payload.analysis.setup ? 'success' : 'info',
        title: payload.analysis.setup ? 'Configuration identifiée' : 'Aucun trade retenu',
        description: payload.analysis.setup
          ? `${payload.analysis.setup.label} · R/R 1:${payload.analysis.setup.riskReward.toFixed(1)}`
          : 'Le détail des filtres est affiché dans le panneau.',
      });
    } catch {
      toast.push({
        tone: 'warning',
        title: 'Analyse impossible',
        description: 'Le service d’analyse n’a pas répondu. Réessayez dans un instant.',
      });
    } finally {
      setAnalyzing(false);
    }
  }, [assetId, timeframe, riskProfile, context, add, toast]);

  const runScreenshotAnalysis = useCallback(async () => {
    if (!file) return;
    setAnalyzing(true);
    setRefusal(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('riskProfile', riskProfile);
      form.append('assetId', assetId);
      form.append('timeframe', timeframe);
      if (context) form.append('context', context);

      const response = await fetch('/api/analyze/screenshot', { method: 'POST', body: form });
      const payload = (await response.json()) as
        | {
            readable: true;
            analysis: MarketAnalysis;
            reasoning: { headline: string };
            candles: Candle[];
          }
        | { readable: false; message: string; missing: string[] }
        | { error: string };

      if ('error' in payload) {
        toast.push({ tone: 'warning', title: 'Capture refusée', description: payload.error });
        return;
      }
      if (!payload.readable) {
        setAnalysis(null);
        setRefusal({ message: payload.message, missing: payload.missing });
        return;
      }

      setAnalysis(payload.analysis);
      setHeadline(payload.reasoning.headline);
      setChartCandles(payload.candles);
      add(payload.analysis);
    } catch {
      toast.push({
        tone: 'warning',
        title: 'Lecture impossible',
        description: 'La capture n’a pas pu être analysée.',
      });
    } finally {
      setAnalyzing(false);
    }
  }, [file, riskProfile, assetId, timeframe, context, add, toast]);

  const handleChartClick = useCallback(
    (point: DrawingPoint) => {
      if (tool === 'cursor') return;
      const required = DRAWING_TOOL_POINTS[tool];
      const points = [...pending, point];
      if (points.length < required) {
        setPending(points);
        return;
      }
      setDrawings((current) => [
        ...current,
        {
          id: createId('draw'),
          tool,
          points,
          label:
            tool === 'entry'
              ? 'Entrée'
              : tool === 'stop'
                ? 'Stop'
                : tool === 'support'
                  ? 'Support'
                  : tool === 'resistance'
                    ? 'Résistance'
                    : undefined,
          color:
            tool === 'stop'
              ? 'var(--color-short)'
              : tool === 'entry'
                ? 'var(--color-brand)'
                : tool === 'support'
                  ? 'var(--color-long)'
                  : tool === 'resistance'
                    ? 'var(--color-short)'
                    : 'var(--color-brand)',
        },
      ]);
      setPending([]);
    },
    [tool, pending],
  );

  const chart = (
    <PriceChart
      candles={candles}
      precision={asset.precision}
      indicators={indicators}
      setup={matchesAnalysis ? analysis.setup : null}
      levels={matchesAnalysis ? analysis.supportResistance : []}
      swings={matchesAnalysis ? analysis.marketStructure.swings : []}
      drawings={drawings}
      theme={settings.theme === 'dark' ? 'dark' : 'light'}
      height={fullscreen ? Math.max(520, (mounted ? window.innerHeight : 800) - 190) : 460}
      onChartClick={handleChartClick}
      crosshairArmed={tool !== 'cursor'}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          label="Source de l’analyse"
          value={mode}
          onChange={(next) => {
            setMode(next);
            resetAnalysis();
          }}
          items={[
            { value: 'marche', label: 'Graphique' },
            { value: 'capture', label: 'Capture d’écran' },
          ]}
        />
        <div className="flex items-center gap-2">
          <span className="hidden text-[12px] text-ink-muted sm:block">Niveau de risque</span>
          <Segmented
            label="Niveau de risque"
            size="sm"
            value={riskProfile}
            onChange={(next) => {
              setRiskProfile(next);
              updateSettings({ riskProfile: next });
            }}
            options={RISK_OPTIONS}
          />
        </div>
      </div>

      <div
        className={cn(
          'grid gap-4',
          fullscreen ? 'grid-cols-1' : 'lg:grid-cols-[minmax(0,1fr)_374px]',
        )}
      >
        <div
          className={cn(
            'min-w-0 space-y-4',
            fullscreen && 'fixed inset-0 z-[70] bg-canvas p-4 overflow-auto',
          )}
        >
          {mode === 'marche' ? (
            <Card className="overflow-hidden">
              <ChartToolbar
                assets={ASSETS}
                assetId={assetId}
                onAssetChange={(next) => {
                  setAssetId(next);
                  resetAnalysis();
                }}
                timeframe={timeframe}
                onTimeframeChange={(next) => {
                  setTimeframe(next);
                  resetAnalysis();
                }}
                indicators={indicators}
                onIndicatorsChange={setIndicators}
                tool={tool}
                onToolChange={setTool}
                onClearDrawings={() => {
                  setDrawings([]);
                  setPending([]);
                }}
                drawingCount={drawings.length}
                fullscreen={fullscreen}
                onFullscreenToggle={() => setFullscreen((current) => !current)}
                onAnalyze={runMarketAnalysis}
                analyzing={analyzing}
              />
              {mounted ? chart : <Skeleton className="h-[460px] w-full rounded-none" />}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2">
                <p className="text-[11.5px] text-ink-subtle">
                  Données simulées — pas un flux de marché en direct. Molette pour zoomer, glisser
                  pour naviguer.
                </p>
                <DrawingToolbar
                  tool={tool}
                  onToolChange={setTool}
                  onClear={() => {
                    setDrawings([]);
                    setPending([]);
                  }}
                  count={drawings.length}
                  className="sm:hidden"
                />
              </div>
            </Card>
          ) : (
            <Card>
              <CardHeader
                title="Nouvelle analyse"
                description="Déposez une capture de votre graphique pour lancer l’analyse."
                icon={<ImageIcon className="h-4 w-4" aria-hidden />}
              />
              <CardContent className="space-y-4">
                <ScreenshotDropzone file={file} onFile={setFile} disabled={analyzing} />

                <Field
                  label="Contexte (optionnel)"
                  htmlFor="analysis-context"
                  hint="Capital et risque ne sont pas vérifiables par le moteur : ils sont repris tels quels."
                >
                  <Textarea
                    id="analysis-context"
                    placeholder="Ex. : capital 5 000 €, risque 1 % — je vise une cassure du range"
                    value={context}
                    onChange={(event) => setContext(event.target.value)}
                    maxLength={500}
                  />
                </Field>

                <Button
                  fullWidth
                  size="lg"
                  onClick={runScreenshotAnalysis}
                  disabled={!file || analyzing}
                >
                  <Sparkles className="h-4 w-4" aria-hidden />
                  {analyzing ? 'Analyse en cours…' : 'Lancer l’analyse'}
                </Button>
                <p className="text-center text-[11.5px] text-ink-subtle">
                  Gratuit et illimité — verdict visible, le reste réservé aux abonnés.
                </p>

                {refusal ? (
                  <div
                    role="alert"
                    className="rounded-[12px] border border-warn/30 bg-warn-soft p-3.5"
                  >
                    <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                      <AlertTriangle className="h-4 w-4 text-warn" aria-hidden />
                      {refusal.message}
                    </p>
                    <ul className="mt-2 space-y-1">
                      {refusal.missing.map((item) => (
                        <li key={item} className="text-[12px] leading-4 text-ink-muted">
                          • {item}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-[12px] leading-4 text-ink-muted">
                      Aucune donnée n’est inventée pour combler ce qui manque. Vous pouvez analyser
                      le même actif depuis l’onglet « Graphique ».
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}
        </div>

        <div ref={panelRef} className={cn('min-w-0', fullscreen && 'hidden')}>
          {analyzing ? (
            <Card className="p-5">
              <AnalysisProgress />
              <div className="mt-5 space-y-2">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </Card>
          ) : analysis ? (
            <AiPanel
              analysis={analysis}
              {...(headline ? { headline } : {})}
              unlocked={settings.subscribed}
              accountSize={settings.accountSize}
              riskPercent={settings.riskPercent}
              onRiskPersist={(values) => updateSettings(values)}
              className="lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)]"
            />
          ) : (
            <Card className="flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand">
                <CandlestickChart className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-[15px] font-semibold text-ink">Aucune analyse en cours</p>
                <p className="mt-1 max-w-xs text-[13px] leading-5 text-ink-muted">
                  {mode === 'marche'
                    ? 'Choisissez un actif et une unité de temps, puis lancez l’analyse.'
                    : 'Déposez une capture de graphique pour lancer la lecture.'}
                </p>
              </div>
              {mode === 'marche' ? (
                <Button onClick={runMarketAnalysis}>
                  <Sparkles className="h-4 w-4" aria-hidden />
                  Lancer l’analyse
                </Button>
              ) : null}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
