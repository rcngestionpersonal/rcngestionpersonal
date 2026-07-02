import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { chargeId, branchId, guardianId } = Object.fromEntries(request.nextUrl.searchParams.entries());
    const where: any = {};
    if (chargeId) where.chargeId = chargeId;
    if (branchId) where.charge = { branchId };
    if (guardianId) where.charge = { guardianId };

    const payments = await prisma.payment.findMany({
      where,
      include: { charge: true },
      orderBy: { recordedAt: 'desc' },
    });
    return NextResponse.json(payments);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chargeId, amount, currency, method, reference, recordedBy } = body;
    const payment = await prisma.payment.create({
      data: {
        chargeId,
        amount,
        currency,
        method,
        reference,
        recordedBy,
      },
    });
    await prisma.charge.update({ where: { id: chargeId }, data: { status: 'paid', paidAt: new Date() } });
    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }
}
