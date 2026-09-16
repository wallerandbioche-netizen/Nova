import type { Logger } from 'pino';
import type { MailMessage, MailProvider } from './mail-provider.js';

/**
 * Development mail transport.
 *
 * Nothing is sent: the message is written to the logs so a developer can follow the reset
 * link locally. `canDeliver` is false, and the API says so honestly rather than claiming an
 * email was sent — production refuses to boot on this provider (see createMailProvider).
 */
export class LogMailProvider implements MailProvider {
  readonly name = 'log';
  readonly canDeliver = false;

  constructor(private readonly logger: Logger) {}

  async send(message: MailMessage): Promise<void> {
    this.logger.warn(
      { to: message.to, subject: message.subject, body: message.text },
      'mail not delivered (log provider): copy the link below to continue locally',
    );
  }
}
