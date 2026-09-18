import { ok, route } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { creditService } from '@/lib/credits/credit-service';
import { getCreditPacks, getPlans } from '@/lib/config/system-config';

/** GET /api/credits — balance, cost per video, history and what can be bought. */
export const GET = route(async () => {
  const user = await requireUser();
  const [balance, costPerVideo, history, plans, packs] = await Promise.all([
    creditService.getBalance(user.id),
    creditService.costPerVideo(),
    creditService.history(user.id, 30),
    getPlans(),
    getCreditPacks(),
  ]);

  return ok({
    balance,
    costPerVideo,
    plans,
    packs,
    transactions: history.map((transaction) => ({
      id: transaction.id,
      amount: transaction.amount,
      type: transaction.type,
      balanceAfter: transaction.balanceAfter,
      description: transaction.description,
      createdAt: transaction.createdAt.toISOString(),
    })),
  });
});
