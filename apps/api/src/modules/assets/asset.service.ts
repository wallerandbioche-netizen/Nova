import type { Asset, AssetType, Region } from '@nova/types';
import { SECTOR_LABELS } from '@nova/config';
import type { Database } from '../../infrastructure/database/prisma.js';
import { notFound } from '../../http/errors.js';
import { buildPage, decodeCursor, encodeCursor, type PageResult } from '../../http/pagination.js';
import { findDemoAsset } from '../../services/market-data/demo-dataset.js';

type AssetRow = Awaited<ReturnType<Database['asset']['findFirst']>>;

/**
 * Asset catalogue.
 *
 * Symbols typed by a user are resolved here: an unknown symbol becomes a placeholder asset
 * flagged as demo-less (no price), so the position is recorded but never shown with an
 * invented valuation.
 */
export class AssetService {
  constructor(private readonly db: Database) {}

  toDto(
    asset: NonNullable<AssetRow> & { sector?: { id: string; key: string; label: string } | null },
  ): Asset {
    return {
      id: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      assetType: asset.assetType as AssetType,
      exchange: asset.exchange,
      currency: asset.currency as Asset['currency'],
      country: asset.country,
      region: asset.region as Region,
      sector: asset.sector
        ? { id: asset.sector.id, key: asset.sector.key, label: asset.sector.label }
        : null,
      isin: asset.isin,
      isDemo: asset.isDemo,
    };
  }

  async getById(id: string): Promise<Asset> {
    const asset = await this.db.asset.findUnique({ where: { id }, include: { sector: true } });
    if (!asset) throw notFound('Actif introuvable');
    return this.toDto(asset);
  }

  async findBySymbol(symbol: string): Promise<Asset | null> {
    const asset = await this.db.asset.findUnique({
      where: { symbol: symbol.toUpperCase() },
      include: { sector: true },
    });
    return asset ? this.toDto(asset) : null;
  }

  async search(options: {
    query?: string;
    type?: string;
    limit: number;
    cursor?: string;
  }): Promise<PageResult<Asset>> {
    const cursor = decodeCursor(options.cursor);
    const rows = await this.db.asset.findMany({
      where: {
        ...(options.query
          ? {
              OR: [
                { symbol: { contains: options.query.toUpperCase() } },
                { name: { contains: options.query, mode: 'insensitive' as const } },
                { isin: { equals: options.query.toUpperCase() } },
              ],
            }
          : {}),
        ...(options.type ? { assetType: options.type as never } : {}),
        ...(cursor ? { name: { gt: cursor.id } } : {}),
      },
      include: { sector: true },
      orderBy: { name: 'asc' },
      take: options.limit + 1,
    });

    const page = buildPage(rows, options.limit, (row) => ({
      timestamp: row.createdAt.toISOString(),
      id: row.name,
    }));

    return { ...page, items: page.items.map((row) => this.toDto(row)) };
  }

  /**
   * Resolves a user-typed symbol into a stored asset, creating a minimal record when the
   * symbol is unknown to the catalogue. The created asset carries no price, and the portfolio
   * screen reports the line as "valorisation indisponible" rather than inventing one.
   */
  async resolveOrCreateBySymbol(
    symbol: string,
    fallback: { name?: string; currency?: string } = {},
  ): Promise<Asset> {
    const normalized = symbol.trim().toUpperCase();
    const existing = await this.findBySymbol(normalized);
    if (existing) return existing;

    const demo = findDemoAsset(normalized);
    const sectorKey = demo?.sectorKey ?? 'diversified';
    const sector = await this.db.sector.findUnique({ where: { key: sectorKey } });

    const created = await this.db.asset.create({
      data: {
        symbol: normalized,
        name: demo?.name ?? fallback.name?.trim() ?? normalized,
        assetType: (demo?.assetType ?? 'stock') as never,
        currency: demo?.currency ?? fallback.currency ?? 'EUR',
        exchange: demo?.exchange ?? null,
        country: demo?.country ?? null,
        region: (demo?.region ?? 'other') as never,
        isin: demo?.isin ?? null,
        sectorId: sector?.id ?? null,
        isDemo: Boolean(demo),
      },
      include: { sector: true },
    });

    return this.toDto(created);
  }

  async listSectors() {
    const sectors = await this.db.sector.findMany({ orderBy: { label: 'asc' } });
    return sectors.map((sector) => ({
      id: sector.id,
      key: sector.key,
      label: sector.label || SECTOR_LABELS[sector.key] || sector.key,
    }));
  }

  /** Cursor helper reused by other modules that page over assets. */
  static cursorFor(name: string, createdAt: Date): string {
    return encodeCursor({ timestamp: createdAt.toISOString(), id: name });
  }
}
