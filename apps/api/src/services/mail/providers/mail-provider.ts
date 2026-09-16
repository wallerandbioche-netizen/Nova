export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  /** Optional HTML body; the text body is always provided and is authoritative. */
  html?: string;
}

/**
 * Transactional mail contract.
 *
 * Only NOVA's own operational messages go through it (password reset today). Marketing is out
 * of scope, and no portfolio content is ever put in an email.
 */
export interface MailProvider {
  readonly name: string;
  /** False when mail cannot actually be delivered on this environment. */
  readonly canDeliver: boolean;
  send(message: MailMessage): Promise<void>;
}
