import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { JournalTable } from '@/components/history/journal-table';

export const metadata: Metadata = {
  title: 'Journal',
  description: 'Historique de vos analyses, verdicts et statistiques.',
};

export default function JournalPage() {
  return (
    <AppShell>
      <PageHeader
        title="Journal"
        description="Historique de vos analyses et de leurs statistiques. Les performances passées ne préjugent pas des performances futures."
      />
      <JournalTable />
    </AppShell>
  );
}
