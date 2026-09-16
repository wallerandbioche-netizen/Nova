import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../theme/index.js';
import { Text } from './Text.js';

export interface ListRowProps {
  label: string;
  description?: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  right?: React.ReactNode;
}

/** Settings-style row, used across profile and settings screens. */
export function ListRow({ label, description, value, onPress, destructive, right }: ListRowProps) {
  const theme = useTheme();

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        minHeight: theme.minTouchTarget,
        paddingVertical: theme.spacing.md,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body" color={destructive ? 'negative' : 'primary'}>
          {label}
        </Text>
        {description ? (
          <Text variant="caption" color="secondary">
            {description}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="small" color="secondary">
          {value}
        </Text>
      ) : null}
      {right}
      {onPress ? (
        <Text variant="body" color="tertiary">
          ›
        </Text>
      ) : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={description}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      {content}
    </Pressable>
  );
}
