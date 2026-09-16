import { formatCurrency, formatPercent } from '@nova/finance';

/**
 * Display helpers.
 *
 * Presentation only: every financial computation happens in `@nova/finance` on the server.
 * These functions never derive a value, they only format one.
 */
export { formatCurrency, formatPercent };

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(date);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(date);
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date);
}

/** "Dernière mise à jour : …" line shown under any market figure. */
export function freshnessLabel(asOf: string | null | undefined): string {
  const formatted = formatDateTime(asOf);
  return formatted === '—' ? 'Fraîcheur des données inconnue' : `Dernière mise à jour : ${formatted}`;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count > 1 ? (plural ?? `${singular}s`) : singular}`;
}
