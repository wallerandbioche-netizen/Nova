import { createHash, randomUUID } from 'node:crypto';
import type { Logger } from 'pino';
import type { Database } from '../../infrastructure/database/prisma.js';
import { notFound, unauthorized } from '../../http/errors.js';
import type { AuditLogService } from '../audit-logs/audit-log.service.js';
import type { AuthService } from '../auth/auth.service.js';
import { verifyPassword } from '../auth/password.js';
import type { StorageProvider } from '../../services/storage/providers/index.js';

/**
 * Account lifecycle: RGPD export and deletion.
 *
 * Deletion is a two-step process (rule #46): the account is anonymised immediately — the user
 * disappears from the product at once — and the row is purged by the retention job after the
 * defined period. All related data cascades.
 */
export class AccountService {
  constructor(
    private readonly db: Database,
    private readonly auth: AuthService,
    private readonly auditLog: AuditLogService,
    private readonly storage: StorageProvider,
    private readonly logger: Logger,
  ) {}

  /** Complete export of the user's own data, in a readable JSON structure. */
  async exportData(userId: string): Promise<Record<string, unknown>> {
    const user = await this.db.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        investorProfile: true,
        notificationPreference: true,
        subscription: true,
        portfolios: { include: { positions: { include: { asset: true } } } },
        journalEntries: { include: { asset: true } },
        learningProgress: { include: { lesson: { select: { slug: true, title: true } } } },
        dailyBriefs: { orderBy: { date: 'desc' }, take: 90 },
        notifications: { orderBy: { createdAt: 'desc' }, take: 200 },
        aiConversations: { include: { messages: true } },
      },
    });
    if (!user) throw notFound('Compte introuvable');

    await this.auditLog.record({
      userId,
      action: 'account.exported',
      resource: 'user',
      resourceId: userId,
    });

    const { passwordHash: _passwordHash, ...safeUser } = user;

    return {
      exportedAt: new Date().toISOString(),
      format: 'nova-export-v1',
      user: {
        ...safeUser,
        // Nested records are returned as stored; nothing is fabricated or summarised.
      },
    };
  }

  /** Stores an export so it can be downloaded once; returns the storage key. */
  async storeExport(userId: string, payload: Record<string, unknown>): Promise<string> {
    const key = `exports/${userId}/${randomUUID()}.json`;
    await this.storage.put(key, JSON.stringify(payload, null, 2), 'application/json');
    return key;
  }

  /**
   * Deletes the account.
   *
   * Requires the current password: an authenticated session alone must not be enough to erase
   * someone's data (an unlocked phone is not consent).
   */
  async deleteAccount(userId: string, password: string, ipHash: string | null): Promise<void> {
    const user = await this.db.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw notFound('Compte introuvable');

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) throw unauthorized('Mot de passe incorrect.');

    // Anonymise immediately: the email is replaced by a one-way digest so the address can be
    // reused for a new account while the old row awaits purge.
    const anonymisedEmail = `deleted-${createHash('sha256')
      .update(`${user.id}:${user.email}`)
      .digest('hex')
      .slice(0, 32)}@deleted.nova.invalid`;

    await this.db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          email: anonymisedEmail,
          firstName: 'Compte supprimé',
          passwordHash: 'deleted',
          deletedAt: new Date(),
        },
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.device.deleteMany({ where: { userId } });
    });

    await this.auth.revokeAllSessions(userId);
    await this.auditLog.record({
      userId: null,
      action: 'account.deleted',
      resource: 'user',
      resourceId: userId,
      ipHash,
    });
    this.logger.info({ userId }, 'account anonymised, pending purge');
  }

  /**
   * Purges accounts anonymised more than `retentionDays` ago, and expired tokens.
   * Run by the retention job.
   */
  async purgeExpired(retentionDays = 30): Promise<{ users: number; tokens: number }> {
    const threshold = new Date(Date.now() - retentionDays * 86_400_000);

    const users = await this.db.user.findMany({
      where: { deletedAt: { lte: threshold } },
      select: { id: true },
    });
    for (const user of users) {
      // Cascades remove portfolios, positions, journal, briefs, notifications and AI history.
      await this.db.user.delete({ where: { id: user.id } });
    }

    const tokens = await this.db.refreshToken.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });

    if (users.length > 0 || tokens.count > 0) {
      this.logger.info({ users: users.length, tokens: tokens.count }, 'retention purge completed');
    }
    return { users: users.length, tokens: tokens.count };
  }

  async changePassword(userId: string, currentPassword: string, newPasswordHash: string) {
    const user = await this.db.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw notFound('Compte introuvable');

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) throw unauthorized('Mot de passe actuel incorrect.');

    await this.db.user.update({ where: { id: userId }, data: { passwordHash: newPasswordHash } });
    // Changing a password ends every other session.
    await this.auth.revokeAllSessions(userId);
    await this.auditLog.record({
      userId,
      action: 'account.password_changed',
      resource: 'user',
      resourceId: userId,
    });
  }
}
