import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentAccount } from '@/lib/server/auth';
import { ensureSchema } from '@/lib/server/db';
import { accountsEnabled } from '@/lib/server/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ENTRIES = 100;

const entrySchema = z.object({
  id: z.string().min(1).max(64),
  status: z.enum(['en_cours', 'confirme', 'invalide']),
  createdAt: z.string().max(40),
  /** The analysis itself, stored as produced by the engine. */
  analysis: z.record(z.unknown()),
});

const syncSchema = z.object({ entries: z.array(entrySchema).max(50) });

interface AnalysisRow {
  id: string;
  status: string;
  created_at: Date;
  payload: Record<string, unknown>;
}

/** The signed-in account's journal, most recent first. */
export async function GET(): Promise<Response> {
  if (!accountsEnabled()) return NextResponse.json({ entries: [] });

  const account = await currentAccount();
  const sql = await ensureSchema();
  if (!account || !sql) return NextResponse.json({ entries: [] });

  const rows = await sql<AnalysisRow[]>`
    SELECT id, status, created_at, payload
      FROM analyses
     WHERE account_id = ${account.id}
     ORDER BY created_at DESC
     LIMIT ${MAX_ENTRIES}
  `;

  return NextResponse.json({
    entries: rows.map((row) => ({
      id: row.id,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      analysis: row.payload,
    })),
  });
}

/**
 * Pushes local entries to the account. Captures stay in the browser: they are
 * heavy, and the journal is useful without them.
 */
export async function POST(request: Request): Promise<Response> {
  if (!accountsEnabled()) return NextResponse.json({ saved: 0 });

  const account = await currentAccount();
  const sql = await ensureSchema();
  if (!account || !sql) {
    return NextResponse.json({ error: 'Connectez-vous pour synchroniser.' }, { status: 401 });
  }

  const parsed = syncSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Entrées invalides.' }, { status: 400 });
  }

  for (const entry of parsed.data.entries) {
    await sql`
      INSERT INTO analyses (id, account_id, created_at, status, payload)
      VALUES (
        ${entry.id}, ${account.id}, ${entry.createdAt}, ${entry.status},
        ${sql.json(entry.analysis as never)}
      )
      ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, payload = EXCLUDED.payload
    `;
  }

  return NextResponse.json({ saved: parsed.data.entries.length });
}

/** Clears the account's journal; the local copy is cleared by the caller. */
export async function DELETE(): Promise<Response> {
  const account = await currentAccount();
  const sql = await ensureSchema();
  if (!account || !sql) {
    return NextResponse.json({ error: 'Connectez-vous d’abord.' }, { status: 401 });
  }

  await sql`DELETE FROM analyses WHERE account_id = ${account.id}`;
  return NextResponse.json({ ok: true });
}
