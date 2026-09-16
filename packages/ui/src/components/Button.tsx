import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/index.js';
import { Text } from './Text.js';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Button.
 *
 * Deliberately free of urgency: no pulsing, no "BUY NOW" styling. A loading button stays
 * disabled and keeps its label so the layout does not jump, and it announces its busy state
 * to screen readers.
 */
export function Button({
  label,
  variant = 'primary',
  size = 'medium',
  loading = false,
  fullWidth = false,
  disabled,
  icon,
  style,
  ...props
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const heights: Record<ButtonSize, number> = { small: 40, medium: 48, large: 54 };
  const paddings: Record<ButtonSize, number> = {
    small: theme.spacing.md,
    medium: theme.spacing.lg,
    large: theme.spacing.xl,
  };

  const backgrounds: Record<ButtonVariant, string> = {
    primary: theme.colors.accent,
    secondary: theme.colors.surfaceSecondary,
    ghost: 'transparent',
    danger: theme.colors.negativeMuted,
  };

  const labelColors: Record<ButtonVariant, Parameters<typeof Text>[0]['color']> = {
    primary: 'inverse',
    secondary: 'primary',
    ghost: 'accent',
    danger: 'negative',
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(isDisabled), busy: loading }}
      accessibilityLabel={label}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          height: heights[size],
          minHeight: theme.minTouchTarget,
          paddingHorizontal: paddings[size],
          borderRadius: theme.radius.md,
          backgroundColor: backgrounds[variant],
          borderWidth: variant === 'ghost' ? 0 : 1,
          borderColor: variant === 'primary' ? theme.colors.accent : theme.colors.border,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
      {...props}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={variant === 'primary' ? theme.colors.accentText : theme.colors.accent}
            style={{ marginRight: theme.spacing.sm }}
          />
        ) : icon ? (
          <View style={{ marginRight: theme.spacing.sm }}>{icon}</View>
        ) : null}
        <Text
          variant={size === 'small' ? 'smallStrong' : 'bodyStrong'}
          color={labelColors[variant]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
