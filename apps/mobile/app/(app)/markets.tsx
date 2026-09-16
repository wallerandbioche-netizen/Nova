import { useRouter } from 'expo-router';
import { View } from 'react-native';
import type { MarketOverview, MarketRadar } from '@nova/types';
import {
  Card,
  DemoBadge,
  ErrorState,
  MetricCard,
  Screen,
  SectionHeader,
  SkeletonCard,
  Text,
  useTheme,
} from '@nova/ui';
import { useNovaQuery } from '../../src/hooks/use-nova-query';
import { freshnessLabel } from '../../src/lib/format';
import { useAuth } from '../../src/state/auth-context';

/**
 * Markets: the indices, then the Market Radar.
 *
 * The radar shows which themes actually drive today's news flow and how exposed the user is to
 * each. It is a premium feature: when the plan does not include it, the screen explains what it
 * is instead of hiding it or showing a broken view.
 */
export default function MarketsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { api, user, subscription } = useAuth();

  const overview = useNovaQuery<MarketOverview>({
    queryKey: ['markets', 'overview'],
    queryFn: () => api.markets.overview(),
    cacheKey: 'markets.overview',
    staleTime: 5 * 60_000,
  });

  const hasRadar = subscription?.entitlements.includes('market_radar') ?? false;

  const radar = useNovaQuery<MarketRadar>({
    queryKey: ['markets', 'radar', user?.id],
    queryFn: () => api.markets.radar(),
    cacheKey: 'markets.radar',
    enabled: hasRadar,
    staleTime: 10 * 60_000,
  });

  return (
    <Screen
      title="Marchés"
      onRefresh={() => {
        void overview.refetch();
        if (hasRadar) void radar.refetch();
      }}
      refreshing={overview.isRefetching}
      offline={overview.isFromCache}
      lastUpdatedLabel={overview.cachedAtLabel}
    >
      <View style={{ gap: theme.spacing['2xl'] }}>
        <View>
          <SectionHeader title="Aujourd’hui" subtitle="Dernières valeurs connues." />
          {overview.isLoading ? (
            <View style={{ gap: theme.spacing.md }}>
              <SkeletonCard lines={1} />
              <SkeletonCard lines={1} />
            </View>
          ) : overview.error ? (
            <ErrorState
              offline={overview.isOffline}
              onRetry={() => void overview.refetch()}
              requestId={overview.error.requestId}
            />
          ) : (
            <View style={{ gap: theme.spacing.md }}>
              {overview.data?.quotes.map((quote) => (
                <MetricCard
                  key={quote.key}
                  label={quote.label}
                  value={quote.value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
                  changePercent={quote.changePercent}
                  caption={freshnessLabel(quote.asOf)}
                  isDemo={quote.isDemo}
                />
              ))}
            </View>
          )}
        </View>

        <View>
          <SectionHeader
            title="Market Radar"
            subtitle="Les thèmes qui portent l’actualité, et votre exposition à chacun."
          />

          {!hasRadar ? (
            <Card>
              <View style={{ gap: theme.spacing.sm }}>
                <Text variant="h3">Disponible avec NOVA Premium</Text>
                <Text variant="small" color="secondary">
                  Le Market Radar classe les grands thèmes (taux, inflation, énergie, technologie…)
                  selon l’attention qu’ils reçoivent, et indique la part de votre portefeuille
                  exposée à chacun.
                </Text>
                <Text
                  variant="smallStrong"
                  color="accent"
                  onPress={() => router.push('/settings/subscription')}
                  accessibilityRole="link"
                >
                  Voir les formules
                </Text>
              </View>
            </Card>
          ) : radar.isLoading ? (
            <SkeletonCard lines={3} />
          ) : radar.error ? (
            <ErrorState
              offline={radar.isOffline}
              onRetry={() => void radar.refetch()}
              requestId={radar.error.requestId}
            />
          ) : (
            <View style={{ gap: theme.spacing.md }}>
              {radar.data?.themes.map((theme_) => (
                <Card key={theme_.key}>
                  <View style={{ gap: theme.spacing.sm }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Text variant="h3">{theme_.label}</Text>
                      <DemoBadge visible={radar.data?.meta.isDemo ?? false} />
                    </View>

                    <View
                      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}
                    >
                      <View
                        accessibilityElementsHidden
                        style={{
                          flex: 1,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: theme.colors.surfaceSecondary,
                          overflow: 'hidden',
                        }}
                      >
                        <View
                          style={{
                            width: `${Math.max(theme_.importance, 2)}%`,
                            height: '100%',
                            backgroundColor: theme.colors.accent,
                          }}
                        />
                      </View>
                      <Text variant="caption" color="secondary" tabular>
                        {theme_.importance}/100
                      </Text>
                    </View>

                    <Text variant="small" color="secondary">
                      {theme_.summary} Attention : {theme_.directionLabel}.
                    </Text>

                    {theme_.userExposurePercent !== null ? (
                      <View
                        style={{
                          backgroundColor:
                            theme_.userExposurePercent >= 10
                              ? theme.colors.accentMuted
                              : theme.colors.surfaceSecondary,
                          borderRadius: theme.radius.sm,
                          padding: theme.spacing.sm,
                        }}
                      >
                        <Text
                          variant="caption"
                          color={theme_.userExposurePercent >= 10 ? 'accent' : 'secondary'}
                        >
                          Votre exposition estimée :{' '}
                          {theme_.userExposurePercent.toFixed(1).replace('.', ',')} %
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </Card>
              ))}
              <Text variant="caption" color="tertiary">
                L’importance mesure la place d’un thème dans l’actualité récente. Ce n’est pas une
                prévision d’évolution des marchés.
              </Text>
            </View>
          )}
        </View>
      </View>
    </Screen>
  );
}
