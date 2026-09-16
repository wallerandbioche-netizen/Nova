import { describe, expect, it } from 'vitest';
import { formatDate, formatShortDate, freshnessLabel, pluralize } from './format';

describe('date formatting', () => {
  it('formats a date in French', () => {
    expect(formatDate('2026-09-16T08:12:00.000Z')).toContain('septembre');
  });

  it('never renders "Invalid Date"', () => {
    expect(formatDate('nope')).toBe('—');
    expect(formatDate(null)).toBe('—');
    expect(formatShortDate(undefined)).toBe('—');
  });
});

describe('freshnessLabel', () => {
  it('states when the data was last updated', () => {
    expect(freshnessLabel('2026-09-16T08:12:00.000Z')).toMatch(/^Dernière mise à jour :/);
  });

  it('says so plainly when freshness is unknown, rather than implying it is live', () => {
    expect(freshnessLabel(null)).toBe('Fraîcheur des données inconnue');
  });
});

describe('pluralize', () => {
  it('agrees in number', () => {
    expect(pluralize(1, 'position')).toBe('1 position');
    expect(pluralize(3, 'position')).toBe('3 positions');
    expect(pluralize(2, 'actualité', 'actualités')).toBe('2 actualités');
  });
});
