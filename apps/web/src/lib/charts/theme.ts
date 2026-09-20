/**
 * Chart palette. Values mirror the CSS tokens but are passed explicitly because
 * the charting library needs concrete colours, not custom properties.
 */
export interface ChartPalette {
  background: string;
  text: string;
  grid: string;
  border: string;
  up: string;
  down: string;
  volumeUp: string;
  volumeDown: string;
  ema20: string;
  ema50: string;
  ema200: string;
  vwap: string;
  crosshair: string;
  entry: string;
  stop: string;
  target: string;
  support: string;
  resistance: string;
}

export const LIGHT_PALETTE: ChartPalette = {
  background: '#ffffff',
  text: '#667a94',
  grid: '#eef2f8',
  border: '#e6ebf3',
  up: '#16a34a',
  down: '#dc2626',
  volumeUp: 'rgba(22, 163, 74, 0.35)',
  volumeDown: 'rgba(220, 38, 38, 0.32)',
  ema20: '#1f6feb',
  ema50: '#d97706',
  ema200: '#7c3aed',
  vwap: '#0f766e',
  crosshair: '#93a2b8',
  entry: '#1f6feb',
  stop: '#dc2626',
  target: '#16a34a',
  support: 'rgba(22, 163, 74, 0.55)',
  resistance: 'rgba(220, 38, 38, 0.5)',
};

export const DARK_PALETTE: ChartPalette = {
  background: '#101827',
  text: '#94a6bf',
  grid: '#182236',
  border: '#1e2a3d',
  up: '#2fbd6a',
  down: '#f0555a',
  volumeUp: 'rgba(47, 189, 106, 0.32)',
  volumeDown: 'rgba(240, 85, 90, 0.3)',
  ema20: '#4d92ff',
  ema50: '#eda52f',
  ema200: '#a78bfa',
  vwap: '#2dd4bf',
  crosshair: '#6c7f99',
  entry: '#4d92ff',
  stop: '#f0555a',
  target: '#2fbd6a',
  support: 'rgba(47, 189, 106, 0.5)',
  resistance: 'rgba(240, 85, 90, 0.45)',
};

export function paletteFor(theme: 'light' | 'dark'): ChartPalette {
  return theme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
}

/** Colour of a drawing, resolved for the charting library (no CSS variables). */
export function drawingColor(
  tool:
    'trendline' | 'horizontal' | 'support' | 'resistance' | 'entry' | 'stop' | 'target' | 'zone',
  theme: 'light' | 'dark',
): string {
  const palette = paletteFor(theme);
  switch (tool) {
    case 'support':
      return palette.up;
    case 'resistance':
      return palette.down;
    case 'stop':
      return palette.stop;
    case 'target':
      return palette.target;
    case 'entry':
      return palette.entry;
    default:
      return palette.ema20;
  }
}
