import type { AnalysisStatus } from '@prisma/client';
import type { AnalysisDetail, ValidatedAnalysis } from '@/types/analysis';
import type {
  AnalysisImageRef,
  AnalysisRepository,
  CreateAnalysisInput,
  ListOptions,
  ListResult,
  SaveResultMeta,
} from '../repository';

/**
 * In-memory repository used by the service tests.
 *
 * It reproduces the one property that matters: every method filters on
 * `userId`. A test that proves user A cannot read user B's analysis is only
 * meaningful if the double enforces the same rule as the Prisma
 * implementation, so the scoping is duplicated here deliberately rather than
 * stubbed away.
 */
export class MemoryAnalysisRepository implements AnalysisRepository {
  private readonly rows = new Map<
    string,
    AnalysisDetail & { userId: string; imageKey: string; imageMimeType: string }
  >();
  private sequence = 0;

  /** Test seam: record the calls so a test can assert what was persisted. */
  readonly savedResults: Array<{ id: string; userId: string; result: ValidatedAnalysis }> = [];

  async create(input: CreateAnalysisInput): Promise<AnalysisDetail> {
    const id = `analysis_${++this.sequence}`;
    const now = new Date();
    const row = {
      id,
      userId: input.userId,
      imageKey: input.imageKey,
      imageMimeType: input.imageMimeType,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      status: 'PENDING' as AnalysisStatus,
      asset: null,
      timeframe: null,
      market: null,
      chartType: null,
      approxPrice: null,
      bias: null,
      entryMin: null,
      entryMax: null,
      stopLoss: null,
      takeProfit1: null,
      takeProfit2: null,
      riskReward: null,
      confidence: null,
      summary: null,
      invalidation: null,
      warnings: [] as string[],
      failureCode: null,
      durationMs: null,
      requestedAsset: input.requestedAsset,
      requestedTimeframe: input.requestedTimeframe,
      requestedMarket: input.requestedMarket,
      levels: [],
      technical: [],
      reasoning: [],
    };
    this.rows.set(id, row);
    return this.detach(row);
  }

  async findOwned(id: string, userId: string): Promise<AnalysisDetail | null> {
    const row = this.rows.get(id);
    if (!row || row.userId !== userId) return null;
    return this.detach(row);
  }

  async findImageRef(id: string, userId: string): Promise<AnalysisImageRef | null> {
    const row = this.rows.get(id);
    if (!row || row.userId !== userId) return null;
    return {
      id: row.id,
      imageKey: row.imageKey,
      imageMimeType: row.imageMimeType,
      status: row.status,
    };
  }

  async list(userId: string, options: ListOptions): Promise<ListResult> {
    const all = [...this.rows.values()]
      .filter((row) => row.userId === userId && (!options.status || row.status === options.status))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const start = options.cursor ? all.findIndex((row) => row.id === options.cursor) + 1 : 0;
    const page = all.slice(start, start + options.limit);
    const hasMore = start + options.limit < all.length;

    return {
      items: page.map((row) => this.detach(row)),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      total: all.length,
    };
  }

  async latest(userId: string): Promise<AnalysisDetail | null> {
    const result = await this.list(userId, { limit: 1 });
    return (result.items[0] as AnalysisDetail | undefined) ?? null;
  }

  async claimForScan(id: string, userId: string): Promise<boolean> {
    const row = this.rows.get(id);
    if (!row || row.userId !== userId) return false;
    if (row.status !== 'PENDING' && row.status !== 'FAILED') return false;
    row.status = 'PROCESSING';
    row.failureCode = null;
    return true;
  }

  async saveResult(
    id: string,
    userId: string,
    result: ValidatedAnalysis,
    meta: SaveResultMeta,
  ): Promise<AnalysisDetail> {
    const row = this.rows.get(id);
    if (!row || row.userId !== userId) throw new Error('not found');

    Object.assign(row, {
      status: result.status,
      asset: result.asset,
      timeframe: result.timeframe,
      market: result.market,
      chartType: result.chartType,
      approxPrice: result.approxPrice,
      bias: result.bias,
      entryMin: result.entryMin,
      entryMax: result.entryMax,
      stopLoss: result.stopLoss,
      takeProfit1: result.takeProfit1,
      takeProfit2: result.takeProfit2,
      riskReward: result.riskReward,
      confidence: result.confidence,
      summary: result.summary,
      invalidation: result.invalidation,
      warnings: result.warnings,
      failureCode: null,
      durationMs: meta.durationMs,
      completedAt: new Date(),
      levels: result.levels,
      technical: result.technical,
      reasoning: result.reasoning,
    });

    this.savedResults.push({ id, userId, result });
    return this.detach(row);
  }

  async markFailed(
    id: string,
    userId: string,
    failureCode: string,
    durationMs: number | null,
  ): Promise<void> {
    const row = this.rows.get(id);
    if (!row || row.userId !== userId) return;
    row.status = 'FAILED';
    row.failureCode = failureCode;
    row.durationMs = durationMs;
  }

  async remove(id: string, userId: string): Promise<AnalysisImageRef | null> {
    const ref = await this.findImageRef(id, userId);
    if (!ref) return null;
    this.rows.delete(id);
    return ref;
  }

  async countSince(): Promise<number> {
    return 0;
  }

  async countByStatus(userId: string): Promise<Record<AnalysisStatus, number>> {
    const base: Record<AnalysisStatus, number> = {
      PENDING: 0,
      PROCESSING: 0,
      COMPLETED: 0,
      NO_TRADE: 0,
      INSUFFICIENT_DATA: 0,
      FAILED: 0,
    };
    for (const row of this.rows.values()) {
      if (row.userId === userId) base[row.status] += 1;
    }
    return base;
  }

  /** Copy so a caller mutating the result cannot corrupt the store. */
  private detach(row: AnalysisDetail): AnalysisDetail {
    return { ...row, warnings: [...row.warnings], levels: [...row.levels] };
  }
}
