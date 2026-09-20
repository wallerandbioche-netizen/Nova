import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/server/auth';
import { NO_SUBSCRIPTION, readSubscription } from '@/lib/server/billing';
import { accountsEnabled, billingEnabled, serverConfig } from '@/lib/server/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Single source of truth the interface reads for account and access state. */
export async function GET(): Promise<Response> {
  const config = serverConfig();
  const accounts = accountsEnabled(config);
  const billing = billingEnabled(config);

  if (!accounts) {
    return NextResponse.json({
      accountsEnabled: false,
      billingEnabled: false,
      account: null,
      subscription: NO_SUBSCRIPTION,
    });
  }

  const account = await currentAccount();
  const subscription = account ? await readSubscription(account.id) : NO_SUBSCRIPTION;

  return NextResponse.json({
    accountsEnabled: true,
    billingEnabled: billing,
    account: account ? { email: account.email } : null,
    subscription,
  });
}
