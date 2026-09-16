import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { useTheme } from '../theme/index.js';
import type { TypographyVariant } from '../theme/tokens.js';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: 'primary' | 'secondary' | 'tertiary' | 'inverse' | 'accent' | 'positive' | 'negative' | 'warning' | 'info' | 'demo';
  align?: TextStyle['textAlign'];
  /** Renders numbers with tabular figures so values do not jitter when they update. */
  tabular?: boolean;
}

/**
 * Typographic primitive. Screens never set a font size directly: they pick a variant, which
 * keeps the hierarchy consistent and lets text scaling work everywhere.
 */
export function Text({
  variant = 'body',
  color = 'primary',
  align,
  tabular,
  style,
  ...props
}: TextProps) {
  const theme = useTheme();

  const colorMap = {
    primary: theme.colors.textPrimary,
    secondary: theme.colors.textSecondary,
    tertiary: theme.colors.textTertiary,
    inverse: theme.colors.textInverse,
    accent: theme.colors.accent,
    positive: theme.colors.positive,
    negative: theme.colors.negative,
    warning: theme.colors.warning,
    info: theme.colors.info,
    demo: theme.colors.demo,
  } as const;

  return (
    <RNText
      {...props}
      style={[
        theme.typography[variant],
        { color: colorMap[color] },
        align ? { textAlign: align } : null,
        tabular ? { fontVariant: ['tabular-nums'] as TextStyle['fontVariant'] } : null,
        style,
      ]}
    />
  );
}
