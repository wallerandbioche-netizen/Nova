import { View } from 'react-native';
import { formatCurrency } from '@nova/finance';
import type { ValuedPosition } from '@nova/types';
import { useTheme } from '../theme/index.js';
import { Card } from './Card.js';
import { Text } from './Text.js';
import { ValueChange } from './ValueChange.js';

export interface AssetCardProps {
  position: ValuedPosition;
  baseCurrency: string;
  onPress?: () => void;
}

/**
 * A portfolio line.
 *
 * When the price is unknown, the card says so explicitly instead of rendering a zero, which
 * would read as a real valuation (absolute rule #58).
 */
export function AssetCard({ position, baseCurrency, onPress }: AssetCardProps) {
  const theme = useTheme();
  const unvalued = position.marketValue === null;

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={
        unvalued
          ? `${position.asset.name}, valorisation indisponible`
          : `${position.asset.name}, ${formatCurrency(position.marketValue as number, baseCurrency)}`
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {position.asset.name}
          </Text>
          <Text variant="caption" color="tertiary">
            {position.asset.symbol} · {position.quantity.toLocaleString('fr-FR')} ×{' '}
            {formatCurrency(position.averagePrice, position.currency)}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          {unvalued ? (
            <>
              <Text variant="small" color="tertiary">
                Valorisation
              </Text>
              <Text variant="caption" color="warning">
                indisponible
              </Text>
            </>
          ) : (
            <>
              <Text variant="bodyStrong" tabular>
                {formatCurrency(position.marketValue as number, baseCurrency)}
              </Text>
              <ValueChange
                percent={position.unrealizedGainPercent}
                variant="caption"
                accessibilityPrefix={position.asset.name}
              />
            </>
          )}
        </View>
      </View>
    </Card>
  );
}
