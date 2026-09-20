import 'server-only';

import { serverConfig } from './env';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Sends the sign-in link. Without a mail provider the link is written to the
 * server log so the flow can still be exercised in development — it is never
 * returned to the browser, which would let anyone sign in as anyone.
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const { resendApiKey, emailFrom } = serverConfig();

  if (!resendApiKey) {
    console.warn(
      `[scan-trade] e-mail non envoyé (aucun fournisseur configuré) : ${message.subject}`,
    );
    console.warn(`[scan-trade] contenu : ${message.text}`);
    return false;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${resendApiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  });

  if (!response.ok) {
    console.error('[scan-trade] envoi e-mail refusé', response.status);
    return false;
  }
  return true;
}

export function loginEmail(link: string): Omit<EmailMessage, 'to'> {
  return {
    subject: 'Votre lien de connexion SCAN TRADE',
    text: [
      'Voici votre lien de connexion à SCAN TRADE :',
      link,
      '',
      'Il est valable 20 minutes et ne fonctionne qu’une fois.',
      'Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.',
    ].join('\n'),
    html: `
      <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#0b1220;line-height:1.5">
        <p>Voici votre lien de connexion à <strong>SCAN TRADE</strong> :</p>
        <p>
          <a href="${link}" style="display:inline-block;background:#1f6feb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:500">
            Se connecter
          </a>
        </p>
        <p style="color:#667a94;font-size:13px">
          Ce lien est valable 20 minutes et ne fonctionne qu’une fois.<br />
          Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.
        </p>
      </div>
    `,
  };
}
