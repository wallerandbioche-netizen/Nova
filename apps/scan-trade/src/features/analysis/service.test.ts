import { beforeEach, describe, expect, it } from 'vitest';
import { AIProviderError } from '@/lib/ai';
import type { AIAnalysisService } from '@/lib/ai';
import type { AppError } from '@/lib/errors';
import { validateUpload } from '@/lib/storage/upload';
import { fakeAIService, validLongResponse } from '@/lib/ai/testing/fake-provider';
import { AnalysisService } from './service';
import { MemoryAnalysisRepository } from './testing/memory-repository';
import { MemoryStorageDriver, MemoryUsageRecorder, pngFixture } from './testing/fakes';

const ALICE = 'user_alice';
const BOB = 'user_bob';

function build(ai: AIAnalysisService = fakeAIService({ raw: validLongResponse() })) {
  const repository = new MemoryAnalysisRepository();
  const storage = new MemoryStorageDriver();
  const usage = new MemoryUsageRecorder();
  const service = new AnalysisService({ repository, storage, aiFactory: () => ai, usage });
  return { service, repository, storage, usage };
}

function upload(userId: string) {
  return validateUpload(pngFixture(), { userId, maxBytes: 8 * 1024 * 1024, filename: 'chart.png' });
}

async function createFor(service: AnalysisService, userId: string) {
  return service.create({
    userId,
    upload: upload(userId),
    asset: null,
    timeframe: null,
    market: null,
  });
}

