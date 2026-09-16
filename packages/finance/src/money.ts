/**
 * Money helpers.
 *
 * Every financial number displayed by NOVA is computed here or in `portfolio.ts` — never in a
 * screen component. Amounts are handled as JavaScript numbers *after* being read from
 * PostgreSQL `Decimal` columns; all arithmetic that reaches the user is rounded explicitly so
 * two renderings of the same value can never disagree.
 */

export type FxRateTable = Record<string, number>;

/** Rounds half away from zero, avoiding the asymmetry of `Math.round` on negative values. */
export function round(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  // Correct the classic binary representation drift (e.g. 1.005 * 100 = 100.49999999999999).
  const scaled = Number((value * factor).toFixed(8));
  // `Math.round` rounds -0.5 towards +Infinity, which would make a loss and a gain of the same
  // magnitude round differently. Round the magnitude and restore the sign instead.
  const rounded = scaled < 0 ? -Math.round(-scaled) : Math.round(scaled);
  return rounded / factor;
}

export function isValidAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Converts an amount between currencies.
 *
 * `rates` expresses the value of one unit of each currency in a single pivot currency
 * (EUR in NOVA). Returns `null` when a rate is missing: an unconvertible amount is reported
 * as unknown rather than silently treated as 1:1.
 */
export function convert(
  amount: number,
  from: string,
  to: string,
  rates: FxRateTable,
): number | null {
  if (!isValidAmount(amount)) return null;
  if (from === to) return amount;
  const fromRate = rates[from];
  const toRate = rates[to];
  if (!isValidAmount(fromRate) || !isValidAmount(toRate) || toRate === 0) return null;
  return (amount * fromRate) / toRate;
}

/** Percentage change from `previous` to `current`. Null when the base is unusable. */
export function percentChange(current: number, previous: number): number | null {
  if (!isValidAmount(current) || !isValidAmount(previous) || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => (isValidAmount(value) ? total + value : total), 0);
}

/**
 * Human-readable, colour-independent description of a variation.
 * Accessibility rule: a change is never communicated by colour alone.
 */
export function describeChange(percent: number | null, options: { locale?: string } = {}): string {
  const locale = options.locale ?? 'fr-FR';
  if (percent === null || !Number.isFinite(percent)) return 'variation inconnue';
  const rounded = round(percent, 2);
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(rounded));
  if (rounded > 0) return `en hausse de ${formatted} %`;
  if (rounded < 0) return `en baisse de ${formatted} %`;
  return 'stable';
}

export function formatCurrency(
  amount: number,
  currency: string,
  options: { locale?: string; maximumFractionDigits?: number } = {},
): string {
  const locale = options.locale ?? 'fr-FR';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: options.maximumFractionDigits ?? 2,
    }).format(amount);
  } catch {
    // Unknown currency code: degrade to a plain number rather than throwing in a render path.
    return `${round(amount, 2)} ${currency}`;
  }
}

export function formatPercent(value: number | null, options: { locale?: string } = {}): string {
  if (value === null || !Number.isFinite(value)) return '—';
  const locale = options.locale ?? 'fr-FR';
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'exceptZero',
  }).format(value);
  return `${formatted} %`;
}
