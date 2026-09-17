import type { AnalysisStatus, MarketType } from '@prisma/client';
import type { AnalysisDetail, AnalysisListItem, ValidatedAnalysis } from '@/types/analysis';

export interface CreateAnalysisInput {
  userId: string;
  imageKey: string;
  imageMimeType: string;
  imageBytes: number;
  requestedAsset: string | null;
  requestedTimeframe: string | null;
  requestedMarket: MarketType | null;
}

export interface AnalysisImageRef {
  id: string;
  imageKey: string;
  imageMimeType: string;
  status: AnalysisStatus;
}

export interface SaveResultMeta {
  provider: string;
  model: string;
  durationMs: number;
}

export interface ListOptions {
  limit: number;
  /** Opaque cursor: the id of the last row of the previous page. */
  cursor?: string | undefined;
  status?: AnalysisStatus | undefined;
}

export interface ListResult {
  items: AnalysisListItem[];
  nextCursor: string | null;
  total: number;
}

/**
 * Persistence seam for analyses.
 *
 * Every method takes a `userId` and every query filters on it. There is no
 * "find by id" that is not also "…and owned by". That is deliberate: it makes
 * a cross-tenant read impossible to write by accident (§37).
 */
export interface AnalysisRepository {
  create(input: CreateAnalysisInput): Promise<AnalysisDetail>;
  findOwned(id: string, userId: string): Promise<AnalysisDetail | null>;
  findImageRef(id: string, userId: string): Promise<AnalysisImageRef | null>;
  list(userId: string, options: ListOptions): Promise<ListResult>;
  latest(userId: string): Promise<AnalysisDetail | null>;
  /** Returns false when the row is missing, not owned, or already processing. */
  claimForScan(id: string, userId: string): Promise<boolean>;
  saveResult(
    id: string,
    userId: string,
    result: ValidatedAnalysis,
    meta: SaveResultMeta,
  ): Promise<AnalysisDetail>;
  markFailed(
    id: string,
    userId: string,
    failureCode: string,
    durationMs: number | null,
  ): Promise<void>;
  /** Returns the deleted row's image key so the object can be removed too. */
  remove(id: string, userId: string): Promise<AnalysisImageRef | null>;
  countSince(userId: string, since: Date): Promise<number>;
  countByStatus(userId: string): Promise<Record<AnalysisStatus, number>>;
}
