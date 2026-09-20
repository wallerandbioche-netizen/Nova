import { NextResponse } from 'next/server';
import { endSession } from '@/lib/server/auth';

export const runtime = 'nodejs';

export async function POST(): Promise<Response> {
  await endSession();
  return NextResponse.json({ ok: true });
}
