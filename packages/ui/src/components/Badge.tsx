import { View } from 'react-native';
import { useTheme } from '../theme/index.js';
import { Text } from './Text.js';

export type BadgeTone =
  'neutral' | 'accent' | 'positive' | 'negative' | 'warning' | 'info' | 'demo';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  accessibilityLabel?: string;
}

export function Badge({ label, tone = 'neutral', accessibilityLabel }: BadgeProps) {
  const theme = useTheme();

  const backgrounds: Record<BadgeTone, string> = {
    neutral: theme.colors.surfaceSecondary,
    accent: theme.colors.accentMuted,
    positive: theme.colors.positiveMuted,
    negative: theme.colors.negativeMuted,
    warning: theme.colors.warningMuted,
    info: theme.colors.infoMuted,
    demo: theme.colors.demoMuted,
  };

  const colors = {
    neutral: 'secondary',
    accent: 'accent',
    positive: 'positive',
    negative: 'negative',
    warning: 'warning',
    info: 'info',
    demo: 'demo',
  } as const;

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? label}
      style={{
        backgroundColor: backgrounds[tone],
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xs / 2 + 2,
        borderRadius: theme.radius.sm,
        alignSelf: 'flex-start',
      }}
    >
      <Text variant="caption" color={colors[tone]}>
        {label}
      </Text>
    </View>
  );
}
