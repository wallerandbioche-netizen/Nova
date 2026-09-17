import { logger } from '@/lib/logger';

/**
 * Transactional e-mail.
 *
 * The MVP sends exactly one kind of message: a password-reset link. Two drivers
 * exist — `resend` for real delivery, and `console`, which writes the link to
 * the server log. The console driver is the honest default for local work: it
 * does not pretend an e-mail was sent, and it refuses to be the production
 * driver silently (see `assertMailerReadyForProduction`).
 */

export interface PasswordResetEmail {
  to: string;
  resetUrl: string;
  expiresInMinutes: number;
}

export interface Mailer {
  readonly name: string;
  sendPasswordReset(email: PasswordResetEmail): Promise<void>;
}

class ConsoleMailer implements Mailer {
  readonly name = 'console';

  async sendPasswordReset(email: PasswordResetEmail): Promise<void> {
    logger.warn('mail.console_driver', {
      template: 'password_reset',
      to: email.to,
      // The link is a credential: it is printed only because this driver exists
      // for local development, where the developer is the recipient.
      resetUrl: email.resetUrl,
      expiresInMinutes: email.expiresInMinutes,
      hint: 'Configurez RESEND_API_KEY et MAIL_FROM pour envoyer de vrais e-mails.',
    });
  }
}

class ResendMailer implements Mailer {
  readonly name = 'resend';

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async sendPasswordReset(email: PasswordResetEmail): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: [email.to],
        subject: 'Réinitialise ton mot de passe Scan Trade',
        text: [
          'Tu as demandé à réinitialiser ton mot de passe Scan Trade.',
          '',
          email.resetUrl,
          '',
          `Ce lien expire dans ${email.expiresInMinutes} minutes et ne fonctionne qu'une seule fois.`,
          "Si tu n'es pas à l'origine de cette demande, ignore ce message : ton mot de passe reste inchangé.",
        ].join('\n'),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      logger.error('mail.send_failed', {
        template: 'password_reset',
        status: response.status,
        detail: detail.slice(0, 200),
      });
      throw new Error(`Resend a refusé l'envoi (${response.status}).`);
    }
  }
}

let mailer: Mailer | null = null;

export function getMailer(): Mailer {
  if (mailer) return mailer;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  mailer = apiKey && from ? new ResendMailer(apiKey, from) : new ConsoleMailer();
  return mailer;
}

/** Test helper. */
export function setMailer(next: Mailer | null): void {
  mailer = next;
}

/**
 * Warns loudly at boot if production is about to swallow password-reset mails.
 * Called from instrumentation, never from a request path.
 */
export function assertMailerReadyForProduction(): void {
  if (process.env.NODE_ENV !== 'production') return;
  if (getMailer().name === 'console') {
    logger.error('mail.console_driver_in_production', {
      hint: 'RESEND_API_KEY et MAIL_FROM ne sont pas configurés : les liens de réinitialisation ne seront pas envoyés.',
    });
  }
}
