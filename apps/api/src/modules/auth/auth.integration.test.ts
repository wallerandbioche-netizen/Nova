import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  closeTestContext,
  createTestContext,
  registerUser,
  resetUserData,
  type TestContext,
} from '../../testing/harness.js';

describe('authentication', () => {
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

  const credentials = {
    email: 'camille@example.com',
    password: 'phrase-de-test-2026',
    firstName: 'Camille',
    acceptedTerms: true,
  };

  describe('POST /auth/register', () => {
    it('creates an account and returns tokens', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: credentials,
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.user.email).toBe('camille@example.com');
      expect(body.tokens.accessToken).toBeTruthy();
      expect(body.tokens.tokenType).toBe('Bearer');
      // The password hash must never appear in a response.
      expect(response.body).not.toContain('passwordHash');
      expect(response.body).not.toContain(credentials.password);
    });

    it('creates the default free subscription and notification preferences', async () => {
      await app.inject({ method: 'POST', url: '/v1/auth/register', payload: credentials });
      const user = await context.db.user.findUnique({
        where: { email: credentials.email },
        include: { subscription: true, notificationPreference: true },
      });
      expect(user?.subscription?.plan).toBe('free');
      expect(user?.notificationPreference).not.toBeNull();
    });

    it('rejects a duplicate email', async () => {
      await app.inject({ method: 'POST', url: '/v1/auth/register', payload: credentials });
      const second = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: credentials,
      });
      expect(second.statusCode).toBe(409);
      expect(second.json().error.code).toBe('CONFLICT');
    });

    it('rejects a weak password with field-level details', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: { ...credentials, password: 'court' },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
      expect(response.json().error.details[0].field).toBe('password');
    });

    it('requires accepting the terms', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: { ...credentials, acceptedTerms: false },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await app.inject({ method: 'POST', url: '/v1/auth/register', payload: credentials });
    });

    it('signs in with valid credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: credentials.email, password: credentials.password },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().tokens.accessToken).toBeTruthy();
    });

    it('rejects a wrong password with the same message as an unknown account', async () => {
      const wrongPassword = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: credentials.email, password: 'mauvaise-phrase-2026' },
      });
      const unknownAccount = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: 'inconnu@example.com', password: 'phrase-de-test-2026' },
      });

      expect(wrongPassword.statusCode).toBe(401);
      expect(unknownAccount.statusCode).toBe(401);
      // Identical responses: the endpoint must not reveal which accounts exist.
      expect(wrongPassword.json().error.message).toBe(unknownAccount.json().error.message);
    });

    it('records the login in the audit trail', async () => {
      await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: credentials.email, password: credentials.password },
      });
      const logs = await context.db.auditLog.findMany({ where: { action: 'auth.login' } });
      expect(logs).toHaveLength(1);
      expect(JSON.stringify(logs[0])).not.toContain(credentials.password);
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates the refresh token', async () => {
      const user = await registerUser(app);
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        payload: { refreshToken: user.refreshToken },
      });

      expect(response.statusCode).toBe(200);
      const tokens = response.json().tokens;
      expect(tokens.refreshToken).not.toBe(user.refreshToken);
    });

    it('detects reuse of a rotated token and revokes the whole family', async () => {
      const user = await registerUser(app);

      const first = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        payload: { refreshToken: user.refreshToken },
      });
      const rotated = first.json().tokens.refreshToken;

      // Replaying the consumed token must fail...
      const replay = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        payload: { refreshToken: user.refreshToken },
      });
      expect(replay.statusCode).toBe(401);

      // ...and invalidate the rotated one too, since the family is considered compromised.
      const afterReuse = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        payload: { refreshToken: rotated },
      });
      expect(afterReuse.statusCode).toBe(401);
    });

    it('rejects an unknown token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        payload: { refreshToken: 'x'.repeat(64) },
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /auth/me', () => {
    it('returns the session for an authenticated user', async () => {
      const user = await registerUser(app);
      const response = await app.inject({
        method: 'GET',
        url: '/v1/auth/me',
        headers: user.authHeader,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.user.id).toBe(user.id);
      expect(body.onboardingCompleted).toBe(false);
      expect(body.subscription.plan).toBe('free');
    });

    it('rejects a missing, malformed or invalid token', async () => {
      expect((await app.inject({ method: 'GET', url: '/v1/auth/me' })).statusCode).toBe(401);
      expect(
        (
          await app.inject({
            method: 'GET',
            url: '/v1/auth/me',
            headers: { authorization: 'Basic abc' },
          })
        ).statusCode,
      ).toBe(401);
      expect(
        (
          await app.inject({
            method: 'GET',
            url: '/v1/auth/me',
            headers: { authorization: 'Bearer not.a.jwt' },
          })
        ).statusCode,
      ).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes the session', async () => {
      const user = await registerUser(app);
      const logout = await app.inject({
        method: 'POST',
        url: '/v1/auth/logout',
        headers: user.authHeader,
        payload: { refreshToken: user.refreshToken },
      });
      expect(logout.statusCode).toBe(204);

      const refresh = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        payload: { refreshToken: user.refreshToken },
      });
      expect(refresh.statusCode).toBe(401);
    });
  });

  describe('password reset', () => {
    it('answers identically whether or not the account exists', async () => {
      await registerUser(app, { email: 'existe@example.com' });

      const known = await app.inject({
        method: 'POST',
        url: '/v1/auth/forgot-password',
        payload: { email: 'existe@example.com' },
      });
      const unknown = await app.inject({
        method: 'POST',
        url: '/v1/auth/forgot-password',
        payload: { email: 'inconnu@example.com' },
      });

      expect(known.statusCode).toBe(202);
      expect(unknown.statusCode).toBe(202);
      expect(known.body).toBe(unknown.body);
    });

    it('rejects an invalid reset token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/reset-password',
        payload: { token: 'y'.repeat(43), password: 'nouvelle-phrase-2026' },
      });
      expect(response.statusCode).toBe(400);
    });
  });
});
