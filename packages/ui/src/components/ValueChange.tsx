import { View } from 'react-native';
import { describeChange, formatPercent } from '@nova/finance';
import { useTheme } from '../theme/index.js';
import { Text } from './Text.js';

export interface ValueChangeProps {
  percent: number | null;
  /** Optional absolute amount, already formatted by the caller. */
  absolute?: string | null;
  variant?: 'body' | 'small' | 'caption' | 'h3';
  /** Prefix for the spoken label, e.g. "Votre portefeuille". */
  accessibilityPrefix?: string;
}

/**
 * Renders a variation.
 *
 * Direction is carried by three independent signals — the sign, an arrow glyph and a written
 * label — so the information survives colour blindness, greyscale and screen readers
 * (design rule: "les variations doivent rester lisibles sans dépendre uniquement de la couleur").
 */
export function ValueChange({
  percent,
  absolute,
  variant = 'small',
  accessibilityPrefix,
}: ValueChangeProps) {
  const theme = useTheme();

  const direction =
    percent === null ? 'unknown' : percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat';
  const arrow =
    direction === 'up' ? '▲' : direction === 'down' ? '▼' : direction === 'flat' ? '■' : '—';
  const color =
    direction === 'up' ? 'positive' : direction === 'down' ? 'negative' : ('secondary' as const);

  const spoken = `${accessibilityPrefix ? `${accessibilityPrefix}, ` : ''}${describeChange(percent)}`;

  return (
    <View
      accessible
      accessibilityLabel={spoken}
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}
    >
      <Text
        variant={variant}
        color={color}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {arrow}
      </Text>
      <Text
        variant={variant}
        color={color}
        tabular
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {formatPercent(percent)}
      </Text>
      {absolute ? (
        <Text
          variant={variant}
          color="secondary"
          tabular
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          ({absolute})
        </Text>
      ) : null}
    </View>
  );
}
