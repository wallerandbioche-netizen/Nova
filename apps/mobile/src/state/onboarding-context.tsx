import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Onboarding draft.
 *
 * Answers are collected across the steps and sent once, at the end: a user who abandons
 * halfway leaves no half-built profile behind.
 */
export interface OnboardingDraft {
  investmentGoal: string | null;
  investmentHorizon: string | null;
  experienceLevel: string | null;
  riskTolerance: string | null;
  interestedAssetTypes: string[];
  positions: { symbol: string; quantity: number; averagePrice: number; currency: string }[];
}

const EMPTY_DRAFT: OnboardingDraft = {
  investmentGoal: null,
  investmentHorizon: null,
  experienceLevel: null,
  riskTolerance: null,
  interestedAssetTypes: [],
  positions: [],
};

interface OnboardingContextValue {
  draft: OnboardingDraft;
  update: (patch: Partial<OnboardingDraft>) => void;
  reset: () => void;
  isComplete: boolean;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<OnboardingDraft>(EMPTY_DRAFT);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      draft,
      update: (patch) => setDraft((current) => ({ ...current, ...patch })),
      reset: () => setDraft(EMPTY_DRAFT),
      isComplete:
        draft.investmentGoal !== null &&
        draft.investmentHorizon !== null &&
        draft.experienceLevel !== null &&
        draft.riskTolerance !== null &&
        draft.interestedAssetTypes.length > 0,
    }),
    [draft],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error('useOnboarding must be used inside an OnboardingProvider');
  return context;
}
