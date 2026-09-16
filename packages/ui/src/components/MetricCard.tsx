import { View } from 'react-native';
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

/** A single figure with its variation, freshness and demo provenance. */
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
      accessibilityLabel={`${label} : ${value}`}
      style={compact ? { minWidth: 150 } : undefined}
    >
      <View style={{ gap: theme.spacing.xs }}>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Text variant="caption" color="secondary">
            {label}
          </Text>
          <DemoBadge visible={isDemo} />
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
