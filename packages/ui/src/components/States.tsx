import { View } from 'react-native';
import { useTheme } from '../theme/index.js';
import { Button } from './Button.js';
import { Text } from './Text.js';

export interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: string;
}

/**
 * Empty state (rule #43). Always says what is missing *and* what to do next, without blaming
 * the user and without inventing content to fill the screen.
 */
export function EmptyState({ title, description, actionLabel, onAction, icon }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${title}. ${description ?? ''}`}
      style={{
        alignItems: 'center',
        paddingVertical: theme.spacing['2xl'],
        paddingHorizontal: theme.spacing.lg,
        gap: theme.spacing.md,
      }}
    >
      {icon ? <Text variant="h1">{icon}</Text> : null}
      <Text variant="h3" align="center">
        {title}
      </Text>
      {description ? (
        <Text variant="small" color="secondary" align="center">
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="primary" />
      ) : null}
    </View>
  );
}

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  /** Shown discreetly so a user can quote it to support; never a stack trace. */
  requestId?: string | null;
  offline?: boolean;
}

/**
 * Error state (rule #44).
 *
 * Network and server errors read differently, both stay calm, and the technical detail is
 * limited to a request id — never an internal message.
 */
export function ErrorState({
  title,
  description,
  onRetry,
  requestId,
  offline = false,
}: ErrorStateProps) {
  const theme = useTheme();

  const resolvedTitle =
    title ??
    (offline ? 'Impossible de récupérer les dernières données.' : 'Une erreur est survenue.');
  const resolvedDescription =
    description ??
    (offline
      ? 'Vérifiez votre connexion. Les dernières données enregistrées restent consultables.'
      : 'Nous n’avons pas pu charger cette section. Vous pouvez réessayer.');

  return (
    <View
      accessible
      accessibilityLabel={`${resolvedTitle} ${resolvedDescription}`}
      style={{
        alignItems: 'center',
        paddingVertical: theme.spacing.xl,
        paddingHorizontal: theme.spacing.lg,
        gap: theme.spacing.md,
      }}
    >
      <Text variant="h3" align="center">
        {resolvedTitle}
      </Text>
      <Text variant="small" color="secondary" align="center">
        {resolvedDescription}
      </Text>
      {onRetry ? <Button label="Réessayer" variant="secondary" onPress={onRetry} /> : null}
      {requestId ? (
        <Text variant="caption" color="tertiary">
          Référence : {requestId}
        </Text>
      ) : null}
    </View>
  );
}

export interface OfflineBannerProps {
  visible: boolean;
  /** Human-readable freshness, e.g. "aujourd'hui à 08:12". */
  lastUpdatedLabel?: string | null;
}

/**
 * Offline banner (rule #42). States plainly that the data is cached and when it was captured;
 * cached data is never presented as real time.
 */
export function OfflineBanner({ visible, lastUpdatedLabel }: OfflineBannerProps) {
  const theme = useTheme();
  if (!visible) return null;

  return (
    <View
      accessible
      accessibilityRole="alert"
      style={{
        backgroundColor: theme.colors.warningMuted,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
      }}
    >
      <Text variant="caption" color="warning">
        Hors connexion
      </Text>
      <Text variant="caption" color="warning" style={{ flex: 1 }}>
        {lastUpdatedLabel
          ? `Données enregistrées — dernière mise à jour : ${lastUpdatedLabel}.`
          : 'Les données affichées peuvent ne pas être à jour.'}
      </Text>
    </View>
  );
}
