import { useRouter } from 'expo-router';
import { View } from 'react-native';
import type { Paginated } from '@nova/types';
import { Card, EmptyState, ErrorState, ListRow, Screen, SkeletonCard, useTheme } from '@nova/ui';
import { useNovaQuery } from '../../src/hooks/use-nova-query';
import { formatDate } from '../../src/lib/format';
import { useAuth } from '../../src/state/auth-context';

type BriefSummary = { id: string; date: string; headline: string; itemCount: number };

export default function BriefHistoryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { api, user, subscription } = useAuth();

  const history = useNovaQuery<Paginated<BriefSummary>>({
    queryKey: ['brief', 'history', user?.id],
    queryFn: () => api.brief.history(),
    cacheKey: 'brief.history',
  });

  return (
    <Screen
      title="Historique des briefings"
      subtitle={
        subscription?.plan === 'premium'
          ? 'Tous vos briefings.'
          : 'Les sept derniers jours sont inclus dans votre formule.'
      }
    >
      {history.isLoading ? (
        <SkeletonCard lines={4} />
      ) : history.error ? (
        <ErrorState
          offline={history.isOffline}
          onRetry={() => void history.refetch()}
          requestId={history.error.requestId}
        />
      ) : (history.data?.items.length ?? 0) === 0 ? (
        <Card>
          <EmptyState
            title="Aucun briefing enregistré"
            description="Votre premier briefing apparaîtra ici dès demain matin."
          />
        </Card>
      ) : (
        <Card>
          {history.data?.items.map((brief, index) => (
            <View key={brief.id}>
              {index > 0 ? (
                <View style={{ height: 1, backgroundColor: theme.colors.border }} />
              ) : null}
              <ListRow
                label={formatDate(brief.date)}
                description={brief.headline}
                value={`${brief.itemCount}`}
                onPress={() => router.push(`/brief/${brief.id}`)}
              />
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
