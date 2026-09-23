'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BarChart3,
  Bitcoin,
  Check,
  DollarSign,
  Gauge,
  GraduationCap,
  Landmark,
  ScanLine,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { RiskProfile } from '@/types/analysis';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Logo } from '@/components/layout/logo';
import { SignInForm } from '@/components/account/sign-in-form';
import { useAccount } from '@/hooks/use-account';
import { useSettings } from '@/hooks/use-settings';
import { RISK_PROFILES } from '@/lib/analysis/risk';
import {
  CAPITAL_PRESETS,
  DEFAULT_ANSWERS,
  SUGGESTED_PROFILE,
  normalizeAccountSize,
  settingsPatchFor,
  type Experience,
  type Objective,
  type OnboardingAnswers,
  type Playground,
} from '@/lib/onboarding/questions';
import { formatMoney } from '@/lib/utils/format';
import { RISK_PROFILE_LABEL } from '@/lib/utils/labels';
import { cn } from '@/lib/utils/cn';

const STEPS = [
  'intro',
  'experience',
  'playground',
  'objective',
  'risk',
  'capital',
  'compte',
] as const;
type Step = (typeof STEPS)[number];

interface Option<T> {
  value: T;
  label: string;
  hint: string;
  icon: LucideIcon;
}

const EXPERIENCE_OPTIONS: Option<Experience>[] = [
  {
    value: 'debutant',
    label: 'Je débute',
    hint: 'Moins d’un an de pratique, ou en apprentissage.',
    icon: GraduationCap,
  },
  {
    value: 'intermediaire',
    label: 'J’ai de la pratique',
    hint: 'Je connais les bases et je prends des positions régulièrement.',
    icon: TrendingUp,
  },
  {
    value: 'confirme',
    label: 'Je suis à l’aise',
    hint: 'Je suis un plan, je gère mon risque, je tiens un journal.',
    icon: Trophy,
  },
];

const PLAYGROUND_OPTIONS: Option<Playground>[] = [
  { value: 'indices', label: 'Indices', hint: 'NASDAQ, S&P 500, CAC 40…', icon: BarChart3 },
  { value: 'forex', label: 'Devises', hint: 'EUR/USD, GBP/USD, or…', icon: DollarSign },
  { value: 'crypto', label: 'Crypto', hint: 'Bitcoin, Ethereum, altcoins…', icon: Bitcoin },
  { value: 'actions', label: 'Actions', hint: 'Titres cotés, ETF sectoriels…', icon: Landmark },
];

const OBJECTIVE_OPTIONS: Option<Objective>[] = [
  {
    value: 'comprendre',
    label: 'Comprendre mes graphiques',
    hint: 'Savoir lire une structure, des niveaux, un momentum.',
    icon: ScanLine,
  },
  {
    value: 'progresser',
    label: 'Gagner en régularité',
    hint: 'Un cadre identique à chaque analyse, et un journal qui le mesure.',
    icon: Target,
  },
  {
    value: 'performer',
    label: 'Affiner mon exécution',
    hint: 'Zones d’entrée, invalidation et taille de position au cordeau.',
    icon: Sparkles,
  },
];

const RISK_OPTIONS: Option<RiskProfile>[] = [
  {
    value: 'prudent',
    label: RISK_PROFILE_LABEL.prudent,
    hint: 'Peu de configurations retenues, mais les plus nettes.',
    icon: Shield,
  },
  {
    value: 'modere',
    label: RISK_PROFILE_LABEL.modere,
    hint: 'L’équilibre par défaut entre sélectivité et occasions.',
    icon: Gauge,
  },
  {
    value: 'agressif',
    label: RISK_PROFILE_LABEL.agressif,
    hint: 'Plus de configurations, stops plus serrés, davantage d’échecs.',
    icon: Zap,
  },
];

/**
 * First-visit questionnaire. Every answer configures something the rest of the
 * application really uses — the risk gates, the position calculator, the
 * instrument shown by default — so this is a setup step, not a welcome tour.
 */
