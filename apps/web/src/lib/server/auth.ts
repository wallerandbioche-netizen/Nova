import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { ensureSchema } from './db';
import { serverConfig } from './env';

const SESSION_COOKIE = 'scantrade_session';
const SESSION_DAYS = 30;
const LOGIN_TOKEN_MINUTES = 20;

export interface Account {
  id: string;
  email: string;
}

function secretKey(): Uint8Array {
  const { sessionSecret } = serverConfig();
  if (!sessionSecret) throw new Error('SESSION_SECRET manquant');
  return new TextEncoder().encode(sessionSecret);
}

/** Only the hash of a sign-in token is stored, never the token itself. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Issues a single-use sign-in token. The caller mails the link; the token is
 * only valid for a short window and is burnt on first use.
 */
export async function createLoginToken(email: string): Promise<string | null> {
  const sql = await ensureSchema();
  if (!sql) return null;

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + LOGIN_TOKEN_MINUTES * 60_000);

  await sql`
    INSERT INTO login_tokens (token_hash, email, expires_at)
    VALUES (${hashToken(token)}, ${normaliseEmail(email)}, ${expiresAt})
  `;
  return token;
}

/** Burns the token and returns the account it belongs to, creating it if new. */
export async function consumeLoginToken(token: string): Promise<Account | null> {
  const sql = await ensureSchema();
  if (!sql) return null;

  const rows = await sql<{ email: string }[]>`
    UPDATE login_tokens
       SET used_at = now()
     WHERE token_hash = ${hashToken(token)}
       AND used_at IS NULL
       AND expires_at > now()
    RETURNING email
  `;
  const email = rows[0]?.email;
  if (!email) return null;

  const accounts = await sql<Account[]>`
    INSERT INTO accounts (email, last_login_at)
    VALUES (${email}, now())
    ON CONFLICT (email) DO UPDATE SET last_login_at = now()
    RETURNING id, email
  `;
  return accounts[0] ?? null;
}

export async function startSession(account: Account): Promise<void> {
  const token = await new SignJWT({ email: account.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(account.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** The signed-in account, or null. Never throws on a bad or expired cookie. */
export async function currentAccount(): Promise<Account | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey());
    const id = payload.sub;
    const email = typeof payload.email === 'string' ? payload.email : null;
    if (!id || !email) return null;
    return { id, email };
  } catch {
    return null;
  }
}
