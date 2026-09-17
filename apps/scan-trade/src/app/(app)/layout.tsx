import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AppHeader, MobileTabBar } from '@/components/layout/app-header';
import { Sidebar } from '@/components/layout/sidebar';
import { getViewer } from '@/server/session';

export const metadata: Metadata = {
  // Nothing behind the login is ever indexed (§49).
  robots: { index: false, follow: false },
};

/**
 * Shell for every signed-in screen.
 *
 * The guard lives here, in a server component, so a page cannot be reached by
 * navigating straight to its URL. It is a convenience, not the security
 * boundary: every route handler and service re-checks ownership on its own
 * (§37).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect('/connexion');

  // A brand-new account has not answered the two onboarding questions yet.
  if (!viewer.onboardedAt) redirect('/onboarding');

  return (
    <div className="min-h-dvh bg-background">
      <Sidebar subscribed={viewer.isSubscribed} />

      <div className="lg:pl-60">
        <AppHeader email={viewer.email} name={viewer.name} />
        <main id="contenu" className="px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-12">
          {children}
        </main>
      </div>

      <MobileTabBar />
    </div>
  );
}
