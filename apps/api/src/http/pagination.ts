import { badRequest } from './errors.js';

/**
 * Opaque cursor pagination.
 *
 * The cursor encodes the sort key of the last item (a timestamp and an id) rather than an
 * offset, so a page stays stable while new rows arrive at the top of the feed.
 */
export interface Cursor {
  timestamp: string;
  id: string;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(`${cursor.timestamp}|${cursor.id}`, 'utf8').toString('base64url');
}

export function decodeCursor(value: string | undefined): Cursor | null {
  if (!value) return null;
  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8');
    const [timestamp, id] = decoded.split('|');
    if (!timestamp || !id) throw new Error('malformed cursor');
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) throw new Error('malformed cursor timestamp');
    return { timestamp, id };
  } catch {
    throw badRequest('Curseur de pagination invalide');
  }
}

export interface PageResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Builds a page from `limit + 1` rows: the extra row tells us whether more data exists
 * without running a second COUNT query.
 */
export function buildPage<T>(
  rows: T[],
  limit: number,
  toCursor: (row: T) => Cursor,
): PageResult<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    hasMore,
    nextCursor: hasMore && last ? encodeCursor(toCursor(last)) : null,
  };
}
