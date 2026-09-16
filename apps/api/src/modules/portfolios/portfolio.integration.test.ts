import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  closeTestContext,
  createTestContext,
  registerUser,
  resetUserData,
  type RegisteredUser,
  type TestContext,
} from '../../testing/harness.js';

describe('portfolios and positions', () => {
  let context: TestContext;
  let app: FastifyInstance;
  let user: RegisteredUser;
  let portfolioId: string;

  beforeAll(async () => {
    context = await createTestContext();
    app = context.app;
  });

  beforeEach(async () => {
    await resetUserData(context.db);
    context.cache.close();
    user = await registerUser(app);
    const created = await app.inject({
      method: 'POST',
      url: '/v1/portfolios',
      headers: user.authHeader,
      payload: { name: 'Mon portefeuille', baseCurrency: 'EUR' },
    });
    portfolioId = created.json().id;
  });

  afterAll(async () => {
    await closeTestContext();
  });

  const addPosition = (payload: Record<string, unknown>, as: RegisteredUser = user) =>
    app.inject({
      method: 'POST',
      url: `/v1/portfolios/${portfolioId}/positions`,
      headers: as.authHeader,
      payload,
    });

  it('creates a portfolio marked as the default one', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/portfolios',
      headers: user.authHeader,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().items).toHaveLength(1);
    expect(response.json().items[0].isDefault).toBe(true);
  });

  it('adds a position from a symbol and values it server-side', async () => {
    const created = await addPosition({ symbol: 'CW8.PA', quantity: 10, averagePrice: 440 });
    expect(created.statusCode).toBe(201);

    const detail = await app.inject({
      method: 'GET',
      url: `/v1/portfolios/${portfolioId}`,
      headers: user.authHeader,
    });
    const body = detail.json();

    expect(body.positions).toHaveLength(1);
    expect(body.positions[0].asset.symbol).toBe('CW8.PA');
    expect(body.positions[0].marketValue).toBeGreaterThan(0);
    expect(body.analytics.totalValue).toBeGreaterThan(0);
    // Demo prices must be flagged all the way to the API response.
    expect(body.analytics.meta.isDemo).toBe(true);
    expect(body.analytics.meta.asOf).toBeTruthy();
  });

  it('converts a foreign-currency position into the base currency', async () => {
    await addPosition({ symbol: 'AAPL', quantity: 10, averagePrice: 200, currency: 'USD' });

    const detail = await app.inject({
      method: 'GET',
      url: `/v1/portfolios/${portfolioId}`,
      headers: user.authHeader,
    });
    const position = detail.json().positions[0];

    expect(position.currency).toBe('USD');
    // 10 × ~200 USD ≈ 2 000 USD → clearly below that once converted at ~0.92.
    expect(position.costBasis).toBeLessThan(2000);
    expect(
      detail.json().analytics.byCurrency.some((slice: { key: string }) => slice.key === 'USD'),
    ).toBe(true);
  });

  it('computes allocation, sector and region breakdowns that sum to 100 %', async () => {
    await addPosition({ symbol: 'CW8.PA', quantity: 10, averagePrice: 440 });
    await addPosition({ symbol: 'AAPL', quantity: 5, averagePrice: 200, currency: 'USD' });
    await addPosition({ symbol: 'TTE.PA', quantity: 20, averagePrice: 58 });

    const detail = await app.inject({
      method: 'GET',
      url: `/v1/portfolios/${portfolioId}`,
      headers: user.authHeader,
    });
    const analytics = detail.json().analytics;

    const total = (slices: { percent: number }[]) =>
      slices.reduce((sum, slice) => sum + slice.percent, 0);

    expect(total(analytics.byAssetType)).toBeCloseTo(100, 0);
    expect(total(analytics.bySector)).toBeCloseTo(100, 0);
    expect(total(analytics.byRegion)).toBeCloseTo(100, 0);
    expect(analytics.concentration.positionCount).toBe(3);
  });

  it('exposes theme exposure derived from sector weights', async () => {
    await addPosition({ symbol: 'AAPL', quantity: 10, averagePrice: 200, currency: 'USD' });

    const exposure = await app.inject({
      method: 'GET',
      url: `/v1/portfolios/${portfolioId}/exposure`,
      headers: user.authHeader,
    });

    expect(exposure.statusCode).toBe(200);
    const body = exposure.json();
    expect(body.bySector.technology).toBeCloseTo(100, 0);
    expect(body.byTheme.technology).toBeGreaterThan(0);
    expect(body.weightsBySymbol['AAPL']).toBeCloseTo(100, 0);
  });

  it('records a position on an unknown symbol without inventing a price', async () => {
    const created = await addPosition({ symbol: 'INCONNU.XX', quantity: 3, averagePrice: 50 });
    expect(created.statusCode).toBe(201);

    const detail = await app.inject({
      method: 'GET',
      url: `/v1/portfolios/${portfolioId}`,
      headers: user.authHeader,
    });
    const position = detail.json().positions[0];

    expect(position.lastPrice).toBeNull();
    expect(position.marketValue).toBeNull();
    expect(detail.json().analytics.unvaluedPercent).toBeGreaterThan(0);
  });

  it('rejects a duplicate position on the same asset', async () => {
    await addPosition({ symbol: 'CW8.PA', quantity: 10, averagePrice: 440 });
    const duplicate = await addPosition({ symbol: 'CW8.PA', quantity: 5, averagePrice: 450 });
    expect(duplicate.statusCode).toBe(409);
  });

  it('rejects invalid quantities and prices', async () => {
    expect(
      (await addPosition({ symbol: 'CW8.PA', quantity: 0, averagePrice: 440 })).statusCode,
    ).toBe(400);
    expect(
      (await addPosition({ symbol: 'CW8.PA', quantity: -1, averagePrice: 440 })).statusCode,
    ).toBe(400);
    expect(
      (await addPosition({ symbol: 'CW8.PA', quantity: 1, averagePrice: -5 })).statusCode,
    ).toBe(400);
    expect(
      (await addPosition({ symbol: 'CW8.PA', quantity: 'abc', averagePrice: 1 })).statusCode,
    ).toBe(400);
  });

  it('updates and deletes a position', async () => {
    const created = await addPosition({ symbol: 'CW8.PA', quantity: 10, averagePrice: 440 });
    const positionId = created.json().id;

    const updated = await app.inject({
      method: 'PATCH',
      url: `/v1/positions/${positionId}`,
      headers: user.authHeader,
      payload: { quantity: 12 },
    });
    expect(updated.statusCode).toBe(200);
    expect(Number(updated.json().quantity)).toBe(12);

    const removed = await app.inject({
      method: 'DELETE',
      url: `/v1/positions/${positionId}`,
      headers: user.authHeader,
    });
    expect(removed.statusCode).toBe(204);

    const positions = await app.inject({
      method: 'GET',
      url: `/v1/portfolios/${portfolioId}/positions`,
      headers: user.authHeader,
    });
    expect(positions.json().items).toHaveLength(0);
  });

  it('handles an empty portfolio without dividing by zero', async () => {
    const detail = await app.inject({
      method: 'GET',
      url: `/v1/portfolios/${portfolioId}`,
      headers: user.authHeader,
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().analytics.totalValue).toBe(0);
    expect(detail.json().analytics.totalUnrealizedGainPercent).toBe(0);
    expect(detail.json().positions).toEqual([]);
  });

  describe('authorisation', () => {
    it('refuses access to another user’s portfolio', async () => {
      const intruder = await registerUser(app);

      const read = await app.inject({
        method: 'GET',
        url: `/v1/portfolios/${portfolioId}`,
        headers: intruder.authHeader,
      });
      expect(read.statusCode).toBe(403);

      const write = await addPosition({ symbol: 'CW8.PA', quantity: 1, averagePrice: 1 }, intruder);
      expect(write.statusCode).toBe(403);

      const remove = await app.inject({
        method: 'DELETE',
        url: `/v1/portfolios/${portfolioId}`,
        headers: intruder.authHeader,
      });
      expect(remove.statusCode).toBe(403);
    });

    it('refuses to act on another user’s position', async () => {
      const created = await addPosition({ symbol: 'CW8.PA', quantity: 10, averagePrice: 440 });
      const positionId = created.json().id;
      const intruder = await registerUser(app);

      const patched = await app.inject({
        method: 'PATCH',
        url: `/v1/positions/${positionId}`,
        headers: intruder.authHeader,
        payload: { quantity: 999 },
      });
      expect(patched.statusCode).toBe(403);

      const stored = await context.db.position.findUnique({ where: { id: positionId } });
      expect(Number(stored?.quantity)).toBe(10);
    });

    it('ignores a userId supplied in the body', async () => {
      const intruder = await registerUser(app);
      // Passing the victim's id must change nothing: identity comes from the token.
      const response = await app.inject({
        method: 'POST',
        url: '/v1/portfolios',
        headers: intruder.authHeader,
        payload: { name: 'Injection', baseCurrency: 'EUR', userId: user.id },
      });
      expect(response.statusCode).toBe(201);

      const stored = await context.db.portfolio.findUnique({ where: { id: response.json().id } });
      expect(stored?.userId).toBe(intruder.id);
    });

    it('requires authentication', async () => {
      expect((await app.inject({ method: 'GET', url: '/v1/portfolios' })).statusCode).toBe(401);
    });

    it('enforces the plan portfolio limit', async () => {
      // The free plan allows a single portfolio.
      const second = await app.inject({
        method: 'POST',
        url: '/v1/portfolios',
        headers: user.authHeader,
        payload: { name: 'Deuxième', baseCurrency: 'EUR' },
      });
      expect(second.statusCode).toBe(409);
    });
  });
});
