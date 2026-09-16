import { useRouter } from 'expo-router';
import { OptionList } from '@nova/ui';
import { OnboardingStepScreen } from '../../src/components/OnboardingStep';
import { ASSET_TYPE_OPTIONS } from '../../src/content/onboarding';
import { useOnboarding } from '../../src/state/onboarding-context';

export default function AssetsStep() {
  const router = useRouter();
  const { draft, update } = useOnboarding();

  const toggle = (value: string) => {
    const current = new Set(draft.interestedAssetTypes);
    if (current.has(value)) current.delete(value);
    else current.add(value);
    update({ interestedAssetTypes: [...current] });
  };

  return (
    <OnboardingStepScreen
      step="assets"
      title="Que possédez-vous, ou souhaitez-vous suivre ?"
      subtitle="Plusieurs choix possibles."
      onNext={() => router.push('/(onboarding)/portfolio')}
      nextDisabled={draft.interestedAssetTypes.length === 0}
    >
      <OptionList
        options={ASSET_TYPE_OPTIONS}
        value={draft.interestedAssetTypes}
        onChange={toggle}
        multiple
      />
    </OnboardingStepScreen>
  );
}
