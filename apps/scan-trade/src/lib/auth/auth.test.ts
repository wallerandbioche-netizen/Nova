import { describe, expect, it } from 'vitest';
import { emailSchema, hashPassword, passwordSchema, verifyPassword } from './password';
import { PASSWORD_RESET_TTL_MINUTES, generateResetToken, hashToken, tokensMatch } from './tokens';

describe('password policy', () => {
  it('accepts a password that meets the stated rules', () => {
    expect(passwordSchema.safeParse('chandelier42').success).toBe(true);
  });

  it('refuses one that is too short', () => {
    const result = passwordSchema.safeParse('court1');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('10 caractères');
  });

  it('refuses one with no digit, and one with no letter', () => {
    expect(passwordSchema.safeParse('sanschiffres').success).toBe(false);
    expect(passwordSchema.safeParse('1234567890123').success).toBe(false);
  });

  it('refuses an absurdly long password rather than paying to hash it', () => {
    expect(passwordSchema.safeParse(`a1${'x'.repeat(500)}`).success).toBe(false);
  });
});

describe('email normalisation', () => {
  it('trims and lowercases, so one address is one account', () => {
    expect(emailSchema.parse('  Lucas@Example.COM ')).toBe('lucas@example.com');
  });

  it('refuses something that is not an address', () => {
    expect(emailSchema.safeParse('pas-une-adresse').success).toBe(false);
    expect(emailSchema.safeParse('').success).toBe(false);
  });
});

describe('password hashing', () => {
  it('never stores the password itself', async () => {
    const hash = await hashPassword('chandelier42');

    expect(hash).not.toContain('chandelier42');
    expect(hash.startsWith('$2')).toBe(true);
  });

  it('salts, so two identical passwords hash differently', async () => {
    const [first, second] = await Promise.all([
      hashPassword('chandelier42'),
      hashPassword('chandelier42'),
    ]);

    expect(first).not.toBe(second);
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('chandelier42');

    await expect(verifyPassword('chandelier42', hash)).resolves.toBe(true);
    await expect(verifyPassword('Chandelier42', hash)).resolves.toBe(false);
    await expect(verifyPassword('', hash)).resolves.toBe(false);
  });

  it('rejects an account with no password without leaking that fact through timing', async () => {
    // The dummy comparison inside `verifyPassword` is what makes the two
    // branches cost the same; here we assert the visible contract.
    await expect(verifyPassword('chandelier42', null)).resolves.toBe(false);
  });
});

describe('password reset tokens', () => {
  it('returns a token, its hash, and an expiry', () => {
    const { token, tokenHash, expiresAt } = generateResetToken();

    expect(token.length).toBeGreaterThan(30);
    expect(tokenHash).toHaveLength(64);
    expect(tokenHash).not.toBe(token);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(expiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + PASSWORD_RESET_TTL_MINUTES * 60_000 + 1000,
    );
  });

  it('is unguessable: two tokens never collide', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateResetToken().token));
    expect(tokens.size).toBe(200);
  });

  it('hashes deterministically, so a link can be looked up', () => {
    const { token, tokenHash } = generateResetToken();
    expect(hashToken(token)).toBe(tokenHash);
  });

  it('compares without leaking length through an early return', () => {
    expect(tokensMatch('abc', 'abc')).toBe(true);
    expect(tokensMatch('abc', 'abd')).toBe(false);
    expect(tokensMatch('abc', 'abcd')).toBe(false);
  });
});
