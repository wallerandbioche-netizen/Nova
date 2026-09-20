import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createLoginToken, normaliseEmail } from '@/lib/server/auth';
import { loginEmail, sendEmail } from '@/lib/server/email';
import { accountsEnabled, serverConfig } from '@/lib/server/env';

export const runtime = 'nodejs';

const requestSchema = z.object({ email: z.string().email().max(200) });

/**
 * Starts a sign-in. The answer is deliberately identical whether or not the
 * address is known: it must not reveal who has an account.
 */
export async function POST(request: Request): Promise<Response> {
  const config = serverConfig();
  if (!accountsEnabled(config)) {
    return NextResponse.json(
      { error: 'Les comptes ne sont pas configurés sur ce déploiement.' },
      { status: 503 },
    );
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Adresse e-mail invalide.' }, { status: 400 });
  }

  const email = normaliseEmail(parsed.data.email);
  const token = await createLoginToken(email);
  if (!token) {
    return NextResponse.json({ error: 'Connexion indisponible.' }, { status: 503 });
  }

  const link = `${config.appUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;
  const delivered = await sendEmail({ to: email, ...loginEmail(link) });

  return NextResponse.json({ sent: true, delivered });
}
