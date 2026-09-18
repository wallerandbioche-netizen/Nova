import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';

export async function createTestUser(credits = 10) {
  const user = await prisma.user.create({
    data: {
      email: `test-${randomUUID()}@example.com`,
      passwordHash: await hashPassword('a-long-enough-password'),
      creditBalance: credits,
    },
  });
  return user;
}

export async function cleanupUser(userId: string): Promise<void> {
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}

/** A minimal listing + video pair, for tests that need real foreign keys. */
export async function createTestVideo(userId: string) {
  const listing = await prisma.listing.create({
    data: { userId, sourcePlatform: 'MANUAL', status: 'READY', title: 'Test' },
  });
  return prisma.video.create({
    data: {
      userId,
      listingId: listing.id,
      name: 'Test video',
      seed: 1234,
      imageOrder: [],
    },
  });
}
