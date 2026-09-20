import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { AnalyzerView } from './analyzer-view';

export const metadata: Metadata = {
  title: 'Analyser',
  description:
    'Déposez une capture de graphique : structure, niveaux, confluence, plan de trade et invalidation.',
};

export default function AnalyzerPage() {
  return (
    <AppShell>
      <PageHeader
        title="Nouvelle analyse"
        description="Déposez une capture de votre graphique pour lancer l’analyse."
        backHref="/"
        backLabel="Retour à l’accueil"
      />
      <AnalyzerView />
    </AppShell>
  );
}
