/** Drawing model — kept separate from the analysis so both can evolve alone. */
export type DrawingTool =
  | 'cursor'
  | 'trendline'
  | 'horizontal'
  | 'support'
  | 'resistance'
  | 'entry'
  | 'stop'
  | 'target'
  | 'zone';

export interface DrawingPoint {
  /** Unix seconds. */
  time: number;
  price: number;
}

export interface Drawing {
  id: string;
  tool: Exclude<DrawingTool, 'cursor'>;
  points: DrawingPoint[];
  label?: string;
  color?: string;
}

export interface IndicatorToggles {
  ema20: boolean;
  ema50: boolean;
  ema200: boolean;
  vwap: boolean;
  volume: boolean;
  rsi: boolean;
  macd: boolean;
}

export const DEFAULT_INDICATORS: IndicatorToggles = {
  ema20: true,
  ema50: true,
  ema200: false,
  vwap: false,
  volume: true,
  rsi: false,
  macd: false,
};

export const DRAWING_TOOL_LABEL: Record<DrawingTool, string> = {
  cursor: 'Curseur',
  trendline: 'Ligne de tendance',
  horizontal: 'Ligne horizontale',
  support: 'Support',
  resistance: 'Résistance',
  entry: 'Entrée',
  stop: 'Stop loss',
  target: 'Objectif',
  zone: 'Zone',
};

/** Number of clicks a tool needs before the drawing is complete. */
export const DRAWING_TOOL_POINTS: Record<Exclude<DrawingTool, 'cursor'>, number> = {
  trendline: 2,
  horizontal: 1,
  support: 1,
  resistance: 1,
  entry: 1,
  stop: 1,
  target: 1,
  zone: 2,
};
