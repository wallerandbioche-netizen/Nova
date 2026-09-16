import bcrypt from 'bcryptjs';
import { z } from 'zod';

/**
 * Password handling.
 *
 * bcrypt with a cost of 12: slow enough to make an offline attack expensive,
 * fast enough that a serverless request does not time out.
 */
const BCRYPT_COST = 12;

export const passwordSchema = z
  .string()
  .min(10, 'Le mot de passe doit contenir au moins 10 caractères.')
  .max(200, 'Le mot de passe est trop long.')
  .refine((value) => /[a-zA-Z]/.test(value), 'Le mot de passe doit contenir au moins une lettre.')
  .refine((value) => /[0-9]/.test(value), 'Le mot de passe doit contenir au moins un chiffre.');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Adresse e-mail invalide.')
  .max(320, 'Adresse e-mail trop longue.');

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

/**
 * Verifies a password against a stored hash.
 *
 * When the account has no password (OAuth-only), a dummy comparison still runs
 * so the response time does not reveal which case it was.
 */
export async function verifyPassword(plain: string, hash: string | null): Promise<boolean> {
  if (!hash) {
    await bcrypt.compare(plain, '$2a$12$0000000000000000000000000000000000000000000000000000');
    return false;
  }
  return bcrypt.compare(plain, hash);
}
