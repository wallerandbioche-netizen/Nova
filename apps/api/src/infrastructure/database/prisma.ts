import { PrismaClient, type Prisma } from '@prisma/client';
import { getEnv } from '../../config/env.js';

export type { Prisma };
export type Database = PrismaClient;

let client: PrismaClient | null = null;

export function createPrismaClient(databaseUrl?: string): PrismaClient {
  const env = getEnv();
  return new PrismaClient({
    datasources: { db: { url: databaseUrl ?? env.DATABASE_URL } },
    log:
      env.LOG_LEVEL === 'debug' || env.LOG_LEVEL === 'trace'
        ? [{ emit: 'stdout', level: 'query' }, 'warn', 'error']
        : ['warn', 'error'],
  });
}

/** Process-wide client. Reused across hot reloads so dev does not exhaust the connection pool. */
export function getPrismaClient(): PrismaClient {
  if (!client) client = createPrismaClient();
  return client;
}

export async function disconnectPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = null;
  }
}

/** Prisma `Decimal` columns arrive as objects; the finance engine works on plain numbers. */
export function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return Number(value.toString());
}

export function toNullableNumber(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value.toString());
  return Number.isFinite(parsed) ? parsed : null;
}
