import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentAccount } from '@/lib/server/auth';
import { customerForAccount, priceIdFor, stripe } from '@/lib/server/billing';
import { billingEnabled, serverConfig } from '@/lib/server/env';

export const runtime = 'nodejs';

const requestSchema = z.object({ plan: z.enum(['mensuelle', 'annuelle']) });

/** Opens a Stripe Checkout session for the signed-in account. */
export async function POST(request: Request): Promise<Response> {
  const config = serverConfig();
  if (!billingEnabled(config)) {
    return NextResponse.json(
      { error: 'Les paiements ne sont pas configurés sur ce déploiement.' },
      { status: 503 },
    );
  }

  const account = await currentAccount();
  if (!account) {
    return NextResponse.json({ error: 'Connectez-vous avant de vous abonner.' }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Formule inconnue.' }, { status: 400 });
  }

  const price = priceIdFor(parsed.data.plan);
  const client = stripe();
  const customer = await customerForAccount(account);
  if (!price || !client || !customer) {
    return NextResponse.json({ error: 'Formule indisponible.' }, { status: 503 });
  }

  const session = await client.checkout.sessions.create({
    mode: 'subscription',
    customer,
    line_items: [{ price, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${config.appUrl}/abonnement?paiement=ok`,
    cancel_url: `${config.appUrl}/abonnement?paiement=annule`,
    client_reference_id: account.id,
    subscription_data: { metadata: { accountId: account.id } },
  });

  if (!session.url) {
    return NextResponse.json({ error: 'Session de paiement indisponible.' }, { status: 502 });
  }
  return NextResponse.json({ url: session.url });
}
