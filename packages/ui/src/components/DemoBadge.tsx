import { Pressable, View } from 'react-native';
import { DEMO_DATA_EXPLANATION, DEMO_DATA_LABEL } from '@nova/config';
import { useTheme } from '../theme/index.js';
import { Badge } from './Badge.js';
import { Text } from './Text.js';

export interface DemoBadgeProps {
  /** Nothing is rendered when the data is real. */
  visible: boolean;
  onPress?: () => void;
  /** Shows the full explanation under the badge rather than only the label. */
  expanded?: boolean;
}

/**
 * DEMO DATA marker (absolute rule #58).
 *
 * Whenever a screen displays a figure that does not come from a real market feed, this badge
 * is shown. It is never decorative and never suppressed to make a screen look better.
 */
export function DemoBadge({ visible, onPress, expanded = false }: DemoBadgeProps) {
  const theme = useTheme();
  if (!visible) return null;

  const badge = (
    <Badge
      label={DEMO_DATA_LABEL}
      tone="demo"
      accessibilityLabel={`${DEMO_DATA_LABEL}. ${DEMO_DATA_EXPLANATION}`}
    />
  );

  if (!expanded) {
    return onPress ? (
      <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8}>
        {badge}
      </Pressable>
    ) : (
      badge
    );
  }

  return (
    <View
      style={{
        backgroundColor: theme.colors.demoMuted,
        borderRadius: theme.radius.md,
        padding: theme.spacing.md,
        gap: theme.spacing.sm,
      }}
    >
      {badge}
      <Text variant="small" color="demo">
        {DEMO_DATA_EXPLANATION}
      </Text>
    </View>
  );
}
