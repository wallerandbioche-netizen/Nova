import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../config/env.js';
import {
  generateRefreshToken,
  hashIp,
  hashToken,
  parseTtlSeconds,
  signAccessToken,
  verifyAccessToken,
} from './tokens.js';

const env = parseEnv({
  DATABASE_URL: 'postgresql://nova:nova@localhost:5432/nova',
  JWT_SECRET: 'x'.repeat(40),
} as NodeJS.ProcessEnv);

const otherEnv = parseEnv({
  DATABASE_URL: 'postgresql://nova:nova@localhost:5432/nova',
  JWT_SECRET: 'y'.repeat(40),
} as NodeJS.ProcessEnv);

describe('access tokens', () => {
  it('signs and verifies a token', async () => {
    const { token, expiresIn } = await signAccessToken(env, {
      userId: 'user-1',
      email: 'camille@example.com',
    });
    const claims = await verifyAccessToken(env, token);
    expect(claims.sub).toBe('user-1');
    expect(claims.email).toBe('camille@example.com');
    expect(expiresIn).toBe(900);
  });

  it('rejects a token signed with another secret', async () => {
    const { token } = await signAccessToken(otherEnv, { userId: 'u', email: 'a@b.fr' });
    await expect(verifyAccessToken(env, token)).rejects.toThrow(/Session/);
  });

  it('rejects a tampered token', async () => {
    const { token } = await signAccessToken(env, { userId: 'u', email: 'a@b.fr' });
    const parts = token.split('.');
    const forged = `${parts[0]}.${Buffer.from(JSON.stringify({ sub: 'admin', v: 1 })).toString(
      'base64url',
    )}.${parts[2]}`;
    await expect(verifyAccessToken(env, forged)).rejects.toThrow(/Session/);
  });

  it('rejects garbage', async () => {
    await expect(verifyAccessToken(env, 'not.a.token')).rejects.toThrow(/Session/);
  });
});

describe('refresh tokens', () => {
  it('returns a token with only its hash meant for storage', () => {
    const { token, tokenHash } = generateRefreshToken();
    expect(token).not.toBe(tokenHash);
    expect(tokenHash).toBe(hashToken(token));
    expect(tokenHash).toHaveLength(64);
  });

  it('produces unique tokens', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateRefreshToken().token));
    expect(tokens.size).toBe(50);
  });
});

describe('hashIp', () => {
  it('never returns the raw address', () => {
    const hashed = hashIp('192.168.1.10', 'salt');
    expect(hashed).not.toContain('192.168');
    expect(hashed).toHaveLength(32);
  });

  it('is stable for the same address and salt', () => {
    expect(hashIp('10.0.0.1', 's')).toBe(hashIp('10.0.0.1', 's'));
    expect(hashIp('10.0.0.1', 's')).not.toBe(hashIp('10.0.0.2', 's'));
  });

  it('returns null without an address', () => {
    expect(hashIp(undefined, 's')).toBeNull();
  });
});

describe('parseTtlSeconds', () => {
  it.each([
    ['15m', 900],
    ['2h', 7200],
    ['7d', 604800],
    ['30s', 30],
    ['900', 900],
    ['nonsense', 900],
  ])('parses %s', (input, expected) => {
    expect(parseTtlSeconds(input)).toBe(expected);
  });
});
