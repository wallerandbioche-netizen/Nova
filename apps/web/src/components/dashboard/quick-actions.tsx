import Link from 'next/link';
import { ArrowRight, BookOpen, ScanLine, User } from 'lucide-react';

const ACTIONS = [
  {
    href: '/analyser',
    icon: ScanLine,
    title: 'Analyser un graphique',
    description: 'Déposez une capture de votre graphique, recevez une analyse complète.',
  },
  {
    href: '/journal',
    icon: BookOpen,
    title: 'Journal de trades',
    description: 'Suivez vos analyses, vos verdicts et vos performances dans le temps.',
  },
  {
    href: '/profil',
    icon: User,
    title: 'Mon profil',
    description: 'Gérez votre compte, votre abonnement et vos préférences de risque.',
  },
] as const;

export function QuickActions() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.href}
            href={action.href}
            className="group flex flex-col rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card transition-all hover:border-brand-ring hover:shadow-raised"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-soft text-brand">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span className="mt-3 text-[14.5px] font-semibold text-ink">{action.title}</span>
            <span className="mt-1 text-[12.5px] leading-5 text-ink-muted">
              {action.description}
            </span>
            <span className="mt-4 flex h-8 w-8 items-center justify-center rounded-full bg-brand text-white transition-transform group-hover:translate-x-0.5">
              <ArrowRight className="h-4 w-4" aria-hidden />
            </span>
          </Link>
        );
      })}
    </div>
  );
}
