import { describe, expect, it, vi } from 'vitest';
import { AuditLogService } from './audit-log.service.js';

const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn() } as never;

describe('AuditLogService.sanitize', () => {
  const service = new AuditLogService({} as never, logger);

  it('keeps harmless metadata', () => {
    expect(service.sanitize({ plan: 'premium', positions: 3 })).toEqual({
      plan: 'premium',
      positions: 3,
    });
  });

  it('drops credentials and financial amounts', () => {
    expect(
      service.sanitize({
        action: 'delete',
        password: 'secret',
        refreshToken: 'abc',
        apiKey: 'k',
        totalValue: 12480,
        price: 100,
        quantity: 3,
      }),
    ).toEqual({ action: 'delete' });
  });

  it('returns undefined when there is no metadata', () => {
    expect(service.sanitize(undefined)).toBeUndefined();
  });
});

describe('AuditLogService.record', () => {
  it('never lets an audit failure break the audited action', async () => {
    const db = { auditLog: { create: vi.fn().mockRejectedValue(new Error('db down')) } };
    const service = new AuditLogService(db as never, logger);
    await expect(
      service.record({ action: 'auth.login', resource: 'user' }),
    ).resolves.toBeUndefined();
  });
});
