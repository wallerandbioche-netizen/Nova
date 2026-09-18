import { afterEach, describe, expect, it } from 'vitest';
import { CreditService } from '@/lib/credits/credit-service';
import { AppError } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { createTestUser, createTestVideo, cleanupUser } from './helpers';

const credits = new CreditService();
const created: string[] = [];

afterEach(async () => {
  await Promise.all(created.splice(0).map(cleanupUser));
});

async function user(balance: number) {
  const created_ = await createTestUser(balance);
  created.push(created_.id);
  return created_;
}

describe('CreditService', () => {
  it('debits a balance and records the movement', async () => {
    const account = await user(5);
    const result = await credits.spend({ userId: account.id, amount: 2, idempotencyKey: `k-${account.id}` });

    expect(result.balance).toBe(3);
    expect(await credits.getBalance(account.id)).toBe(3);

    const transaction = await prisma.creditTransaction.findUnique({ where: { idempotencyKey: `k-${account.id}` } });
    expect(transaction?.amount).toBe(-2);
    expect(transaction?.balanceAfter).toBe(3);
    expect(transaction?.type).toBe('GENERATION');
  });

  it('refuses to spend credits the user does not have', async () => {
    const account = await user(1);
    await expect(
      credits.spend({ userId: account.id, amount: 2, idempotencyKey: `k-${account.id}` }),
    ).rejects.toThrow(AppError);
    expect(await credits.getBalance(account.id)).toBe(1);
  });

  it('never spends the same credits twice under concurrency', async () => {
    const account = await user(3);

    // Five simultaneous generations against a three-credit balance.
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, (_, index) =>
        credits.spend({ userId: account.id, amount: 1, idempotencyKey: `race-${account.id}-${index}` }),
      ),
    );

    const succeeded = results.filter((result) => result.status === 'fulfilled');
    expect(succeeded).toHaveLength(3);
    expect(await credits.getBalance(account.id)).toBe(0);

    const movements = await prisma.creditTransaction.findMany({ where: { userId: account.id } });
    expect(movements).toHaveLength(3);
    expect(movements.reduce((sum, m) => sum + m.amount, 0)).toBe(-3);
  });

  it('applies the same idempotency key only once', async () => {
    const account = await user(5);
    const key = `idem-${account.id}`;

    const first = await credits.spend({ userId: account.id, amount: 2, idempotencyKey: key });
    const second = await credits.spend({ userId: account.id, amount: 2, idempotencyKey: key });

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.balance).toBe(first.balance);
    expect(await credits.getBalance(account.id)).toBe(3);
  });

  it('is idempotent even when the same key arrives concurrently', async () => {
    const account = await user(5);
    const key = `concurrent-idem-${account.id}`;

    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () => credits.spend({ userId: account.id, amount: 1, idempotencyKey: key })),
    );
    expect(results.some((r) => r.status === 'fulfilled')).toBe(true);

    // Whatever the interleaving, the key may only ever produce one debit.
    const movements = await prisma.creditTransaction.findMany({ where: { idempotencyKey: key } });
    expect(movements).toHaveLength(1);
    expect(await credits.getBalance(account.id)).toBe(4);
  });

  it('gives credits back when a render fails, once per job', async () => {
    const account = await user(2);
    const video = await createTestVideo(account.id);
    await credits.spend({ userId: account.id, amount: 1, idempotencyKey: `gen-${account.id}` });

    const first = await credits.refundGeneration(account.id, video.id, `job-${account.id}`, 1);
    const replay = await credits.refundGeneration(account.id, video.id, `job-${account.id}`, 1);

    expect(first.balance).toBe(2);
    expect(replay.replayed).toBe(true);
    expect(await credits.getBalance(account.id)).toBe(2);
  });

  it('grants purchased credits', async () => {
    const account = await user(0);
    const result = await credits.grant({ userId: account.id, amount: 15, type: 'PURCHASE', idempotencyKey: `buy-${account.id}` });
    expect(result.balance).toBe(15);

    const history = await credits.history(account.id);
    expect(history[0]?.type).toBe('PURCHASE');
  });

  it('rejects nonsensical amounts', async () => {
    const account = await user(5);
    await expect(credits.spend({ userId: account.id, amount: 0, idempotencyKey: 'x' })).rejects.toThrow(AppError);
    await expect(credits.spend({ userId: account.id, amount: -3, idempotencyKey: 'y' })).rejects.toThrow(AppError);
    await expect(credits.grant({ userId: account.id, amount: -1, type: 'BONUS' })).rejects.toThrow(AppError);
  });
});
