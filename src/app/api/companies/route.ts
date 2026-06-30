import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/companies - Listar empresas
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');

    const where: any = {};
    if (organizationId) where.organizationId = organizationId;

    const companies = await prisma.company.findMany({
      where,
      include: {
        contacts: true,
        deals: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(companies);
  } catch (error) {
    return NextResponse.json({ error: 'Error fetching companies' }, { status: 500 });
  }
}

// POST /api/companies - Crear empresa
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      industry,
      website,
      phone,
      email,
      address,
      organizationId,
      userId,
    } = body;

    const company = await prisma.company.create({
      data: {
        name,
        industry,
        website,
        phone,
        email,
        address,
        organizationId,
        userId,
      },
    });

    return NextResponse.json(company, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Error creating company' }, { status: 500 });
  }
}
