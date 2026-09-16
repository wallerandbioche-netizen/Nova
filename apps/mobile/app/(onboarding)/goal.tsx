import { useRouter } from 'expo-router';
import { OptionList } from '@nova/ui';
import { OnboardingStepScreen } from '../../src/components/OnboardingStep';
import { GOAL_OPTIONS } from '../../src/content/onboarding';
import { useOnboarding } from '../../src/state/onboarding-context';

export default function GoalStep() {
  const router = useRouter();
  const { draft, update } = useOnboarding();

  return (
    <OnboardingStepScreen
      step="goal"
      title="Quel est votre principal objectif ?"
      subtitle="NOVA adapte ses explications à ce que vous cherchez à faire."
      onNext={() => router.push('/(onboarding)/horizon')}
      nextDisabled={!draft.investmentGoal}
    >
      <OptionList
        options={GOAL_OPTIONS}
        value={draft.investmentGoal}
        onChange={(value) => update({ investmentGoal: value })}
      />
    </OnboardingStepScreen>
  );
}
