'use client';

import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InlineError } from '@/components/ui/error-state';

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Where to land afterwards. Only same-origin paths are honoured, so a
  // crafted `?next=` cannot bounce a signed-in user off to another site.
  const rawNext = searchParams.get('next');
  const next =
    rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard';

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const result = await signIn('credentials', { email, password, redirect: false });

    if (!result || result.error) {
      // Auth.js collapses every credential failure into one code; the rate
      // limiter is the only case worth phrasing differently.
      setError(
        result?.code === 'RATE_LIMITED'
          ? 'Trop de tentatives sur ce compte. Réessaie dans quelques minutes.'
          : 'E-mail ou mot de passe incorrect.',
      );
      setPending(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <div>
      <h1 className="text-heading font-semibold text-content">Connexion</h1>
      <p className="mt-2 text-sm text-content-muted">Reprends là où tu t&apos;étais arrêté.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        {error && <InlineError message={error} />}

        <Input
          label="E-mail"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="toi@exemple.com"
        />

        <div className="space-y-1.5">
          <Input
            label="Mot de passe"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <div className="text-right">
            <Link
              href="/mot-de-passe-oublie"
              className="text-xs text-content-muted underline-offset-4 hover:text-content"
            >
              Mot de passe oublié ?
            </Link>
          </div>
        </div>

        <Button type="submit" size="lg" className="w-full" loading={pending}>
          Se connecter
        </Button>
      </form>

      {googleEnabled && (
        <>
          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-[0.12em] text-content-faint">ou</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => void signIn('google', { callbackUrl: next })}
          >
            Continuer avec Google
          </Button>
        </>
      )}

      <p className="mt-8 text-center text-sm text-content-muted">
        Pas encore de compte ?{' '}
        <Link href="/inscription" className="text-accent underline-offset-4 hover:underline">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
