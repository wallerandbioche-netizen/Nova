'use client';

import { useCallback, useState } from 'react';
import { AlertTriangle, ImageIcon, ScanLine, Sparkles } from 'lucide-react';
import type { Candle } from '@/types/market';
import type { MarketAnalysis, RiskProfile } from '@/types/analysis';
import { AiPanel } from '@/components/analysis/ai-panel';
import { AnalysisProgress } from '@/components/analysis/analysis-progress';
import { ScreenshotDropzone } from '@/components/upload/screenshot-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Field, Textarea } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { useHistory } from '@/hooks/use-history';
import { useSettings } from '@/hooks/use-settings';
import { runLocalAnalysis } from '@/lib/ai/local-analysis';
import { compressImage } from '@/lib/utils/image';
import { RISK_PROFILE_LABEL } from '@/lib/utils/labels';

const RISK_OPTIONS: { value: RiskProfile; label: string }[] = [
  { value: 'prudent', label: RISK_PROFILE_LABEL.prudent },
  { value: 'modere', label: RISK_PROFILE_LABEL.modere },
  { value: 'agressif', label: RISK_PROFILE_LABEL.agressif },
];

/** Instruments used by the demonstration analysis, in rotation. */
const DEMO_SCENARIOS = [
  { assetId: 'XAUUSD', timeframe: '5m' },
  { assetId: 'SPX500', timeframe: '1D' },
  { assetId: 'EURUSD', timeframe: '1D' },
  { assetId: 'BTCUSDT', timeframe: '15m' },
] as const;

interface Refusal {
  message: string;
  missing: string[];
}

/**
 * The analyzer reads a chart screenshot — that is the only way in. Nothing is
 * produced when the image cannot be read: the refusal says what is missing,
 * and the demonstration analysis, if asked for, states that it does not come
 * from the uploaded capture.
 */
export function AnalyzerView() {
  const [settings, updateSettings] = useSettings();
  const { add } = useHistory();
  const toast = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [context, setContext] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<MarketAnalysis | null>(null);
  const [headline, setHeadline] = useState<string | undefined>(undefined);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [demoIndex, setDemoIndex] = useState(0);

  const riskProfile = settings.riskProfile;

  const reset = useCallback(() => {
    setAnalysis(null);
    setHeadline(undefined);
    setRefusal(null);
    setPreview(null);
  }, []);

  const runScreenshotAnalysis = useCallback(async () => {
    if (!file) return;
    setAnalyzing(true);
    setRefusal(null);
    setAnalysis(null);

    try {
      const form = new FormData();
      form.append('file', file);
      form.append('riskProfile', riskProfile);
      if (context) form.append('context', context);

      const response = await fetch('/api/analyze/screenshot', { method: 'POST', body: form });
      // A host without the API answers with an error page, not JSON — which
      // means there is no reader here, not that the capture was rejected.
      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        setRefusal({
          message: 'Lecture de capture indisponible sur cette version.',
          missing: [
            'Aucun service de lecture d’image n’est branché ici : rien ne peut être extrait du fichier.',
          ],
        });
        return;
      }

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
        setRefusal({ message: payload.message, missing: payload.missing });
        return;
      }

      const image = await compressImage(file);
      setAnalysis(payload.analysis);
      setHeadline(payload.reasoning.headline);
      setPreview(image);
      add(payload.analysis, 'en_cours', image ?? undefined);
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
        title: 'Lecture impossible',
        description: 'La capture n’a pas pu être analysée.',
      });
    } finally {
      setAnalyzing(false);
    }
  }, [file, riskProfile, context, add, toast]);

  /**
   * Demonstration path: runs the engine on simulated market data so the
   * interface can be shown end to end. It is never presented as a reading of
   * the uploaded image.
   */
  const runDemoAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setRefusal(null);

    const scenario = DEMO_SCENARIOS[demoIndex % DEMO_SCENARIOS.length]!;
    setDemoIndex((current) => current + 1);

    try {
      const { analysis: result, reasoning } = await runLocalAnalysis({
        assetId: scenario.assetId,
        timeframe: scenario.timeframe,
        riskProfile,
        ...(context ? { context } : {}),
      });

      const demo: MarketAnalysis = {
        ...result,
        dataSource: {
          ...result.dataSource,
          label: 'Démonstration — données simulées, pas votre capture',
        },
        notes: [
          'Analyse de démonstration : elle porte sur des données simulées et non sur l’image déposée.',
          ...result.notes,
        ],
      };

      setAnalysis(demo);
      setHeadline(reasoning.headline);
      setPreview(null);
      add(demo);
    } finally {
      setAnalyzing(false);
    }
  }, [demoIndex, riskProfile, context, add]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_374px]">
      <div className="min-w-0 space-y-4">
        <Card>
          <CardHeader
            title="Nouvelle analyse"
            description="Déposez une capture de votre graphique pour lancer l’analyse."
            icon={<ImageIcon className="h-4 w-4" aria-hidden />}
          />
          <CardContent className="space-y-4">
            <ScreenshotDropzone
              file={file}
              onFile={(next) => {
                setFile(next);
                reset();
              }}
              disabled={analyzing}
            />

            <div>
              <p className="mb-1.5 text-[13px] font-medium text-ink">Niveau de risque</p>
              <Segmented
                label="Niveau de risque"
                value={riskProfile}
                onChange={(next) => updateSettings({ riskProfile: next })}
                options={RISK_OPTIONS}
                className="w-full"
              />
              <p className="mt-1.5 text-[12px] leading-4 text-ink-muted">
                Il fixe les seuils de confluence, de rapport risque / rendement et la largeur du
                stop exigés avant qu’une configuration soit proposée.
              </p>
            </div>

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
              Gratuit et illimité — verdict directionnel visible, le reste réservé aux abonnés.
            </p>

            {refusal ? (
              <div role="alert" className="rounded-[12px] border border-warn/30 bg-warn-soft p-3.5">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-warn" aria-hidden />
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
                  Aucune donnée n’est inventée pour combler ce qui manque. Vous pouvez voir à quoi
                  ressemble une analyse complète sur un cas de démonstration.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={runDemoAnalysis}
                  disabled={analyzing}
                >
                  <ScanLine className="h-3.5 w-3.5" aria-hidden />
                  Voir une analyse de démonstration
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {preview && analysis ? (
          <Card className="overflow-hidden">
            <CardHeader
              title="Capture analysée"
              description="Les niveaux ci-contre proviennent de la lecture de cette image."
            />
            <div className="border-t border-line bg-surface-muted">
              {/* A stored capture is a data URL; the optimizer cannot process it. */}
              <img
                src={preview}
                alt="Capture du graphique analysé"
                className="max-h-[420px] w-full object-contain"
              />
            </div>
          </Card>
        ) : null}
      </div>

      <div className="min-w-0">
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
              <ScanLine className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-[15px] font-semibold text-ink">Aucune analyse en cours</p>
              <p className="mt-1 max-w-xs text-[13px] leading-5 text-ink-muted">
                Déposez une capture de graphique — TradingView, MetaTrader, votre courtier — puis
                lancez la lecture.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
