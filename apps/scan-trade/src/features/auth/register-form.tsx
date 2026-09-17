'use client';

import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InlineError } from '@/components/ui/error-state';
import { apiRequest } from './api-client';

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setPending(true);

    const created = await apiRequest<{ id: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name: name.trim() || undefined }),
    });

    if (!created.ok) {
      setError(created.error.message);
      setFieldErrors(created.error.fields ?? {});
      setPending(false);
      return;
    }

    // Sign in straight away: asking someone to type the same password twice
    // in a row is friction with no security benefit.
    const signedIn = await signIn('credentials', { email, password, redirect: false });
    if (!signedIn || signedIn.error) {
      router.push('/connexion');
      return;
    }

    router.push('/onboarding');
    router.refresh();
  }

  return (
    <div>
      <h1 className="text-heading font-semibold text-content">Créer un compte</h1>
      <p className="mt-2 text-sm text-content-muted">Deux minutes, puis tu peux scanner ton premier chart.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        {error && <InlineError message={error} />}

        <Input
          label="Prénom (optionnel)"
          type="text"
          name="name"
          autoComplete="given-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={fieldErrors.name}
        />

        <Input
          label="E-mail"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="toi@exemple.com"
          error={fieldErrors.email}
        />

        <Input
          label="Mot de passe"
          type="password"
          name="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          hint="Au moins 10 caractères, dont une lettre et un chiffre."
          error={fieldErrors.password}
        />

        <Button type="submit" size="lg" className="w-full" loading={pending}>
          Créer mon compte
        </Button>
      </form>

      <p className="mt-6 text-xs leading-relaxed text-content-faint">
        En créant un compte, tu acceptes les{' '}
        <Link href="/conditions" className="underline underline-offset-4 hover:text-content-muted">
          conditions d&apos;utilisation
        </Link>{' '}
        et la{' '}
        <Link href="/confidentialite" className="underline underline-offset-4 hover:text-content-muted">
          politique de confidentialité
        </Link>
        .
      </p>

      <p className="mt-8 text-center text-sm text-content-muted">
        Déjà inscrit ?{' '}
        <Link href="/connexion" className="text-accent underline-offset-4 hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
