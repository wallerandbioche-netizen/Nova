import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * Illustrative example for the landing page (§19).
 *
 * These numbers are invented for the sake of the layout and are labelled as
 * such, loudly and next to the data itself. Nothing here is presented as a real
 * analysis, a track record or a result (§55).
 */
const DEMO = {
  asset: 'BTC/USDT',
  timeframe: '4H',
  bias: 'LONG',
  entry: '61 250 — 61 900',
  stopLoss: '59 800',
  takeProfit1: '65 400',
  takeProfit2: '68 200',
  riskReward: '1:2.8',
  levels: [
    { label: 'Résistance principale', value: '65 400' },
    { label: "Zone d'entrée", value: '61 250 — 61 900' },
    { label: 'Support principal', value: '59 800' },
  ],
  reasoning: [
    'Séquence de plus hauts et plus bas ascendants depuis la base de range.',
    "Réaction nette sur la zone d'entrée lors des deux dernières touches.",
    'Le scénario est invalidé par une clôture sous le support principal.',
  ],
} as const;

export function DemoAnalysis() {
  return (
    <div className="relative">
      <div className="mb-3 flex justify-center">
        <Badge tone="warning">Exemple illustratif — ce n&apos;est pas une analyse réelle</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="numeric text-sm font-semibold text-content">{DEMO.asset}</span>
              <Badge tone="muted">{DEMO.timeframe}</Badge>
            </div>
            <Badge tone="accent">Bias : {DEMO.bias}</Badge>
          </div>

          <div className="px-5 py-5">
            <MockChart />
            <ul className="mt-5 space-y-2">
              {DEMO.reasoning.map((line) => (
                <li key={line} className="flex gap-2.5 text-sm leading-relaxed text-content-muted">
                  <span
                    aria-hidden="true"
                    className="mt-2 h-1 w-1 shrink-0 rounded-full bg-content-faint"
                  />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card tone="raised" className="overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-content-muted">
              Trade Setup
            </p>
          </div>
          <dl className="divide-y divide-border">
            <DemoRow label="Zone d'entrée" value={DEMO.entry} />
            <DemoRow label="Stop Loss" value={DEMO.stopLoss} tone="danger" />
            <DemoRow label="Take Profit 1" value={DEMO.takeProfit1} tone="accent" />
            <DemoRow label="Take Profit 2" value={DEMO.takeProfit2} tone="accent" />
            <DemoRow label="Risk / Reward" value={DEMO.riskReward} />
          </dl>
          <div className="border-t border-border px-5 py-4">
            <p className="text-xs uppercase tracking-[0.12em] text-content-faint">Key Levels</p>
            <ul className="mt-2.5 space-y-2">
              {DEMO.levels.map((level) => (
                <li key={level.label} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-content-muted">{level.label}</span>
                  <span className="numeric font-medium text-content">{level.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}

function DemoRow({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'accent' | 'danger';
}) {
  const color =
    tone === 'accent' ? 'text-accent' : tone === 'danger' ? 'text-danger' : 'text-content';
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-3.5">
      <dt className="text-sm text-content-muted">{label}</dt>
      <dd className={`numeric text-right text-lg font-semibold ${color}`}>{value}</dd>
    </div>
  );
}

/**
 * A schematic candle series. It is drawn, not photographed, so no real chart or
 * broker interface is implied.
 */
function MockChart() {
  const candles = [
    { x: 8, open: 108, close: 96, high: 92, low: 112 },
    { x: 28, open: 100, close: 104, high: 96, low: 110 },
    { x: 48, open: 104, close: 88, high: 84, low: 108 },
    { x: 68, open: 88, close: 82, high: 76, low: 92 },
    { x: 88, open: 82, close: 90, high: 78, low: 96 },
    { x: 108, open: 90, close: 74, high: 68, low: 94 },
    { x: 128, open: 74, close: 78, high: 70, low: 86 },
    { x: 148, open: 78, close: 62, high: 56, low: 82 },
    { x: 168, open: 62, close: 68, high: 58, low: 74 },
    { x: 188, open: 68, close: 52, high: 46, low: 72 },
    { x: 208, open: 52, close: 58, high: 48, low: 64 },
    { x: 228, open: 58, close: 42, high: 36, low: 62 },
  ];

  return (
    <svg
      viewBox="0 0 260 130"
      className="w-full"
      role="img"
      aria-label="Illustration schématique d'un graphique en chandeliers"
    >
      <defs>
        <linearGradient id="demo-fade" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#22C55E" stopOpacity="0" />
          <stop offset="1" stopColor="#22C55E" stopOpacity="0.5" />
        </linearGradient>
      </defs>

      {[26, 52, 78, 104].map((y) => (
        <line
          key={y}
          x1="0"
          x2="260"
          y1={y}
          y2={y}
          stroke="#FFFFFF"
          strokeOpacity="0.04"
          strokeWidth="1"
        />
      ))}

      <line
        x1="0"
        x2="260"
        y1="46"
        y2="46"
        stroke="#F59E0B"
        strokeOpacity="0.5"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
      <line
        x1="0"
        x2="260"
        y1="96"
        y2="96"
        stroke="#22C55E"
        strokeOpacity="0.5"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
      <rect x="0" y="84" width="260" height="12" fill="url(#demo-fade)" opacity="0.25" />

      {candles.map((candle) => {
        const bullish = candle.close < candle.open;
        const color = bullish ? '#22C55E' : '#EF4444';
        const top = Math.min(candle.open, candle.close);
        const height = Math.max(2, Math.abs(candle.close - candle.open));
        return (
          <g key={candle.x}>
            <line
              x1={candle.x + 4}
              x2={candle.x + 4}
              y1={candle.high}
              y2={candle.low}
              stroke={color}
              strokeWidth="1.2"
              strokeOpacity="0.75"
            />
            <rect
              x={candle.x}
              y={top}
              width="8"
              height={height}
              rx="1.2"
              fill={color}
              fillOpacity="0.85"
            />
          </g>
        );
      })}
    </svg>
  );
}
