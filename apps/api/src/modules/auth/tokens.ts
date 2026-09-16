import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { Env } from '../../config/env.js';
import { unauthorized } from '../../http/errors.js';

export interface AccessTokenClaims extends JWTPayload {
  sub: string;
  email: string;
  /** Token version, so a future claim change can invalidate old tokens explicitly. */
  v: number;
}

const ISSUER = 'nova-api';
const AUDIENCE = 'nova-app';
const TOKEN_VERSION = 1;

function secretKey(env: Env): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET);
}

export async function signAccessToken(
  env: Env,
  payload: { userId: string; email: string },
): Promise<{ token: string; expiresIn: number }> {
  const token = await new SignJWT({ email: payload.email, v: TOKEN_VERSION })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setJti(randomUUID())
    .setExpirationTime(env.JWT_ACCESS_TTL)
    .sign(secretKey(env));

  return { token, expiresIn: parseTtlSeconds(env.JWT_ACCESS_TTL) };
}

export async function verifyAccessToken(env: Env, token: string): Promise<AccessTokenClaims> {
  try {
    const { payload } = await jwtVerify(token, secretKey(env), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });
    if (typeof payload.sub !== 'string' || payload.v !== TOKEN_VERSION) {
      throw unauthorized('Session invalide');
    }
    return payload as AccessTokenClaims;
  } catch {
    throw unauthorized('Session expirée ou invalide');
  }
}

/**
 * Opaque refresh token. Only its SHA-256 hash is persisted, so a database dump cannot be
 * replayed as a session, and rotation can detect reuse of an already-consumed token.
 */
export function generateRefreshToken(): { token: string; tokenHash: string } {
  const token = randomBytes(48).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** One-way, non-reversible IP fingerprint for audit logs (never the raw address). */
export function hashIp(ip: string | undefined, salt: string): string | null {
  if (!ip) return null;
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

/** Parses a `15m` / `2h` / `7d` / `900` TTL string into seconds. */
export function parseTtlSeconds(ttl: string): number {
  const match = /^(\d+)\s*([smhd]?)$/.exec(ttl.trim());
  if (!match) return 900;
  const value = Number(match[1]);
  switch (match[2]) {
    case 'd':
      return value * 86400;
    case 'h':
      return value * 3600;
    case 'm':
      return value * 60;
    default:
      return value;
  }
}
