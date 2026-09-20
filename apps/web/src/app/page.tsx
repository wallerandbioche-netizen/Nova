import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { SectionTitle } from '@/components/ui/card';
import { OverviewStats } from '@/components/dashboard/overview-stats';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { RecentAnalyses } from '@/components/dashboard/recent-analyses';

export default function HomePage() {
  return (
    <AppShell>
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
    </AppShell>
  );
}
