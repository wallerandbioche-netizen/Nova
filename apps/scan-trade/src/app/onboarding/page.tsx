import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/brand/logo';
import { Disclaimer } from '@/components/layout/disclaimer';
import { OnboardingFlow } from '@/features/auth/onboarding-flow';
import { getViewer } from '@/server/session';

export const metadata: Metadata = {
  title: 'Bienvenue',
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  const viewer = await getViewer();
  if (!viewer) redirect('/connexion');
  if (viewer.onboardedAt) redirect('/dashboard');

  return (
    <div className="grid-lines flex min-h-dvh flex-col">
      <header className="px-4 py-6 sm:px-8">
        <Logo href="/dashboard" />
      </header>

      <main id="contenu" className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          <OnboardingFlow firstName={viewer.name} />
        </div>
      </main>

      <footer className="px-4 pb-8 sm:px-8">
        <Disclaimer variant="compact" className="mx-auto max-w-lg" />
      </footer>
    </div>
  );
}
