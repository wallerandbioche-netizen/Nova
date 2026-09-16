import { prisma } from '@/lib/db/prisma';
import { getCoreEnv } from '@/lib/env';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { UsageRecorder } from '@/features/analysis/service';
import type { Viewer } from './session';

/**
 * Usage policy (§5 / §43).
 *
 * The MVP sells one unlimited plan, so the only gate that bites today is the
 * subscription check. The monthly counter is wired anyway, behind
 * `ANALYSIS_MONTHLY_LIMIT` (0 = unlimited): turning on quotas or credits later
 * is a configuration change plus a plan column, not a migration of history.
 */

export const usageRecorder: UsageRecorder = {
  async record(userId, kind) {
    try {
      await prisma.usageEvent.create({ data: { userId, kind } });
    } catch (error) {
      // Accounting must never fail a scan the user already paid for.
      logger.error('usage.record_failed', { userId, kind, error });
    }
  },
};

export function currentPeriodStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export interface UsageSnapshot {
  used: number;
  limit: number | null;
  remaining: number | null;
  periodStart: Date;
}

export async function getUsageSnapshot(userId: string, now: Date = new Date()): Promise<UsageSnapshot> {
  const periodStart = currentPeriodStart(now);
  const configured = getCoreEnv().ANALYSIS_MONTHLY_LIMIT;
  const limit = configured > 0 ? configured : null;

  const used = await prisma.usageEvent.count({
    where: { userId, kind: 'ANALYSIS_SCAN', createdAt: { gte: periodStart } },
  });

  return {
    used,
    limit,
    remaining: limit == null ? null : Math.max(0, limit - used),
    periodStart,
  };
}

/**
 * The single gate every paid action goes through.
 *
 * @throws {AppError} `subscription_required` or `quota_exceeded`.
 */
export async function assertCanScan(viewer: Viewer, now: Date = new Date()): Promise<void> {
  if (!viewer.isSubscribed) throw new AppError('subscription_required');

  const limit = getCoreEnv().ANALYSIS_MONTHLY_LIMIT;
  if (limit <= 0) return;

  const snapshot = await getUsageSnapshot(viewer.id, now);
  if (snapshot.limit != null && snapshot.used >= snapshot.limit) {
    throw new AppError(
      'quota_exceeded',
      `Tu as utilisé tes ${snapshot.limit} analyses de la période. Le compteur repart au début du mois prochain.`,
    );
  }
}
