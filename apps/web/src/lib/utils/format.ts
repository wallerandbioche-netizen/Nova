import type { Asset } from '@/types/market';

const LOCALE = 'fr-FR';

export function formatPrice(value: number, asset?: Pick<Asset, 'precision'>): string {
  const precision = asset?.precision ?? inferPrecision(value);
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(value);
}

export function inferPrecision(value: number): number {
  const magnitude = Math.abs(value);
  if (magnitude >= 1000) return 2;
  if (magnitude >= 10) return 2;
  if (magnitude >= 1) return 3;
  return 5;
}

export function formatPriceRange(
  low: number,
  high: number,
  asset?: Pick<Asset, 'precision'>,
): string {
  return `${formatPrice(low, asset)} — ${formatPrice(high, asset)}`;
}

export function formatPercent(value: number, digits = 2): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)} %`;
}

export function formatSignedPercent(value: number, digits = 2): string {
  return formatPercent(value, digits);
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  );
}

export function formatMoney(value: number, currency = 'EUR'): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

export function formatRatio(value: number): string {
  return `1:${value.toFixed(1)}`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat(LOCALE, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export function relativeTime(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return `il y a ${days} j`;
}
