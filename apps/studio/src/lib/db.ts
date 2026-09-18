import { PrismaClient } from '@prisma/client';
import { getEnv } from './config/env';

declare global {
  var __novaStudioPrisma: PrismaClient | undefined;
}

function createClient(): PrismaClient {
  const env = getEnv();
  return new PrismaClient({
    datasources: { db: { url: env.DATABASE_URL } },
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

/** Single client per process; Next.js dev reloads would otherwise exhaust the pool. */
export const prisma: PrismaClient = globalThis.__novaStudioPrisma ?? createClient();

if (getEnv().NODE_ENV !== 'production') {
  globalThis.__novaStudioPrisma = prisma;
}
