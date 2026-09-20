import 'server-only';

import postgres from 'postgres';
import { serverConfig } from './env';

export type Sql = ReturnType<typeof postgres>;

let client: Sql | null = null;
let schemaReady: Promise<void> | null = null;

/** Lazily opened pool — the app must boot fine without a database. */
export function db(): Sql | null {
  const { databaseUrl } = serverConfig();
  if (!databaseUrl) return null;
  if (!client) {
    client = postgres(databaseUrl, {
      // Serverless invocations are short lived: keep the pool small.
      max: 3,
      idle_timeout: 20,
      prepare: false,
    });
  }
  return client;
}

/**
 * Creates the tables on first use. The schema is small and additive, so this
 * stays simpler than a migration tool while remaining safe to run repeatedly.
 */
export async function ensureSchema(): Promise<Sql | null> {
  const sql = db();
  if (!sql) return null;

  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS accounts (
          id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          email         text UNIQUE NOT NULL,
          created_at    timestamptz NOT NULL DEFAULT now(),
          last_login_at timestamptz
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS login_tokens (
          token_hash text PRIMARY KEY,
          email      text NOT NULL,
          expires_at timestamptz NOT NULL,
          used_at    timestamptz
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS subscriptions (
          account_id             uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
          stripe_customer_id     text UNIQUE,
          stripe_subscription_id text UNIQUE,
          status                 text NOT NULL DEFAULT 'none',
          plan                   text,
          current_period_end     timestamptz,
          cancel_at_period_end   boolean NOT NULL DEFAULT false,
          updated_at             timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS analyses (
          id         text PRIMARY KEY,
          account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
          created_at timestamptz NOT NULL DEFAULT now(),
          status     text NOT NULL DEFAULT 'en_cours',
          payload    jsonb NOT NULL
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS analyses_account_idx ON analyses (account_id, created_at DESC)`;
    })().catch((error) => {
      // A failed bootstrap must not be cached as success.
      schemaReady = null;
      throw error;
    });
  }

  await schemaReady;
  return sql;
}
