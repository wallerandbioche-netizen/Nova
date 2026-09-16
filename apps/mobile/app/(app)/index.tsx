import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import type { DashboardPayload } from '@nova/types';
import { formatCurrency } from '@nova/finance';
import {
  Button,
  Card,
  DemoBadge,
  EmptyState,
  ErrorState,
  MetricCard,
  NewsCard,
  Screen,
  SectionHeader,
  SkeletonCard,
  Text,
  ValueChange,
  useTheme,
} from '@nova/ui';
import { freshnessLabel } from '../../src/lib/format';
import { useNovaQuery } from '../../src/hooks/use-nova-query';
import { useAuth } from '../../src/state/auth-context';

/**
 * Dashboard — the main screen.
 *
 * Hierarchy, in order: what matters today, what concerns you, what to do next. Everything
 * comes from a single API call, and every figure carries its freshness and its provenance.
 */
export default function DashboardScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { api, user } = useAuth();

  const dashboard = useNovaQuery<DashboardPayload>({
    queryKey: ['dashboard', user?.id],
    queryFn: () => api.dashboard.get(),
    cacheKey: 'dashboard',
    staleTime: 60_000,
  });

  if (dashboard.isLoading) {
    return (
      <Screen title="Bonjour 👋">
        <View style={{ gap: theme.spacing.lg }}>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={1} />
          <SkeletonCard lines={3} />
        </View>
      </Screen>
    );
  }

  if (dashboard.error || !dashboard.data) {
    return (
      <Screen>
        <ErrorState
          offline={dashboard.isOffline}
          onRetry={() => void dashboard.refetch()}
          requestId={dashboard.error?.requestId}
        />
      </Screen>
    );
  }

  const data = dashboard.data;

  return (
    <Screen
      onRefresh={() => void dashboard.refetch()}
      refreshing={dashboard.isRefetching}
      offline={dashboard.isFromCache}
      lastUpdatedLabel={dashboard.cachedAtLabel}
    >
      <View style={{ gap: theme.spacing['2xl'] }}>
        {/* ---------------------------------------------------------- Greeting + brief */}
        <View style={{ gap: theme.spacing.lg }}>
          <Text variant="h1" accessibilityRole="header">
            {data.greeting}
          </Text>

          {data.brief ? (
            <Card onPress={() => router.push(`/brief/${data.brief?.id}`)} accessibilityLabel="Ouvrir votre briefing du jour">
              <View style={{ gap: theme.spacing.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text variant="smallStrong" color="accent">
                    Votre briefing du jour
                  </Text>
                  <DemoBadge visible={data.brief.meta.isDemo} />
                </View>
                <Text variant="h3">{data.brief.headline}</Text>
                <Text variant="small" color="secondary" numberOfLines={3}>
                  {data.brief.summary}
                </Text>
                {data.brief.isStale ? (
                  <Text variant="caption" color="warning">
                    Briefing du {data.brief.date} — le briefing d’aujourd’hui n’est pas encore
                    disponible.
                  </Text>
                ) : (
                  <Text variant="caption" color="tertiary">
                    {freshnessLabel(data.brief.dataAsOf)}
                  </Text>
                )}
              </View>
            </Card>
          ) : null}
        </View>

        {/* ---------------------------------------------------------- Portfolio */}
        {data.portfolio ? (
          data.portfolio.isEmpty ? (
            <Card>
              <EmptyState
                title="Votre portefeuille est vide."
                description="Ajoutez votre première position pour personnaliser votre briefing."
                actionLabel="Ajouter une position"
                onAction={() => router.push('/(app)/portfolio')}
              />
            </Card>
          ) : (
            <Card onPress={() => router.push('/(app)/portfolio')} accessibilityLabel="Ouvrir votre portefeuille">
              <View style={{ gap: theme.spacing.xs }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="caption" color="secondary">
                    {data.portfolio.name}
                  </Text>
                  <DemoBadge visible={data.portfolio.meta.isDemo} />
                </View>
                <Text variant="display" tabular>
                  {formatCurrency(data.portfolio.totalValue, data.portfolio.baseCurrency)}
                </Text>
                <ValueChange
                  percent={data.portfolio.dayChangePercent}
                  accessibilityPrefix="Votre portefeuille"
                />
                <Text variant="caption" color="tertiary">
                  {freshnessLabel(data.portfolio.meta.asOf)}
                </Text>
              </View>
            </Card>
          )
        ) : (
          <Card>
            <EmptyState
              title="Aucun portefeuille"
              description="Créez votre portefeuille pour que NOVA relie l’actualité à ce que vous détenez."
              actionLabel="Créer mon portefeuille"
              onAction={() => router.push('/(app)/portfolio')}
            />
          </Card>
        )}

        {/* ---------------------------------------------------------- Markets */}
        <View>
          <SectionHeader
            title="Les marchés"
            actionLabel="Tout voir"
            onAction={() => router.push('/(app)/markets')}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: theme.spacing.md, paddingRight: theme.spacing.lg }}
          >
            {data.markets.map((quote) => (
              <MetricCard
                key={quote.key}
                label={quote.label}
                value={quote.value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
                changePercent={quote.changePercent}
                isDemo={quote.isDemo}
                compact
              />
            ))}
          </ScrollView>
        </View>

        {/* ---------------------------------------------------------- Top news */}
        <View>
          <SectionHeader
            title="Les informations importantes"
            subtitle="Classées selon leur portée et votre exposition."
          />
          <View style={{ gap: theme.spacing.md }}>
            {data.topNews.length === 0 ? (
              <Card>
                <EmptyState
                  title="Aucune actualité marquante"
                  description="Rien n’a dépassé le seuil d’importance retenu par NOVA sur les dernières 48 heures."
                />
              </Card>
            ) : (
              data.topNews.map((item) => (
                <NewsCard key={item.id} item={item} onPress={() => router.push(`/news/${item.id}`)} />
              ))
            )}
          </View>
        </View>

        {/* ---------------------------------------------------------- Personal insight */}
        {data.portfolioInsight ? (
          <View>
            <SectionHeader title="Pour votre portefeuille" />
            <Card>
              <View style={{ gap: theme.spacing.sm }}>
                <Text variant="body">{data.portfolioInsight.text}</Text>
                <Text variant="caption" color="tertiary">
                  Analyse produite à partir de votre exposition. Il ne s’agit pas d’une prévision.
                </Text>
              </View>
            </Card>
          </View>
        ) : null}

        {/* ---------------------------------------------------------- Lesson */}
        {data.lessonOfTheDay ? (
          <View>
            <SectionHeader title="À apprendre aujourd’hui" />
            <Card
              onPress={() => router.push(`/lesson/${data.lessonOfTheDay?.id}`)}
              accessibilityLabel={`Leçon : ${data.lessonOfTheDay.title}`}
            >
              <View style={{ gap: theme.spacing.xs }}>
                <Text variant="h3">{data.lessonOfTheDay.title}</Text>
                <Text variant="small" color="secondary">
                  {data.lessonOfTheDay.estimatedMinutes} minutes
                </Text>
              </View>
            </Card>
          </View>
        ) : null}

        {/* ---------------------------------------------------------- Ask NOVA */}
        <Card>
          <View style={{ gap: theme.spacing.md }}>
            <Text variant="h3">Demander à NOVA</Text>
            <Text variant="small" color="secondary">
              « Pourquoi mon portefeuille baisse aujourd’hui ? », « Qu’est-ce qu’un ETF ? »
            </Text>
            <Button label="Poser une question" variant="secondary" onPress={() => router.push('/coach')} />
          </View>
        </Card>
      </View>
    </Screen>
  );
}
