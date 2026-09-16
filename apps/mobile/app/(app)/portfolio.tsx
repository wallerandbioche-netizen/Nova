import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { formatCurrency } from '@nova/finance';
import { priceSchema, quantitySchema } from '@nova/validation';
import {
  AllocationBar,
  AssetCard,
  Button,
  Card,
  DemoBadge,
  EmptyState,
  ErrorState,
  Input,
  Screen,
  SectionHeader,
  SegmentedControl,
  SkeletonCard,
  Text,
  ValueChange,
  useTheme,
} from '@nova/ui';
import { ApiError } from '../../src/api/client';
import type { PortfolioDetail, PortfolioSummary } from '../../src/api/endpoints';
import { useNovaQuery } from '../../src/hooks/use-nova-query';
import { freshnessLabel } from '../../src/lib/format';
import { useAuth } from '../../src/state/auth-context';

type Breakdown = 'assetType' | 'sector' | 'region';

/**
 * Portfolio screen.
 *
 * Every number shown here is computed server-side by the shared financial engine; this screen
 * only formats. Positions without a known price are displayed as "valorisation indisponible"
 * rather than as zero.
 */
export default function PortfolioScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { api, user } = useAuth();

  const [breakdown, setBreakdown] = useState<Breakdown>('assetType');
  const [adding, setAdding] = useState(false);

  const portfolios = useNovaQuery<{ items: PortfolioSummary[] }>({
    queryKey: ['portfolios', user?.id],
    queryFn: () => api.portfolios.list(),
    cacheKey: 'portfolios',
  });

  const portfolioId = portfolios.data?.items[0]?.id;

  const detail = useNovaQuery<PortfolioDetail>({
    queryKey: ['portfolio', portfolioId],
    queryFn: () => api.portfolios.detail(portfolioId as string),
    cacheKey: portfolioId ? `portfolio.${portfolioId}` : undefined,
    enabled: Boolean(portfolioId),
  });

  const refresh = async () => {
    await portfolios.refetch();
    await detail.refetch();
  };

  if (portfolios.isLoading || (portfolioId && detail.isLoading)) {
    return (
      <Screen title="Portefeuille">
        <View style={{ gap: theme.spacing.lg }}>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={4} />
        </View>
      </Screen>
    );
  }

  if (portfolios.error) {
    return (
      <Screen title="Portefeuille">
        <ErrorState
          offline={portfolios.isOffline}
          onRetry={() => void refresh()}
          requestId={portfolios.error.requestId}
        />
      </Screen>
    );
  }

  // No portfolio at all yet.
  if (!portfolioId) {
    return (
      <Screen title="Portefeuille">
        <Card>
          <EmptyState
            title="Vous n’avez pas encore de portefeuille."
            description="Créez-en un pour suivre votre exposition et personnaliser votre briefing."
            actionLabel="Créer mon portefeuille"
            onAction={async () => {
              await api.portfolios.create({ name: 'Mon portefeuille', baseCurrency: 'EUR' });
              await refresh();
            }}
          />
        </Card>
      </Screen>
    );
  }

  const analytics = detail.data?.analytics;
  const positions = detail.data?.positions ?? [];

  const segments =
    breakdown === 'assetType'
      ? (analytics?.byAssetType ?? [])
      : breakdown === 'sector'
        ? (analytics?.bySector ?? [])
        : (analytics?.byRegion ?? []);

  return (
    <Screen
      title="Portefeuille"
      onRefresh={() => void refresh()}
      refreshing={detail.isRefetching}
      offline={detail.isFromCache}
      lastUpdatedLabel={detail.cachedAtLabel}
      footer={
        <Button
          label={adding ? 'Fermer le formulaire' : 'Ajouter une position'}
          fullWidth
          variant={adding ? 'ghost' : 'primary'}
          onPress={() => setAdding((current) => !current)}
        />
      }
    >
      <View style={{ gap: theme.spacing['2xl'] }}>
        {/* ------------------------------------------------------------ Total value */}
        <Card>
          <View style={{ gap: theme.spacing.xs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="caption" color="secondary">
                Valeur totale
              </Text>
              <DemoBadge visible={analytics?.meta.isDemo ?? false} />
            </View>
            <Text variant="display" tabular>
              {analytics ? formatCurrency(analytics.totalValue, analytics.baseCurrency) : '—'}
            </Text>
            <View style={{ flexDirection: 'row', gap: theme.spacing.lg, flexWrap: 'wrap' }}>
              <View>
                <Text variant="caption" color="tertiary">
                  Aujourd’hui
                </Text>
                <ValueChange
                  percent={analytics?.dayChangePercent ?? null}
                  accessibilityPrefix="Variation du jour"
                />
              </View>
              <View>
                <Text variant="caption" color="tertiary">
                  Depuis l’achat
                </Text>
                <ValueChange
                  percent={analytics?.totalUnrealizedGainPercent ?? null}
                  accessibilityPrefix="Plus-value latente"
                />
              </View>
            </View>
            <Text variant="caption" color="tertiary">
              {freshnessLabel(analytics?.meta.asOf)}
            </Text>
            {analytics && analytics.unvaluedPercent > 0 ? (
              <Text variant="caption" color="warning">
                {analytics.unvaluedPercent.toFixed(0)} % de vos positions n’ont pas de cours connu
                et ne sont pas incluses dans la valeur totale.
              </Text>
            ) : null}
          </View>
        </Card>

        {/* ------------------------------------------------------------ Add position */}
        {adding ? (
          <AddPositionForm
            portfolioId={portfolioId}
            onAdded={async () => {
              setAdding(false);
              await refresh();
            }}
          />
        ) : null}

        {positions.length === 0 ? (
          <Card>
            <EmptyState
              title="Votre portefeuille est vide."
              description="Ajoutez votre première position pour personnaliser votre briefing."
              actionLabel="Ajouter une position"
              onAction={() => setAdding(true)}
            />
          </Card>
        ) : (
          <>
            {/* -------------------------------------------------------- Allocation */}
            <View>
              <SectionHeader title="Répartition" />
              <View style={{ gap: theme.spacing.lg }}>
                <SegmentedControl<Breakdown>
                  value={breakdown}
                  onChange={setBreakdown}
                  accessibilityLabel="Choisir le type de répartition"
                  options={[
                    { value: 'assetType', label: 'Classes' },
                    { value: 'sector', label: 'Secteurs' },
                    { value: 'region', label: 'Zones' },
                  ]}
                />
                <Card>
                  <AllocationBar segments={segments} />
                </Card>
              </View>
            </View>

            {/* -------------------------------------------------------- Concentration */}
            {analytics ? (
              <View>
                <SectionHeader title="Concentration" />
                <Card>
                  <View style={{ gap: theme.spacing.sm }}>
                    <Row
                      label="Première ligne"
                      value={`${analytics.concentration.topPositionPercent.toFixed(1).replace('.', ',')} %`}
                      hint={analytics.concentration.topPositionLabel ?? undefined}
                    />
                    <Row
                      label="Trois premières lignes"
                      value={`${analytics.concentration.topThreePercent.toFixed(1).replace('.', ',')} %`}
                    />
                    <Row label="Nombre de positions" value={String(analytics.concentration.positionCount)} />
                    <Text variant="caption" color="tertiary">
                      Une concentration élevée signifie qu’une seule information peut avoir un
                      effet important sur la valeur de votre portefeuille.
                    </Text>
                  </View>
                </Card>
              </View>
            ) : null}

            {/* -------------------------------------------------------- Positions */}
            <View>
              <SectionHeader title="Positions" subtitle={`${positions.length} ligne${positions.length > 1 ? 's' : ''}`} />
              <View style={{ gap: theme.spacing.md }}>
                {positions.map((position) => (
                  <AssetCard
                    key={position.id}
                    position={position}
                    baseCurrency={analytics?.baseCurrency ?? 'EUR'}
                    onPress={() => router.push(`/asset/${position.asset.id}`)}
                  />
                ))}
              </View>
            </View>

            <Button
              label="Demander à NOVA d’expliquer mon portefeuille"
              variant="secondary"
              fullWidth
              onPress={() => router.push('/coach?topic=portfolio')}
            />
          </>
        )}
      </View>
    </Screen>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md }}>
      <View style={{ flex: 1 }}>
        <Text variant="small" color="secondary">
          {label}
        </Text>
        {hint ? (
          <Text variant="caption" color="tertiary">
            {hint}
          </Text>
        ) : null}
      </View>
      <Text variant="smallStrong" tabular>
        {value}
      </Text>
    </View>
  );
}

