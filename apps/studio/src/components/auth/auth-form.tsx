'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/dashboard';

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    const data = new FormData(event.currentTarget);
    const payload = {
      email: String(data.get('email') ?? ''),
      password: String(data.get('password') ?? ''),
      ...(mode === 'signup' ? { name: String(data.get('name') ?? '') || undefined } : {}),
    };

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        setError(body.error?.message ?? 'Une erreur est survenue.');
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError('Connexion impossible. Réessayez dans un instant.');
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {mode === 'signup' ? (
        <div className="space-y-2">
          <Label htmlFor="name">Nom (facultatif)</Label>
          <Input id="name" name="name" autoComplete="name" />
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">Adresse e-mail</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={mode === 'signup' ? 10 : 1}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
        />
        {mode === 'signup' ? <p className="text-xs text-ink-400">Au moins 10 caractères.</p> : null}
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        {mode === 'signup' ? 'Créer mon compte' : 'Se connecter'}
      </Button>

      <p className="text-center text-sm text-ink-500">
        {mode === 'signup' ? (
          <>
            Déjà un compte ?{' '}
            <Link href="/login" className="font-medium text-ink-900 underline underline-offset-4">
              Se connecter
            </Link>
          </>
        ) : (
          <>
            Pas encore de compte ?{' '}
            <Link href="/signup" className="font-medium text-ink-900 underline underline-offset-4">
              Créer un compte
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
