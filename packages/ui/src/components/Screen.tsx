import { type ReactNode } from 'react';
import { RefreshControl, ScrollView, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/index.js';
import { OfflineBanner } from './States.js';
import { Text } from './Text.js';

export interface ScreenProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  scrollable?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  offline?: boolean;
  lastUpdatedLabel?: string | null;
  footer?: ReactNode;
  contentStyle?: ViewStyle;
  /** Disables the horizontal gutter for screens that manage their own layout (e.g. chat). */
  edgeToEdge?: boolean;
}

/**
 * Screen shell.
 *
 * Applies the 20 px gutter, safe areas and the offline banner consistently. Content is
 * vertically scrollable by default and never scrolls horizontally (responsive rule #27).
 */
export function Screen({
  children,
  title,
  subtitle,
  scrollable = true,
  onRefresh,
  refreshing = false,
  offline = false,
  lastUpdatedLabel,
  footer,
  contentStyle,
  edgeToEdge = false,
}: ScreenProps) {
  const theme = useTheme();

  const header =
    title || subtitle ? (
      <View style={{ gap: theme.spacing.xs, marginBottom: theme.spacing.lg }}>
        {title ? (
          <Text variant="h1" accessibilityRole="header">
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text variant="small" color="secondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
    ) : null;

  const padding = edgeToEdge ? 0 : theme.screenPadding;

  const body = (
    <View style={[{ paddingHorizontal: padding, gap: theme.spacing.lg }, contentStyle]}>
      {header}
      {children}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <OfflineBanner visible={offline} lastUpdatedLabel={lastUpdatedLabel} />
      {scrollable ? (
        <ScrollView
          contentContainerStyle={{
            paddingTop: theme.spacing.lg,
            paddingBottom: theme.spacing['3xl'],
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.textSecondary}
              />
            ) : undefined
          }
        >
          {body}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, paddingTop: theme.spacing.lg }}>{body}</View>
      )}
      {footer ? (
        <View
          style={{
            paddingHorizontal: theme.screenPadding,
            paddingVertical: theme.spacing.md,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          }}
        >
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );
}
