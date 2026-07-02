import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const branchId = searchParams.get('branchId');
    const where: any = {};
    if (branchId) where.students = { some: { branchId } };
    const guardians = await prisma.guardian.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(guardians);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch guardians' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, whatsapp, email, phone } = body;
    const guardian = await prisma.guardian.create({
      data: { name, whatsapp, email, phone },
    });
    return NextResponse.json(guardian, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create guardian' }, { status: 500 });
  }
}
