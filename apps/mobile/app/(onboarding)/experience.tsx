import { useRouter } from 'expo-router';
import { OptionList } from '@nova/ui';
import { OnboardingStepScreen } from '../../src/components/OnboardingStep';
import { EXPERIENCE_OPTIONS } from '../../src/content/onboarding';
import { useOnboarding } from '../../src/state/onboarding-context';

export default function ExperienceStep() {
  const router = useRouter();
  const { draft, update } = useOnboarding();

  return (
    <OnboardingStepScreen
      step="experience"
      title="Où en êtes-vous aujourd’hui ?"
      subtitle="Cela détermine le niveau de détail des explications. Vous pourrez le changer à tout moment."
      onNext={() => router.push('/(onboarding)/risk')}
      nextDisabled={!draft.experienceLevel}
    >
      <OptionList
        options={EXPERIENCE_OPTIONS}
        value={draft.experienceLevel}
        onChange={(value) => update({ experienceLevel: value })}
      />
    </OnboardingStepScreen>
  );
}
