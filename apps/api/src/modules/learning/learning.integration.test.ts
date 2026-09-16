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

describe('learning, journal, notifications and account', () => {
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

  describe('learning', () => {
    const firstLessonId = async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/learning',
        headers: user.authHeader,
      });
      return response.json().items[0].id as string;
    };

    it('lists lessons with the user progress state', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/learning',
        headers: user.authHeader,
      });

      expect(response.statusCode).toBe(200);
      const items = response.json().items;
      expect(items.length).toBeGreaterThan(0);
      expect(items[0].status).toBe('not_started');
      expect(items[0].estimatedMinutes).toBeGreaterThan(0);
    });

    it('never sends the correct answers to the client before it answers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/v1/learning/${await firstLessonId()}`,
        headers: user.authHeader,
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).not.toContain('correctOptionId');
      expect(response.json().sections.length).toBeGreaterThan(0);
      expect(response.json().quiz.length).toBeGreaterThan(0);
    });

    it('marks a lesson as started when it is opened', async () => {
      const lessonId = await firstLessonId();
      await app.inject({
        method: 'GET',
        url: `/v1/learning/${lessonId}`,
        headers: user.authHeader,
      });

      const list = await app.inject({
        method: 'GET',
        url: '/v1/learning',
        headers: user.authHeader,
      });
      const lesson = list.json().items.find((item: { id: string }) => item.id === lessonId);
      expect(lesson.status).toBe('in_progress');
    });

    it('grades the quiz server-side and explains every answer', async () => {
      const lessonId = await firstLessonId();
      const lesson = await app.inject({
        method: 'GET',
        url: `/v1/learning/${lessonId}`,
        headers: user.authHeader,
      });
      const question = lesson.json().quiz[0];

      const completion = await app.inject({
        method: 'POST',
        url: `/v1/learning/${lessonId}/complete`,
        headers: user.authHeader,
        payload: { answers: { [question.id]: question.options[0].id } },
      });

      expect(completion.statusCode).toBe(200);
      const body = completion.json();
      expect(body.status).toBe('completed');
      expect(typeof body.score).toBe('number');
      // The explanation is returned whatever the answer: the goal is understanding.
      expect(body.corrections[0].explanation).toBeTruthy();
    });

    it('counts a completed lesson in the progress summary', async () => {
      const lessonId = await firstLessonId();
      await app.inject({
        method: 'POST',
        url: `/v1/learning/${lessonId}/complete`,
        headers: user.authHeader,
        payload: { answers: {} },
      });

      const progress = await app.inject({
        method: 'GET',
        url: '/v1/learning/progress',
        headers: user.authHeader,
      });
      expect(progress.json().completedCount).toBe(1);
      expect(progress.json().percent).toBeGreaterThan(0);
    });

    it('suggests a lesson of the day', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/learning/daily',
        headers: user.authHeader,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().lesson).not.toBeNull();
    });
  });

  describe('journal', () => {
    const createEntry = (overrides: Record<string, unknown> = {}) =>
      app.inject({
        method: 'POST',
        url: '/v1/journal',
        headers: user.authHeader,
        payload: {
          action: 'buy',
          reason: 'J’achète un ETF World pour ne pas avoir à choisir les entreprises une par une.',
          horizon: '10_to_20_years',
          conviction: 'high',
          ...overrides,
        },
      });

    it('creates and lists an entry', async () => {
      const created = await createEntry();
      expect(created.statusCode).toBe(201);

      const list = await app.inject({
        method: 'GET',
        url: '/v1/journal',
        headers: user.authHeader,
      });
      expect(list.json().items).toHaveLength(1);
      expect(list.json().items[0].reason).toContain('ETF World');
    });

    it('requires a reason', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/journal',
        headers: user.authHeader,
        payload: { action: 'buy' },
      });
      expect(response.statusCode).toBe(400);
    });

    it('returns the look-back without judging the decision', async () => {
      const created = await createEntry({ price: 440, quantity: 10 });
      const detail = await app.inject({
        method: 'GET',
        url: `/v1/journal/${created.json().id}`,
        headers: user.authHeader,
      });

      expect(detail.statusCode).toBe(200);
      const body = detail.json();
      expect(body.entry.reason).toContain('ETF World');
      expect(body.prompt).toBeTruthy();
      // No verdict field exists: the payload states facts only.
      expect(Object.keys(body)).not.toContain('verdict');
      expect(Object.keys(body)).not.toContain('score');
    });

    it('updates and deletes an entry', async () => {
      const created = await createEntry();
      const id = created.json().id;

      const updated = await app.inject({
        method: 'PATCH',
        url: `/v1/journal/${id}`,
        headers: user.authHeader,
        payload: { conviction: 'low' },
      });
      expect(updated.statusCode).toBe(200);
      expect(updated.json().conviction).toBe('low');

      const removed = await app.inject({
        method: 'DELETE',
        url: `/v1/journal/${id}`,
        headers: user.authHeader,
      });
      expect(removed.statusCode).toBe(204);
    });

    it('refuses access to another user’s entry', async () => {
      const created = await createEntry();
      const intruder = await registerUser(app);

      const read = await app.inject({
        method: 'GET',
        url: `/v1/journal/${created.json().id}`,
        headers: intruder.authHeader,
      });
      expect(read.statusCode).toBe(403);

      const removed = await app.inject({
        method: 'DELETE',
        url: `/v1/journal/${created.json().id}`,
        headers: intruder.authHeader,
      });
      expect(removed.statusCode).toBe(403);
    });
  });

  describe('notifications', () => {
    it('lists notifications and the unread count', async () => {
      await context.db.notification.create({
        data: {
          userId: user.id,
          type: 'daily_brief',
          title: 'Votre briefing du matin est prêt',
          body: 'Prenez trois minutes pour comprendre ce qui s’est passé.',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/notifications',
        headers: user.authHeader,
      });
      expect(response.json().items).toHaveLength(1);
      expect(response.json().unreadCount).toBe(1);
    });

    it('marks one and all as read', async () => {
      const notification = await context.db.notification.create({
        data: { userId: user.id, type: 'learning', title: 'Leçon', body: 'Prête.' },
      });

      const read = await app.inject({
        method: 'PATCH',
        url: `/v1/notifications/${notification.id}/read`,
        headers: user.authHeader,
      });
      expect(read.statusCode).toBe(200);
      expect(read.json().readAt).not.toBeNull();

      const all = await app.inject({
        method: 'POST',
        url: '/v1/notifications/read-all',
        headers: user.authHeader,
      });
      expect(all.statusCode).toBe(200);
    });

    it('refuses to mark another user’s notification', async () => {
      const notification = await context.db.notification.create({
        data: { userId: user.id, type: 'system', title: 'Test', body: 'Test.' },
      });
      const intruder = await registerUser(app);

      const response = await app.inject({
        method: 'PATCH',
        url: `/v1/notifications/${notification.id}/read`,
        headers: intruder.authHeader,
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('subscriptions', () => {
    it('serves the plan catalogue with prices from the server', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/subscriptions/plans' });
      expect(response.statusCode).toBe(200);
      const plans = response.json().items;
      expect(plans.map((plan: { key: string }) => plan.key)).toEqual(['free', 'premium']);
      expect(plans[1].priceAmount).toBeGreaterThan(0);
      // With no payment provider configured, premium must not advertise a working checkout.
      expect(plans[1].isPurchasable).toBe(false);
      expect(response.json().paymentEnabled).toBe(false);
    });

    it('defaults a new account to the free plan with no premium entitlement', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/subscriptions/me',
        headers: user.authHeader,
      });
      expect(response.json().plan).toBe('free');
      expect(response.json().entitlements).toEqual([]);
    });

    it('fails loudly instead of pretending when checkout is not configured', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/subscriptions/checkout',
        headers: user.authHeader,
        payload: { plan: 'premium', interval: 'month' },
      });
      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('FEATURE_NOT_AVAILABLE');
    });

    it('gates the Market Radar on the free plan', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/markets/radar',
        headers: user.authHeader,
      });
      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('FEATURE_NOT_AVAILABLE');
    });
  });

  describe('account', () => {
    it('exports every category of user data without the password hash', async () => {
      await app.inject({
        method: 'POST',
        url: '/v1/journal',
        headers: user.authHeader,
        payload: { action: 'note', reason: 'Une note de test.' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/account/export',
        headers: user.authHeader,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-disposition']).toContain('attachment');
      const body = response.json();
      expect(body.user.investorProfile).not.toBeNull();
      expect(body.user.portfolios.length).toBeGreaterThan(0);
      expect(body.user.journalEntries).toHaveLength(1);
      expect(response.body).not.toContain('passwordHash');
      expect(response.body).not.toContain('scrypt$');
    });

    it('refuses deletion without the password or the typed confirmation', async () => {
      const noConfirmation = await app.inject({
        method: 'DELETE',
        url: '/v1/account',
        headers: user.authHeader,
        payload: { password: 'phrase-de-test-2026' },
      });
      expect(noConfirmation.statusCode).toBe(400);

      const wrongPassword = await app.inject({
        method: 'DELETE',
        url: '/v1/account',
        headers: user.authHeader,
        payload: { password: 'mauvaise-phrase-2026', confirmation: 'SUPPRIMER' },
      });
      expect(wrongPassword.statusCode).toBe(401);

      // The account must still exist and still work.
      const session = await app.inject({
        method: 'GET',
        url: '/v1/auth/me',
        headers: user.authHeader,
      });
      expect(session.statusCode).toBe(200);
    });

    it('anonymises the account and cascades the deletion of its data', async () => {
      const portfolios = await app.inject({
        method: 'GET',
        url: '/v1/portfolios',
        headers: user.authHeader,
      });
      const portfolioId = portfolios.json().items[0].id;

      const deletion = await app.inject({
        method: 'DELETE',
        url: '/v1/account',
        headers: user.authHeader,
        payload: { password: 'phrase-de-test-2026', confirmation: 'SUPPRIMER' },
      });
      expect(deletion.statusCode).toBe(204);

      const stored = await context.db.user.findUnique({ where: { id: user.id } });
      expect(stored?.deletedAt).not.toBeNull();
      expect(stored?.email).not.toBe(user.email);
      expect(stored?.passwordHash).toBe('deleted');

      // Sessions are revoked immediately.
      const afterDeletion = await app.inject({
        method: 'GET',
        url: '/v1/auth/me',
        headers: user.authHeader,
      });
      expect(afterDeletion.statusCode).toBe(401);

      // A purge removes the row and everything attached to it.
      const purged = await context.container.account.purgeExpired(0);
      expect(purged.users).toBeGreaterThan(0);
      expect(await context.db.user.findUnique({ where: { id: user.id } })).toBeNull();
      expect(await context.db.portfolio.findUnique({ where: { id: portfolioId } })).toBeNull();
      expect(await context.db.position.count({ where: { portfolioId } })).toBe(0);
    });
  });
});
