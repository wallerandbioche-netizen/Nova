'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { InlineError } from '@/components/ui/error-state';
import { cn } from '@/utils/cn';
import { apiRequest } from './api-client';

const MARKETS = [
  { value: 'CRYPTO', label: 'Crypto' },
  { value: 'FOREX', label: 'Forex' },
  { value: 'INDICES', label: 'Indices' },
  { value: 'STOCKS', label: 'Actions' },
  { value: 'OTHER', label: 'Autre' },
] as const;

const STYLES = [
  { value: 'SCALPING', label: 'Scalping' },
  { value: 'DAY_TRADING', label: 'Day trading' },
  { value: 'SWING_TRADING', label: 'Swing trading' },
  { value: 'OTHER', label: 'Autre' },
] as const;

/**
 * Three short steps (§23).
 *
 * Both questions are skippable, and the answers only shape how the request is
 * phrased — they are never used to fill in something the chart does not show.
 */
export function OnboardingFlow({ firstName }: { firstName: string | null }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [market, setMarket] = useState<string | null>(null);
  const [style, setStyle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function finish() {
    setPending(true);
    setError(null);

    const result = await apiRequest<{ ok: true }>('/api/onboarding', {
      method: 'POST',
      body: JSON.stringify({ market, style }),
    });

    if (!result.ok) {
      setError(result.error.message);
      setPending(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <Card tone="raised" className="px-6 py-8 sm:px-8">
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className={cn('h-1 flex-1 rounded-full transition-colors', index <= step ? 'bg-accent' : 'bg-border')}
          />
        ))}
      </div>
      <p className="mt-3 text-xs uppercase tracking-[0.12em] text-content-faint">Étape {step + 1} sur 3</p>

      {error && <InlineError message={error} className="mt-4" />}

      {step === 0 && (
        <div className="mt-6">
          <h1 className="text-heading font-semibold text-content">
            Bienvenue sur Scan Trade{firstName ? `, ${firstName}` : ''}.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-content-muted">
            Tu importes une capture de ton graphique, Scan Trade en lit la structure et te rend un plan lisible :
            niveaux clés, scénario potentiel, invalidation.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-content-muted">
            Deux questions rapides, puis tu pourras lancer ton premier scan. Tu peux les passer.
          </p>
          <Button size="lg" className="mt-8 w-full" onClick={() => setStep(1)}>
            Commencer
          </Button>
        </div>
      )}

      {step === 1 && (
        <div className="mt-6">
          <h1 className="text-heading font-semibold text-content">Quel type de marché trades-tu ?</h1>
          <p className="mt-2 text-sm text-content-muted">Principalement. Tu pourras analyser n&apos;importe quel graphique.</p>

          <div className="mt-6 grid grid-cols-2 gap-2">
            {MARKETS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMarket(option.value)}
                aria-pressed={market === option.value}
                className={cn(
                  'h-12 rounded-lg border text-sm transition-colors',
                  market === option.value
                    ? 'border-accent-border bg-accent-soft text-accent'
                    : 'border-border-strong text-content-muted hover:text-content',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-8 flex gap-2">
            <Button variant="ghost" onClick={() => setStep(2)}>
              Passer
            </Button>
            <Button className="flex-1" onClick={() => setStep(2)}>
              Continuer
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mt-6">
          <h1 className="text-heading font-semibold text-content">Quel est ton style ?</h1>
          <p className="mt-2 text-sm text-content-muted">Cela aide à cadrer la lecture, sans jamais la déterminer.</p>

          <div className="mt-6 grid grid-cols-2 gap-2">
            {STYLES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStyle(option.value)}
                aria-pressed={style === option.value}
                className={cn(
                  'h-12 rounded-lg border text-sm transition-colors',
                  style === option.value
                    ? 'border-accent-border bg-accent-soft text-accent'
                    : 'border-border-strong text-content-muted hover:text-content',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-8 flex gap-2">
            <Button variant="ghost" onClick={() => void finish()} disabled={pending}>
              Passer
            </Button>
            <Button className="flex-1" loading={pending} onClick={() => void finish()}>
              Terminer
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
