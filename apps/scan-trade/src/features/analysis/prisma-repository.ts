import type { Prisma, PrismaClient } from '@prisma/client';
import type { AnalysisStatus } from '@prisma/client';
import type { AnalysisDetail, AnalysisListItem, ValidatedAnalysis } from '@/types/analysis';
import type {
  AnalysisImageRef,
  AnalysisRepository,
  CreateAnalysisInput,
  ListOptions,
  ListResult,
  SaveResultMeta,
} from './repository';

const DETAIL_INCLUDE = {
  levels: { orderBy: { position: 'asc' } },
  technical: { orderBy: { position: 'asc' } },
  reasoning: { orderBy: { position: 'asc' } },
} satisfies Prisma.AnalysisInclude;

type AnalysisRow = Prisma.AnalysisGetPayload<{ include: typeof DETAIL_INCLUDE }>;

const LIST_SELECT = {
  id: true,
  createdAt: true,
  status: true,
  asset: true,
  timeframe: true,
  market: true,
  bias: true,
  entryMin: true,
  entryMax: true,
  stopLoss: true,
  takeProfit1: true,
  takeProfit2: true,
  riskReward: true,
  confidence: true,
} satisfies Prisma.AnalysisSelect;

export class PrismaAnalysisRepository implements AnalysisRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: CreateAnalysisInput): Promise<AnalysisDetail> {
    const row = await this.db.analysis.create({
      data: {
        userId: input.userId,
        imageKey: input.imageKey,
        imageMimeType: input.imageMimeType,
        imageBytes: input.imageBytes,
        requestedAsset: input.requestedAsset,
        requestedTimeframe: input.requestedTimeframe,
        requestedMarket: input.requestedMarket,
        status: 'PENDING',
      },
      include: DETAIL_INCLUDE,
    });
    return toDetail(row);
  }

  async findOwned(id: string, userId: string): Promise<AnalysisDetail | null> {
    const row = await this.db.analysis.findFirst({
      where: { id, userId },
      include: DETAIL_INCLUDE,
    });
    return row ? toDetail(row) : null;
  }

  async findImageRef(id: string, userId: string): Promise<AnalysisImageRef | null> {
    return this.db.analysis.findFirst({
      where: { id, userId },
      select: { id: true, imageKey: true, imageMimeType: true, status: true },
    });
  }

  async list(userId: string, options: ListOptions): Promise<ListResult> {
    const where: Prisma.AnalysisWhereInput = {
      userId,
      ...(options.status ? { status: options.status } : {}),
    };

    const [rows, total] = await Promise.all([
      this.db.analysis.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { createdAt: 'desc' },
        take: options.limit + 1,
        ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      }),
      this.db.analysis.count({ where }),
    ]);

    const hasMore = rows.length > options.limit;
    const items = (hasMore ? rows.slice(0, options.limit) : rows) as AnalysisListItem[];

    return {
      items,
      nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
      total,
    };
  }

  async latest(userId: string): Promise<AnalysisDetail | null> {
    const row = await this.db.analysis.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: DETAIL_INCLUDE,
    });
    return row ? toDetail(row) : null;
  }

  async claimForScan(id: string, userId: string): Promise<boolean> {
    // Conditional update: only a PENDING or FAILED row owned by this user moves
    // to PROCESSING, so two concurrent scans cannot both start.
    const result = await this.db.analysis.updateMany({
      where: { id, userId, status: { in: ['PENDING', 'FAILED'] } },
      data: { status: 'PROCESSING', failureCode: null },
    });
    return result.count === 1;
  }

  async saveResult(
    id: string,
    userId: string,
    result: ValidatedAnalysis,
    meta: SaveResultMeta,
  ): Promise<AnalysisDetail> {
    const row = await this.db.$transaction(async (tx) => {
      // Re-scoped by userId: a transaction is not an excuse to drop the filter.
      const updated = await tx.analysis.updateMany({
        where: { id, userId },
        data: {
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
          provider: meta.provider,
          model: meta.model,
          durationMs: meta.durationMs,
          completedAt: new Date(),
        },
      });
      if (updated.count !== 1) return null;

      await tx.analysisLevel.deleteMany({ where: { analysisId: id } });
      await tx.analysisReasoning.deleteMany({ where: { analysisId: id } });
      await tx.technicalObservation.deleteMany({ where: { analysisId: id } });

      if (result.levels.length > 0) {
        await tx.analysisLevel.createMany({
          data: result.levels.map((level, position) => ({
            analysisId: id,
            type: level.type,
            price: level.price,
            priceMax: level.priceMax,
            label: level.label,
            position,
          })),
        });
      }
      if (result.reasoning.length > 0) {
        await tx.analysisReasoning.createMany({
          data: result.reasoning.map((item, position) => ({
            analysisId: id,
            category: item.category,
            content: item.content,
            position,
          })),
        });
      }
      if (result.technical.length > 0) {
        await tx.technicalObservation.createMany({
          data: result.technical.map((item, position) => ({
            analysisId: id,
            category: item.category,
            title: item.title,
            detail: item.detail,
            position,
          })),
        });
      }

      return tx.analysis.findFirst({ where: { id, userId }, include: DETAIL_INCLUDE });
    });

    if (!row) throw new Error(`Analysis ${id} disappeared while saving its result.`);
    return toDetail(row);
  }

  async markFailed(
    id: string,
    userId: string,
    failureCode: string,
    durationMs: number | null,
  ): Promise<void> {
    await this.db.analysis.updateMany({
      where: { id, userId },
      data: { status: 'FAILED', failureCode, durationMs, completedAt: new Date() },
    });
  }

  async remove(id: string, userId: string): Promise<AnalysisImageRef | null> {
    const existing = await this.findImageRef(id, userId);
    if (!existing) return null;
    const deleted = await this.db.analysis.deleteMany({ where: { id, userId } });
    return deleted.count === 1 ? existing : null;
  }

  async countSince(userId: string, since: Date): Promise<number> {
    return this.db.usageEvent.count({
      where: { userId, kind: 'ANALYSIS_SCAN', createdAt: { gte: since } },
    });
  }

  async countByStatus(userId: string): Promise<Record<AnalysisStatus, number>> {
    const rows = await this.db.analysis.groupBy({
      by: ['status'],
      where: { userId },
      _count: { _all: true },
    });
    const base: Record<AnalysisStatus, number> = {
      PENDING: 0,
      PROCESSING: 0,
      COMPLETED: 0,
      NO_TRADE: 0,
      INSUFFICIENT_DATA: 0,
      FAILED: 0,
    };
    for (const row of rows) base[row.status] = row._count._all;
    return base;
  }
}

function toDetail(row: AnalysisRow): AnalysisDetail {
  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt,
    status: row.status,
    asset: row.asset,
    timeframe: row.timeframe,
    market: row.market,
    chartType: row.chartType,
    approxPrice: row.approxPrice,
    bias: row.bias,
    entryMin: row.entryMin,
    entryMax: row.entryMax,
    stopLoss: row.stopLoss,
    takeProfit1: row.takeProfit1,
    takeProfit2: row.takeProfit2,
    riskReward: row.riskReward,
    confidence: row.confidence,
    summary: row.summary,
    invalidation: row.invalidation,
    warnings: row.warnings,
    failureCode: row.failureCode,
    durationMs: row.durationMs,
    requestedAsset: row.requestedAsset,
    requestedTimeframe: row.requestedTimeframe,
    requestedMarket: row.requestedMarket,
    levels: row.levels.map((level) => ({
      type: level.type,
      price: level.price,
      priceMax: level.priceMax,
      label: level.label,
    })),
    technical: row.technical.map((item) => ({
      category: item.category,
      title: item.title,
      detail: item.detail,
    })),
    reasoning: row.reasoning.map((item) => ({ category: item.category, content: item.content })),
  };
}
