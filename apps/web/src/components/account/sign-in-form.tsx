'use client';

import { useState, type FormEvent } from 'react';
import { CheckCircle2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { useAccount } from '@/hooks/use-account';
import { cn } from '@/lib/utils/cn';

/**
 * Sign-in by e-mail link: no password to choose, lose or leak. The same form
 * creates the account on first use.
 */
export function SignInForm({ className, title }: { className?: string; title?: string }) {
  const { requestSignIn } = useAccount();
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [delivered, setDelivered] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await requestSignIn(email);
    setPending(false);

    if (!result.ok) {
      setError(result.error ?? 'Connexion impossible.');
      return;
    }
    setSent(true);
    setDelivered(result.delivered);
  };

  if (sent) {
    return (
      <div className={cn('rounded-[12px] border border-line bg-long-soft p-4', className)}>
        <p className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
          <CheckCircle2 className="h-4 w-4 text-long" aria-hidden />
          Lien envoyé à {email}
        </p>
        <p className="mt-1 text-[12.5px] leading-5 text-ink-muted">
          Ouvrez-le depuis cet appareil ou un autre : il vous connecte directement. Il est valable
          20 minutes et ne fonctionne qu’une fois.
        </p>
        {!delivered ? (
          <p className="mt-2 text-[12px] leading-4 text-warn">
            Aucun service d’envoi d’e-mails n’est configuré sur ce déploiement : le lien a été écrit
            dans les journaux du serveur.
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-2 text-[12.5px] font-medium text-brand hover:underline"
        >
          Utiliser une autre adresse
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={cn('space-y-3', className)}>
      {title ? <p className="text-[13.5px] font-semibold text-ink">{title}</p> : null}
      <Field
        label="Adresse e-mail"
        htmlFor="signin-email"
        hint="Nous vous envoyons un lien de connexion, sans mot de passe."
      >
        <Input
          id="signin-email"
          type="email"
          required
          autoComplete="email"
          placeholder="vous@exemple.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>
      {error ? (
        <p role="alert" className="text-[12.5px] font-medium text-short">
          {error}
        </p>
      ) : null}
      <Button type="submit" fullWidth disabled={pending || email.length < 5}>
        <Mail className="h-4 w-4" aria-hidden />
        {pending ? 'Envoi…' : 'Recevoir mon lien de connexion'}
      </Button>
    </form>
  );
}
