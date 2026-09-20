'use client';

import { Check, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { useSettings } from '@/hooks/use-settings';
import { cn } from '@/lib/utils/cn';

const FEATURES = [
  'Zone d’entrée, stop et objectifs chiffrés',
  'Niveaux tracés directement sur le graphique',
  'Rapport risque / rendement et taille de position',
  'Raisonnement complet et plan d’exécution',
  'Analyses illimitées et journal de fiabilité',
];

export function Plans() {
  const [settings, updateSettings] = useSettings();
  const toast = useToast();

  const subscribe = (plan: 'mensuelle' | 'annuelle') => {
    updateSettings({ subscribed: true });
    toast.push({
      tone: 'success',
      title: 'Abonnement activé',
      description: `Formule ${plan} — démonstration locale, aucun paiement n’a été traité.`,
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Formule gratuite"
          description="Analyses illimitées — verdict directionnel visible, le reste flouté."
          action={<span className="text-[15px] font-semibold text-ink">0 €</span>}
        />
        <CardContent>
          <Button
            variant="secondary"
            fullWidth
            disabled={!settings.subscribed}
            onClick={() => updateSettings({ subscribed: false })}
          >
            {settings.subscribed ? 'Revenir à la formule gratuite' : 'Formule actuelle'}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <PlanCard
          title="Mensuelle"
          price="29,99 €"
          period="par mois"
          note="Sans engagement, résiliable à tout moment."
          onSubscribe={() => subscribe('mensuelle')}
          active={settings.subscribed}
        />
        <PlanCard
          title="Annuelle"
          price="199,99 €"
          period="par an"
          note="Soit 16,67 € par mois."
          badge="2 mois offerts"
          highlighted
          onSubscribe={() => subscribe('annuelle')}
          active={settings.subscribed}
        />
      </div>

      <Card>
        <CardHeader title="Inclus dans l’abonnement" />
        <CardContent>
          <ul className="space-y-2">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-[13px] leading-5 text-ink">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                {feature}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11.5px] leading-4 text-ink-subtle">
            L’abonnement donne accès à une analyse détaillée. Il ne garantit aucun résultat : SCAN
            TRADE fournit une lecture structurée, la décision et le risque restent les vôtres. Les
            paiements ne sont pas activés dans cette version de démonstration.
          </p>
          <Link
            href="/analyser"
            className="mt-3 inline-block text-[13px] font-medium text-brand hover:underline"
          >
            Continuer en gratuit
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function PlanCard({
  title,
  price,
  period,
  note,
  badge,
  highlighted,
  onSubscribe,
  active,
}: {
  title: string;
  price: string;
  period: string;
  note: string;
  badge?: string;
  highlighted?: boolean;
  onSubscribe: () => void;
  active: boolean;
}) {
  return (
    <Card className={cn('relative flex flex-col', highlighted && 'border-brand shadow-raised')}>
      <CardHeader
        title={title}
        description={note}
        action={badge ? <Badge tone="brand">{badge}</Badge> : undefined}
      />
      <CardContent className="mt-auto">
        <p className="text-[26px] leading-8 font-semibold tracking-[-0.02em] text-ink">{price}</p>
        <p className="text-[12.5px] text-ink-muted">{period}</p>
        <Button
          fullWidth
          className="mt-4"
          variant={highlighted ? 'primary' : 'secondary'}
          onClick={onSubscribe}
          disabled={active}
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          {active ? 'Abonnement actif' : 'Choisir cette formule'}
        </Button>
      </CardContent>
    </Card>
  );
}
