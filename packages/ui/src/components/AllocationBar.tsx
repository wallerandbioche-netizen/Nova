import { View } from 'react-native';
import { useTheme } from '../theme/index.js';
import { Text } from './Text.js';

export interface AllocationSegment {
  key: string;
  label: string;
  percent: number;
}

export interface AllocationBarProps {
  segments: AllocationSegment[];
  /** Maximum number of segments before the rest is grouped under "Autres". */
  maxSegments?: number;
}

/**
 * Allocation bar.
 *
 * A meaningful chart, not a decorative one (rule #14): each segment is labelled with its
 * percentage in the legend, so the visualisation is readable without perceiving the colours.
 */
export function AllocationBar({ segments, maxSegments = 6 }: AllocationBarProps) {
  const theme = useTheme();

  const sorted = [...segments].sort((a, b) => b.percent - a.percent);
  const visible = sorted.slice(0, maxSegments);
  const rest = sorted.slice(maxSegments);
  const restPercent = rest.reduce((total, segment) => total + segment.percent, 0);
  const display =
    restPercent > 0
      ? [...visible, { key: 'other', label: 'Autres', percent: restPercent }]
      : visible;

  // A single-hue ramp: order is conveyed by shade, exact values by the legend.
  const shades = [1, 0.82, 0.66, 0.52, 0.4, 0.3, 0.22];

  if (display.length === 0) return null;

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          flexDirection: 'row',
          height: 10,
          borderRadius: theme.radius.full,
          overflow: 'hidden',
          backgroundColor: theme.colors.surfaceSecondary,
        }}
      >
        {display.map((segment, index) => (
          <View
            key={segment.key}
            style={{
              flex: Math.max(segment.percent, 0.5),
              backgroundColor: theme.colors.accent,
              opacity: shades[Math.min(index, shades.length - 1)],
            }}
          />
        ))}
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        {display.map((segment, index) => (
          <View
            key={segment.key}
            accessible
            accessibilityLabel={`${segment.label} : ${segment.percent.toFixed(1).replace('.', ',')} pour cent`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                backgroundColor: theme.colors.accent,
                opacity: shades[Math.min(index, shades.length - 1)],
              }}
            />
            <Text variant="small" style={{ flex: 1 }}>
              {segment.label}
            </Text>
            <Text variant="smallStrong" tabular>
              {segment.percent.toFixed(1).replace('.', ',')} %
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
