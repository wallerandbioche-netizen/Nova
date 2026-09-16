import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import type { DailyBrief } from '@nova/types';
import {
  Badge,
  Card,
  DemoBadge,
  EmptyState,
  ErrorState,
  Screen,
  SectionHeader,
  SkeletonCard,
  Text,
  useTheme,
} from '@nova/ui';
import { useNovaQuery } from '../../src/hooks/use-nova-query';
import { formatDateTime } from '../../src/lib/format';
import { useAuth } from '../../src/state/auth-context';

/**
 * Daily brief.
 *
 * `today` resolves to the current brief; any other id opens a stored one. When the brief being
 * shown is not today's, the screen says so with its real date — cached or older content is
 * never presented as current (rule #41).
 */
export default function BriefScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useAuth();

  const isToday = !id || id === 'today';

  const brief = useNovaQuery<DailyBrief>({
    queryKey: ['brief', id ?? 'today'],
    queryFn: () => (isToday ? api.brief.today() : api.brief.detail(id as string)),
    cacheKey: `brief.${id ?? 'today'}`,
    staleTime: 5 * 60_000,
  });

  if (brief.isLoading) {
    return (
      <Screen title="Votre briefing">
        <View style={{ gap: theme.spacing.lg }}>
          <SkeletonCard lines={3} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </View>
      </Screen>
    );
  }

  if (brief.error || !brief.data) {
    return (
      <Screen title="Votre briefing">
        <ErrorState
          offline={brief.isOffline}
          onRetry={() => void brief.refetch()}
          requestId={brief.error?.requestId}
        />
      </Screen>
    );
  }

  const data = brief.data;

  return (
    <Screen
      onRefresh={() => void brief.refetch()}
      refreshing={brief.isRefetching}
      offline={brief.isFromCache}
      lastUpdatedLabel={brief.cachedAtLabel}
    >
      <View style={{ gap: theme.spacing['2xl'] }}>
        <View style={{ gap: theme.spacing.sm }}>
          <View
            style={{
              flexDirection: 'row',
              gap: theme.spacing.sm,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            {data.isStale ? (
              <Badge
                label={`Briefing du ${data.date}`}
                tone="warning"
                accessibilityLabel={`Ce briefing date du ${data.date}. Celui d’aujourd’hui n’est pas encore disponible.`}
              />
            ) : null}
            <DemoBadge visible={data.meta.isDemo} />
          </View>

          <Text variant="h1" accessibilityRole="header">
            {data.greeting}
          </Text>
          <Text variant="h3">{data.headline}</Text>
          <Text variant="body" color="secondary">
            {data.summary}
          </Text>
          <Text variant="caption" color="tertiary">
            Données arrêtées au {formatDateTime(data.dataAsOf)}.
          </Text>

          {data.isStale ? (
            <Text variant="small" color="warning">
              Le briefing d’aujourd’hui n’a pas encore été généré. Voici le dernier disponible.
            </Text>
          ) : null}
        </View>

        <Card>
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="smallStrong" color="secondary">
              Les marchés
            </Text>
            <Text variant="body">{data.marketSummary.text}</Text>
          </View>
        </Card>

        {data.portfolioSummary ? (
          <Card>
            <View style={{ gap: theme.spacing.sm }}>
              <Text variant="smallStrong" color="secondary">
                Pour votre portefeuille
              </Text>
              <Text variant="body">{data.portfolioSummary.text}</Text>
            </View>
          </Card>
        ) : null}

        <View>
          <SectionHeader
            title={`Les ${data.items.length} information${data.items.length > 1 ? 's' : ''} retenue${
              data.items.length > 1 ? 's' : ''
            }`}
          />
          {data.items.length === 0 ? (
            <Card>
              <EmptyState
                title="Rien de marquant ce matin"
                description="Aucune actualité n’a dépassé le seuil d’importance retenu par NOVA. C’est une information en soi."
              />
            </Card>
          ) : (
            <View style={{ gap: theme.spacing.md }}>
              {data.items.map((item, index) => (
                <Card
                  key={item.newsId}
                  onPress={() => router.push(`/news/${item.newsId}`)}
                  accessibilityLabel={`${index + 1}. ${item.title}`}
                >
                  <View style={{ gap: theme.spacing.sm }}>
                    <View
                      style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}
                    >
                      <Text variant="caption" color="tertiary" tabular>
                        {String(index + 1).padStart(2, '0')}
                      </Text>
                      {item.relevanceReason ? (
                        <Badge label={item.relevanceReason} tone="accent" />
                      ) : null}
                    </View>
                    <Text variant="h3">{item.title}</Text>
                    <Text variant="small" color="secondary">
                      {item.takeaway}
                    </Text>
                    <Text variant="caption" color="tertiary">
                      {item.source} · {formatDateTime(item.publishedAt)}
                    </Text>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>

        {data.uncertainties.length > 0 ? (
          <View
            style={{
              backgroundColor: theme.colors.warningMuted,
              borderRadius: theme.radius.lg,
              padding: theme.spacing.lg,
              gap: theme.spacing.sm,
            }}
          >
            <Text variant="smallStrong" color="warning">
              À garder en tête
            </Text>
            {data.uncertainties.map((uncertainty, index) => (
              <Text key={index} variant="small" color="warning">
                • {uncertainty}
              </Text>
            ))}
          </View>
        ) : null}

        {data.learningSuggestionId ? (
          <Card
            onPress={() => router.push(`/lesson/${data.learningSuggestionId}`)}
            accessibilityLabel="Ouvrir la leçon du jour"
          >
            <View style={{ gap: theme.spacing.xs }}>
              <Text variant="smallStrong" color="accent">
                À apprendre aujourd’hui
              </Text>
              <Text variant="body">Une leçon de deux minutes liée à l’actualité du jour.</Text>
            </View>
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}
