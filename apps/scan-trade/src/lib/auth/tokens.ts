import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * One-time tokens for password reset.
 *
 * The plaintext token exists only in the e-mail link. The database stores its
 * SHA-256 hash, so a dump of `password_reset_tokens` cannot be replayed.
 */

export const PASSWORD_RESET_TTL_MINUTES = 30;

export function generateResetToken(): { token: string; tokenHash: string; expiresAt: Date } {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60_000),
  };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function tokensMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
