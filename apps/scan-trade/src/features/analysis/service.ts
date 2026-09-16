import type { MarketType } from '@prisma/client';
import { AIProviderError, AnalysisValidationError, type AIAnalysisService } from '@/lib/ai';
import { ConfigurationError } from '@/lib/env';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { StorageError, type StorageDriver } from '@/lib/storage';
import type { ValidatedUpload } from '@/lib/storage/upload';
import type { AnalysisDetail, AnalysisHints } from '@/types/analysis';
import type { AnalysisRepository, ListOptions, ListResult } from './repository';

/**
 * Orchestration for the product's one job: turn a screenshot into a checked,
 * owned, stored analysis.
 *
 * The service owns no HTTP concerns and no rendering concerns. It is handed a
 * repository, a storage driver and the AI service, which is what makes the
 * ownership rules and the failure paths straightforward to test.
 */

export interface UsageRecorder {
  record(userId: string, kind: 'ANALYSIS_SCAN' | 'ANALYSIS_UPLOAD'): Promise<void>;
}

export interface AnalysisServiceDeps {
  repository: AnalysisRepository;
  storage: StorageDriver;
  /** Built lazily: a missing AI key must not break listing or deleting. */
  aiFactory: () => AIAnalysisService;
  usage: UsageRecorder;
}

export interface CreateAnalysisRequest {
  userId: string;
  upload: ValidatedUpload;
  asset: string | null;
  timeframe: string | null;
  market: MarketType | null;
}

export class AnalysisService {
  constructor(private readonly deps: AnalysisServiceDeps) {}

  /** Stores the screenshot and opens a PENDING analysis. No model call yet. */
  async create(request: CreateAnalysisRequest): Promise<AnalysisDetail> {
    const { upload } = request;

    await this.deps.storage.put(upload.key, upload.data, upload.mimeType);

    try {
      const analysis = await this.deps.repository.create({
        userId: request.userId,
        imageKey: upload.key,
        imageMimeType: upload.mimeType,
        imageBytes: upload.bytes,
        requestedAsset: request.asset,
        requestedTimeframe: request.timeframe,
        requestedMarket: request.market,
      });
      await this.deps.usage.record(request.userId, 'ANALYSIS_UPLOAD');
      logger.info('analysis.created', { userId: request.userId, analysisId: analysis.id, bytes: upload.bytes });
      return analysis;
    } catch (error) {
      // Do not leave an orphan object in the bucket when the row never landed.
      await this.deps.storage.remove(upload.key).catch((cause) => {
        logger.error('analysis.orphan_object', { key: upload.key, error: cause });
      });
      throw error;
    }
  }

  async get(userId: string, analysisId: string): Promise<AnalysisDetail> {
    const analysis = await this.deps.repository.findOwned(analysisId, userId);
    // Deliberately 404 rather than 403: someone probing ids learns nothing
    // about whether they exist under another account.
    if (!analysis) throw AppError.notFound("Cette analyse n'existe pas ou a été supprimée.");
    return analysis;
  }

  async list(userId: string, options: ListOptions): Promise<ListResult> {
    return this.deps.repository.list(userId, options);
  }

  async latest(userId: string): Promise<AnalysisDetail | null> {
    return this.deps.repository.latest(userId);
  }

  async remove(userId: string, analysisId: string): Promise<void> {
    const removed = await this.deps.repository.remove(analysisId, userId);
    if (!removed) throw AppError.notFound("Cette analyse n'existe pas ou a été supprimée.");

    // The row is gone either way; a storage failure must not resurrect it.
    await this.deps.storage.remove(removed.imageKey).catch((error) => {
      logger.error('analysis.image_delete_failed', { analysisId, error });
    });
    logger.info('analysis.deleted', { userId, analysisId });
  }

  /**
   * Runs the vision analysis.
   *
   * The row is claimed first (PENDING/FAILED → PROCESSING) so a double click
   * cannot bill two model calls, and every failure path writes a terminal
   * status: an analysis never stays stuck on PROCESSING because of a throw.
   */
  async scan(userId: string, analysisId: string, hints: AnalysisHints): Promise<AnalysisDetail> {
    const existing = await this.deps.repository.findOwned(analysisId, userId);
    if (!existing) throw AppError.notFound("Cette analyse n'existe pas ou a été supprimée.");

    if (existing.status === 'PROCESSING') throw new AppError('analysis_in_progress');
    if (existing.status === 'COMPLETED' || existing.status === 'NO_TRADE' || existing.status === 'INSUFFICIENT_DATA') {
      return existing;
    }

    const claimed = await this.deps.repository.claimForScan(analysisId, userId);
    if (!claimed) throw new AppError('analysis_in_progress');

    const startedAt = Date.now();
    const scopedLogger = logger.child({ userId, analysisId });

    try {
      const ref = await this.deps.repository.findImageRef(analysisId, userId);
      if (!ref) throw AppError.notFound();

      const object = await this.deps.storage.getObject(ref.imageKey);
      const result = await this.deps.aiFactory().analyzeChart({
        image: { data: object.data, mimeType: ref.imageMimeType },
        hints,
      });

      const saved = await this.deps.repository.saveResult(analysisId, userId, result.analysis, {
        provider: result.provider,
        model: result.model,
        durationMs: result.durationMs,
      });

      await this.deps.usage.record(userId, 'ANALYSIS_SCAN');
      scopedLogger.info('analysis.scan.completed', {
        status: saved.status,
        durationMs: result.durationMs,
        bias: saved.bias,
      });
      return saved;
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const appError = toAppError(error);
      await this.deps.repository
        .markFailed(analysisId, userId, appError.code, durationMs)
        .catch((cause) => scopedLogger.error('analysis.mark_failed_failed', { error: cause }));
      scopedLogger.error('analysis.scan.failed', { code: appError.code, durationMs, error });
      throw appError;
    }
  }
}

/** Translates every internal failure into a user-facing error (§46). */
function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof AnalysisValidationError) return new AppError('ai_invalid_response');
  if (error instanceof AIProviderError) {
    if (error.kind === 'timeout') return new AppError('ai_timeout');
    if (error.kind === 'invalid_response') return new AppError('ai_invalid_response');
    return new AppError('ai_unavailable');
  }
  if (error instanceof StorageError) return new AppError('storage_error');
  if (error instanceof ConfigurationError) return new AppError('configuration_error');
  return new AppError('internal_error');
}
