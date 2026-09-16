import type { JournalEntry, JournalLookback } from '@nova/types';
import type { CreateJournalEntryInput } from '@nova/validation';
import { percentChange, round } from '@nova/finance';
import {
  toNullableNumber,
  type Database,
  type Prisma,
} from '../../infrastructure/database/prisma.js';
import { notFound } from '../../http/errors.js';
import { assertOwnership } from '../../http/plugins/authenticate.js';
import { buildPage, decodeCursor, type PageResult } from '../../http/pagination.js';
import type { MarketDataService } from '../../services/market-data/market-data.service.js';
import type { AssetService } from '../assets/asset.service.js';

/**
 * Investment journal.
 *
 * The purpose is discipline and learning, not scoring: a look-back shows what the user thought
 * at the time and, when a price is known, the factual change since — with no judgement and no
 * "you were right / wrong" framing (rule #19).
 */
export class JournalService {
  constructor(
    private readonly db: Database,
    private readonly marketData: MarketDataService,
    private readonly assets: AssetService,
  ) {}

  private toDto(row: JournalRow): JournalEntry {
    return {
      id: row.id,
      portfolioId: row.portfolioId,
      asset: row.asset ? this.assets.toDto(row.asset) : null,
      action: row.action as JournalEntry['action'],
      quantity: toNullableNumber(row.quantity),
      price: toNullableNumber(row.price),
      currency: row.currency,
      reason: row.reason,
      horizon: row.horizon ? mapHorizon(row.horizon) : null,
      conviction: row.conviction as JournalEntry['conviction'],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async list(
    userId: string,
    options: { limit: number; cursor?: string },
  ): Promise<PageResult<JournalEntry>> {
    const cursor = decodeCursor(options.cursor);
    const rows = await this.db.journalEntry.findMany({
      where: {
        userId,
        ...(cursor ? { createdAt: { lt: new Date(cursor.timestamp) } } : {}),
      },
      include: { asset: { include: { sector: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: options.limit + 1,
    });

    const page = buildPage(rows, options.limit, (row) => ({
      timestamp: row.createdAt.toISOString(),
      id: row.id,
    }));
    return { ...page, items: page.items.map((row) => this.toDto(row as JournalRow)) };
  }

  async create(userId: string, input: CreateJournalEntryInput): Promise<JournalEntry> {
    if (input.portfolioId) {
      const portfolio = await this.db.portfolio.findUnique({ where: { id: input.portfolioId } });
      if (!portfolio) throw notFound('Portefeuille introuvable');
      assertOwnership(portfolio.userId, userId);
    }

    const row = await this.db.journalEntry.create({
      data: {
        userId,
        portfolioId: input.portfolioId ?? null,
        assetId: input.assetId ?? null,
        action: input.action,
        quantity: input.quantity ?? null,
        price: input.price ?? null,
        currency: input.currency ?? null,
        reason: input.reason,
        horizon: input.horizon ? mapHorizonToDb(input.horizon) : null,
        conviction: input.conviction ?? null,
        occurredAt: input.occurredAt ?? new Date(),
      },
      include: { asset: { include: { sector: true } } },
    });
    return this.toDto(row as JournalRow);
  }

  private async getOwned(entryId: string, userId: string) {
    const entry = await this.db.journalEntry.findUnique({
      where: { id: entryId },
      include: { asset: { include: { sector: true } } },
    });
    if (!entry) throw notFound('Entrée de journal introuvable');
    assertOwnership(entry.userId, userId);
    return entry;
  }

  async getById(entryId: string, userId: string): Promise<JournalLookback> {
    const entry = await this.getOwned(entryId, userId);
    const dto = this.toDto(entry as JournalRow);

    const monthsElapsed = Math.max(
      0,
      Math.floor((Date.now() - entry.occurredAt.getTime()) / (30 * 86_400_000)),
    );

    let priceNow: number | null = null;
    let priceAsOf: string | null = null;
    if (entry.asset) {
      const quotes = await this.marketData.getQuotes([entry.asset.symbol]);
      const quote = quotes.get(entry.asset.symbol);
      priceNow = quote?.price ?? null;
      priceAsOf = quote?.asOf.toISOString() ?? null;
    }

    const priceThen = toNullableNumber(entry.price);
    const changePercent =
      priceThen !== null && priceNow !== null ? percentChange(priceNow, priceThen) : null;

    return {
      entry: dto,
      monthsElapsed,
      prompt:
        monthsElapsed >= 6
          ? 'Voici ce que vous pensiez au moment de votre décision.'
          : 'Votre note au moment de la décision.',
      priceThen,
      priceNow,
      priceChangePercent: changePercent === null ? null : round(changePercent, 2),
      priceAsOf,
    };
  }

  async update(
    entryId: string,
    userId: string,
    input: Partial<CreateJournalEntryInput>,
  ): Promise<JournalEntry> {
    await this.getOwned(entryId, userId);
    const row = await this.db.journalEntry.update({
      where: { id: entryId },
      data: {
        ...(input.action ? { action: input.action } : {}),
        ...(input.reason ? { reason: input.reason } : {}),
        ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.horizon ? { horizon: mapHorizonToDb(input.horizon) } : {}),
        ...(input.conviction ? { conviction: input.conviction } : {}),
        ...(input.assetId !== undefined ? { assetId: input.assetId } : {}),
      },
      include: { asset: { include: { sector: true } } },
    });
    return this.toDto(row as JournalRow);
  }

  async remove(entryId: string, userId: string): Promise<void> {
    await this.getOwned(entryId, userId);
    await this.db.journalEntry.delete({ where: { id: entryId } });
  }

  /** Entries worth revisiting: at least six months old and not yet revisited. */
  async listLookbacks(userId: string, limit = 3): Promise<JournalLookback[]> {
    const sixMonthsAgo = new Date(Date.now() - 182 * 86_400_000);
    const entries = await this.db.journalEntry.findMany({
      where: { userId, occurredAt: { lte: sixMonthsAgo } },
      orderBy: { occurredAt: 'desc' },
      take: limit,
      select: { id: true },
    });
    return Promise.all(entries.map((entry) => this.getById(entry.id, userId)));
  }
}

const HORIZON_TO_API = {
  under_2_years: 'under_2_years',
  two_to_5_years: '2_to_5_years',
  five_to_10_years: '5_to_10_years',
  ten_to_20_years: '10_to_20_years',
  over_20_years: 'over_20_years',
} as const;

const HORIZON_TO_DB = {
  under_2_years: 'under_2_years',
  '2_to_5_years': 'two_to_5_years',
  '5_to_10_years': 'five_to_10_years',
  '10_to_20_years': 'ten_to_20_years',
  over_20_years: 'over_20_years',
} as const;

function mapHorizon(value: string): JournalEntry['horizon'] {
  return (HORIZON_TO_API[value as keyof typeof HORIZON_TO_API] ?? null) as JournalEntry['horizon'];
}

function mapHorizonToDb(value: string) {
  return HORIZON_TO_DB[value as keyof typeof HORIZON_TO_DB] as never;
}

type JournalRow = {
  id: string;
  portfolioId: string | null;
  asset: Parameters<AssetService['toDto']>[0] | null;
  action: string;
  quantity: Prisma.Decimal | null;
  price: Prisma.Decimal | null;
  currency: string | null;
  reason: string;
  horizon: string | null;
  conviction: string | null;
  createdAt: Date;
  updatedAt: Date;
};
