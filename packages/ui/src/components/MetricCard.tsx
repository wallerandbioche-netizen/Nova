import { View } from 'react-native';
import { DEMO_DATA_LABEL } from '@nova/config';
import { useTheme } from '../theme/index.js';
import { Card } from './Card.js';
import { DemoBadge } from './DemoBadge.js';
import { Text } from './Text.js';
import { ValueChange } from './ValueChange.js';

export interface MetricCardProps {
  label: string;
  value: string;
  changePercent?: number | null;
  changeAbsolute?: string | null;
  caption?: string | null;
  isDemo?: boolean;
  onPress?: () => void;
  compact?: boolean;
}

/**
 * A single figure with its variation, freshness and provenance.
 *
 * The compact variant (a horizontal row of indices) drops the inline DEMO DATA badge: at phone
 * width it crowds the label, and repeating it on every card is noise. The badge then belongs on
 * the section header, which covers the whole row, while each card keeps the mention in its
 * accessibility label so a screen reader still hears it per value.
 */
export function MetricCard({
  label,
  value,
  changePercent,
  changeAbsolute,
  caption,
  isDemo = false,
  onPress,
  compact = false,
}: MetricCardProps) {
  const theme = useTheme();

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${label} : ${value}${isDemo ? `, ${DEMO_DATA_LABEL}` : ''}`}
      style={compact ? { minWidth: 150 } : undefined}
    >
      <View style={{ gap: theme.spacing.xs }}>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Text variant="caption" color="secondary" numberOfLines={1} style={{ flex: 1 }}>
            {label}
          </Text>
          {compact ? null : <DemoBadge visible={isDemo} />}
        </View>
        <Text variant={compact ? 'h3' : 'h1'} tabular>
          {value}
        </Text>
        {changePercent !== undefined ? (
          <ValueChange
            percent={changePercent}
            absolute={changeAbsolute}
            accessibilityPrefix={label}
          />
        ) : null}
        {caption ? (
          <Text variant="caption" color="tertiary">
            {caption}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
