import { describe, expect, it } from 'vitest';
import { horizonToApi, horizonToDb, toPublicUser } from './user.mapper.js';
import { INVESTMENT_HORIZONS } from '@nova/types';

describe('horizon mapping', () => {
  it('round-trips every API horizon value', () => {
    for (const horizon of INVESTMENT_HORIZONS) {
      expect(horizonToApi(horizonToDb(horizon))).toBe(horizon);
    }
  });
});

describe('toPublicUser', () => {
  it('never exposes the password hash', () => {
    const user = {
      id: 'u1',
      email: 'camille@example.com',
      passwordHash: 'scrypt$secret',
      firstName: 'Camille',
      locale: 'fr',
      theme: 'system',
      contentDepth: 'simple',
      onboardingCompletedAt: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    } as never;
    const publicUser = toPublicUser(user);
    expect(JSON.stringify(publicUser)).not.toContain('scrypt');
    expect(Object.keys(publicUser)).not.toContain('passwordHash');
    expect(publicUser.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });
});
