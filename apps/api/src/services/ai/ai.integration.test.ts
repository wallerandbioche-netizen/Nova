import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  closeTestContext,
  completeOnboarding,
  createTestContext,
  registerUser,
  resetUserData,
  type RegisteredUser,
  type TestContext,
} from '../../testing/harness.js';

describe('news, analysis and AI coach', () => {
  let context: TestContext;
  let app: FastifyInstance;
  let user: RegisteredUser;

  beforeAll(async () => {
    context = await createTestContext();
    app = context.app;
  });

  beforeEach(async () => {
    await resetUserData(context.db);
    user = await registerUser(app);
    await completeOnboarding(app, user);
  });

  afterAll(async () => {
    await closeTestContext();
  });

  const firstNewsId = async (): Promise<string> => {
    const feed = await app.inject({
      method: 'GET',
      url: '/v1/news?limit=10',
      headers: user.authHeader,
    });
    return feed.json().items[0].id;
  };

  describe('GET /news', () => {
    it('returns scored, sourced items', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/news?limit=5',
        headers: user.authHeader,
      });

      expect(response.statusCode).toBe(200);
      const items = response.json().items;
      expect(items.length).toBeGreaterThan(0);

      for (const item of items) {
        expect(item.source).toBeTruthy();
        expect(item.publishedAt).toBeTruthy();
        expect(item.importanceScore).toBeGreaterThanOrEqual(0);
        expect(item.importanceScore).toBeLessThanOrEqual(100);
        // Demo corpus must be labelled as such.
        expect(item.isDemo).toBe(true);
      }
    });

    it('ranks personally relevant items higher for a user with a portfolio', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/news?limit=20&personalized=true',
        headers: user.authHeader,
      });

      const items = response.json().items;
      expect(response.json().personalized).toBe(true);

      const relevant = items.filter(
        (item: { portfolioRelevanceScore: number }) => item.portfolioRelevanceScore > 0,
      );
      expect(relevant.length).toBeGreaterThan(0);
      // The user holds AAPL and an ETF, so at least one item must state a reason.
      expect(
        relevant.some((item: { relevanceReason: string | null }) => item.relevanceReason),
      ).toBe(true);
    });

    it('serves the feed to an anonymous caller without personalisation', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/news?limit=3' });
      expect(response.statusCode).toBe(200);
      expect(response.json().personalized).toBe(false);
    });

    it('paginates with a stable cursor', async () => {
      const first = await app.inject({
        method: 'GET',
        url: '/v1/news?limit=3',
        headers: user.authHeader,
      });
      expect(first.json().items).toHaveLength(3);
      expect(first.json().hasMore).toBe(true);

      const second = await app.inject({
        method: 'GET',
        url: `/v1/news?limit=3&cursor=${encodeURIComponent(first.json().nextCursor)}`,
        headers: user.authHeader,
      });
      const firstIds = first.json().items.map((item: { id: string }) => item.id);
      const secondIds = second.json().items.map((item: { id: string }) => item.id);
      expect(secondIds.some((id: string) => firstIds.includes(id))).toBe(false);
    });

    it('rejects a malformed cursor', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/news?cursor=not-a-cursor',
        headers: user.authHeader,
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /news/:id/analysis — "Pourquoi cela vous concerne ?"', () => {
    it('returns every block the screen needs, with sources and uncertainties', async () => {
      const newsId = await firstNewsId();
      const response = await app.inject({
        method: 'GET',
        url: `/v1/news/${newsId}/analysis`,
        headers: user.authHeader,
      });

      expect(response.statusCode).toBe(200);
      const analysis = response.json();

      expect(analysis.whatHappened.text).toBeTruthy();
      expect(analysis.whatHappened.kind).toBe('fact');
      expect(analysis.whyItMatters.kind).toBe('analysis');
      expect(Array.isArray(analysis.uncertainties)).toBe(true);
      expect(analysis.uncertainties.length).toBeGreaterThan(0);
      expect(analysis.sources.length).toBeGreaterThan(0);
      expect(analysis.whyItConcernsYou.length).toBeGreaterThan(0);
      expect(analysis.meta.isDemo).toBe(true);
    });

    it('states exposure for a user who holds an affected asset', async () => {
      // The demo corpus links an item to AAPL, which the onboarding portfolio holds.
      const feed = await app.inject({
        method: 'GET',
        url: '/v1/news?limit=20',
        headers: user.authHeader,
      });
      const withAapl = feed
        .json()
        .items.find((item: { affectedAssets: { symbol: string }[] }) =>
          item.affectedAssets.some((asset) => asset.symbol === 'AAPL'),
        );
      expect(withAapl).toBeDefined();

      const response = await app.inject({
        method: 'GET',
        url: `/v1/news/${withAapl.id}/analysis`,
        headers: user.authHeader,
      });
      const analysis = response.json();

      expect(analysis.portfolioRelevanceScore).toBeGreaterThan(0);
      expect(analysis.yourExposure.length).toBeGreaterThan(0);
      expect(analysis.yourExposureSummary).toMatch(/exposition/i);
    });

    it('invites a user without positions to add them, instead of inventing exposure', async () => {
      const newcomer = await registerUser(app);
      await completeOnboarding(app, newcomer, { withPositions: false });

      const newsId = await firstNewsId();
      const response = await app.inject({
        method: 'GET',
        url: `/v1/news/${newsId}/analysis`,
        headers: newcomer.authHeader,
      });

      const analysis = response.json();
      expect(analysis.portfolioRelevanceScore).toBe(0);
      expect(analysis.yourExposure).toEqual([]);
      expect(analysis.whyItConcernsYou[0].text).toMatch(/ajoutez vos positions/i);
    });

    it('requires authentication', async () => {
      const newsId = await firstNewsId();
      const response = await app.inject({ method: 'GET', url: `/v1/news/${newsId}/analysis` });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /ai/chat', () => {
    it('answers a definition question from the curated glossary', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/ai/chat',
        headers: user.authHeader,
        payload: { message: 'Qu’est-ce qu’un ETF ?', depth: 'simple' },
      });

      expect(response.statusCode).toBe(200);
      const answer = response.json().message.answer;
      expect(answer.shortAnswer).toMatch(/fonds|indice/i);
      expect(answer.disclaimer).toMatch(/ne constitue pas un conseil/i);
      expect(answer.generatedBy.provider).toBe('demo');
    });

    it('answers a portfolio question from computed exposure only', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/ai/chat',
        headers: user.authHeader,
        payload: { message: 'Quelle est mon exposition aux États-Unis ?', depth: 'detailed' },
      });

      const answer = response.json().message.answer;
      expect(answer.whatWeKnow.length).toBeGreaterThan(0);
      expect(answer.whatWeKnow.join(' ')).toMatch(/position|exposition|portefeuille/i);
      // Demo prices must be disclosed in the answer itself.
      expect(answer.whatWeKnow.join(' ')).toMatch(/démonstration/i);
    });

    it('says it lacks data rather than improvising', async () => {
      const newcomer = await registerUser(app);
      await completeOnboarding(app, newcomer, { withPositions: false });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/ai/chat',
        headers: newcomer.authHeader,
        payload: { message: 'Quel sera le cours de Tesla dans six mois ?' },
      });

      const answer = response.json().message.answer;
      expect(answer.shortAnswer).toMatch(/pas suffisamment de données/i);
      expect(answer.sources).toEqual([]);
    });

    it('never promises a return or gives an instruction to buy', async () => {
      const questions = [
        'Est-ce que je dois acheter des actions Apple ?',
        'Quel rendement vais-je obtenir ?',
        'Le CAC 40 va-t-il monter demain ?',
      ];

      for (const message of questions) {
        const response = await app.inject({
          method: 'POST',
          url: '/v1/ai/chat',
          headers: user.authHeader,
          payload: { message },
        });
        const answer = response.json().message.answer;
        const text = JSON.stringify(answer).toLowerCase();

        expect(text).not.toMatch(/je vous conseille/);
        expect(text).not.toMatch(/vous devriez acheter/);
        expect(text).not.toMatch(/rendement garanti/);
        expect(text).not.toMatch(/va certainement/);
      }
    });

    it('persists the conversation and can reload it', async () => {
      const first = await app.inject({
        method: 'POST',
        url: '/v1/ai/chat',
        headers: user.authHeader,
        payload: { message: 'Explique-moi les taux d’intérêt.' },
      });
      const conversationId = first.json().conversationId;

      await app.inject({
        method: 'POST',
        url: '/v1/ai/chat',
        headers: user.authHeader,
        payload: { message: 'Et l’inflation ?', conversationId },
      });

      const conversation = await app.inject({
        method: 'GET',
        url: `/v1/ai/conversations/${conversationId}`,
        headers: user.authHeader,
      });
      expect(conversation.json().messages).toHaveLength(4);
    });

    it('refuses to expose another user’s conversation', async () => {
      const first = await app.inject({
        method: 'POST',
        url: '/v1/ai/chat',
        headers: user.authHeader,
        payload: { message: 'Qu’est-ce qu’une obligation ?' },
      });
      const conversationId = first.json().conversationId;
      const intruder = await registerUser(app);

      const response = await app.inject({
        method: 'GET',
        url: `/v1/ai/conversations/${conversationId}`,
        headers: intruder.authHeader,
      });
      expect(response.statusCode).toBe(404);
    });

    it('rejects an empty or oversized message', async () => {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/v1/ai/chat',
            headers: user.authHeader,
            payload: { message: '' },
          })
        ).statusCode,
      ).toBe(400);

      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/v1/ai/chat',
            headers: user.authHeader,
            payload: { message: 'a'.repeat(5000) },
          })
        ).statusCode,
      ).toBe(400);
    });

    it('enforces the free-plan daily quota', async () => {
      // The free plan allows 5 questions per day.
      const codes: number[] = [];
      for (let index = 0; index < 7; index += 1) {
        const response = await app.inject({
          method: 'POST',
          url: '/v1/ai/chat',
          headers: user.authHeader,
          payload: { message: `Question numéro ${index}` },
        });
        codes.push(response.statusCode);
      }
      expect(codes.filter((code) => code === 200)).toHaveLength(5);
      expect(codes.filter((code) => code === 429).length).toBeGreaterThan(0);
    });
  });

  describe('POST /ai/explain-portfolio', () => {
    it('explains the portfolio without recommending anything', async () => {
      const portfolios = await app.inject({
        method: 'GET',
        url: '/v1/portfolios',
        headers: user.authHeader,
      });
      const portfolioId = portfolios.json().items[0].id;

      const response = await app.inject({
        method: 'POST',
        url: '/v1/ai/explain-portfolio',
        headers: user.authHeader,
        payload: { portfolioId, depth: 'simple' },
      });

      expect(response.statusCode).toBe(200);
      const answer = response.json();
      expect(answer.whatWeKnow.length).toBeGreaterThan(0);
      expect(answer.uncertainties.length).toBeGreaterThan(0);
      expect(answer.disclaimer).toBeTruthy();
    });

    it('refuses another user’s portfolio', async () => {
      const portfolios = await app.inject({
        method: 'GET',
        url: '/v1/portfolios',
        headers: user.authHeader,
      });
      const portfolioId = portfolios.json().items[0].id;
      const intruder = await registerUser(app);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/ai/explain-portfolio',
        headers: intruder.authHeader,
        payload: { portfolioId },
      });
      expect(response.statusCode).toBe(403);
    });
  });
});
