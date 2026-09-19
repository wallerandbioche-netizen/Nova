'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { looksLikeAirbnbUrl } from '@/lib/listing/url';
import { cn } from '@/lib/cn';
import { GENERIC_ERROR, startProject } from './createProject';

/** Saisies de développement acceptées en plus d'un lien d'annonce. */
function isDeveloperInput(value: string): boolean {
  return value === 'demo:' || value === 'demo' || value.startsWith('folder:');
}

export function CreateForm() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function launch(body: Record<string, unknown>): Promise<void> {
    setError(null);
    setBusy(true);
    setSubmitting(true);
    try {
      router.push(`/p/${await startProject(body)}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : GENERIC_ERROR);
      setBusy(false);
      setSubmitting(false);
    }
  }

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (busy) return;

    const source = value.trim();
    // Un lien manifestement invalide est signalé sans aller-retour serveur :
    // l'utilisateur regarde encore son champ.
    if (source === '' || (!looksLikeAirbnbUrl(source) && !isDeveloperInput(source))) {
      setError('Ce lien ne semble pas être une annonce valide.');
      return;
    }
    await launch({ source });
  }

  return (
    <div className="w-full max-w-xl">
      <form onSubmit={onSubmit} noValidate>
        <div
          className={cn(
            'flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-2',
            'sm:rounded-full sm:border sm:bg-surface sm:p-1.5 sm:pl-6 sm:shadow-lift',
            'sm:transition-colors sm:duration-quick',
            error ? 'sm:border-danger/40' : 'sm:border-line sm:focus-within:border-ink/30',
          )}
        >
          <label htmlFor="listing-url" className="sr-only">
            Lien de votre annonce
          </label>
          <input
            id="listing-url"
            name="listing-url"
            type="url"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            placeholder="Collez votre lien Airbnb"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              if (error) setError(null);
            }}
            disabled={busy}
            className={cn(
              'h-13 w-full min-w-0 rounded-full border bg-surface px-5 text-[1rem]',
              'tracking-[-0.011em] outline-none placeholder:text-faint',
              'transition-colors duration-quick disabled:opacity-60',
              'sm:h-11 sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0',
              error ? 'border-danger/40' : 'border-line focus:border-ink/30',
            )}
          />
          <Button type="submit" size="lg" disabled={busy} className="w-full sm:w-auto">
            {submitting ? 'Analyse en cours' : 'Créer la vidéo'}
          </Button>
        </div>
      </form>

      <div className="mt-4 flex min-h-6 items-center justify-center text-caption">
        <AnimatePresence mode="wait" initial={false}>
          {error ? (
            <motion.p
              key="error"
              className="text-danger"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              role="alert"
            >
              {error}
            </motion.p>
          ) : (
            <motion.p
              key="hint"
              className="text-faint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
            >
              Les photos de l’annonce sont récupérées depuis sa page publique.
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4 flex justify-center">
        <button
          type="button"
          disabled={busy}
          onClick={() => void launch({ source: 'demo:' })}
          className="text-caption text-muted underline decoration-line-strong underline-offset-4
                     transition-colors duration-quick hover:text-ink hover:decoration-ink/40
                     disabled:opacity-40"
        >
          voir un exemple
        </button>
      </div>
    </div>
  );
}
