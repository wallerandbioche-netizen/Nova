import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Button, Screen, Text, useTheme } from '@nova/ui';
import { stepProgress, type OnboardingStep as StepName } from '../content/onboarding';

export interface OnboardingStepProps {
  step: StepName;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  onSkip?: () => void;
  skipLabel?: string;
  footnote?: string;
}

/**
 * Shared onboarding step layout.
 *
 * Shows progress as "étape n sur 7" — a factual indicator, not a pressure device — and keeps
 * the primary action in a fixed footer so it is always reachable with one thumb.
 */
export function OnboardingStepScreen({
  step,
  title,
  subtitle,
  children,
  onNext,
  nextLabel = 'Continuer',
  nextDisabled = false,
  nextLoading = false,
  onSkip,
  skipLabel = 'Passer cette étape',
  footnote,
}: OnboardingStepProps) {
  const theme = useTheme();
  const { index, total } = stepProgress(step);

  return (
    <Screen
      footer={
        <View style={{ gap: theme.spacing.sm }}>
          <Button
            label={nextLabel}
            fullWidth
            onPress={onNext}
            disabled={nextDisabled}
            loading={nextLoading}
          />
          {onSkip ? <Button label={skipLabel} variant="ghost" fullWidth onPress={onSkip} /> : null}
        </View>
      }
    >
      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.sm }}>
          <View
            accessible
            accessibilityLabel={`Étape ${index} sur ${total}`}
            style={{ flexDirection: 'row', gap: 4 }}
          >
            {Array.from({ length: total }).map((_, position) => (
              <View
                key={position}
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor:
                    position < index ? theme.colors.accent : theme.colors.surfaceSecondary,
                }}
              />
            ))}
          </View>
          <Text variant="caption" color="tertiary">
            Étape {index} sur {total}
          </Text>
        </View>

        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="h1" accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="small" color="secondary">
              {subtitle}
            </Text>
          ) : null}
        </View>

        {children}

        {footnote ? (
          <Text variant="caption" color="tertiary">
            {footnote}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
