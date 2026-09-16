/**
 * Database seed.
 *
 * Creates the reference data NOVA needs (sectors, indices, asset catalogue, lessons) and an
 * explicitly labelled demonstration account.
 *
 * Every row that is not reference data carries `isDemo: true`, and the demo user's email makes
 * its nature obvious. Demo and real data are never mixed silently (rule #55).
 */
import { PrismaClient } from '@prisma/client';
import { MARKET_INDICES, SECTORS } from '@nova/config';
import { DEMO_ASSETS, DEMO_INDEX_LEVELS } from '../src/services/market-data/demo-dataset.js';
import { DemoMarketDataProvider } from '../src/services/market-data/providers/demo-market-data.provider.js';
import { DemoNewsProvider } from '../src/services/news/providers/demo-news.provider.js';
import { ScoringService } from '../src/services/news/scoring.service.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { SEED_LESSONS } from './lessons.js';

const prisma = new PrismaClient();
const scoring = new ScoringService();

const DEMO_USER_EMAIL = 'demo@nova.app';
const DEMO_USER_PASSWORD = 'demo-nova-2026';

async function seedSectors() {
  for (const sector of SECTORS) {
    await prisma.sector.upsert({
      where: { key: sector.key },
      create: { key: sector.key, label: sector.label },
      update: { label: sector.label },
    });
  }
  console.log(`✓ ${SECTORS.length} secteurs`);
}

async function seedAssets() {
  for (const asset of DEMO_ASSETS) {
    const sector = await prisma.sector.findUnique({ where: { key: asset.sectorKey } });
    await prisma.asset.upsert({
      where: { symbol: asset.symbol },
      create: {
        symbol: asset.symbol,
        name: asset.name,
        assetType: asset.assetType,
        currency: asset.currency,
        exchange: asset.exchange,
        country: asset.country,
        region: asset.region,
        isin: asset.isin,
        sectorId: sector?.id ?? null,
        isDemo: true,
      },
      update: { sectorId: sector?.id ?? null, name: asset.name },
    });
  }
  console.log(`✓ ${DEMO_ASSETS.length} actifs (données de démonstration)`);
}

async function seedIndices() {
  for (const index of MARKET_INDICES) {
    await prisma.marketIndex.upsert({
      where: { key: index.key },
      create: {
        key: index.key,
        label: index.label,
        currency: index.currency,
        region: index.region,
      },
      update: { label: index.label },
    });
  }
  console.log(`✓ ${MARKET_INDICES.length} indices`);
}

/** Builds 90 days of synthetic price history so charts and day-over-day changes work. */
async function seedPrices() {
  const provider = new DemoMarketDataProvider();
  let written = 0;

  for (const asset of DEMO_ASSETS) {
    const stored = await prisma.asset.findUnique({ where: { symbol: asset.symbol } });
    if (!stored) continue;

    const candles = await provider.getCandles(asset.symbol, '3M');
    for (const candle of candles) {
      await prisma.marketPrice.upsert({
        where: { assetId_timestamp: { assetId: stored.id, timestamp: candle.timestamp } },
        create: {
          assetId: stored.id,
          timestamp: candle.timestamp,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
          isDemo: true,
        },
        update: {},
      });
      written += 1;
    }
  }

  const indices = await prisma.marketIndex.findMany();
  const now = new Date();
  for (const index of indices) {
    const base = DEMO_INDEX_LEVELS[index.key];
    if (base === undefined) continue;
    for (let offset = 5; offset >= 0; offset -= 1) {
      const day = new Date(now.getTime() - offset * 86_400_000);
      const timestamp = new Date(`${day.toISOString().slice(0, 10)}T17:30:00.000Z`);
      const quotes = await provider.getIndexQuotes([index.key]);
      const quote = quotes[0];
      if (!quote) continue;
      await prisma.marketIndexQuote.upsert({
        where: { indexId_timestamp: { indexId: index.id, timestamp } },
        create: {
          indexId: index.id,
          timestamp,
          value: quote.value,
          previousClose: quote.previousClose,
          isDemo: true,
        },
        update: {},
      });
    }
  }

  const rates = await provider.getFxRates(['EUR', 'USD', 'GBP', 'CHF']);
  const fxTimestamp = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
  for (const [currency, rate] of Object.entries(rates)) {
    await prisma.fxRate.upsert({
      where: { currency_timestamp: { currency, timestamp: fxTimestamp } },
      create: { currency, rate, timestamp: fxTimestamp, isDemo: true },
      update: { rate },
    });
  }

  console.log(`✓ ${written} cours (démonstration) + indices + taux de change`);
}

