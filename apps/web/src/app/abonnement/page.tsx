import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Plans } from './plans';

export const metadata: Metadata = {
  title: 'Abonnement',
  description: 'Formules et avantages de SCAN TRADE.',
};

export default function SubscriptionPage() {
  return (
    <AppShell>
      <PageHeader
        title="Abonnement"
        description="Accédez au détail des analyses et aux fonctionnalités avancées."
        backHref="/profil"
        backLabel="Retour au profil"
      />
      <div className="max-w-3xl">
        <Plans />
      </div>
    </AppShell>
  );
}
