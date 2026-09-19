import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AtriumError, USER_MESSAGES, describe } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createProject } from '@/services/pipeline';
import { VIDEO_FORMATS } from '@/types/domain';
import type { CreateProjectResponse } from '@/types/api';

const log = logger('api');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z
  .object({
    source: z.string().trim().min(1).max(2048).optional(),
    uploadId: z.string().trim().min(1).max(64).optional(),
    format: z.enum(VIDEO_FORMATS).optional(),
  })
  .refine((value) => Boolean(value.source ?? value.uploadId), {
    message: 'source ou uploadId requis',
  });

export async function POST(request: Request): Promise<NextResponse> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_URL', message: USER_MESSAGES.INVALID_URL } },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_URL', message: USER_MESSAGES.INVALID_URL } },
      { status: 400 },
    );
  }

  try {
    const project = await createProject(parsed.data);
    const response: CreateProjectResponse = { id: project.id };
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof AtriumError) {
      log.warn('création refusée', error.detail ?? error.message);
      return NextResponse.json(
        { error: error.toProjectError() },
        { status: error.code === 'INVALID_URL' ? 400 : 502 },
      );
    }
    log.error('création en échec', describe(error));
    return NextResponse.json(
      { error: { code: 'UNKNOWN', message: USER_MESSAGES.UNKNOWN } },
      { status: 500 },
    );
  }
}
