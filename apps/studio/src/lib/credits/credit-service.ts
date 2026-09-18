import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../db';
import { AppError } from '../errors';
import { getCreditCostPerVideo } from '../config/system-config';

export interface SpendInput {
  userId: string;
  amount: number;
  videoId?: string | undefined;
  description?: string | undefined;
  /** Same key twice = one debit. Required for retry-safe generation. */
  idempotencyKey: string;
}

export interface GrantInput {
  userId: string;
  amount: number;
  type: 'PURCHASE' | 'REFUND' | 'BONUS';
  videoId?: string | undefined;
  description?: string | undefined;
  idempotencyKey?: string | undefined;
}

export interface CreditResult {
  balance: number;
  transactionId: string;
  /** True when an identical idempotency key had already been applied. */
  replayed: boolean;
}

/**
 * Credits are money. Every mutation runs inside a single database transaction and the debit
 * itself is a conditional UPDATE (`balance >= amount`), so two concurrent generations can never
 * spend the same credit: the second one finds zero rows updated and is rejected.
 */
export class CreditService {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async getBalance(userId: string): Promise<number> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { creditBalance: true },
    });
    if (!user) throw new AppError('NOT_FOUND');
    return user.creditBalance;
  }

  async costPerVideo(): Promise<number> {
    return getCreditCostPerVideo();
  }

  async spend(input: SpendInput): Promise<CreditResult> {
    if (input.amount <= 0) {
      throw new AppError('VALIDATION_FAILED', 'Le montant débité doit être positif.');
    }

    return this.db.$transaction(
      async (tx) => {
        const replay = await this.findReplay(tx, input.idempotencyKey);
        if (replay) return replay;

        const updated = await tx.user.updateMany({
          where: { id: input.userId, creditBalance: { gte: input.amount } },
          data: { creditBalance: { decrement: input.amount } },
        });

        if (updated.count === 0) {
          const exists = await tx.user.findUnique({
            where: { id: input.userId },
            select: { id: true },
          });
          if (!exists) throw new AppError('NOT_FOUND');
          throw new AppError('INSUFFICIENT_CREDITS');
        }

        const user = await tx.user.findUniqueOrThrow({
          where: { id: input.userId },
          select: { creditBalance: true },
        });

        const transaction = await tx.creditTransaction.create({
          data: {
            userId: input.userId,
            amount: -input.amount,
            type: 'GENERATION',
            videoId: input.videoId ?? null,
            balanceAfter: user.creditBalance,
            description: input.description ?? null,
            idempotencyKey: input.idempotencyKey,
          },
          select: { id: true },
        });

        return { balance: user.creditBalance, transactionId: transaction.id, replayed: false };
      },
      { isolationLevel: 'ReadCommitted' },
    );
  }

  async grant(input: GrantInput): Promise<CreditResult> {
    if (input.amount <= 0) {
      throw new AppError('VALIDATION_FAILED', 'Le montant crédité doit être positif.');
    }

    return this.db.$transaction(async (tx) => {
      if (input.idempotencyKey) {
        const replay = await this.findReplay(tx, input.idempotencyKey);
        if (replay) return replay;
      }

      const user = await tx.user.update({
        where: { id: input.userId },
        data: { creditBalance: { increment: input.amount } },
        select: { creditBalance: true },
      });

      const transaction = await tx.creditTransaction.create({
        data: {
          userId: input.userId,
          amount: input.amount,
          type: input.type,
          videoId: input.videoId ?? null,
          balanceAfter: user.creditBalance,
          description: input.description ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
        },
        select: { id: true },
      });

      return { balance: user.creditBalance, transactionId: transaction.id, replayed: false };
    });
  }

  /**
   * Gives back the credits of a failed generation. Keyed on the job, so a video that is
   * regenerated three times can be refunded three times — but each job only once.
   */
  async refundGeneration(
    userId: string,
    videoId: string,
    jobId: string,
    amount: number,
  ): Promise<CreditResult> {
    return this.grant({
      userId,
      amount,
      type: 'REFUND',
      videoId,
      description: 'Remboursement automatique : le rendu a échoué',
      idempotencyKey: `refund:${jobId}`,
    });
  }

  async history(userId: string, limit = 50) {
    return this.db.creditTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  private async findReplay(
    tx: Prisma.TransactionClient,
    idempotencyKey: string,
  ): Promise<CreditResult | null> {
    const existing = await tx.creditTransaction.findUnique({
      where: { idempotencyKey },
      select: { id: true, balanceAfter: true },
    });
    if (!existing) return null;
    return { balance: existing.balanceAfter, transactionId: existing.id, replayed: true };
  }
}

export const creditService = new CreditService();
