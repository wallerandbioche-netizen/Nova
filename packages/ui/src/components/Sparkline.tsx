import { View } from 'react-native';
import { useTheme } from '../theme/index.js';
import { Text } from './Text.js';

export interface SparklineProps {
  points: number[];
  height?: number;
  /** Spoken description, e.g. "évolution sur un mois, de 432 à 465 euros". */
  accessibilityLabel: string;
  caption?: string;
}

/**
 * Minimal price chart, drawn with plain views (no chart dependency).
 *
 * It exists to show the shape of a series, not to suggest a trend to act on: there is no
 * gradient, no glow, no projection beyond the last known point.
 */
export function Sparkline({ points, height = 64, accessibilityLabel, caption }: SparklineProps) {
  const theme = useTheme();

  if (points.length < 2) {
    return (
      <View
        style={{
          height,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.surfaceSecondary,
          borderRadius: theme.radius.md,
        }}
      >
        <Text variant="caption" color="tertiary">
          Historique insuffisant pour afficher une évolution
        </Text>
      </View>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const first = points[0] as number;
  const last = points[points.length - 1] as number;
  const rising = last >= first;

  // One thin bar per point: readable at any width, and honest about granularity.
  const maxBars = 60;
  const step = Math.max(1, Math.ceil(points.length / maxBars));
  const sampled = points.filter((_, index) => index % step === 0);

  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={{ gap: theme.spacing.xs }}>
      <View
        style={{
          height,
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 1,
        }}
      >
        {sampled.map((point, index) => (
          <View
            key={index}
            style={{
              flex: 1,
              height: Math.max(((point - min) / range) * height, 2),
              backgroundColor: rising ? theme.colors.positive : theme.colors.negative,
              opacity: 0.25 + (index / sampled.length) * 0.75,
              borderRadius: 1,
            }}
          />
        ))}
      </View>
      {caption ? (
        <Text variant="caption" color="tertiary">
          {caption}
        </Text>
      ) : null}
    </View>
  );
}
