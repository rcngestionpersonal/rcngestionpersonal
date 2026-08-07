import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { shouldUseMockStore } from '@/lib/real-estate/mock-store';

export async function GET() {
  if (shouldUseMockStore()) {
    return NextResponse.json({ db: 'mock', mock: true });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ db: 'ok' });
  } catch (err) {
    const message = err instanceof Error ? err.message.split('\n')[0] : 'unknown error';
    return NextResponse.json({ db: 'error', message }, { status: 503 });
  }
}
