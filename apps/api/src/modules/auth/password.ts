import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * `promisify` loses scrypt's options overload, so the typed wrapper is declared explicitly.
 */
const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * Password hashing with scrypt from Node's standard library.
 *
 * scrypt is memory-hard and ships with Node, which removes a native build step and one more
 * third-party dependency from the authentication path. Parameters are stored inside the hash
 * so they can be raised later without invalidating existing passwords.
 *
 * Format: `scrypt$N$r$p$<salt base64url>$<derived key base64url>`
 */
const DEFAULT_PARAMS = { N: 2 ** 15, r: 8, p: 1, keyLength: 64 } as const;
const SALT_BYTES = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const { N, r, p, keyLength } = DEFAULT_PARAMS;
  const derived = await scrypt(password.normalize('NFKC'), salt, keyLength, {
    N,
    r,
    p,
    // scrypt needs roughly 128 * N * r bytes; raise the default limit accordingly.
    maxmem: 256 * N * r,
  });
  return ['scrypt', N, r, p, salt.toString('base64url'), derived.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, nRaw, rRaw, pRaw, saltRaw, keyRaw] = stored.split('$');
    if (scheme !== 'scrypt' || !nRaw || !rRaw || !pRaw || !saltRaw || !keyRaw) return false;

    const N = Number(nRaw);
    const r = Number(rRaw);
    const p = Number(pRaw);
    if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

    const salt = Buffer.from(saltRaw, 'base64url');
    const expected = Buffer.from(keyRaw, 'base64url');
    const derived = await scrypt(password.normalize('NFKC'), salt, expected.length, {
      N,
      r,
      p,
      maxmem: 256 * N * r,
    });

    // Constant-time comparison: a length check alone would leak information through timing.
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/** True when a stored hash uses weaker parameters than the current policy. */
export function needsRehash(stored: string): boolean {
  const [scheme, nRaw] = stored.split('$');
  if (scheme !== 'scrypt') return true;
  return Number(nRaw) < DEFAULT_PARAMS.N;
}
