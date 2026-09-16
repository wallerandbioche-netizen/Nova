import type { Logger } from 'pino';
import type { Env } from '../../../config/env.js';
import { upstreamUnavailable } from '../../../http/errors.js';
import type { MailMessage, MailProvider } from './mail-provider.js';

/**
 * Generic HTTP mail transport: POSTs `{ from, to, subject, text, html }` to a configured
 * endpoint, which most transactional providers expose directly or behind a thin proxy.
 */
export class HttpMailProvider implements MailProvider {
  readonly name = 'http';
  readonly canDeliver = true;

  constructor(
    private readonly env: Env,
    private readonly logger: Logger,
  ) {}

  async send(message: MailMessage): Promise<void> {
    try {
      const response = await fetch(this.env.MAIL_API_URL ?? '', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.env.MAIL_API_KEY ? { authorization: `Bearer ${this.env.MAIL_API_KEY}` } : {}),
        },
        body: JSON.stringify({
          from: this.env.MAIL_FROM,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`mail provider responded ${response.status}`);
    } catch (error) {
      this.logger.error({ err: error }, 'failed to send a transactional email');
      throw upstreamUnavailable('L’envoi de l’e-mail a échoué. Réessayez dans quelques instants.');
    }
  }
}
