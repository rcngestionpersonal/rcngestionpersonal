import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const mockBranches = [
  { id: '1', name: 'Sede Norte', city: 'San Isidro', address: 'Av. Libertad 123', phone: '+54 9 11 1111-1111', coach: 'Diego Alvarez', createdAt: new Date(), updatedAt: new Date() },
  { id: '2', name: 'Sede Sur', city: 'Lomas', address: 'Calle Rojo 45', phone: '+54 9 11 2222-2222', coach: 'Martín Pérez', createdAt: new Date(), updatedAt: new Date() },
  { id: '3', name: 'Sede Este', city: 'Ituzaingó', address: 'Ruta 5 km 12', phone: '+54 9 11 3333-3333', coach: 'Lucas Gómez', createdAt: new Date(), updatedAt: new Date() },
  { id: '4', name: 'Sede Oeste', city: 'Morón', address: 'Av. Libertador 987', phone: '+54 9 11 4444-4444', coach: 'Javier Ramírez', createdAt: new Date(), updatedAt: new Date() },
  { id: '5', name: 'Sede Central', city: 'CABA', address: 'Calle Principal 1000', phone: '+54 9 11 5555-5555', coach: 'Rodrigo Díaz', createdAt: new Date(), updatedAt: new Date() }
];

export async function GET() {
  try {
    const branches = await prisma.branch.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(branches);
  } catch (error) {
    console.log('Using mock branches (DB not available)');
    return NextResponse.json(mockBranches);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, city, address, phone, coach } = body;
    const branch = await prisma.branch.create({
      data: { name, city, address, phone, coach },
    });
    return NextResponse.json(branch, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create branch' }, { status: 500 });
  }
}
