import { describe, expect, it } from 'vitest';
import { buildPage, decodeCursor, encodeCursor } from './pagination.js';

describe('cursor encoding', () => {
  it('round-trips a cursor', () => {
    const cursor = { timestamp: '2026-09-16T06:00:00.000Z', id: 'abc' };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it('returns null for an absent cursor', () => {
    expect(decodeCursor(undefined)).toBeNull();
  });

  it('rejects a malformed cursor with a 400', () => {
    expect(() => decodeCursor('bm90LWEtY3Vyc29y')).toThrow(/Curseur/);
    expect(() => decodeCursor('###')).toThrow(/Curseur/);
  });
});

describe('buildPage', () => {
  const rows = Array.from({ length: 4 }, (_, index) => ({
    id: `id-${index}`,
    createdAt: `2026-09-1${index}T00:00:00.000Z`,
  }));
  const toCursor = (row: (typeof rows)[number]) => ({ timestamp: row.createdAt, id: row.id });

  it('detects more pages using the extra row', () => {
    const page = buildPage(rows, 3, toCursor);
    expect(page.items).toHaveLength(3);
    expect(page.hasMore).toBe(true);
    expect(decodeCursor(page.nextCursor as string)?.id).toBe('id-2');
  });

  it('reports the last page', () => {
    const page = buildPage(rows.slice(0, 2), 3, toCursor);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it('handles an empty result', () => {
    const page = buildPage([], 10, toCursor);
    expect(page).toEqual({ items: [], hasMore: false, nextCursor: null });
  });
});
