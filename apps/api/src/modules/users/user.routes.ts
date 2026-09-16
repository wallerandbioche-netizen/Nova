import type { FastifyInstance } from 'fastify';
import {
  changePasswordSchema,
  investorProfileSchema,
  notificationPreferencesSchema,
  updateInvestorProfileSchema,
  updateProfileSchema,
} from '@nova/validation';
import { RISK_QUESTIONNAIRE_DISCLAIMER } from '@nova/config';
import { requireUser } from '../../http/plugins/authenticate.js';
import { parseInput } from '../../http/validate.js';
import { hashPassword } from '../auth/password.js';

export async function profileRoutes(app: FastifyInstance): Promise<void> {
  const { users, account, analytics } = app.nova;

  app.addHook('onRequest', app.authenticate);

  app.get('/profile', async (request) => {
    const user = requireUser(request);
    return users.getProfile(user.id);
  });

  app.patch('/profile', async (request) => {
    const user = requireUser(request);
    const input = parseInput(updateProfileSchema, request.body);
    return users.updateProfile(user.id, input);
  });

  app.get('/profile/investor', async (request) => {
    const user = requireUser(request);
    const profile = await users.getInvestorProfile(user.id);
    return { profile, disclaimer: RISK_QUESTIONNAIRE_DISCLAIMER };
  });

  app.put('/profile/investor', async (request) => {
    const user = requireUser(request);
    const input = parseInput(investorProfileSchema, request.body);
    const profile = await users.upsertInvestorProfile(user.id, input);
    return { profile, disclaimer: RISK_QUESTIONNAIRE_DISCLAIMER };
  });

  app.patch('/profile/investor', async (request) => {
    const user = requireUser(request);
    const input = parseInput(updateInvestorProfileSchema, request.body);
    const profile = await users.patchInvestorProfile(user.id, input);
    return { profile, disclaimer: RISK_QUESTIONNAIRE_DISCLAIMER };
  });

  app.post('/profile/onboarding/complete', async (request) => {
    const user = requireUser(request);
    const updated = await users.completeOnboarding(user.id);
    await analytics.track({ event: 'onboarding_completed', userRef: user.id });
    return updated;
  });

  app.get('/profile/notifications', async (request) => {
    const user = requireUser(request);
    return users.getNotificationPreferences(user.id);
  });

  app.patch('/profile/notifications', async (request) => {
    const user = requireUser(request);
    const input = parseInput(notificationPreferencesSchema, request.body);
    return users.updateNotificationPreferences(user.id, input);
  });

  app.post('/profile/password', async (request, reply) => {
    const user = requireUser(request);
    const input = parseInput(changePasswordSchema, request.body);
    const hash = await hashPassword(input.newPassword);
    await account.changePassword(user.id, input.currentPassword, hash);
    return reply.status(204).send();
  });
}
