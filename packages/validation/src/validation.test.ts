import { describe, expect, it } from 'vitest';
import {
  createPositionSchema,
  findGuardrailViolation,
  llmAnswerSchema,
  loginSchema,
  quantitySchema,
  registerSchema,
  updateProfileSchema,
} from './index.js';

describe('registerSchema', () => {
  const valid = {
    email: ' Camille@Example.COM ',
    password: 'longuephrase42',
    firstName: ' Camille ',
    acceptedTerms: true as const,
  };

  it('normalises email and first name', () => {
    const parsed = registerSchema.parse(valid);
    expect(parsed.email).toBe('camille@example.com');
    expect(parsed.firstName).toBe('Camille');
  });

  it('rejects a password without a digit', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'motdepassesansnombre' }).success).toBe(
      false,
    );
  });

  it('rejects a password shorter than the policy', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'court1' }).success).toBe(false);
  });

  it('requires explicit acceptance of the terms', () => {
    expect(registerSchema.safeParse({ ...valid, acceptedTerms: false }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('does not apply the password policy to logins', () => {
    // Existing accounts may predate a policy change; login must still be attemptable.
    expect(loginSchema.safeParse({ email: 'a@b.fr', password: 'x' }).success).toBe(true);
  });
});

describe('quantitySchema', () => {
  it('accepts a comma decimal separator sent by mobile inputs', () => {
    expect(quantitySchema.parse('12,5')).toBe(12.5);
  });

  it('rejects non-finite values', () => {
    expect(quantitySchema.safeParse('abc').success).toBe(false);
    expect(quantitySchema.safeParse(Number.NaN).success).toBe(false);
    expect(quantitySchema.safeParse(Number.POSITIVE_INFINITY).success).toBe(false);
  });

  it('rejects zero and negative quantities', () => {
    expect(quantitySchema.safeParse(0).success).toBe(false);
    expect(quantitySchema.safeParse(-3).success).toBe(false);
  });
});

describe('createPositionSchema', () => {
  const base = { quantity: 3, averagePrice: 100 };

  it('accepts a symbol only', () => {
    const parsed = createPositionSchema.parse({ ...base, symbol: 'mc.pa' });
    expect(parsed.symbol).toBe('MC.PA');
  });

  it('accepts an asset id only', () => {
    expect(
      createPositionSchema.safeParse({ ...base, assetId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' })
        .success,
    ).toBe(true);
  });

  it('rejects both or neither', () => {
    expect(
      createPositionSchema.safeParse({
        ...base,
        symbol: 'AAPL',
        assetId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
      }).success,
    ).toBe(false);
    expect(createPositionSchema.safeParse(base).success).toBe(false);
  });
});

describe('updateProfileSchema', () => {
  it('rejects an empty patch', () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(false);
  });
});

describe('llmAnswerSchema', () => {
  it('fills optional sections with safe defaults', () => {
    const parsed = llmAnswerSchema.parse({ shortAnswer: 'Réponse courte.' });
    expect(parsed.uncertainties).toEqual([]);
    expect(parsed.sources).toEqual([]);
    expect(parsed.portfolioRelevance).toBeNull();
    expect(parsed.confidence).toBe(0.5);
  });

  it('rejects an answer without a short answer', () => {
    expect(llmAnswerSchema.safeParse({ whyItMatters: 'x' }).success).toBe(false);
  });

  it('rejects a confidence outside [0, 1]', () => {
    expect(llmAnswerSchema.safeParse({ shortAnswer: 'ok', confidence: 1.4 }).success).toBe(false);
  });

  it('rejects a fabricated source url', () => {
    const result = llmAnswerSchema.safeParse({
      shortAnswer: 'ok',
      sources: [{ name: 'Source', url: 'pas-une-url' }],
    });
    expect(result.success).toBe(false);
  });
});

describe('findGuardrailViolation', () => {
  it.each([
    'Je vous conseille d’acheter cette action.',
    'Vous devriez vendre immédiatement.',
    'Ce placement offre un rendement garanti de 8 %.',
    'Le CAC 40 va certainement monter demain.',
  ])('flags forbidden phrasing: %s', (text) => {
    expect(findGuardrailViolation(text)).not.toBeNull();
  });

  it.each([
    'Le pétrole progresse aujourd’hui de 3 %, selon Reuters.',
    'Cette évolution pourrait concerner les entreprises sensibles au prix de l’énergie.',
    'Ce que l’on ne sait pas : la durée de cette hausse.',
  ])('accepts factual, hedged phrasing: %s', (text) => {
    expect(findGuardrailViolation(text)).toBeNull();
  });
});
