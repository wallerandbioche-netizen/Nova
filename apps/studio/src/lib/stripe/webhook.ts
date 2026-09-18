import type Stripe from 'stripe';
import { prisma } from '../db';
import { creditService } from '../credits/credit-service';

/**
 * Handles the events that actually move credits.
 *
 * Every grant is keyed on the Stripe object id, so Stripe's at-least-once delivery can replay an
 * event as often as it likes without ever granting the same credits twice.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      if (!userId) return;

      const credits = Number(session.metadata?.credits ?? session.metadata?.monthlyCredits ?? 0);

      await prisma.payment.upsert({
        where: { stripeCheckoutSessionId: session.id },
        create: {
          userId,
          stripeCheckoutSessionId: session.id,
          amountCents: session.amount_total ?? 0,
          currency: session.currency ?? 'eur',
          creditsGranted: credits,
          status: 'SUCCEEDED',
        },
        update: { status: 'SUCCEEDED' },
      });

      if (credits > 0) {
        await creditService.grant({
          userId,
          amount: credits,
          type: 'PURCHASE',
          description: session.mode === 'subscription' ? 'Abonnement' : 'Achat de crédits',
          idempotencyKey: `stripe:${session.id}`,
        });
      }

      if (session.mode === 'subscription' && session.metadata?.planId) {
        await prisma.subscription.upsert({
          where: { userId },
          create: {
            userId,
            plan: session.metadata.planId as 'STARTER' | 'PRO',
            status: 'ACTIVE',
            stripeSubscriptionId: String(session.subscription ?? ''),
          },
          update: {
            plan: session.metadata.planId as 'STARTER' | 'PRO',
            status: 'ACTIVE',
            stripeSubscriptionId: String(session.subscription ?? ''),
          },
        });
      }
      return;
    }

    case 'invoice.paid': {
      // Monthly renewal: top the subscriber's credits back up, once per invoice.
      const invoice = event.data.object as Stripe.Invoice & { subscription?: string };
      const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : null;
      if (!subscriptionId) return;

      const subscription = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: subscriptionId },
      });
      if (!subscription) return;

      const { getPlans } = await import('../config/system-config');
      const plan = (await getPlans()).find((entry) => entry.id === subscription.plan);
      if (!plan || plan.monthlyCredits <= 0) return;

      await creditService.grant({
        userId: subscription.userId,
        amount: plan.monthlyCredits,
        type: 'PURCHASE',
        description: `Crédits mensuels — ${plan.name}`,
        idempotencyKey: `stripe:invoice:${invoice.id}`,
      });
      return;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: { status: 'CANCELED', plan: 'FREE' },
      });
      return;
    }

    default:
      return;
  }
}
