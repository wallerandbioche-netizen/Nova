import type { Logger } from 'pino';
import type { Database } from '../../infrastructure/database/prisma.js';

/**
 * Append-only trail of sensitive actions (authentication, data export, account deletion,
 * subscription changes).
 *
 * Metadata never contains credentials, tokens or portfolio amounts — an audit log must be
 * safe to read during an incident (rule #52).
 */
export interface AuditEvent {
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
  ipHash?: string | null;
}

const FORBIDDEN_METADATA_KEYS = [
  'password',
  'token',
  'secret',
  'apikey',
  'authorization',
  'amount',
  'value',
  'quantity',
  'price',
];

export class AuditLogService {
  constructor(
    private readonly db: Database,
    private readonly logger: Logger,
  ) {}

  /** Drops any key that could carry a credential or a financial amount. */
  sanitize(metadata: AuditEvent['metadata']): Record<string, unknown> | undefined {
    if (!metadata) return undefined;
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (FORBIDDEN_METADATA_KEYS.some((forbidden) => key.toLowerCase().includes(forbidden))) {
        continue;
      }
      clean[key] = value;
    }
    return clean;
  }

  /**
   * Records an event. Auditing must never break the action it observes, so a failure is
   * logged and swallowed.
   */
  async record(event: AuditEvent): Promise<void> {
    try {
      await this.db.auditLog.create({
        data: {
          userId: event.userId ?? null,
          action: event.action,
          resource: event.resource,
          resourceId: event.resourceId ?? null,
          metadata: (this.sanitize(event.metadata) ?? undefined) as never,
          ipHash: event.ipHash ?? null,
        },
      });
    } catch (error) {
      this.logger.error({ err: error, action: event.action }, 'failed to write audit log');
    }
  }

  async listForUser(userId: string, limit = 50) {
    return this.db.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
