import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { AnalyzerView } from './analyzer-view';

export const metadata: Metadata = {
  title: 'Analyser',
  description:
    'Analysez un graphique ou une capture : structure, niveaux, confluence, plan de trade et invalidation.',
};

export default function AnalyzerPage() {
  return (
    <AppShell>
      <PageHeader
        title="Analyser"
        description="Lecture structurée d’un graphique : contexte, niveaux, configuration et gestion du risque."
        backHref="/"
        backLabel="Retour à l’accueil"
      />
      <AnalyzerView initialAssetId="XAUUSD" initialTimeframe="15m" />
    </AppShell>
  );
}
