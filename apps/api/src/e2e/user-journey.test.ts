import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  closeTestContext,
  createTestContext,
  resetUserData,
  type TestContext,
} from '../testing/harness.js';

/**
 * End-to-end journey, mirroring the MVP completion criteria (specification §60):
 *
 *   signup → onboarding → portfolio → position → exposure → daily brief → news →
 *   "pourquoi cela me concerne" → question to NOVA → lesson → journal entry →
 *   settings → logout → account deletion
 *
 * Each step runs through the real HTTP layer against a real database. The test also checks
 * that the app degrades correctly for a user with no portfolio and no data.
 */
describe('end-to-end user journey', () => {
  let context: TestContext;
  let app: FastifyInstance;

  beforeAll(async () => {
    context = await createTestContext();
    app = context.app;
  });

  beforeEach(async () => {
    await resetUserData(context.db);
  });

  afterAll(async () => {
    await closeTestContext();
  });

  it('carries a new user through the complete NOVA loop', async () => {
    // ---------------------------------------------------------------- 1. Sign up
    const signup = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: 'thomas@example.com',
        password: 'ma-phrase-de-passe-2026',
        firstName: 'Thomas',
        acceptedTerms: true,
      },
    });
    expect(signup.statusCode).toBe(201);
    const auth = { authorization: `Bearer ${signup.json().tokens.accessToken}` };
    const refreshToken = signup.json().tokens.refreshToken;

    // A fresh account has not completed onboarding.
    const session = await app.inject({ method: 'GET', url: '/v1/auth/me', headers: auth });
    expect(session.json().onboardingCompleted).toBe(false);
    expect(session.json().investorProfile).toBeNull();

    // ---------------------------------------------------------------- 2. Onboarding
    const profile = await app.inject({
      method: 'PUT',
      url: '/v1/profile/investor',
      headers: auth,
      payload: {
        investmentGoal: 'prepare_retirement',
        investmentHorizon: '10_to_20_years',
        experienceLevel: 'intermediate',
        riskTolerance: 'balanced',
        interestedAssetTypes: ['etf', 'stock', 'crypto'],
      },
    });
    expect(profile.statusCode).toBe(200);
    // The questionnaire must state that it is not a regulatory assessment on its own.
    expect(profile.json().disclaimer).toMatch(/ne constitue pas à lui seul une évaluation/i);

    // ---------------------------------------------------------------- 3. Portfolio
    const portfolio = await app.inject({
      method: 'POST',
      url: '/v1/portfolios',
      headers: auth,
      payload: { name: 'PEA', baseCurrency: 'EUR' },
    });
    expect(portfolio.statusCode).toBe(201);
    const portfolioId = portfolio.json().id;

    // ---------------------------------------------------------------- 4. Positions
    for (const position of [
      { symbol: 'CW8.PA', quantity: 14, averagePrice: 438 },
      { symbol: 'ASML.AS', quantity: 3, averagePrice: 700 },
      { symbol: 'TTE.PA', quantity: 30, averagePrice: 57 },
    ]) {
      const created = await app.inject({
        method: 'POST',
        url: `/v1/portfolios/${portfolioId}/positions`,
        headers: auth,
        payload: position,
      });
      expect(created.statusCode).toBe(201);
    }

    await app.inject({ method: 'POST', url: '/v1/profile/onboarding/complete', headers: auth });

    // ---------------------------------------------------------------- 5. Exposure
    const exposure = await app.inject({
      method: 'GET',
      url: `/v1/portfolios/${portfolioId}/exposure`,
      headers: auth,
    });
    expect(exposure.statusCode).toBe(200);
    expect(exposure.json().totalValue).toBeGreaterThan(0);
    expect(Object.keys(exposure.json().bySector).length).toBeGreaterThan(0);
    expect(exposure.json().meta.isDemo).toBe(true);

    // ---------------------------------------------------------------- 6. Dashboard
    const dashboard = await app.inject({ method: 'GET', url: '/v1/dashboard', headers: auth });
    expect(dashboard.statusCode).toBe(200);
    const dashboardBody = dashboard.json();
    expect(dashboardBody.greeting).toContain('Thomas');
    expect(dashboardBody.markets.length).toBeGreaterThan(0);
    expect(dashboardBody.topNews.length).toBeGreaterThan(0);
    expect(dashboardBody.portfolio.isEmpty).toBe(false);
    expect(dashboardBody.portfolio.changeLabel).toBeTruthy();
    expect(dashboardBody.lessonOfTheDay).not.toBeNull();

    // ---------------------------------------------------------------- 7. Daily brief
    const brief = await app.inject({ method: 'GET', url: '/v1/brief/today', headers: auth });
    expect(brief.statusCode).toBe(200);
    const briefBody = brief.json();
    expect(briefBody.greeting).toContain('Thomas');
    expect(briefBody.items.length).toBeGreaterThan(0);
    expect(briefBody.isStale).toBe(false);
    expect(briefBody.dataAsOf).toBeTruthy();
    expect(briefBody.uncertainties.length).toBeGreaterThan(0);
    for (const item of briefBody.items) {
      expect(item.takeaway).toBeTruthy();
      expect(item.source).toBeTruthy();
    }

    // ---------------------------------------------------------------- 8. News + analysis
    const newsId = briefBody.items[0].newsId;
    const news = await app.inject({ method: 'GET', url: `/v1/news/${newsId}`, headers: auth });
    expect(news.statusCode).toBe(200);
    expect(news.json().sourceUrl !== undefined).toBe(true);

    const analysis = await app.inject({
      method: 'GET',
      url: `/v1/news/${newsId}/analysis`,
      headers: auth,
    });
    expect(analysis.statusCode).toBe(200);
    expect(analysis.json().whatHappened.text).toBeTruthy();
    expect(analysis.json().uncertainties.length).toBeGreaterThan(0);
    expect(analysis.json().sources.length).toBeGreaterThan(0);

    // ---------------------------------------------------------------- 9. Ask NOVA
    const question = await app.inject({
      method: 'POST',
      url: '/v1/ai/chat',
      headers: auth,
      payload: { message: 'Pourquoi mon portefeuille baisse aujourd’hui ?', depth: 'simple' },
    });
    expect(question.statusCode).toBe(200);
    const answer = question.json().message.answer;
    expect(answer.shortAnswer).toBeTruthy();
    expect(answer.disclaimer).toBeTruthy();
    expect(answer.uncertainties.length).toBeGreaterThan(0);

    // ---------------------------------------------------------------- 10. Lesson
    const lessons = await app.inject({ method: 'GET', url: '/v1/learning', headers: auth });
    expect(lessons.json().items.length).toBeGreaterThan(0);
    const lessonId = lessons.json().items[0].id;

    const lesson = await app.inject({
      method: 'GET',
      url: `/v1/learning/${lessonId}`,
      headers: auth,
    });
    expect(lesson.statusCode).toBe(200);
    expect(lesson.json().sections.length).toBeGreaterThan(0);
    // The correct answers must never be sent to the client before it answers.
    expect(lesson.body).not.toContain('correctOptionId');

    const quizQuestion = lesson.json().quiz[0];
    const completion = await app.inject({
      method: 'POST',
      url: `/v1/learning/${lessonId}/complete`,
      headers: auth,
      payload: { answers: { [quizQuestion.id]: quizQuestion.options[0].id } },
    });
    expect(completion.statusCode).toBe(200);
    expect(completion.json().corrections.length).toBeGreaterThan(0);

    const progress = await app.inject({
      method: 'GET',
      url: '/v1/learning/progress',
      headers: auth,
    });
    expect(progress.json().completedCount).toBe(1);

    // ---------------------------------------------------------------- 11. Journal
    const entry = await app.inject({
      method: 'POST',
      url: '/v1/journal',
      headers: auth,
      payload: {
        portfolioId,
        action: 'buy',
        quantity: 14,
        price: 438,
        currency: 'EUR',
        reason:
          'J’achète un ETF World pour ne pas avoir à choisir les entreprises une par une. Horizon long.',
        horizon: '10_to_20_years',
        conviction: 'high',
      },
    });
    expect(entry.statusCode).toBe(201);

    const journal = await app.inject({ method: 'GET', url: '/v1/journal', headers: auth });
    expect(journal.json().items).toHaveLength(1);

    const entryDetail = await app.inject({
      method: 'GET',
      url: `/v1/journal/${entry.json().id}`,
      headers: auth,
    });
    expect(entryDetail.json().entry.reason).toContain('ETF World');
    expect(entryDetail.json().prompt).toBeTruthy();

    // ---------------------------------------------------------------- 12. Settings
    const settings = await app.inject({
      method: 'PATCH',
      url: '/v1/profile',
      headers: auth,
      payload: { theme: 'dark', contentDepth: 'detailed' },
    });
    expect(settings.statusCode).toBe(200);
    expect(settings.json().theme).toBe('dark');

    const notificationPreferences = await app.inject({
      method: 'PATCH',
      url: '/v1/profile/notifications',
      headers: auth,
      payload: { dailyBrief: false },
    });
    expect(notificationPreferences.json().dailyBrief).toBe(false);

    // ---------------------------------------------------------------- 13. Data export
    const dataExport = await app.inject({
      method: 'GET',
      url: '/v1/account/export',
      headers: auth,
    });
    expect(dataExport.statusCode).toBe(200);
    expect(dataExport.json().user.portfolios[0].positions.length).toBe(3);
    expect(dataExport.body).not.toContain('passwordHash');

    // ---------------------------------------------------------------- 14. Logout
    const logout = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      headers: auth,
      payload: { refreshToken },
    });
    expect(logout.statusCode).toBe(204);

    // ---------------------------------------------------------------- 15. Sign back in and delete
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'thomas@example.com', password: 'ma-phrase-de-passe-2026' },
    });
    const finalAuth = { authorization: `Bearer ${login.json().tokens.accessToken}` };

    const wrongPassword = await app.inject({
      method: 'DELETE',
      url: '/v1/account',
      headers: finalAuth,
      payload: { password: 'mauvaise-phrase-2026', confirmation: 'SUPPRIMER' },
    });
    expect(wrongPassword.statusCode).toBe(401);

    const missingConfirmation = await app.inject({
      method: 'DELETE',
      url: '/v1/account',
      headers: finalAuth,
      payload: { password: 'ma-phrase-de-passe-2026', confirmation: 'oui' },
    });
    expect(missingConfirmation.statusCode).toBe(400);

    const deletion = await app.inject({
      method: 'DELETE',
      url: '/v1/account',
      headers: finalAuth,
      payload: { password: 'ma-phrase-de-passe-2026', confirmation: 'SUPPRIMER' },
    });
    expect(deletion.statusCode).toBe(204);

    // The session is dead and the account is anonymised immediately.
    const afterDeletion = await app.inject({
      method: 'GET',
      url: '/v1/dashboard',
      headers: finalAuth,
    });
    expect(afterDeletion.statusCode).toBe(401);

    const deletedUser = await context.db.user.findFirst({
      where: { id: signup.json().user.id },
    });
    expect(deletedUser?.deletedAt).not.toBeNull();
    expect(deletedUser?.email).not.toBe('thomas@example.com');

    // The address can be reused for a new account.
    const reRegistration = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: 'thomas@example.com',
        password: 'une-autre-phrase-2026',
        firstName: 'Thomas',
        acceptedTerms: true,
      },
    });
    expect(reRegistration.statusCode).toBe(201);
  });

  it('degrades gracefully for a user with no portfolio and no data', async () => {
    const signup = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: 'nouvelle@example.com',
        password: 'phrase-de-passe-2026',
        firstName: 'Camille',
        acceptedTerms: true,
      },
    });
    const auth = { authorization: `Bearer ${signup.json().tokens.accessToken}` };

    const dashboard = await app.inject({ method: 'GET', url: '/v1/dashboard', headers: auth });
    expect(dashboard.statusCode).toBe(200);
    // No portfolio: the payload says so explicitly rather than showing a zeroed one.
    expect(dashboard.json().portfolio).toBeNull();
    expect(dashboard.json().portfolioInsight).toBeNull();
    expect(dashboard.json().markets.length).toBeGreaterThan(0);

    const brief = await app.inject({ method: 'GET', url: '/v1/brief/today', headers: auth });
    expect(brief.statusCode).toBe(200);
    expect(brief.json().portfolioSummary).toBeNull();

    const journal = await app.inject({ method: 'GET', url: '/v1/journal', headers: auth });
    expect(journal.json().items).toEqual([]);

    const notifications = await app.inject({
      method: 'GET',
      url: '/v1/notifications',
      headers: auth,
    });
    expect(notifications.json().items).toEqual([]);
    expect(notifications.json().unreadCount).toBe(0);
  });

  it('returns a structured error, never an internal message, on unknown resources', async () => {
    const signup = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: 'erreurs@example.com',
        password: 'phrase-de-passe-2026',
        firstName: 'Test',
        acceptedTerms: true,
      },
    });
    const auth = { authorization: `Bearer ${signup.json().tokens.accessToken}` };

    const unknownId = '00000000-0000-4000-8000-000000000000';
    const notFound = await app.inject({
      method: 'GET',
      url: `/v1/news/${unknownId}`,
      headers: auth,
    });
    expect(notFound.statusCode).toBe(404);
    expect(notFound.json().error.requestId).toBeTruthy();

    const malformedId = await app.inject({
      method: 'GET',
      url: '/v1/news/not-a-uuid/analysis',
      headers: auth,
    });
    expect(malformedId.statusCode).toBe(400);

    const unknownRoute = await app.inject({ method: 'GET', url: '/v1/inexistant', headers: auth });
    expect(unknownRoute.statusCode).toBe(404);
    expect(unknownRoute.json().error.code).toBe('NOT_FOUND');
  });
});
