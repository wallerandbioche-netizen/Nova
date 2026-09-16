import { useRouter } from 'expo-router';
import { OptionList } from '@nova/ui';
import { OnboardingStepScreen } from '../../src/components/OnboardingStep';
import { HORIZON_OPTIONS } from '../../src/content/onboarding';
import { useOnboarding } from '../../src/state/onboarding-context';

export default function HorizonStep() {
  const router = useRouter();
  const { draft, update } = useOnboarding();

  return (
    <OnboardingStepScreen
      step="horizon"
      title="Sur quelle durée investissez-vous ?"
      subtitle="L’horizon change la lecture d’une baisse : c’est l’un des éléments les plus utiles à connaître."
      onNext={() => router.push('/(onboarding)/experience')}
      nextDisabled={!draft.investmentHorizon}
    >
      <OptionList
        options={HORIZON_OPTIONS}
        value={draft.investmentHorizon}
        onChange={(value) => update({ investmentHorizon: value })}
      />
    </OnboardingStepScreen>
  );
}