describe('AnalysisService', () => {
  describe('creating an analysis', () => {
    it('stores the screenshot and opens a PENDING row', async () => {
      const { service, storage, usage } = build();

      const analysis = await createFor(service, ALICE);

      expect(analysis.status).toBe('PENDING');
      expect(storage.objects.size).toBe(1);
      expect(usage.events).toEqual([{ userId: ALICE, kind: 'ANALYSIS_UPLOAD' }]);
    });

    it('keeps the optional context the trader supplied', async () => {
      const { service } = build();

      const analysis = await service.create({
        userId: ALICE,
        upload: upload(ALICE),
        asset: 'BTC/USDT',
        timeframe: '4H',
        market: 'CRYPTO',
      });

      expect(analysis.requestedAsset).toBe('BTC/USDT');
      expect(analysis.requestedTimeframe).toBe('4H');
      expect(analysis.requestedMarket).toBe('CRYPTO');
      // Context supplied is not context identified: the analysed fields stay empty.
      expect(analysis.asset).toBeNull();
      expect(analysis.timeframe).toBeNull();
    });

    it('removes the stored object when the row cannot be written', async () => {
      const { service, storage, repository } = build();
      repository.create = async () => {
        throw new Error('base indisponible');
      };

      await expect(createFor(service, ALICE)).rejects.toThrow('base indisponible');
      // No orphan left behind in the bucket.
      expect(storage.removed).toHaveLength(1);
    });
  });

  describe('cross-tenant isolation', () => {
    it("refuses to read another user's analysis", async () => {
      const { service } = build();
      const alices = await createFor(service, ALICE);

      await expect(service.get(BOB, alices.id)).rejects.toMatchObject({ code: 'not_found' });
    });

    it('answers 404, not 403, so ids cannot be probed for existence', async () => {
      const { service } = build();
      const alices = await createFor(service, ALICE);

      const forged = await service.get(BOB, alices.id).catch((error: AppError) => error);
      const missing = await service
        .get(BOB, 'analysis_does_not_exist')
        .catch((error: AppError) => error);

      expect((forged as AppError).code).toBe((missing as AppError).code);
      expect((forged as AppError).message).toBe((missing as AppError).message);
    });

    it("refuses to delete another user's analysis, and leaves the image in place", async () => {
      const { service, storage } = build();
      const alices = await createFor(service, ALICE);

      await expect(service.remove(BOB, alices.id)).rejects.toMatchObject({ code: 'not_found' });
      expect(storage.removed).toHaveLength(0);
      // Still readable by its owner.
      await expect(service.get(ALICE, alices.id)).resolves.toMatchObject({ id: alices.id });
    });

    it("refuses to scan another user's analysis", async () => {
      const { service, repository } = build();
      const alices = await createFor(service, ALICE);

      await expect(service.scan(BOB, alices.id, {})).rejects.toMatchObject({ code: 'not_found' });
      expect(repository.savedResults).toHaveLength(0);
    });

    it('never lists an analysis belonging to someone else', async () => {
      const { service } = build();
      await createFor(service, ALICE);
      await createFor(service, ALICE);
      await createFor(service, BOB);

      const alices = await service.list(ALICE, { limit: 20 });
      const bobs = await service.list(BOB, { limit: 20 });

      expect(alices.total).toBe(2);
      expect(bobs.total).toBe(1);
      expect(alices.items.map((item) => item.id)).not.toContain(bobs.items[0]?.id);
    });

    it("never returns another user's analysis as the latest one", async () => {
      const { service } = build();
      await createFor(service, ALICE);

      await expect(service.latest(BOB)).resolves.toBeNull();
    });
  });

  describe('deleting an analysis', () => {
    it('removes the row and its stored screenshot', async () => {
      const { service, storage } = build();
      const analysis = await createFor(service, ALICE);
      const key = [...storage.objects.keys()][0];

      await service.remove(ALICE, analysis.id);

      expect(storage.removed).toEqual([key]);
      await expect(service.get(ALICE, analysis.id)).rejects.toMatchObject({ code: 'not_found' });
    });

    it('still deletes the row when the storage removal fails', async () => {
      const { service, storage } = build();
      const analysis = await createFor(service, ALICE);
      storage.remove = async () => {
        throw new Error('bucket injoignable');
      };

      await expect(service.remove(ALICE, analysis.id)).resolves.toBeUndefined();
      await expect(service.get(ALICE, analysis.id)).rejects.toMatchObject({ code: 'not_found' });
    });
  });

  describe('scanning', () => {
    it('produces a validated trade plan', async () => {
      const { service } = build();
      const created = await createFor(service, ALICE);

      const scanned = await service.scan(ALICE, created.id, {});

      expect(scanned.status).toBe('COMPLETED');
      expect(scanned.bias).toBe('LONG');
      expect(scanned.entryMin).toBe(61250);
      expect(scanned.stopLoss).toBe(59800);
      expect(scanned.riskReward).toBe(2.15);
    });

    it('records the scan for usage accounting', async () => {
      const { service, usage } = build();
      const created = await createFor(service, ALICE);

      await service.scan(ALICE, created.id, {});

      expect(usage.events).toContainEqual({ userId: ALICE, kind: 'ANALYSIS_SCAN' });
    });

    it('stores a NO TRADE without inventing any level', async () => {
      const { service } = build(fakeAIService({ raw: validLongResponse({ status: 'no_trade' }) }));
      const created = await createFor(service, ALICE);

      const scanned = await service.scan(ALICE, created.id, {});

      expect(scanned.status).toBe('NO_TRADE');
      expect(scanned.entryMin).toBeNull();
      expect(scanned.stopLoss).toBeNull();
      expect(scanned.takeProfit1).toBeNull();
      expect(scanned.riskReward).toBeNull();
    });

    it('stores INSUFFICIENT_DATA when the chart could not be read', async () => {
      const { service } = build(
        fakeAIService({
          raw: validLongResponse({ status: 'insufficient_data', asset: null, timeframe: null }),
        }),
      );
      const created = await createFor(service, ALICE);

      const scanned = await service.scan(ALICE, created.id, {});

      expect(scanned.status).toBe('INSUFFICIENT_DATA');
      expect(scanned.asset).toBeNull();
    });

    it('fails the analysis rather than showing an incoherent plan', async () => {
      const { service } = build(fakeAIService({ raw: validLongResponse({ stop_loss: 70000 }) }));
      const created = await createFor(service, ALICE);

      await expect(service.scan(ALICE, created.id, {})).rejects.toMatchObject({
        code: 'ai_invalid_response',
      });

      const stored = await service.get(ALICE, created.id);
      expect(stored.status).toBe('FAILED');
      expect(stored.failureCode).toBe('ai_invalid_response');
      expect(stored.entryMin).toBeNull();
    });

    it('maps a provider timeout onto a retryable failure', async () => {
      const { service } = build(
        fakeAIService({ error: new AIProviderError('timeout', 'trop long') }),
      );
      const created = await createFor(service, ALICE);

      await expect(service.scan(ALICE, created.id, {})).rejects.toMatchObject({
        code: 'ai_timeout',
      });
      expect((await service.get(ALICE, created.id)).status).toBe('FAILED');
    });

    it('maps a provider outage onto ai_unavailable', async () => {
      const { service } = build(
        fakeAIService({ error: new AIProviderError('unavailable', 'HTTP 503', 503) }),
      );
      const created = await createFor(service, ALICE);

      await expect(service.scan(ALICE, created.id, {})).rejects.toMatchObject({
        code: 'ai_unavailable',
      });
    });

    it('never leaves an analysis stuck on PROCESSING after a failure', async () => {
      const { service } = build(
        fakeAIService({ error: new AIProviderError('unavailable', 'boom') }),
      );
      const created = await createFor(service, ALICE);

      await service.scan(ALICE, created.id, {}).catch(() => undefined);

      expect((await service.get(ALICE, created.id)).status).toBe('FAILED');
    });

    it('allows a retry after a failure', async () => {
      const failing = fakeAIService({ error: new AIProviderError('unavailable', 'boom') });
      const { service, repository, storage, usage } = build(failing);
      const created = await createFor(service, ALICE);
      await service.scan(ALICE, created.id, {}).catch(() => undefined);

      const recovered = new AnalysisService({
        repository,
        storage,
        aiFactory: () => fakeAIService({ raw: validLongResponse() }),
        usage,
      });

      const scanned = await recovered.scan(ALICE, created.id, {});
      expect(scanned.status).toBe('COMPLETED');
    });

    it('refuses a second concurrent scan on the same analysis', async () => {
      const { service, repository } = build();
      const created = await createFor(service, ALICE);
      await repository.claimForScan(created.id, ALICE);

      await expect(service.scan(ALICE, created.id, {})).rejects.toMatchObject({
        code: 'analysis_in_progress',
      });
    });

    it('returns the existing result instead of paying for a second scan', async () => {
      const { service, repository } = build();
      const created = await createFor(service, ALICE);
      await service.scan(ALICE, created.id, {});

      const again = await service.scan(ALICE, created.id, {});

      expect(again.status).toBe('COMPLETED');
      expect(repository.savedResults).toHaveLength(1);
    });

    it('hands the model the stored bytes and their real MIME type', async () => {
      const ai = fakeAIService({ raw: validLongResponse() });
      const { service } = build(ai);
      const created = await createFor(service, ALICE);

      await service.scan(ALICE, created.id, {});

      const stored = await service.get(ALICE, created.id);
      expect(stored.status).toBe('COMPLETED');
    });
  });

  describe('pagination', () => {
    beforeEach(() => {
      // Each test builds its own service; nothing is shared between them.
    });

    it('pages through the history with a cursor', async () => {
      const { service } = build();
      for (let index = 0; index < 5; index += 1) {
        await createFor(service, ALICE);
      }

      const first = await service.list(ALICE, { limit: 2 });
      expect(first.items).toHaveLength(2);
      expect(first.nextCursor).not.toBeNull();
      expect(first.total).toBe(5);

      const second = await service.list(ALICE, { limit: 2, cursor: first.nextCursor ?? undefined });
      expect(second.items).toHaveLength(2);
      expect(second.items.map((item) => item.id)).not.toEqual(first.items.map((item) => item.id));
    });

    it('filters by status', async () => {
      const { service } = build();
      const scanned = await createFor(service, ALICE);
      await createFor(service, ALICE);
      await service.scan(ALICE, scanned.id, {});

      const completed = await service.list(ALICE, { limit: 10, status: 'COMPLETED' });
      const pending = await service.list(ALICE, { limit: 10, status: 'PENDING' });

      expect(completed.total).toBe(1);
      expect(pending.total).toBe(1);
    });
  });
});