export function OnboardingFlow() {
  const router = useRouter();
  const [, update] = useSettings();
  const { accountsEnabled, account } = useAccount();
  const [step, setStep] = useState<Step>('intro');
  /** Only what the visitor actually answered: no card looks chosen for them. */
  const [draft, setDraft] = useState<Partial<OnboardingAnswers>>({});
  const [customCapital, setCustomCapital] = useState('');

  const answers: OnboardingAnswers = { ...DEFAULT_ANSWERS, ...draft };

  const index = STEPS.indexOf(step);
  const questionNumber = index;
  const questionCount = STEPS.length - 2;

  const goTo = (next: Step) => {
    setStep(next);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  };

  const back = () => {
    const previous = STEPS[index - 1];
    if (previous) goTo(previous);
  };

  /**
   * Saving happens on the way into the last step, not at the very end: someone
   * who leaves to open their sign-in e-mail keeps everything they answered.
   */
  const saveAndFinish = (accountSize: number) => {
    const complete = { ...answers, accountSize: normalizeAccountSize(accountSize) };
    setDraft(complete);
    update(settingsPatchFor(complete));
    goTo('compte');
  };

  const leave = () => router.replace('/');

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-[640px] items-center justify-between px-4 sm:px-6">
          <Logo />
          {step === 'compte' ? null : (
            <button
              type="button"
              onClick={leave}
              className="text-[12.5px] font-medium text-ink-muted hover:text-ink"
            >
              Passer
            </button>
          )}
        </div>
        {index > 0 ? (
          <div className="mx-auto w-full max-w-[640px] px-4 pb-3 sm:px-6">
            <div
              className="h-1 overflow-hidden rounded-full bg-surface-muted"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={questionCount}
              aria-valuenow={Math.min(questionNumber, questionCount)}
              aria-label="Progression du questionnaire"
            >
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-300"
                style={{
                  width: `${(Math.min(questionNumber, questionCount) / questionCount) * 100}%`,
                }}
              />
            </div>
          </div>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-[640px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {step === 'intro' ? <Intro onStart={() => goTo('experience')} /> : null}

        {step === 'experience' ? (
          <Question
            number={1}
            total={questionCount}
            title="Où en êtes-vous dans votre pratique ?"
            subtitle="Cela nous sert à choisir un réglage de risque de départ, que vous pourrez changer."
          >
            <Choices
              options={EXPERIENCE_OPTIONS}
              value={draft.experience}
              onSelect={(experience) => {
                setDraft((current) => ({ ...current, experience }));
                goTo('playground');
              }}
            />
          </Question>
        ) : null}

        {step === 'playground' ? (
          <Question
            number={2}
            total={questionCount}
            title="Que regardez-vous le plus souvent ?"
            subtitle="L’analyse fonctionne sur n’importe quelle capture ; ceci fixe seulement l’instrument affiché par défaut."
          >
            <Choices
              options={PLAYGROUND_OPTIONS}
              value={draft.playground}
              onSelect={(playground) => {
                setDraft((current) => ({ ...current, playground }));
                goTo('objective');
              }}
            />
          </Question>
        ) : null}

        {step === 'objective' ? (
          <Question
            number={3}
            total={questionCount}
            title="Qu’attendez-vous de SCAN TRADE ?"
            subtitle="Une seule réponse, celle qui vous ressemble le plus aujourd’hui."
          >
            <Choices
              options={OBJECTIVE_OPTIONS}
              value={draft.objective}
              onSelect={(objective) => {
                setDraft((current) => ({ ...current, objective }));
                goTo('risk');
              }}
            />
          </Question>
        ) : null}

        {step === 'risk' ? (
          <Question
            number={4}
            total={questionCount}
            title="Quel niveau de sélectivité voulez-vous ?"
            subtitle="Ce réglage décide quand l’analyse conclut « aucun trade » plutôt que de proposer une configuration."
          >
            <Choices
              options={RISK_OPTIONS}
              value={draft.riskProfile}
              recommended={SUGGESTED_PROFILE[answers.experience]}
              onSelect={(riskProfile) => {
                setDraft((current) => ({ ...current, riskProfile }));
                goTo('capital');
              }}
            />
            <p className="mt-4 text-[12px] leading-4 text-ink-subtle">
              Un profil plus agressif ne rapporte pas davantage : il abaisse le seuil de confluence
              exigé, donc il propose plus de configurations, dont plus de mauvaises.
            </p>
          </Question>
        ) : null}

        {step === 'capital' ? (
          <Question
            number={5}
            total={questionCount}
            title="Quel capital suivez-vous ?"
            subtitle="Il ne sert qu’au calcul de la taille de position, sur votre appareil. Nous ne demandons aucun accès à votre courtier."
          >
            <div className="grid grid-cols-2 gap-2.5">
              {CAPITAL_PRESETS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => saveAndFinish(amount)}
                  className="flex h-16 flex-col items-start justify-center rounded-[12px] border border-line bg-surface px-4 text-left transition-colors hover:border-brand hover:bg-brand-soft/40"
                >
                  <span className="text-[16px] font-semibold text-ink">{formatMoney(amount)}</span>
                </button>
              ))}
            </div>

            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                saveAndFinish(Number(customCapital));
              }}
            >
              <Field label="Ou un autre montant" htmlFor="onboarding-capital" hint="En euros.">
                <Input
                  id="onboarding-capital"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  placeholder="25 000"
                  value={customCapital}
                  onChange={(event) => setCustomCapital(event.target.value)}
                />
              </Field>
              <Button type="submit" fullWidth disabled={Number(customCapital) <= 0}>
                Continuer
              </Button>
            </form>
          </Question>
        ) : null}

        {step === 'compte' ? (
          <Recap
            answers={answers}
            accountsEnabled={accountsEnabled}
            signedIn={Boolean(account)}
            onSkip={leave}
          />
        ) : null}

        {index > 1 && step !== 'compte' ? (
          <button
            type="button"
            onClick={back}
            className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Question précédente
          </button>
        ) : null}
      </main>
    </div>
  );
}

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <div>
      <h1 className="text-[27px] leading-9 font-semibold tracking-[-0.03em] text-ink sm:text-[32px] sm:leading-10">
        Bienvenue sur SCAN TRADE
      </h1>
      <p className="mt-2 text-[14.5px] leading-6 text-ink-muted">
        Déposez la capture d’écran de votre graphique : l’application en tire la structure, les
        niveaux, le momentum et le risque, puis explique son raisonnement.
      </p>

      <ul className="mt-5 space-y-2.5">
        {[
          'Une lecture structurée de votre capture, pas un signal à suivre aveuglément.',
          'Un verdict « aucun trade » quand rien n’est assez net — c’est un résultat, pas un échec.',
          'Aucun chiffre inventé : ce qui n’est pas lisible est annoncé comme manquant.',
        ].map((line) => (
          <li key={line} className="flex items-start gap-2.5 text-[13.5px] leading-5 text-ink">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
            {line}
          </li>
        ))}
      </ul>

      <p className="mt-5 text-[13px] leading-5 text-ink-muted">
        Cinq questions rapides pour régler l’application sur votre façon de travailler. Une minute,
        et tout reste modifiable ensuite.
      </p>

      <Button size="lg" fullWidth className="mt-5" onClick={onStart}>
        Commencer
      </Button>

      <p className="mt-4 text-center text-[13px] text-ink-muted">
        Vous avez déjà un compte ?{' '}
        <Link href="/connexion" className="font-medium text-brand hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}

