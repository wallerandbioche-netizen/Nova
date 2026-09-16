import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { requireViewer } from '@/server/session';
import { jsonOk, route } from '@/server/http';

export const runtime = 'nodejs';

const bodySchema = z.object({
  name: z.string().trim().min(1).max(80).nullable().optional(),
  marketPreference: z
    .enum(['CRYPTO', 'FOREX', 'INDICES', 'STOCKS', 'COMMODITIES', 'OTHER'])
    .nullable()
    .optional(),
  tradingStyle: z.enum(['SCALPING', 'DAY_TRADING', 'SWING_TRADING', 'OTHER']).nullable().optional(),
});

/** PATCH /api/account/profile — display name and trading preferences. */
export const PATCH = route('account.profile', async (request: Request) => {
  const viewer = await requireViewer();
  const body = await request.json().catch(() => ({}));
  const input = bodySchema.parse(body);

  const updated = await prisma.user.update({
    where: { id: viewer.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.marketPreference !== undefined ? { marketPreference: input.marketPreference } : {}),
      ...(input.tradingStyle !== undefined ? { tradingStyle: input.tradingStyle } : {}),
    },
    select: { name: true, marketPreference: true, tradingStyle: true },
  });

  return jsonOk({ profile: updated });
});
