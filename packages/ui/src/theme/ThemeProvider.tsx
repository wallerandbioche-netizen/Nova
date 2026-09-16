import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import {
  darkColors,
  elevation,
  lightColors,
  minTouchTarget,
  motion,
  radius,
  screenPadding,
  spacing,
  typography,
  type ColorScheme,
} from './tokens.js';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Theme {
  colors: ColorScheme;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  elevation: typeof elevation;
  motion: typeof motion;
  screenPadding: number;
  minTouchTarget: number;
  isDark: boolean;
}

const ThemeContext = createContext<Theme | null>(null);

export interface ThemeProviderProps {
  children: ReactNode;
  /** Defaults to following the system appearance, as required by the design brief. */
  preference?: ThemePreference;
}

export function ThemeProvider({ children, preference = 'system' }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const isDark = preference === 'system' ? systemScheme === 'dark' : preference === 'dark';

  const theme = useMemo<Theme>(
    () => ({
      colors: isDark ? darkColors : lightColors,
      spacing,
      radius,
      typography,
      elevation,
      motion,
      screenPadding,
      minTouchTarget,
      isDark,
    }),
    [isDark],
  );

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme must be used inside a ThemeProvider');
  }
  return theme;
}