function Question({
  number,
  total,
  title,
  subtitle,
  children,
}: {
  number: number;
  total: number;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-[12px] font-semibold tracking-[0.06em] text-brand uppercase">
        Question {number} sur {total}
      </p>
      <h1 className="mt-2 text-[22px] leading-7 font-semibold tracking-[-0.02em] text-ink sm:text-[25px] sm:leading-8">
        {title}
      </h1>
      <p className="mt-1.5 text-[13.5px] leading-5 text-ink-muted">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Choices<T extends string>({
  options,
  value,
  recommended,
  onSelect,
}: {
  options: Option<T>[];
  /** Undefined until the visitor answers: no option is highlighted before that. */
  value: T | undefined;
  recommended?: T;
  onSelect: (value: T) => void;
}) {
  return (
    <div className="space-y-2.5">
      {options.map((option) => {
        const Icon = option.icon;
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            aria-pressed={selected}
            className={cn(
              'flex w-full items-start gap-3 rounded-[12px] border bg-surface p-4 text-left transition-colors',
              selected
                ? 'border-brand bg-brand-soft/40 shadow-card'
                : 'border-line hover:border-line-strong hover:bg-surface-muted',
            )}
          >
            <span
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]',
                selected ? 'bg-brand text-white' : 'bg-surface-muted text-ink-muted',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] font-semibold text-ink">{option.label}</span>
                {recommended === option.value ? (
                  <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">
                    Conseillé pour vous
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 block text-[12.5px] leading-4 text-ink-muted">
                {option.hint}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Recap({
  answers,
  accountsEnabled,
  signedIn,
  onSkip,
}: {
  answers: OnboardingAnswers;
  accountsEnabled: boolean;
  signedIn: boolean;
  onSkip: () => void;
}) {
  const profile = RISK_PROFILES[answers.riskProfile];

  return (
    <div>
      <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-ink sm:text-[25px] sm:leading-8">
        C’est réglé.
      </h1>
      <p className="mt-1.5 text-[13.5px] leading-5 text-ink-muted">
        Vos réponses ont configuré l’analyse. Tout se change depuis le profil.
      </p>

      <dl className="mt-5 divide-y divide-line overflow-hidden rounded-[12px] border border-line bg-surface">
        <Row
          term="Sélectivité"
          value={RISK_PROFILE_LABEL[answers.riskProfile]}
          detail={`Confluence minimale ${profile.minConfluence.toFixed(1)}/10 · rapport risque / rendement minimal ${profile.minRiskReward.toFixed(1)}`}
        />
        <Row
          term="Capital suivi"
          value={formatMoney(answers.accountSize)}
          detail={`Risque par position ${profile.defaultRiskPercent} % — soit ${formatMoney((answers.accountSize * profile.defaultRiskPercent) / 100)}`}
        />
      </dl>

      {signedIn ? (
        <div className="mt-5">
          <Button fullWidth onClick={onSkip}>
            Analyser ma première capture
          </Button>
        </div>
      ) : (
        <div className="mt-5 rounded-[12px] border border-line bg-surface p-4">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-ink">
            <Wallet className="h-4 w-4 text-brand" aria-hidden />
            Créer un compte, ou se connecter
          </p>
          <p className="mt-1 mb-3 text-[12.5px] leading-5 text-ink-muted">
            {accountsEnabled
              ? 'Une adresse e-mail suffit : nous envoyons un lien, il n’y a pas de mot de passe. C’est ce qui vous permet de retrouver votre abonnement et votre journal sur vos autres appareils.'
              : 'Les comptes ne sont pas activés sur cette version : vos analyses restent enregistrées sur cet appareil uniquement.'}
          </p>
          {accountsEnabled ? <SignInForm /> : null}
          <button
            type="button"
            onClick={onSkip}
            className="mt-3 w-full text-[13px] font-medium text-ink-muted hover:text-ink"
          >
            Continuer sans compte
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ term, value, detail }: { term: string; value: string; detail: string }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-[13px] text-ink-muted">{term}</dt>
        <dd className="text-[14px] font-semibold text-ink">{value}</dd>
      </div>
      <p className="mt-0.5 text-[12px] leading-4 text-ink-subtle">{detail}</p>
    </div>
  );
}
