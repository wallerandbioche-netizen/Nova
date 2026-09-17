import { describe, expect, it } from 'vitest';
import { uncapitalize } from './text.js';

describe('uncapitalize', () => {
  it('lowers only the first letter', () => {
    expect(uncapitalize('Vous détenez OBLI.PA')).toBe('vous détenez OBLI.PA');
  });

  it('preserves the casing of a fund name', () => {
    expect(uncapitalize('Vous détenez Amundi Euro Government Bond UCITS ETF')).toBe(
      'vous détenez Amundi Euro Government Bond UCITS ETF',
    );
  });

  it('handles an empty string and an already-lowercase fragment', () => {
    expect(uncapitalize('')).toBe('');
    expect(uncapitalize('déjà en minuscule')).toBe('déjà en minuscule');
  });
});
