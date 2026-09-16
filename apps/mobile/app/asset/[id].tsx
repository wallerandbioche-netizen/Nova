import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { formatCurrency } from '@nova/finance';
import type { PriceSeries } from '@nova/types';
import {
  Button,
  Card,
  DemoBadge,
  ErrorState,
  Screen,
  SectionHeader,
  SegmentedControl,
  SkeletonCard,
  Sparkline,
  Text,
  useTheme,
} from '@nova/ui';
import { useNovaQuery } from '../../src/hooks/use-nova-query';
import { freshnessLabel } from '../../src/lib/format';
import { useAuth } from '../../src/state/auth-context';

type Range = '1W' | '1M' | '3M' | '1Y';

interface AssetResponse {
  asset: {
    id: string;
    symbol: string;
    name: string;
    sector: { label: string } | null;
    currency: string;
    isDemo: boolean;
  };
  position: { quantity: number; averagePrice: number } | null;
}

export default function AssetDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useAuth();
  const [range, setRange] = useState<Range>('1M');

  const asset = useNovaQuery<AssetResponse>({
    queryKey: ['asset', id],
    queryFn: () => api.markets.asset(id as string),
    cacheKey: `asset.${id}`,
    enabled: Boolean(id),
  });

  const prices = useNovaQuery<PriceSeries>({
    queryKey: ['asset', id, 'prices', range],
    queryFn: () => api.markets.prices(id as string, range),
    cacheKey: `asset.${id}.prices.${range}`,
    enabled: Boolean(id),
  });

  if (asset.isLoading) {
    return (
      <Screen>
        <SkeletonCard lines={3} />
      </Screen>
    );
  }

  if (asset.error || !asset.data) {
    return (
      <Screen>
        <ErrorState
          offline={asset.isOffline}
          onRetry={() => void asset.refetch()}
          requestId={asset.error?.requestId}
        />
      </Screen>
    );
  }

  const { asset: detail, position } = asset.data;
  const closes = prices.data?.points.map((point) => point.close) ?? [];
  const last = closes.at(-1);
  const first = closes[0];

  return (
    <Screen
      offline={asset.isFromCache}
      lastUpdatedLabel={asset.cachedAtLabel}
      footer={
        <Button
          label="Poser une question sur cet actif"
          variant="secondary"
          fullWidth
          onPress={() => router.push('/coach')}
        />
      }
    >
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ gap: theme.spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Text variant="caption" color="tertiary">
              {detail.symbol}
            </Text>
            <DemoBadge visible={detail.isDemo} />
          </View>
          <Text variant="h1" accessibilityRole="header">
            {detail.name}
          </Text>
          {detail.sector ? (
            <Text variant="small" color="secondary">
              {detail.sector.label}
            </Text>
          ) : null}
        </View>

        <View>
          <SectionHeader title="Évolution" />
          <Card>
            <View style={{ gap: theme.spacing.lg }}>
              <SegmentedControl<Range>
                value={range}
                onChange={setRange}
                accessibilityLabel="Période affichée"
                options={[
                  { value: '1W', label: '1S' },
                  { value: '1M', label: '1M' },
                  { value: '3M', label: '3M' },
                  { value: '1Y', label: '1A' },
                ]}
              />

              {prices.isLoading ? (
                <SkeletonCard lines={2} />
              ) : prices.error ? (
                <Text variant="small" color="secondary">
                  L’historique n’est pas disponible pour le moment.
                </Text>
              ) : (
                <>
                  <Sparkline
                    points={closes}
                    accessibilityLabel={
                      first !== undefined && last !== undefined
                        ? `Évolution sur la période, de ${formatCurrency(first, detail.currency)} à ${formatCurrency(last, detail.currency)}`
                        : 'Évolution indisponible'
                    }
                    caption={
                      prices.data
                        ? `${prices.data.points.length} séances · ${freshnessLabel(prices.data.meta.asOf)}`
                        : undefined
                    }
                  />
                  {last !== undefined ? (
                    <Text variant="h2" tabular>
                      {formatCurrency(last, detail.currency)}
                    </Text>
                  ) : (
                    <Text variant="small" color="warning">
                      Aucun cours connu pour cet actif. NOVA n’affiche pas de valeur estimée.
                    </Text>
                  )}
                </>
              )}
            </View>
          </Card>
        </View>

        {position ? (
          <View>
            <SectionHeader title="Votre position" />
            <Card>
              <View style={{ gap: theme.spacing.sm }}>
                <Row label="Quantité" value={position.quantity.toLocaleString('fr-FR')} />
                <Row
                  label="Prix moyen d’achat"
                  value={formatCurrency(position.averagePrice, detail.currency)}
                />
                {last !== undefined ? (
                  <Row
                    label="Valorisation"
                    value={formatCurrency(position.quantity * last, detail.currency)}
                  />
                ) : null}
              </View>
            </Card>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md }}>
      <Text variant="small" color="secondary">
        {label}
      </Text>
      <Text variant="smallStrong" tabular>
        {value}
      </Text>
    </View>
  );
}
