import type { Logger } from 'pino';
import type { Env } from '../../../config/env.js';
import { HttpMailProvider } from './http-mail.provider.js';
import { LogMailProvider } from './log-mail.provider.js';
import type { MailProvider } from './mail-provider.js';

export * from './mail-provider.js';

export function createMailProvider(env: Env, logger: Logger): MailProvider {
  if (env.MAIL_PROVIDER === 'http') return new HttpMailProvider(env, logger);
  if (env.NODE_ENV === 'production') {
    // Guarded at boot too (config/env.ts); this is the last line of defence.
    throw new Error(
      'MAIL_PROVIDER=log cannot be used in production: password reset would silently fail',
    );
  }
  logger.warn('mail: using the log provider — no email will actually be delivered');
  return new LogMailProvider(logger);
}
