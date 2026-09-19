import { NextResponse } from 'next/server';
import { z } from 'zod';
import { toProjectView } from '@/lib/api/present';
import { AtriumError, USER_MESSAGES, describe } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { renderFormat } from '@/services/pipeline';
import { VIDEO_FORMATS } from '@/types/domain';

const log = logger('api');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({ format: z.enum(VIDEO_FORMATS) });

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'UNKNOWN', message: USER_MESSAGES.UNKNOWN } },
      { status: 400 },
    );
  }

  try {
    const project = await renderFormat(id, parsed.data.format);
    return NextResponse.json(toProjectView(project), {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof AtriumError) {
      return NextResponse.json({ error: error.toProjectError() }, { status: 409 });
    }
    log.error('changement de format en échec', describe(error));
    return NextResponse.json(
      { error: { code: 'UNKNOWN', message: USER_MESSAGES.UNKNOWN } },
      { status: 500 },
    );
  }
}
