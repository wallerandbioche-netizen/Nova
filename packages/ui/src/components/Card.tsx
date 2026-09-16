import { Pressable, View, type ViewProps, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/index.js';

export interface CardProps extends ViewProps {
  onPress?: () => void;
  padded?: boolean;
  /** Elevated cards are reserved for floating surfaces; the default relies on a 1 px border. */
  elevated?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle | ViewStyle[];
}

export function Card({
  children,
  onPress,
  padded = true,
  elevated = false,
  style,
  accessibilityLabel,
  ...props
}: CardProps) {
  const theme = useTheme();

  const cardStyle: ViewStyle = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: elevated ? 0 : 1,
    borderColor: theme.colors.border,
    padding: padded ? theme.spacing.lg : 0,
    ...(elevated ? theme.elevation.card : {}),
  };

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [cardStyle, { opacity: pressed ? 0.9 : 1 }, style as ViewStyle]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View {...props} style={[cardStyle, style]} accessibilityLabel={accessibilityLabel}>
      {children}
    </View>
  );
}
