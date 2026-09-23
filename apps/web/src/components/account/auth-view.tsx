'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, Laptop, Lock, Mail } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Logo } from '@/components/layout/logo';
import { SignInForm } from '@/components/account/sign-in-form';
import { useAccount } from '@/hooks/use-account';

const REASONS = [
  {
    icon: Lock,
    title: 'Pas de mot de passe',
    text: 'Vous recevez un lien de connexion valable 20 minutes, utilisable une seule fois.',
  },
  {
    icon: Laptop,
    title: 'Sur tous vos appareils',
    text: 'Votre abonnement et votre journal vous suivent du téléphone à l’ordinateur.',
  },
  {
    icon: CheckCircle2,
    title: 'Rien d’autre à donner',
    text: 'Une adresse e-mail. Aucun accès à un courtier, aucune donnée bancaire chez nous.',
  },
];

/** Standalone sign-in screen: the same e-mail link creates the account. */
export function AuthView() {
  const { accountsEnabled, account, loading, signOut } = useAccount();

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-[560px] items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="SCAN TRADE — accueil">
            <Logo />
          </Link>
          <Link href="/" className="text-[12.5px] font-medium text-ink-muted hover:text-ink">
            Continuer sans compte
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[560px] flex-1 px-4 py-8 sm:px-6">
        {loading ? (
          <p className="text-[13px] text-ink-muted">Vérification de votre session…</p>
        ) : account ? (
          <div>
            <h1 className="text-[24px] leading-8 font-semibold tracking-[-0.02em] text-ink">
              Vous êtes connecté
            </h1>
            <p className="mt-1.5 text-[13.5px] leading-5 text-ink-muted">
              Session ouverte avec <span className="font-medium text-ink">{account.email}</span>.
            </p>
            <div className="mt-5 space-y-2.5">
              <ButtonLink href="/analyser" fullWidth>
                Analyser une capture
                <ArrowRight className="h-4 w-4" aria-hidden />
              </ButtonLink>
              <ButtonLink href="/profil" variant="secondary" fullWidth>
                Voir mon profil
              </ButtonLink>
              <Button variant="ghost" fullWidth onClick={() => void signOut()}>
                Se déconnecter
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-[24px] leading-8 font-semibold tracking-[-0.02em] text-ink sm:text-[28px] sm:leading-9">
              Connexion ou création de compte
            </h1>
            <p className="mt-1.5 text-[13.5px] leading-5 text-ink-muted">
              Le même formulaire fait les deux : si l’adresse est inconnue, le compte est créé à la
              première connexion.
            </p>

            {accountsEnabled ? (
              <div className="mt-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card">
                <SignInForm />
              </div>
            ) : (
              <div className="mt-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card">
                <p className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                  <Mail className="h-4 w-4 text-ink-muted" aria-hidden />
                  Comptes indisponibles sur cette version
                </p>
                <p className="mt-1 text-[12.5px] leading-5 text-ink-muted">
                  Ce déploiement n’a pas de base de données rattachée. L’application fonctionne
                  entièrement, mais vos analyses restent enregistrées sur cet appareil.
                </p>
                <ButtonLink href="/analyser" fullWidth className="mt-4">
                  Continuer sans compte
                </ButtonLink>
              </div>
            )}

            <ul className="mt-6 space-y-3">
              {REASONS.map((reason) => {
                const Icon = reason.icon;
                return (
                  <li key={reason.title} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-brand-soft text-brand">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span>
                      <span className="block text-[13.5px] font-semibold text-ink">
                        {reason.title}
                      </span>
                      <span className="block text-[12.5px] leading-4 text-ink-muted">
                        {reason.text}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>

            <p className="mt-6 text-center text-[13px] text-ink-muted">
              Première visite ?{' '}
              <Link href="/bienvenue" className="font-medium text-brand hover:underline">
                Répondre aux questions de départ
              </Link>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
