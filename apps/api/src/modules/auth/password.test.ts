import { describe, expect, it } from 'vitest';
import { hashPassword, needsRehash, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('verifies a correct password', async () => {
    const hash = await hashPassword('correcte-phrase-42');
    expect(await verifyPassword('correcte-phrase-42', hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correcte-phrase-42');
    expect(await verifyPassword('mauvaise-phrase-42', hash)).toBe(false);
  });

  it('never stores the password in clear text', async () => {
    const hash = await hashPassword('correcte-phrase-42');
    expect(hash).not.toContain('correcte-phrase-42');
    expect(hash.startsWith('scrypt$')).toBe(true);
  });

  it('produces a different hash for the same password (random salt)', async () => {
    const [a, b] = await Promise.all([
      hashPassword('meme-phrase-42'),
      hashPassword('meme-phrase-42'),
    ]);
    expect(a).not.toBe(b);
    expect(await verifyPassword('meme-phrase-42', a)).toBe(true);
    expect(await verifyPassword('meme-phrase-42', b)).toBe(true);
  });

  it('normalises unicode so an equivalent password still verifies', async () => {
    const hash = await hashPassword('café-securise-1'); // e + combining acute
    expect(await verifyPassword('café-securise-1', hash)).toBe(true); // é precomposed
  });

  it('returns false instead of throwing on a malformed hash', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$abc$8$1$zz$zz')).toBe(false);
    expect(await verifyPassword('x', '')).toBe(false);
  });

  it('flags legacy parameters for rehashing', async () => {
    expect(needsRehash('scrypt$1024$8$1$c2FsdA$a2V5')).toBe(true);
    expect(needsRehash(await hashPassword('phrase-actuelle-42'))).toBe(false);
    expect(needsRehash('bcrypt$whatever')).toBe(true);
  });
});
