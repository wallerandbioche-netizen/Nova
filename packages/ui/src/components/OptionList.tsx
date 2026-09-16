import { Pressable, View } from 'react-native';
import { useTheme } from '../theme/index.js';
import { Text } from './Text.js';

export interface Option<T extends string = string> {
  value: T;
  label: string;
  description?: string;
}

export interface OptionListProps<T extends string = string> {
  options: Option<T>[];
  value: T | T[] | null;
  onChange: (value: T) => void;
  multiple?: boolean;
}

/**
 * Single- or multi-choice list, used throughout onboarding.
 *
 * Selection is announced through `accessibilityState`, and marked with a check glyph as well
 * as a border, so it never depends on colour alone.
 */
export function OptionList<T extends string = string>({
  options,
  value,
  onChange,
  multiple = false,
}: OptionListProps<T>) {
  const theme = useTheme();
  const selected = new Set(Array.isArray(value) ? value : value ? [value] : []);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {options.map((option) => {
        const isSelected = selected.has(option.value);
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole={multiple ? 'checkbox' : 'radio'}
            accessibilityState={{ checked: isSelected, selected: isSelected }}
            accessibilityLabel={option.label}
            accessibilityHint={option.description}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.md,
              minHeight: theme.minTouchTarget + 8,
              padding: theme.spacing.lg,
              borderRadius: theme.radius.md,
              borderWidth: isSelected ? 2 : 1,
              borderColor: isSelected ? theme.colors.accent : theme.colors.border,
              backgroundColor: isSelected ? theme.colors.accentMuted : theme.colors.surface,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong">{option.label}</Text>
              {option.description ? (
                <Text variant="small" color="secondary">
                  {option.description}
                </Text>
              ) : null}
            </View>
            <Text variant="body" color={isSelected ? 'accent' : 'tertiary'}>
              {isSelected ? '✓' : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
