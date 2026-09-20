import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { ProfileView } from './profile-view';

export const metadata: Metadata = {
  title: 'Profil',
  description: 'Compte, abonnement, apparence et calibrage.',
};

export default function ProfilePage() {
  return (
    <AppShell>
      <PageHeader title="Profil" description="Compte, abonnement, apparence et calibrage." />
      <ProfileView />
    </AppShell>
  );
}
