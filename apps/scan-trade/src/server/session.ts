import { cache } from 'react';
import type { MarketType, SubscriptionStatus, TradingStyle } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { AppError } from '@/lib/errors';
import { isSubscriptionActive } from '@/features/billing/subscription';

/**
 * Server-side identity.
 *
 * Every read of "who is asking" goes through here. Nothing in the app derives
 * authorisation from a prop, a query parameter or a client-held value (§37).
 */

export interface Viewer {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  createdAt: Date;
  onboardedAt: Date | null;
  marketPreference: MarketType | null;
  tradingStyle: TradingStyle | null;
  hasPassword: boolean;
  subscription: {
    status: SubscriptionStatus;
    currentPeriodEnd: Date | null;
    currentPeriodStart: Date | null;
    cancelAtPeriodEnd: boolean;
    stripeCustomerId: string | null;
  } | null;
  isSubscribed: boolean;
}

/**
 * Loads the signed-in user, or null.
 *
 * `cache()` dedupes the lookup across a single render pass, so a layout and the
 * page it wraps share one query.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      createdAt: true,
      onboardedAt: true,
      marketPreference: true,
      tradingStyle: true,
      passwordHash: true,
      subscription: {
        select: {
          status: true,
          currentPeriodEnd: true,
          currentPeriodStart: true,
          cancelAtPeriodEnd: true,
          stripeCustomerId: true,
        },
      },
    },
  });

  // The session outlived the account (deleted elsewhere).
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    createdAt: user.createdAt,
    onboardedAt: user.onboardedAt,
    marketPreference: user.marketPreference,
    tradingStyle: user.tradingStyle,
    hasPassword: Boolean(user.passwordHash),
    subscription: user.subscription,
    isSubscribed: isSubscriptionActive(user.subscription),
  };
});

/** @throws {AppError} `unauthenticated` when nobody is signed in. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw AppError.unauthenticated();
  return viewer;
}

/** @throws {AppError} `subscription_required` when the viewer has no active plan. */
export async function requireSubscribedViewer(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.isSubscribed) {
    throw new AppError('subscription_required');
  }
  return viewer;
}
