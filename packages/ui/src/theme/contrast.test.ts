import { describe, expect, it } from 'vitest';
import { contrastRatio, meetsAA, WCAG_AA_LARGE, WCAG_AA_NORMAL } from './contrast.js';
import { darkColors, lightColors, type ColorScheme } from './tokens.js';

describe('contrastRatio', () => {
  it('computes the reference extremes', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 1);
  });

  it('returns null for a malformed colour', () => {
    expect(contrastRatio('not-a-colour', '#FFFFFF')).toBeNull();
  });
});

/**
 * The palette is part of the product's accessibility contract: a colour change that drops a
 * text pair below WCAG AA must fail here rather than ship.
 */
describe.each([
  ['light', lightColors],
  ['dark', darkColors],
])('%s palette meets WCAG AA', (_name, colors: ColorScheme) => {
  const surfaces = [colors.background, colors.surface, colors.surfaceSecondary];

  it.each(surfaces)('body text on %s', (surface) => {
    expect(meetsAA(colors.textPrimary, surface)).toBe(true);
    expect(meetsAA(colors.textSecondary, surface)).toBe(true);
  });

  it.each(surfaces)('tertiary text on %s meets the large-text threshold', (surface) => {
    expect(contrastRatio(colors.textTertiary, surface)).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
  });

  it.each(surfaces)('semantic colours remain readable on %s', (surface) => {
    for (const color of [colors.positive, colors.negative, colors.warning, colors.info, colors.demo]) {
      expect(contrastRatio(color, surface)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    }
  });

  it('accent text is readable on the accent fill', () => {
    expect(meetsAA(colors.accentText, colors.accent)).toBe(true);
  });

  it('muted backgrounds keep their semantic text readable', () => {
    expect(contrastRatio(colors.positive, colors.positiveMuted)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    expect(contrastRatio(colors.negative, colors.negativeMuted)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    expect(contrastRatio(colors.warning, colors.warningMuted)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    expect(contrastRatio(colors.demo, colors.demoMuted)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
  });

  it('separates positive and negative by luminance, not only by hue', () => {
    // Colour-blind users must be able to tell them apart even before reading the label.
    const ratio = contrastRatio(colors.positive, colors.negative);
    expect(ratio).not.toBeNull();
    expect(ratio as number).toBeGreaterThan(1.4);
  });
});
