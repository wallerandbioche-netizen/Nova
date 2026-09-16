import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { JOURNAL_ACTION_LABELS } from '@nova/config';
import type { JournalEntry, Paginated } from '@nova/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Screen,
  SkeletonCard,
  Text,
  useTheme,
} from '@nova/ui';
import { useNovaQuery } from '../../src/hooks/use-nova-query';
import { formatDate } from '../../src/lib/format';
import { useAuth } from '../../src/state/auth-context';

/**
 * Investment journal.
 *
 * A record of decisions and the reasons behind them. NOVA never grades an entry: the value is
 * in re-reading what you thought at the time (rule #19).
 */
export default function JournalScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { api, user } = useAuth();

  const journal = useNovaQuery<Paginated<JournalEntry>>({
    queryKey: ['journal', user?.id],
    queryFn: () => api.journal.list(),
    cacheKey: 'journal',
  });

  return (
    <Screen
      title="Journal"
      subtitle="Vos décisions, et ce que vous pensiez au moment de les prendre."
      onRefresh={() => void journal.refetch()}
      refreshing={journal.isRefetching}
      offline={journal.isFromCache}
      lastUpdatedLabel={journal.cachedAtLabel}
      footer={<Button label="Nouvelle entrée" fullWidth onPress={() => router.push('/journal/new')} />}
    >
      {journal.isLoading ? (
        <View style={{ gap: theme.spacing.md }}>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </View>
      ) : journal.error ? (
        <ErrorState
          offline={journal.isOffline}
          onRetry={() => void journal.refetch()}
          requestId={journal.error.requestId}
        />
      ) : (journal.data?.items.length ?? 0) === 0 ? (
        <Card>
          <EmptyState
            title="Votre journal est vide."
            description="Notez pourquoi vous avez acheté, vendu — ou décidé de ne rien faire. Dans six mois, cette note vaudra plus qu’un graphique."
            actionLabel="Écrire ma première entrée"
            onAction={() => router.push('/journal/new')}
          />
        </Card>
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          {journal.data?.items.map((entry) => (
            <Card
              key={entry.id}
              onPress={() => router.push(`/journal/${entry.id}`)}
              accessibilityLabel={`${JOURNAL_ACTION_LABELS[entry.action]} du ${formatDate(entry.createdAt)}`}
            >
              <View style={{ gap: theme.spacing.sm }}>
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}>
                  <Badge label={JOURNAL_ACTION_LABELS[entry.action]} tone="neutral" />
                  {entry.asset ? <Badge label={entry.asset.symbol} tone="accent" /> : null}
                  {entry.conviction ? (
                    <Badge
                      label={`Conviction ${
                        entry.conviction === 'high'
                          ? 'forte'
                          : entry.conviction === 'medium'
                            ? 'moyenne'
                            : 'faible'
                      }`}
                      tone="neutral"
                    />
                  ) : null}
                </View>
                <Text variant="small" numberOfLines={3}>
                  {entry.reason}
                </Text>
                <Text variant="caption" color="tertiary">
                  {formatDate(entry.createdAt)}
                </Text>
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
