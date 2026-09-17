import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppError } from '@/lib/errors';
import { AnalysisSummary, AnalysisWarnings } from '@/components/analysis/analysis-summary';
import { ChartAnalysisCard } from '@/components/analysis/chart-analysis-card';
import { KeyLevelsCard } from '@/components/analysis/key-levels-card';
import { ReasoningSection, TechnicalAnalysisSection } from '@/components/analysis/technical-analysis';
import { TradePlanCard } from '@/components/analysis/trade-plan-card';
import { Card } from '@/components/ui/card';
import { Disclaimer } from '@/components/layout/disclaimer';
import { DeleteAnalysisButton, RunScanButton } from '@/features/analysis/analysis-actions';
import { getAnalysisService } from '@/server/services';
import { requireViewer } from '@/server/session';
import { formatDuration, orUnknown } from '@/utils/format';

export const metadata: Metadata = { title: 'Analyse' };
export const dynamic = 'force-dynamic';

export default async function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireViewer();
  const { id } = await params;

  let analysis;
  try {
    analysis = await getAnalysisService().get(viewer.id, id);
  } catch (error) {
    // `get` throws 404 for a row that belongs to someone else, so this branch
    // covers "not yours" and "does not exist" identically — by design.
    if (error instanceof AppError && error.code === 'not_found') notFound();
    throw error;
  }

  const running = analysis.status === 'PROCESSING';
  const pending = analysis.status === 'PENDING';
  const failed = analysis.status === 'FAILED';

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/historique" className="text-sm text-content-muted underline-offset-4 hover:text-content">
          ← Historique
        </Link>
        <DeleteAnalysisButton analysisId={analysis.id} />
      </div>

      {/* --- Terminal failure ------------------------------------------- */}
      {failed && (
        <Card className="border-danger-border bg-danger-soft px-5 py-5 sm:px-6">
          <p className="text-sm font-semibold text-danger">
            {analysis.failureCode === 'ai_invalid_response'
              ? 'Analyse indisponible — les données générées sont incohérentes.'
              : 'Cette analyse n’a pas pu être produite.'}
          </p>
          <p className="mt-1.5 text-sm text-content-muted">
            {failureExplanation(analysis.failureCode)}
          </p>
          <div className="mt-4">
            <RunScanButton analysisId={analysis.id} label="Relancer le scan" />
          </div>
        </Card>
      )}

      {pending && (
        <Card className="px-5 py-5 sm:px-6">
          <p className="text-sm font-medium text-content">Cette capture n&apos;a pas encore été analysée.</p>
          <p className="mt-1.5 text-sm text-content-muted">Lance le scan pour obtenir le plan.</p>
          <div className="mt-4">
            <RunScanButton analysisId={analysis.id} label="Lancer le Scan" />
          </div>
        </Card>
      )}

      {running && (
        <Card className="px-5 py-5 sm:px-6">
          <p className="text-sm font-medium text-content">Analyse en cours…</p>
          <p className="mt-1.5 text-sm text-content-muted">
            Recharge la page dans quelques instants pour voir le résultat.
          </p>
        </Card>
      )}

      {/*
        Two columns on desktop (§51): the reading on the left, the numbers on
        the right. On mobile the order flips in the markup below so Trade Setup
        is the first thing under the headline.
      */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <div className="order-2 space-y-5 lg:order-1">
          <ChartAnalysisCard analysis={analysis} />
          <TechnicalAnalysisSection items={analysis.technical} />
          <ReasoningSection items={analysis.reasoning} />
        </div>

        <div className="order-1 space-y-5 lg:order-2">
          <AnalysisSummary analysis={analysis} />
          <AnalysisWarnings warnings={analysis.warnings} />
          <TradePlanCard analysis={analysis} />
          <KeyLevelsCard levels={analysis.levels} />

          <Card className="px-5 py-4 sm:px-6">
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between gap-4">
                <dt className="text-content-faint">Contexte fourni</dt>
                <dd className="text-right text-content-muted">
                  {[analysis.requestedAsset, analysis.requestedTimeframe].filter(Boolean).join(' · ') || 'Aucun'}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-content-faint">Durée du scan</dt>
                <dd className="numeric text-content-muted">{formatDuration(analysis.durationMs)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-content-faint">Référence</dt>
                <dd className="numeric truncate text-content-muted">{orUnknown(analysis.id)}</dd>
              </div>
            </dl>
          </Card>

          <Disclaimer />
        </div>
      </div>
    </div>
  );
}

function failureExplanation(code: string | null): string {
  switch (code) {
    case 'ai_invalid_response':
      return "Le résultat produit ne passait pas les contrôles de cohérence : plutôt que d'afficher des niveaux douteux, rien n'est affiché. Relance le scan.";
    case 'ai_timeout':
      return "Le service d'analyse a mis trop de temps à répondre. Relance le scan, si possible avec une capture plus légère.";
    case 'ai_unavailable':
      return "Le service d'analyse était momentanément indisponible. Réessaie dans quelques minutes.";
    case 'storage_error':
      return "La capture n'a pas pu être relue depuis le stockage. Réessaie dans un instant.";
    case 'configuration_error':
      return "Le service d'analyse n'est pas configuré sur ce déploiement. Contacte le support.";
    default:
      return 'Réessaie dans un instant. Si le problème persiste, contacte le support.';
  }
}
