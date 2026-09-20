import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/server/auth';
import { customerForAccount, stripe } from '@/lib/server/billing';
import { billingEnabled, serverConfig } from '@/lib/server/env';

export const runtime = 'nodejs';

/** Stripe's own portal handles cancellation, card changes and invoices. */
export async function POST(): Promise<Response> {
  const config = serverConfig();
  if (!billingEnabled(config)) {
    return NextResponse.json({ error: 'Paiements non configurés.' }, { status: 503 });
  }

  const account = await currentAccount();
  if (!account) {
    return NextResponse.json({ error: 'Connectez-vous d’abord.' }, { status: 401 });
  }

  const client = stripe();
  const customer = await customerForAccount(account);
  if (!client || !customer) {
    return NextResponse.json({ error: 'Espace de gestion indisponible.' }, { status: 503 });
  }

  const session = await client.billingPortal.sessions.create({
    customer,
    return_url: `${config.appUrl}/profil`,
  });

  return NextResponse.json({ url: session.url });
}
