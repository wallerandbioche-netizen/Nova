import { randomBytes } from 'node:crypto';

const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';

/**
 * Identifiant court, lisible, sans caractère ambigu — utilisable dans une URL.
 */
export function newId(prefix?: string): string {
  const bytes = randomBytes(12);
  let out = '';
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
  return prefix ? `${prefix}_${out}` : out;
}