function AddPositionForm({
  portfolioId,
  onAdded,
}: {
  portfolioId: string;
  onAdded: () => Promise<void>;
}) {
  const theme = useTheme();
  const { api } = useAuth();

  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('');
  const [averagePrice, setAveragePrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setError(null);

    const parsedQuantity = quantitySchema.safeParse(quantity);
    const parsedPrice = priceSchema.safeParse(averagePrice);

    if (!symbol.trim()) {
      setError('Indiquez un nom ou un symbole.');
      return;
    }
    if (!parsedQuantity.success) {
      setError(parsedQuantity.error.issues[0]?.message ?? 'Quantité invalide');
      return;
    }
    if (!parsedPrice.success) {
      setError(parsedPrice.error.issues[0]?.message ?? 'Prix invalide');
      return;
    }

    setSubmitting(true);
    try {
      await api.portfolios.addPosition(portfolioId, {
        symbol: symbol.trim().toUpperCase(),
        quantity: parsedQuantity.data,
        averagePrice: parsedPrice.data,
      });
      setSymbol('');
      setQuantity('');
      setAveragePrice('');
      await onAdded();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'La position n’a pas pu être ajoutée.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <View style={{ gap: theme.spacing.md }}>
        <Text variant="h3">Nouvelle position</Text>
        <Input
          label="Nom ou symbole"
          value={symbol}
          onChangeText={setSymbol}
          autoCapitalize="characters"
          placeholder="CW8.PA"
        />
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <Input
            label="Quantité"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="decimal-pad"
            containerStyle={{ flex: 1 }}
          />
          <Input
            label="Prix moyen"
            value={averagePrice}
            onChangeText={setAveragePrice}
            keyboardType="decimal-pad"
            suffix="€"
            containerStyle={{ flex: 1 }}
          />
        </View>
        {error ? (
          <Text variant="caption" color="negative" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <Button label="Ajouter" fullWidth loading={submitting} onPress={submit} />
      </View>
    </Card>
  );
}
