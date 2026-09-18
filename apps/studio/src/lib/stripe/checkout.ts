import { prisma } from '../db';
import { getEnv } from '../config/env';
import { AppError } from '../errors';
import { getCreditPacks, getPlans } from '../config/system-config';
import { getStripe, resolvePriceId } from './client';

export interface CheckoutInput {
  userId: string;
  email: string;
  planId?: 'STARTER' | 'PRO' | undefined;
  packId?: string | undefined;
}

/** Creates a Checkout session for a subscription plan or a one-off credit pack. */
export async function createCheckoutSession(input: CheckoutInput): Promise<{ url: string }> {
  const env = getEnv();
  const stripe = getStripe();

  const customerId = await ensureCustomer(input.userId, input.email);

  if (input.planId) {
    const plan = (await getPlans()).find((entry) => entry.id === input.planId);
    const price = resolvePriceId(plan?.stripePriceEnv);
    if (!plan || !price) throw new AppError('VALIDATION_FAILED', 'Offre indisponible.');

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      success_url: `${env.APP_URL}/dashboard/credits?checkout=success`,
      cancel_url: `${env.APP_URL}/dashboard/credits?checkout=cancelled`,
      metadata: { userId: input.userId, planId: plan.id, monthlyCredits: String(plan.monthlyCredits) },
    });
    if (!session.url) throw new AppError('INTERNAL');
    return { url: session.url };
  }

  const pack = (await getCreditPacks()).find((entry) => entry.id === input.packId);
  const price = resolvePriceId(pack?.stripePriceEnv);
  if (!pack || !price) throw new AppError('VALIDATION_FAILED', 'Pack indisponible.');

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer: customerId,
    line_items: [{ price, quantity: 1 }],
    success_url: `${env.APP_URL}/dashboard/credits?checkout=success`,
    cancel_url: `${env.APP_URL}/dashboard/credits?checkout=cancelled`,
    metadata: { userId: input.userId, packId: pack.id, credits: String(pack.credits) },
  });
  if (!session.url) throw new AppError('INTERNAL');
  return { url: session.url };
}

async function ensureCustomer(userId: string, email: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('NOT_FOUND');
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await getStripe().customers.create({ email, metadata: { userId } });
  await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}
