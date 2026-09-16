import { randomUUID } from 'node:crypto';
import type { Logger } from 'pino';
import type { PublicUser, SessionPayload } from '@nova/types';
import type {
  LoginInput,
  RegisterInput,
} from '@nova/validation';
import type { Env } from '../../config/env.js';
import type { Database } from '../../infrastructure/database/prisma.js';
import { conflict, notFound, unauthorized } from '../../http/errors.js';
import type { AuditLogService } from '../audit-logs/audit-log.service.js';
import { hashPassword, needsRehash, verifyPassword } from './password.js';
import {
  generateRefreshToken,
  hashToken,
  signAccessToken,
} from './tokens.js';
import { toPublicUser, toInvestorProfile } from '../users/user.mapper.js';

export interface AuthContext {
  ipHash?: string | null;
  userAgent?: string | null;
}

export interface AuthResult {
  user: PublicUser;
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: 'Bearer';
  };
}

export class AuthService {
  constructor(
    private readonly db: Database,
    private readonly env: Env,
    private readonly logger: Logger,
    private readonly auditLog: AuditLogService,
  ) {}

  async register(input: RegisterInput, context: AuthContext = {}): Promise<AuthResult> {
    const existing = await this.db.user.findUnique({ where: { email: input.email } });
    if (existing) {
      // The address is already visible to whoever typed it, so a clear conflict is more
      // useful than a fake success — registration is rate limited to prevent enumeration.
      throw conflict('Un compte existe déjà avec cette adresse e-mail.');
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.db.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        acceptedTermsAt: new Date(),
        notificationPreference: { create: {} },
        subscription: { create: { plan: 'free', status: 'active', provider: 'none' } },
      },
    });

    await this.auditLog.record({
      userId: user.id,
      action: 'auth.register',
      resource: 'user',
      resourceId: user.id,
      ipHash: context.ipHash,
    });

    return this.issueSession(user.id, user.email, toPublicUser(user), context);
  }

  async login(input: LoginInput, context: AuthContext = {}): Promise<AuthResult> {
    const user = await this.db.user.findUnique({ where: { email: input.email } });

    // Always run a verification, even for an unknown account, so response time does not
    // reveal whether the address exists.
    const storedHash = user?.passwordHash ?? (await this.dummyHash());
    const valid = await verifyPassword(input.password, storedHash);

    if (!user || !valid || user.deletedAt) {
      await this.auditLog.record({
        userId: user?.id ?? null,
        action: 'auth.login_failed',
        resource: 'user',
        resourceId: user?.id ?? null,
        ipHash: context.ipHash,
      });
      throw unauthorized('Adresse e-mail ou mot de passe incorrect.');
    }

    // Opportunistically upgrade a hash produced with older parameters.
    if (needsRehash(user.passwordHash)) {
      const upgraded = await hashPassword(input.password);
      await this.db.user.update({ where: { id: user.id }, data: { passwordHash: upgraded } });
    }

    await this.db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.auditLog.record({
      userId: user.id,
      action: 'auth.login',
      resource: 'user',
      resourceId: user.id,
      ipHash: context.ipHash,
    });

    return this.issueSession(user.id, user.email, toPublicUser(user), context);
  }

  /**
   * Rotates a refresh token.
   *
   * Presenting an already-revoked token means the token leaked, so the whole family is
   * revoked and the user has to sign in again.
   */
  async refresh(refreshToken: string, context: AuthContext = {}): Promise<AuthResult> {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.db.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored) throw unauthorized('Session invalide. Reconnectez-vous.');

    if (stored.revokedAt) {
      await this.db.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.auditLog.record({
        userId: stored.userId,
        action: 'auth.refresh_reuse_detected',
        resource: 'refresh_token',
        resourceId: stored.id,
        ipHash: context.ipHash,
      });
      this.logger.warn({ userId: stored.userId }, 'refresh token reuse detected, family revoked');
      throw unauthorized('Session invalide. Reconnectez-vous.');
    }

    if (stored.expiresAt <= new Date() || stored.user.deletedAt) {
      throw unauthorized('Session expirée. Reconnectez-vous.');
    }

    await this.db.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueSession(
      stored.user.id,
      stored.user.email,
      toPublicUser(stored.user),
      context,
      stored.familyId,
    );
  }

  async logout(refreshToken: string | undefined, userId: string | null): Promise<void> {
    if (refreshToken) {
      const stored = await this.db.refreshToken.findUnique({
        where: { tokenHash: hashToken(refreshToken) },
      });
      if (stored && (!userId || stored.userId === userId)) {
        // Revoke the whole rotation family: signing out ends the session, not just this token.
        await this.db.refreshToken.updateMany({
          where: { familyId: stored.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return;
    }
    if (userId) {
      await this.db.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getSession(userId: string): Promise<SessionPayload> {
    const user = await this.db.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { investorProfile: true },
    });
    if (!user) throw notFound('Compte introuvable');

    return {
      user: toPublicUser(user),
      investorProfile: user.investorProfile ? toInvestorProfile(user.investorProfile) : null,
      onboardingCompleted: user.onboardingCompletedAt !== null,
    };
  }

  private async issueSession(
    userId: string,
    email: string,
    user: PublicUser,
    context: AuthContext,
    familyId?: string,
  ): Promise<AuthResult> {
    const { token: accessToken, expiresIn } = await signAccessToken(this.env, { userId, email });
    const { token: refreshToken, tokenHash } = generateRefreshToken();

    const expiresAt = new Date(Date.now() + this.env.JWT_REFRESH_TTL_DAYS * 86400 * 1000);
    await this.db.refreshToken.create({
      data: {
        userId,
        tokenHash,
        familyId: familyId ?? randomUUID(),
        expiresAt,
        userAgent: context.userAgent?.slice(0, 200) ?? null,
        ipHash: context.ipHash ?? null,
      },
    });

    return {
      user,
      tokens: { accessToken, refreshToken, expiresIn, tokenType: 'Bearer' },
    };
  }

  /** Stable dummy hash so an unknown email costs the same time as a known one. */
  private async dummyHash(): Promise<string> {
    if (!AuthService.dummy) {
      AuthService.dummy = await hashPassword('nova-timing-equalisation-placeholder');
    }
    return AuthService.dummy;
  }

  private static dummy: string | null = null;
}
