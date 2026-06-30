import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/contacts/[id] - Obtener contacto
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: params.id },
      include: {
        company: true,
        deals: true,
        tasks: true,
        emails: true,
        activities: true,
      },
    });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    return NextResponse.json(contact);
  } catch (error) {
    return NextResponse.json({ error: 'Error fetching contact' }, { status: 500 });
  }
}

// PUT /api/contacts/[id] - Actualizar contacto
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    const contact = await prisma.contact.update({
      where: { id: params.id },
      data: body,
    });

    return NextResponse.json(contact);
  } catch (error) {
    return NextResponse.json({ error: 'Error updating contact' }, { status: 500 });
  }
}

// DELETE /api/contacts/[id] - Eliminar contacto
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.contact.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error deleting contact' }, { status: 500 });
  }
}
