import type { Logger } from 'pino';
import type { NotificationProvider, PushMessage, PushResult } from './notification-provider.js';

/**
 * Demo transport: notifications are persisted in the database and visible in the app, but
 * nothing is pushed to a device. Used whenever no push credentials are configured.
 */
export class DemoNotificationProvider implements NotificationProvider {
  readonly name = 'demo';
  readonly isDemo = true;

  constructor(private readonly logger: Logger) {}

  async send(messages: PushMessage[]): Promise<PushResult[]> {
    this.logger.debug({ count: messages.length }, 'demo notification provider: no push sent');
    return messages.map((message) => ({ token: message.token, delivered: false }));
  }
}
