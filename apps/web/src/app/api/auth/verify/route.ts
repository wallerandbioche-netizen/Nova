import { NextResponse } from 'next/server';
import { consumeLoginToken, startSession } from '@/lib/server/auth';
import { serverConfig } from '@/lib/server/env';

export const runtime = 'nodejs';

/** Opened from the e-mail: burns the token, opens the session, comes back. */
export async function GET(request: Request): Promise<Response> {
  const { appUrl } = serverConfig();
  const token = new URL(request.url).searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(`${appUrl}/profil?connexion=invalide`);
  }

  const account = await consumeLoginToken(token);
  if (!account) {
    return NextResponse.redirect(`${appUrl}/profil?connexion=expire`);
  }

  await startSession(account);
  return NextResponse.redirect(`${appUrl}/profil?connexion=ok`);
}
