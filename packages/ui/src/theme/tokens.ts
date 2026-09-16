/**
 * NOVA design tokens.
 *
 * Colours are named by role, never by hue, so a screen can never hardcode "green for up".
 * Positive and negative are deliberately desaturated: NOVA is not a trading terminal, and a
 * variation is always accompanied by a sign, an arrow and a spoken label (accessibility
 * rule #28 — information never depends on colour alone).
 */
export interface ColorScheme {
  background: string;
  surface: string;
  surfaceSecondary: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentText: string;
  accentMuted: string;
  positive: string;
  positiveMuted: string;
  negative: string;
  negativeMuted: string;
  warning: string;
  warningMuted: string;
  info: string;
  infoMuted: string;
  demo: string;
  demoMuted: string;
  overlay: string;
  skeleton: string;
}

export const lightColors: ColorScheme = {
  background: '#FBFBFA',
  surface: '#FFFFFF',
  surfaceSecondary: '#F4F4F2',
  textPrimary: '#14171A',
  textSecondary: '#5B6470',
  textTertiary: '#7A8492',
  textInverse: '#FFFFFF',
  border: '#E4E5E2',
  borderStrong: '#CFD2CD',
  accent: '#1F5D4C',
  accentText: '#FFFFFF',
  accentMuted: '#E8F1ED',
  // Positive and negative are separated by luminance as well as hue, so a colour-blind
  // reader can distinguish them before reading the label (see contrast.test.ts).
  positive: '#0F5340',
  positiveMuted: '#E7F1EB',
  negative: '#B04A38',
  negativeMuted: '#F6EAE7',
  warning: '#7A5C15',
  warningMuted: '#F7F0DC',
  info: '#2A5470',
  infoMuted: '#E8EFF4',
  demo: '#5C4080',
  demoMuted: '#F0EAF7',
  overlay: 'rgba(20, 23, 26, 0.45)',
  skeleton: '#ECECE9',
};

export const darkColors: ColorScheme = {
  background: '#0E1012',
  surface: '#16191C',
  surfaceSecondary: '#1E2226',
  textPrimary: '#F2F4F5',
  textSecondary: '#A8B2BE',
  textTertiary: '#8A94A0',
  textInverse: '#0E1012',
  border: '#282D33',
  borderStrong: '#3A4148',
  accent: '#5FB49C',
  accentText: '#0E1012',
  accentMuted: '#16302A',
  positive: '#8FD4B1',
  positiveMuted: '#152720',
  negative: '#C97C6E',
  negativeMuted: '#2A1C19',
  warning: '#E0C173',
  warningMuted: '#2A2417',
  info: '#8FBBD6',
  infoMuted: '#152229',
  demo: '#C4AEE0',
  demoMuted: '#211A2B',
  overlay: 'rgba(0, 0, 0, 0.6)',
  skeleton: '#20252A',
};

/** 4 px base scale. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

/** Screen side gutter. Used everywhere, so nothing ever touches the edge. */
export const screenPadding = 20;

/** Minimum touch target (WCAG 2.5.5 / platform guidelines). */
export const minTouchTarget = 44;

export const typography = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '600' as const, letterSpacing: -0.5 },
  h1: { fontSize: 26, lineHeight: 32, fontWeight: '600' as const, letterSpacing: -0.3 },
  h2: { fontSize: 20, lineHeight: 26, fontWeight: '600' as const, letterSpacing: -0.2 },
  h3: { fontSize: 17, lineHeight: 24, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600' as const },
  small: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  smallStrong: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
} as const;

export type TypographyVariant = keyof typeof typography;

/** A single, very discreet elevation. Cards otherwise rely on a 1 px border. */
export const elevation = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sheet: {
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
} as const;

/** Motion stays short and purposeful. */
export const motion = {
  fast: 120,
  base: 180,
  slow: 240,
} as const;
