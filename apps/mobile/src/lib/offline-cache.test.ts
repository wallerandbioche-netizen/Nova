import { describe, expect, it } from 'vitest';
import { formatCachedAt } from './offline-cache';

describe('formatCachedAt', () => {
  const now = new Date('2026-09-16T14:00:00');

  it('describes a timestamp from today', () => {
    expect(formatCachedAt('2026-09-16T08:12:00', now)).toBe('aujourd’hui à 08:12');
  });

  it('describes yesterday', () => {
    expect(formatCachedAt('2026-09-15T19:40:00', now)).toBe('hier à 19:40');
  });

  it('falls back to a full date for older entries', () => {
    expect(formatCachedAt('2026-09-12T08:12:00', now)).toBe('le 12 septembre à 08:12');
  });

  it('returns null when there is nothing to describe', () => {
    expect(formatCachedAt(null, now)).toBeNull();
    expect(formatCachedAt('pas-une-date', now)).toBeNull();
  });
});
