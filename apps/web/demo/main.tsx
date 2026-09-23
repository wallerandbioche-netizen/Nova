/**
 * Standalone demo bundle.
 *
 * The product is a Next.js application; this entry re-mounts the very same
 * components as a single page with hash routing, so the interface can be
 * opened from a static host. The analysis engine already runs in the browser,
 * so nothing is faked here: every screen shows real engine output on the
 * simulated market data the app ships with.
 */
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { usePathname } from './shims/navigation';

import '../src/app/globals.css';

import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { ThemeSync } from '@/components/layout/theme-sync';
import { ToastProvider } from '@/components/ui/toast';
import { SectionTitle } from '@/components/ui/card';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { OverviewStats } from '@/components/dashboard/overview-stats';
import { RecentAnalyses } from '@/components/dashboard/recent-analyses';
import { JournalTable } from '@/components/history/journal-table';
import { AnalyzerView } from '@/app/analyser/analyzer-view';
import { AnalysisView } from '@/app/analyse/[id]/analysis-view';
import { Plans } from '@/app/abonnement/plans';
import { ProfileView } from '@/app/profil/profile-view';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';
import { AuthView } from '@/components/account/auth-view';
import Link from './shims/link';
import { Sparkles } from 'lucide-react';

function HomeView() {
  return (
    <>
      <header className="mb-6">
        <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.03em] text-ink sm:text-[30px] sm:leading-9">
          Bienvenue sur SCAN TRADE
        </h1>
        <p className="mt-1.5 max-w-2xl text-[14px] leading-6 text-ink-muted">
          Votre assistant d’analyse graphique par intelligence artificielle. Déposez une capture,
          recevez une lecture structurée — y compris lorsqu’elle conclut qu’il n’y a rien à faire.
        </p>
      </header>

      <div className="space-y-6">
        <QuickActions />
        <OverviewStats />
        <RecentAnalyses />

        <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card">
          <SectionTitle>Une analyse, pas un signal</SectionTitle>
          <p className="mt-1.5 max-w-3xl text-[13px] leading-5 text-ink-muted">
            SCAN TRADE lit votre capture, puis calcule la structure, les niveaux, le momentum et le
            risque avant d’expliquer son raisonnement. Le score de confluence mesure l’accord entre
            les facteurs : ce n’est pas une probabilité de gain, et aucune direction n’est garantie.
          </p>
          <Link
            href="/analyser"
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Analyser une capture
          </Link>
        </section>
      </div>
    </>
  );
}

function Routes() {
  const pathname = usePathname();

  if (pathname.startsWith('/analyser')) {
    return (
      <>
        <PageHeader
          title="Nouvelle analyse"
          description="Déposez une capture de votre graphique pour lancer l’analyse."
          backHref="/"
          backLabel="Retour à l’accueil"
        />
        <AnalyzerView />
      </>
    );
  }

  if (pathname.startsWith('/journal')) {
    return (
      <>
        <PageHeader
          title="Journal"
          description="Historique de vos analyses et de leurs statistiques. Les performances passées ne préjugent pas des performances futures."
        />
        <JournalTable />
      </>
    );
  }

  if (pathname.startsWith('/analyse/')) {
    const id = decodeURIComponent(pathname.slice('/analyse/'.length));
    return (
      <>
        <PageHeader
          title="Résultat d’analyse"
          description="Verdict directionnel, niveaux clés et plan d’exécution."
          backHref="/journal"
          backLabel="Retour au journal"
        />
        <AnalysisView analysisId={id} />
      </>
    );
  }

  if (pathname.startsWith('/abonnement')) {
    return (
      <>
        <PageHeader
          title="Abonnement"
          description="Accédez au détail des analyses et aux fonctionnalités avancées."
          backHref="/profil"
          backLabel="Retour au profil"
        />
        <div className="max-w-3xl">
          <Plans />
        </div>
      </>
    );
  }

  if (pathname.startsWith('/profil')) {
    return (
      <>
        <PageHeader title="Profil" description="Compte, abonnement, apparence et calibrage." />
        <ProfileView />
      </>
    );
  }

  return <HomeView />;
}

function DemoApp() {
  // Scroll back to the top on every route change, like a real navigation.
  const pathname = usePathname();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  // The welcome questionnaire and the sign-in screen own the whole viewport:
  // they are what a visitor sees before the application itself.
  if (pathname.startsWith('/bienvenue')) {
    return (
      <ToastProvider>
        <ThemeSync />
        <OnboardingFlow />
      </ToastProvider>
    );
  }

  if (pathname.startsWith('/connexion')) {
    return (
      <ToastProvider>
        <ThemeSync />
        <AuthView />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <ThemeSync />
      <AppShell>
        <Routes />
      </AppShell>
    </ToastProvider>
  );
}

/**
 * The host can stamp its own theme on the document before the bundle boots.
 * A first-time visitor inherits it; a stored preference always wins.
 */
function adoptHostTheme(): void {
  try {
    if (window.localStorage.getItem('scantrade.settings.v1')) return;
    const stamped = document.documentElement.dataset.theme;
    const theme = stamped === 'dark' || stamped === 'light' ? stamped : 'auto';
    window.localStorage.setItem('scantrade.settings.v1', JSON.stringify({ theme }));
  } catch {
    // Storage unavailable: the default light theme applies.
  }
}

/**
 * A visitor who has never answered the questionnaire starts there, exactly as
 * on the deployed site.
 */
function routeFirstVisit(): void {
  try {
    const raw = window.localStorage.getItem('scantrade.settings.v1');
    if (raw && (JSON.parse(raw) as { onboarded?: boolean }).onboarded) return;
    const route = window.location.hash.replace(/^#/, '');
    if (route.indexOf('/bienvenue') === 0 || route.indexOf('/connexion') === 0) return;
    window.location.hash = '/bienvenue';
  } catch {
    // Storage unavailable: the application opens on the dashboard.
  }
}

adoptHostTheme();
routeFirstVisit();

const container = document.getElementById('root');
if (container) {
  container.innerHTML = '';
  createRoot(container).render(
    <StrictMode>
      <DemoApp />
    </StrictMode>,
  );
}
