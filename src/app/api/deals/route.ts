import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/deals - Listar deals
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const stage = searchParams.get('stage');
    const organizationId = searchParams.get('organizationId');

    const where: any = {};
    if (organizationId) where.organizationId = organizationId;
    if (stage) where.stage = stage;

    const deals = await prisma.deal.findMany({
      where,
      include: {
        contact: true,
        company: true,
        tasks: { where: { completed: false } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(deals);
  } catch (error) {
    return NextResponse.json({ error: 'Error fetching deals' }, { status: 500 });
  }
}

// POST /api/deals - Crear deal
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      amount,
      currency,
      stage,
      organizationId,
      userId,
      contactId,
      companyId,
    } = body;

    const deal = await prisma.deal.create({
      data: {
        title,
        description,
        amount,
        currency,
        stage,
        organizationId,
        userId,
        contactId,
        companyId,
      },
    });

    return NextResponse.json(deal, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Error creating deal' }, { status: 500 });
  }
}
