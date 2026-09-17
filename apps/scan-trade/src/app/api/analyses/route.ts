import { z } from 'zod';
import { getCoreEnv } from '@/lib/env';
import { AppError } from '@/lib/errors';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { validateUpload } from '@/lib/storage/upload';
import { getAnalysisService } from '@/server/services';
import { requireViewer } from '@/server/session';
import { assertCanScan } from '@/server/usage';
import { enforceRateLimit, jsonCreated, jsonOk, route } from '@/server/http';

export const runtime = 'nodejs';

const hintSchema = z.object({
  asset: z.string().trim().min(1).max(40).optional(),
  timeframe: z.string().trim().min(1).max(20).optional(),
  market: z.enum(['CRYPTO', 'FOREX', 'INDICES', 'STOCKS', 'COMMODITIES', 'OTHER']).optional(),
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(50).optional(),
  status: z
    .enum(['PENDING', 'PROCESSING', 'COMPLETED', 'NO_TRADE', 'INSUFFICIENT_DATA', 'FAILED'])
    .optional(),
});

/** POST /api/analyses — upload a chart screenshot and open an analysis. */
export const POST = route('analyses.create', async (request: Request) => {
  const viewer = await requireViewer();
  await enforceRateLimit(RATE_LIMITS.upload, `user:${viewer.id}`);
  // Checked before the bytes are stored: an unsubscribed upload costs us nothing.
  await assertCanScan(viewer);

  const form = await request.formData().catch(() => null);
  if (!form) throw AppError.validation('Requête invalide : un envoi multipart est attendu.');

  const file = form.get('image');
  if (!(file instanceof File)) throw new AppError('upload_invalid', 'Aucune image reçue.');

  const maxBytes = getCoreEnv().MAX_UPLOAD_BYTES;
  if (file.size > maxBytes) {
    throw new AppError('upload_too_large');
  }

  const hints = hintSchema.parse({
    asset: emptyToUndefined(form.get('asset')),
    timeframe: emptyToUndefined(form.get('timeframe')),
    market: emptyToUndefined(form.get('market')),
  });

  const upload = validateUpload(Buffer.from(await file.arrayBuffer()), {
    userId: viewer.id,
    maxBytes,
    filename: file.name,
    declaredMimeType: file.type,
  });

  const analysis = await getAnalysisService().create({
    userId: viewer.id,
    upload,
    asset: hints.asset ?? null,
    timeframe: hints.timeframe ?? null,
    market: hints.market ?? null,
  });

  return jsonCreated({ analysis });
});

/** GET /api/analyses — the caller's own analyses, newest first. */
export const GET = route('analyses.list', async (request: Request) => {
  const viewer = await requireViewer();
  const url = new URL(request.url);
  const query = listQuerySchema.parse({
    limit: url.searchParams.get('limit') ?? undefined,
    cursor: url.searchParams.get('cursor') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
  });

  const result = await getAnalysisService().list(viewer.id, query);
  return jsonOk(result);
});

function emptyToUndefined(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
