import { PrismaClient } from '@prisma/client';

/**
 * One Prisma client per process. Next.js hot-reloads modules in development,
 * so the instance is parked on `globalThis` to avoid exhausting the pool.
 */

const globalForPrisma = globalThis as unknown as { scanTradePrisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.scanTradePrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.scanTradePrisma = prisma;
}
