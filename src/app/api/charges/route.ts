import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { branchId, status, guardianId, dueDate } = Object.fromEntries(request.nextUrl.searchParams.entries());
    const where: any = {};
    if (branchId) where.branchId = branchId;
    if (status) where.status = status;
    if (guardianId) where.guardianId = guardianId;
    if (dueDate) where.dueDate = new Date(dueDate);

    const charges = await prisma.charge.findMany({
      where,
      include: {
        student: true,
        guardian: true,
        branch: true,
        payments: true,
      },
      orderBy: { dueDate: 'asc' },
    });
    return NextResponse.json(charges);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch charges' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { branchId, studentId, guardianId, planId, description, amount, currency, dueDate } = body;
    const charge = await prisma.charge.create({
      data: {
        branchId,
        studentId,
        guardianId,
        planId,
        description,
        amount,
        currency,
        dueDate: new Date(dueDate),
      },
    });
    return NextResponse.json(charge, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create charge' }, { status: 500 });
  }
}
