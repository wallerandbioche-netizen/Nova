import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { AnalysisView } from './analysis-view';

export const metadata: Metadata = {
  title: 'Résultat d’analyse',
  description: 'Verdict, niveaux, plan de trade et invalidation.',
};

export default async function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell>
      <PageHeader
        title="Résultat d’analyse"
        description="Verdict directionnel, niveaux clés et plan d’exécution."
        backHref="/journal"
        backLabel="Retour au journal"
      />
      <AnalysisView analysisId={id} />
    </AppShell>
  );
}