async function seedNews() {
  const provider = new DemoNewsProvider();
  const items = await provider.fetchLatest({ limit: 50 });
  const now = new Date();
  let inserted = 0;

  for (const item of items) {
    const contentHash = scoring.contentHash(item.title, item.source);
    const existing = await prisma.news.findUnique({ where: { contentHash } });
    if (existing) continue;

    const category = scoring.classify(item.title, item.summary, item.category);
    const assets = await prisma.asset.findMany({ where: { symbol: { in: item.symbols } } });
    const themeKeys = scoring.extractThemes(item.title, item.summary, item.body);

    const sectorSensitivity = scoring.sectorsForThemes(themeKeys);
    const directSectorIds = new Set(
      assets.map((asset) => asset.sectorId).filter((id): id is string => Boolean(id)),
    );
    const themeSectors = await prisma.sector.findMany({
      where: { key: { in: Object.keys(sectorSensitivity) } },
    });

    const scored = scoring.score({
      title: item.title,
      summary: item.summary,
      body: item.body,
      source: item.source,
      category,
      publishedAt: item.publishedAt,
      affectedAssetCount: assets.length,
      affectedSectorCount: directSectorIds.size + themeSectors.length,
      now,
    });

    await prisma.news.create({
      data: {
        title: item.title,
        summary: item.summary,
        body: item.body,
        source: item.source,
        sourceUrl: item.sourceUrl,
        externalId: item.externalId,
        contentHash,
        publishedAt: item.publishedAt,
        category,
        language: item.language,
        isDemo: true,
        assets: { create: assets.map((asset) => ({ assetId: asset.id, relevance: 90 })) },
        sectors: {
          create: [
            ...[...directSectorIds].map((sectorId) => ({ sectorId, relevance: 80 })),
            ...themeSectors
              .filter((sector) => !directSectorIds.has(sector.id))
              .map((sector) => ({
                sectorId: sector.id,
                relevance: Math.round((sectorSensitivity[sector.key] ?? 0.5) * 60),
              })),
          ],
        },
        analysis: {
          create: {
            importanceScore: scored.importanceScore,
            confidenceScore: scored.confidenceScore,
            horizon: scored.horizon,
            themeKeys: scored.themeKeys,
            analysis: { rationale: scored.rationale } as never,
            scoringVersion: scored.scoringVersion,
          },
        },
      },
    });
    inserted += 1;
  }
  console.log(`✓ ${inserted} actualités (données de démonstration)`);
}

async function seedLessons() {
  for (const lesson of SEED_LESSONS) {
    await prisma.learningLesson.upsert({
      where: { slug: lesson.slug },
      create: {
        slug: lesson.slug,
        title: lesson.title,
        description: lesson.description,
        content: lesson.content as never,
        difficulty: lesson.difficulty,
        estimatedMinutes: lesson.estimatedMinutes,
        category: lesson.category,
        themeKeys: lesson.themeKeys,
        orderIndex: lesson.orderIndex,
      },
      update: {
        title: lesson.title,
        description: lesson.description,
        content: lesson.content as never,
        themeKeys: lesson.themeKeys,
        orderIndex: lesson.orderIndex,
      },
    });
  }
  console.log(`✓ ${SEED_LESSONS.length} leçons`);
}

async function seedDemoUser() {
  const passwordHash = await hashPassword(DEMO_USER_PASSWORD);

  const user = await prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    create: {
      email: DEMO_USER_EMAIL,
      passwordHash,
      firstName: 'Camille',
      acceptedTermsAt: new Date(),
      onboardingCompletedAt: new Date(),
      notificationPreference: { create: {} },
      subscription: { create: { plan: 'free', status: 'active', provider: 'none' } },
      investorProfile: {
        create: {
          investmentGoal: 'build_wealth',
          investmentHorizon: 'ten_to_20_years',
          experienceLevel: 'beginner',
          riskTolerance: 'cautious',
          knowledgeLevel: 'beginner',
          interestedAssetTypes: ['stock', 'etf', 'crypto'],
        },
      },
    },
    update: { passwordHash },
  });

  const portfolio = await prisma.portfolio.upsert({
    where: {
      id:
        (await prisma.portfolio.findFirst({ where: { userId: user.id } }))?.id ??
        '00000000-0000-0000-0000-000000000000',
    },
    create: {
      userId: user.id,
      name: 'Portefeuille de démonstration',
      baseCurrency: 'EUR',
      isDefault: true,
    },
    update: {},
  });

  const positions = [
    { symbol: 'CW8.PA', quantity: 12, averagePrice: 442 },
    { symbol: 'AAPL', quantity: 8, averagePrice: 198, currency: 'USD' },
    { symbol: 'MC.PA', quantity: 2, averagePrice: 690 },
    { symbol: 'TTE.PA', quantity: 25, averagePrice: 58 },
    { symbol: 'OBLI.PA', quantity: 6, averagePrice: 180 },
    { symbol: 'BTC-EUR', quantity: 0.05, averagePrice: 51000 },
  ];

  for (const position of positions) {
    const asset = await prisma.asset.findUnique({ where: { symbol: position.symbol } });
    if (!asset) continue;
    await prisma.position.upsert({
      where: { portfolioId_assetId: { portfolioId: portfolio.id, assetId: asset.id } },
      create: {
        portfolioId: portfolio.id,
        assetId: asset.id,
        quantity: position.quantity,
        averagePrice: position.averagePrice,
        currency: position.currency ?? asset.currency,
      },
      update: {},
    });
  }

  const existingJournal = await prisma.journalEntry.count({ where: { userId: user.id } });
  if (existingJournal === 0) {
    const asset = await prisma.asset.findUnique({ where: { symbol: 'CW8.PA' } });
    await prisma.journalEntry.create({
      data: {
        userId: user.id,
        portfolioId: portfolio.id,
        assetId: asset?.id ?? null,
        action: 'buy',
        quantity: 12,
        price: 442,
        currency: 'EUR',
        reason:
          'Je commence par un ETF World pour être diversifié sans avoir à choisir des entreprises une par une. Horizon long, je ne compte pas y toucher.',
        horizon: 'ten_to_20_years',
        conviction: 'high',
        occurredAt: new Date(Date.now() - 200 * 86_400_000),
      },
    });
  }

  console.log(`✓ compte de démonstration : ${DEMO_USER_EMAIL} / ${DEMO_USER_PASSWORD}`);
  return user;
}

async function main() {
  console.log('Seed NOVA — données de référence + démonstration\n');
  await seedSectors();
  await seedIndices();
  await seedAssets();
  await seedPrices();
  await seedNews();
  await seedLessons();
  await seedDemoUser();
  console.log(
    '\nSeed terminé. Les données de marché et d’actualité sont des DONNÉES DE DÉMONSTRATION.',
  );
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
