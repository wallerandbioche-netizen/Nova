'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InlineError, InlineSuccess } from '@/components/ui/error-state';
import { apiRequest } from './api-client';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const result = await apiRequest<{ ok: true }>('/api/auth/password/forgot', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setSent(true);
  }

  return (
    <div>
      <h1 className="text-heading font-semibold text-content">Mot de passe oublié</h1>
      <p className="mt-2 text-sm text-content-muted">
        Indique ton adresse : si un compte existe, tu recevras un lien de réinitialisation.
      </p>

      {sent ? (
        <div className="mt-8 space-y-4">
          {/*
            Worded so it says nothing about whether the address is registered —
            the endpoint deliberately answers the same way either way.
          */}
          <InlineSuccess message="Si un compte existe avec cette adresse, un lien de réinitialisation vient de partir. Il expire dans 30 minutes." />
          <Link
            href="/connexion"
            className="block text-center text-sm text-content-muted underline-offset-4 hover:text-content"
          >
            Retour à la connexion
          </Link>
        </div>
      ) : (
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
          <Button type="submit" size="lg" className="w-full" loading={pending}>
            Envoyer le lien
          </Button>
          <Link
            href="/connexion"
            className="block text-center text-sm text-content-muted underline-offset-4 hover:text-content"
          >
            Retour à la connexion
          </Link>
        </form>
      )}
    </div>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmation) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setPending(true);
    const result = await apiRequest<{ ok: true }>('/api/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    router.push('/connexion?reinitialise=1');
  }

  if (!token) {
    return (
      <div>
        <h1 className="text-heading font-semibold text-content">Lien invalide</h1>
        <p className="mt-2 text-sm text-content-muted">
          Ce lien de réinitialisation est incomplet. Demande-en un nouveau.
        </p>
        <Link
          href="/mot-de-passe-oublie"
          className="mt-6 inline-block text-sm text-accent underline-offset-4 hover:underline"
        >
          Demander un nouveau lien
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-heading font-semibold text-content">Nouveau mot de passe</h1>
      <p className="mt-2 text-sm text-content-muted">
        Choisis un mot de passe. Toutes tes sessions ouvertes seront déconnectées.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        {error && <InlineError message={error} />}
        <Input
          label="Nouveau mot de passe"
          type="password"
          name="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          hint="Au moins 10 caractères, dont une lettre et un chiffre."
        />
        <Input
          label="Confirme le mot de passe"
          type="password"
          name="confirmation"
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          Mettre à jour
        </Button>
      </form>
    </div>
  );
}
