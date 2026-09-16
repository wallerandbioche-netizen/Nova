import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useTheme } from '../theme/index.js';
import { Text } from './Text.js';

export interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Remaining questions in the current quota window, shown calmly when limited. */
  remainingQuota?: number | null;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Posez votre question à NOVA…',
  remainingQuota,
}: ChatInputProps) {
  const theme = useTheme();
  const [value, setValue] = useState('');
  const canSend = value.trim().length > 0 && !disabled;

  const send = () => {
    if (!canSend) return;
    onSend(value.trim());
    setValue('');
  };

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: theme.spacing.sm,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.lg,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
        }}
      >
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textTertiary}
          multiline
          maxLength={1000}
          editable={!disabled}
          accessibilityLabel="Votre question"
          onSubmitEditing={send}
          style={{
            flex: 1,
            maxHeight: 120,
            minHeight: 36,
            color: theme.colors.textPrimary,
            fontSize: theme.typography.body.fontSize,
            lineHeight: theme.typography.body.lineHeight,
            paddingTop: 8,
          }}
        />
        <Pressable
          onPress={send}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Envoyer la question"
          accessibilityState={{ disabled: !canSend }}
          hitSlop={8}
          style={{
            width: 36,
            height: 36,
            borderRadius: theme.radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: canSend ? theme.colors.accent : theme.colors.surfaceSecondary,
          }}
        >
          <Text variant="bodyStrong" color={canSend ? 'inverse' : 'tertiary'}>
            ↑
          </Text>
        </Pressable>
      </View>

      {typeof remainingQuota === 'number' ? (
        <Text variant="caption" color="tertiary">
          {remainingQuota > 0
            ? `${remainingQuota} question${remainingQuota > 1 ? 's' : ''} restante${remainingQuota > 1 ? 's' : ''} aujourd’hui`
            : 'Limite quotidienne atteinte. Elle se réinitialise demain.'}
        </Text>
      ) : null}
    </View>
  );
}
