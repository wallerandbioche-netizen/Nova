import type { Logger } from 'pino';
import type { AppNotification, NotificationType } from '@nova/types';
import { DEFAULT_TIMEZONE } from '@nova/config';
import type { Database } from '../../infrastructure/database/prisma.js';
import { notFound } from '../../http/errors.js';
import { buildPage, decodeCursor, type PageResult } from '../../http/pagination.js';
import type { NotificationProvider } from './providers/index.js';

/**
 * Notifications.
 *
 * Copy is deliberately calm: NOVA never sends an alarming message or manufactures urgency to
 * provoke a transaction (rule #20). Quiet hours and per-type preferences are honoured before
 * anything is sent.
 */
export class NotificationService {
  constructor(
    private readonly db: Database,
    private readonly provider: NotificationProvider,
    private readonly logger: Logger,
  ) {}

  private toDto(row: {
    id: string;
    type: string;
    title: string;
    body: string;
    link: string | null;
    readAt: Date | null;
    createdAt: Date;
  }): AppNotification {
    return {
      id: row.id,
      type: row.type as NotificationType,
      title: row.title,
      body: row.body,
      link: row.link,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async list(
    userId: string,
    options: { limit: number; cursor?: string; unreadOnly?: boolean },
  ): Promise<PageResult<AppNotification>> {
    const cursor = decodeCursor(options.cursor);
    const rows = await this.db.notification.findMany({
      where: {
        userId,
        ...(options.unreadOnly ? { readAt: null } : {}),
        ...(cursor ? { createdAt: { lt: new Date(cursor.timestamp) } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: options.limit + 1,
    });

    const page = buildPage(rows, options.limit, (row) => ({
      timestamp: row.createdAt.toISOString(),
      id: row.id,
    }));
    return { ...page, items: page.items.map((row) => this.toDto(row)) };
  }

  async countUnread(userId: string): Promise<number> {
    return this.db.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(notificationId: string, userId: string): Promise<AppNotification> {
    const notification = await this.db.notification.findUnique({ where: { id: notificationId } });
    if (!notification || notification.userId !== userId) throw notFound('Notification introuvable');
    const updated = await this.db.notification.update({
      where: { id: notificationId },
      data: { readAt: notification.readAt ?? new Date() },
    });
    return this.toDto(updated);
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.db.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return result.count;
  }

  async registerDevice(
    userId: string,
    token: string,
    platform: 'ios' | 'android' | 'web',
  ): Promise<void> {
    await this.db.device.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, lastSeenAt: new Date() },
    });
  }

  /** True when the current local hour falls inside the user's quiet hours. */
  private isQuietHour(start: number, end: number, now: Date): boolean {
    const hour = Number(
      new Intl.DateTimeFormat('fr-FR', {
        hour: 'numeric',
        hour12: false,
        timeZone: DEFAULT_TIMEZONE,
      }).format(now),
    );
    // Quiet hours usually wrap around midnight (22 → 7).
    return start > end ? hour >= start || hour < end : hour >= start && hour < end;
  }

  /**
   * Creates a notification, honouring the user's preferences, and pushes it when a device is
   * registered and we are outside quiet hours.
   */
  async notify(options: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    link?: string | null;
    now?: Date;
  }): Promise<AppNotification | null> {
    const now = options.now ?? new Date();
    const preferences = await this.db.notificationPreference.findUnique({
      where: { userId: options.userId },
    });

    const enabled =
      options.type === 'daily_brief'
        ? (preferences?.dailyBrief ?? true)
        : options.type === 'important_news'
          ? (preferences?.importantNews ?? true)
          : options.type === 'learning'
            ? (preferences?.learning ?? true)
            : true;

    if (!enabled) return null;

    const notification = await this.db.notification.create({
      data: {
        userId: options.userId,
        type: options.type,
        title: options.title,
        body: options.body,
        link: options.link ?? null,
      },
    });

    const quiet = this.isQuietHour(
      preferences?.quietHoursStart ?? 22,
      preferences?.quietHoursEnd ?? 7,
      now,
    );

    if (!quiet) {
      const devices = await this.db.device.findMany({ where: { userId: options.userId } });
      if (devices.length > 0) {
        const results = await this.provider.send(
          devices.map((device) => ({
            token: device.token,
            title: options.title,
            body: options.body,
            data: options.link ? { link: options.link } : ({} as Record<string, string>),
          })),
        );
        // Clean up tokens the transport reports as dead, so we stop pushing to them.
        const invalid = results
          .filter((result) => result.invalidToken)
          .map((result) => result.token);
        if (invalid.length > 0) {
          await this.db.device.deleteMany({ where: { token: { in: invalid } } });
        }
      }
    } else {
      this.logger.debug({ userId: options.userId }, 'quiet hours: notification stored, not pushed');
    }

    return this.toDto(notification);
  }

  /** Calm, non-urgent copy for each notification type. */
  static copyFor(type: NotificationType, context: { count?: number } = {}) {
    switch (type) {
      case 'daily_brief':
        return {
          title: 'Votre briefing du matin est prêt',
          body: 'Prenez trois minutes pour comprendre ce qui s’est passé sur les marchés.',
        };
      case 'important_news':
        return {
          title: 'Une actualité concerne un actif que vous suivez',
          body:
            context.count && context.count > 1
              ? `${context.count} informations touchent votre portefeuille. À lire quand vous le souhaitez.`
              : 'Une information touche votre portefeuille. À lire quand vous le souhaitez.',
        };
      case 'learning':
        return {
          title: 'Votre leçon de 2 minutes est prête',
          body: 'Un concept expliqué simplement, en lien avec l’actualité du jour.',
        };
      default:
        return { title: 'NOVA', body: '' };
    }
  }
}
