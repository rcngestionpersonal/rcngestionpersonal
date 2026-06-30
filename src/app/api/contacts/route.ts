import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/contacts - Listar contactos
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const organizationId = searchParams.get('organizationId');

    const where: any = {};
    if (organizationId) where.organizationId = organizationId;
    if (status) where.status = status;

    const contacts = await prisma.contact.findMany({
      where,
      include: {
        company: true,
        deals: true,
        tasks: { where: { completed: false } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(contacts);
  } catch (error) {
    return NextResponse.json({ error: 'Error fetching contacts' }, { status: 500 });
  }
}

// POST /api/contacts - Crear contacto
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      mobile,
      title,
      source,
      organizationId,
      userId,
      companyId,
    } = body;

    const contact = await prisma.contact.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        mobile,
        title,
        source,
        organizationId,
        userId,
        companyId,
      },
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Error creating contact' }, { status: 500 });
  }
}
