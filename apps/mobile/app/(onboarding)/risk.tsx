import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { RISK_QUESTIONNAIRE_DISCLAIMER } from '@nova/config';
import { OptionList, Text, useTheme } from '@nova/ui';
import { OnboardingStepScreen } from '../../src/components/OnboardingStep';
import { RISK_OPTIONS, RISK_SCENARIO } from '../../src/content/onboarding';
import { useOnboarding } from '../../src/state/onboarding-context';

/**
 * Risk step.
 *
 * A concrete scenario rather than an abstract slider: people answer "what would I do" far more
 * honestly than "rate your risk tolerance from 1 to 10". The screen states explicitly that this
 * is not, by itself, a regulatory suitability assessment.
 */
export default function RiskStep() {
  const router = useRouter();
  const theme = useTheme();
  const { draft, update } = useOnboarding();

  return (
    <OnboardingStepScreen
      step="risk"
      title="Une baisse temporaire"
      onNext={() => router.push('/(onboarding)/assets')}
      nextDisabled={!draft.riskTolerance}
      footnote={RISK_QUESTIONNAIRE_DISCLAIMER}
    >
      <View style={{ gap: theme.spacing.lg }}>
        <View
          style={{
            backgroundColor: theme.colors.surfaceSecondary,
            borderRadius: theme.radius.md,
            padding: theme.spacing.lg,
          }}
        >
          <Text variant="body">{RISK_SCENARIO}</Text>
        </View>

        <OptionList
          options={RISK_OPTIONS}
          value={draft.riskTolerance}
          onChange={(value) => update({ riskTolerance: value })}
        />

        <Text variant="caption" color="tertiary">
          Il n’y a pas de bonne réponse. Cette question sert à adapter la façon dont NOVA vous
          explique les mouvements de marché.
        </Text>
      </View>
    </OnboardingStepScreen>
  );
}
