import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { JOURNAL_ACTION_LABELS } from '@nova/config';
import { formatPercent } from '@nova/finance';
import type { JournalLookback } from '@nova/types';
import { Badge, Button, Card, ErrorState, Screen, SkeletonCard, Text, useTheme } from '@nova/ui';
import { useNovaQuery } from '../../src/hooks/use-nova-query';
import { formatDate, freshnessLabel } from '../../src/lib/format';
import { useAuth } from '../../src/state/auth-context';

/**
 * Journal entry detail — the look-back.
 *
 * Shows what the user wrote at the time and, when a price is known, the factual change since.
 * There is deliberately no verdict, no "good call" / "bad call": the purpose is discipline and
 * learning, not scoring (rule #19).
 */
export default function JournalEntryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useAuth();
  const [deleting, setDeleting] = useState(false);

  const lookback = useNovaQuery<JournalLookback>({
    queryKey: ['journal', id],
    queryFn: () => api.journal.detail(id as string),
    cacheKey: `journal.${id}`,
    enabled: Boolean(id),
  });

  if (lookback.isLoading) {
    return (
      <Screen>
        <SkeletonCard lines={4} />
      </Screen>
    );
  }

  if (lookback.error || !lookback.data) {
    return (
      <Screen>
        <ErrorState
          offline={lookback.isOffline}
          onRetry={() => void lookback.refetch()}
          requestId={lookback.error?.requestId}
        />
      </Screen>
    );
  }

  const { entry, monthsElapsed, prompt, priceThen, priceNow, priceChangePercent, priceAsOf } =
    lookback.data;

  return (
    <Screen
      offline={lookback.isFromCache}
      lastUpdatedLabel={lookback.cachedAtLabel}
      footer={
        <Button
          label="Supprimer cette entrée"
          variant="danger"
          fullWidth
          loading={deleting}
          onPress={async () => {
            if (!id) return;
            setDeleting(true);
            try {
              await api.journal.remove(id);
              router.replace('/journal');
            } finally {
              setDeleting(false);
            }
          }}
        />
      }
    >
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
            <Badge label={JOURNAL_ACTION_LABELS[entry.action]} tone="neutral" />
            {entry.asset ? <Badge label={entry.asset.name} tone="accent" /> : null}
          </View>
          <Text variant="h1" accessibilityRole="header">
            {prompt}
          </Text>
          <Text variant="caption" color="tertiary">
            Écrit le {formatDate(entry.createdAt)}
            {monthsElapsed > 0 ? ` · il y a ${monthsElapsed} mois` : ''}
          </Text>
        </View>

        <Card>
          <Text variant="body">{entry.reason}</Text>
        </Card>

        {entry.quantity !== null || entry.price !== null ? (
          <Card>
            <View style={{ gap: theme.spacing.sm }}>
              <Text variant="smallStrong" color="secondary">
                Ce que vous aviez noté
              </Text>
              {entry.quantity !== null ? (
                <Row label="Quantité" value={entry.quantity.toLocaleString('fr-FR')} />
              ) : null}
              {entry.price !== null ? (
                <Row
                  label="Prix"
                  value={`${entry.price.toLocaleString('fr-FR')} ${entry.currency ?? 'EUR'}`}
                />
              ) : null}
            </View>
          </Card>
        ) : null}

        {priceThen !== null && priceNow !== null ? (
          <Card>
            <View style={{ gap: theme.spacing.sm }}>
              <Text variant="smallStrong" color="secondary">
                Depuis cette décision
              </Text>
              <Row label="Prix noté" value={priceThen.toLocaleString('fr-FR')} />
              <Row label="Dernier cours connu" value={priceNow.toLocaleString('fr-FR')} />
              <Row label="Écart" value={formatPercent(priceChangePercent)} />
              <Text variant="caption" color="tertiary">
                {freshnessLabel(priceAsOf)}
              </Text>
              <Text variant="caption" color="tertiary">
                NOVA affiche cet écart à titre factuel. Il ne juge pas votre décision : une décision
                peut être bonne et mal tomber, ou l’inverse.
              </Text>
            </View>
          </Card>
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
