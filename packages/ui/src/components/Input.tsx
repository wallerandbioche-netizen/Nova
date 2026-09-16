import { useState } from 'react';
import { TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/index.js';
import { Text } from './Text.js';

export interface InputProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string | null;
  containerStyle?: ViewStyle;
  suffix?: string;
}

/**
 * Text input with a visible label, hint and error.
 *
 * The error is linked to the field for screen readers and is never conveyed by a red border
 * alone: it is always accompanied by a message.
 */
export function Input({
  label,
  hint,
  error,
  containerStyle,
  suffix,
  editable = true,
  style,
  ...props
}: InputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={[{ gap: theme.spacing.xs }, containerStyle]}>
      {label ? (
        <Text variant="smallStrong" color="secondary">
          {label}
        </Text>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: theme.minTouchTarget,
          borderWidth: 1,
          borderRadius: theme.radius.md,
          borderColor: error
            ? theme.colors.negative
            : focused
              ? theme.colors.accent
              : theme.colors.border,
          backgroundColor: editable ? theme.colors.surface : theme.colors.surfaceSecondary,
          paddingHorizontal: theme.spacing.md,
        }}
      >
        <TextInput
          {...props}
          editable={editable}
          accessibilityLabel={props.accessibilityLabel ?? label}
          accessibilityHint={hint}
          accessibilityState={{ disabled: !editable }}
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
          placeholderTextColor={theme.colors.textTertiary}
          style={[
            {
              flex: 1,
              paddingVertical: theme.spacing.md,
              color: theme.colors.textPrimary,
              fontSize: theme.typography.body.fontSize,
              lineHeight: theme.typography.body.lineHeight,
            },
            style,
          ]}
        />
        {suffix ? (
          <Text variant="small" color="secondary">
            {suffix}
          </Text>
        ) : null}
      </View>

      {error ? (
        <Text variant="caption" color="negative" accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="tertiary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
