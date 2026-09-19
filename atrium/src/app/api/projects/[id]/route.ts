import { NextResponse } from 'next/server';
import { projectRepository } from '@/lib/db/memory';
import { toProjectView } from '@/lib/api/present';
import { discardProject } from '@/services/pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Context {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: Context): Promise<NextResponse> {
  const { id } = await context.params;
  const project = await projectRepository().find(id);
  if (!project) {
    return NextResponse.json(
      { error: { code: 'UNKNOWN', message: 'Ce projet n\'existe plus.' } },
      { status: 404 },
    );
  }

  return NextResponse.json(toProjectView(project), {
    headers: { 'cache-control': 'no-store' },
  });
}

export async function DELETE(_request: Request, context: Context): Promise<NextResponse> {
  const { id } = await context.params;
  await discardProject(id);
  return new NextResponse(null, { status: 204 });
}
