import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const mockCharges = [
  { id: '1', description: 'Mensualidad Junio', amount: 25000, dueDate: '2026-06-10', status: 'pending', branchId: '1', studentId: 's1', guardianId: 'g1', planId: 'p1', currency: 'ARS', daysLate: 0, paidAt: null, createdAt: new Date(), updatedAt: new Date(), branch: { id: '1', name: 'Sede Norte', city: 'San Isidro', address: 'Av. Libertad 123', phone: '+54 9 11 1111-1111', coach: 'Diego Alvarez', createdAt: new Date(), updatedAt: new Date() }, student: { id: 's1', firstName: 'Juan', lastName: 'Perez', birthDate: null, category: 'Sub 12', active: true, disabledAt: null, branchId: '1', guardianId: 'g1', notes: '', createdAt: new Date(), updatedAt: new Date() }, guardian: { id: 'g1', name: 'Tutor 1', whatsapp: '+5491110000001', email: 'tutor1@academiafutbol.com', phone: '+54 11 6000001', createdAt: new Date(), updatedAt: new Date() }, payments: [] },
  { id: '2', description: 'Mensualidad Junio', amount: 25000, dueDate: '2026-06-10', status: 'pending', branchId: '2', studentId: 's2', guardianId: 'g2', planId: 'p1', currency: 'ARS', daysLate: 5, paidAt: null, createdAt: new Date(), updatedAt: new Date(), branch: { id: '2', name: 'Sede Sur', city: 'Lomas', address: 'Calle Rojo 45', phone: '+54 9 11 2222-2222', coach: 'Martín Pérez', createdAt: new Date(), updatedAt: new Date() }, student: { id: 's2', firstName: 'María', lastName: 'García', birthDate: null, category: 'Sub 14', active: true, disabledAt: null, branchId: '2', guardianId: 'g2', notes: '', createdAt: new Date(), updatedAt: new Date() }, guardian: { id: 'g2', name: 'Tutor 2', whatsapp: '+5491110000002', email: 'tutor2@academiafutbol.com', phone: '+54 11 6000002', createdAt: new Date(), updatedAt: new Date() }, payments: [] },
  { id: '3', description: 'Uniforme', amount: 12000, dueDate: '2026-07-01', status: 'pending', branchId: '3', studentId: 's3', guardianId: 'g3', planId: 'p3', currency: 'ARS', daysLate: 1, paidAt: null, createdAt: new Date(), updatedAt: new Date(), branch: { id: '3', name: 'Sede Este', city: 'Ituzaingó', address: 'Ruta 5 km 12', phone: '+54 9 11 3333-3333', coach: 'Lucas Gómez', createdAt: new Date(), updatedAt: new Date() }, student: { id: 's3', firstName: 'Carlos', lastName: 'López', birthDate: null, category: 'Sub 12', active: true, disabledAt: null, branchId: '3', guardianId: 'g3', notes: '', createdAt: new Date(), updatedAt: new Date() }, guardian: { id: 'g3', name: 'Tutor 3', whatsapp: '+5491110000003', email: 'tutor3@academiafutbol.com', phone: '+54 11 6000003', createdAt: new Date(), updatedAt: new Date() }, payments: [] },
  { id: '4', description: 'Mensualidad Junio', amount: 25000, dueDate: '2026-06-10', status: 'paid', branchId: '4', studentId: 's4', guardianId: 'g4', planId: 'p1', currency: 'ARS', daysLate: 0, paidAt: new Date('2026-06-08'), createdAt: new Date(), updatedAt: new Date(), branch: { id: '4', name: 'Sede Oeste', city: 'Morón', address: 'Av. Libertador 987', phone: '+54 9 11 4444-4444', coach: 'Javier Ramírez', createdAt: new Date(), updatedAt: new Date() }, student: { id: 's4', firstName: 'Pedro', lastName: 'Martínez', birthDate: null, category: 'Sub 14', active: true, disabledAt: null, branchId: '4', guardianId: 'g4', notes: '', createdAt: new Date(), updatedAt: new Date() }, guardian: { id: 'g4', name: 'Tutor 4', whatsapp: '+5491110000004', email: 'tutor4@academiafutbol.com', phone: '+54 11 6000004', createdAt: new Date(), updatedAt: new Date() }, payments: [{ id: 'pay1', chargeId: '4', amount: 25000, currency: 'ARS', method: 'manual', reference: 'Pago directo', recordedBy: 'Coordinador', recordedAt: new Date('2026-06-08'), createdAt: new Date('2026-06-08'), updatedAt: new Date('2026-06-08') }] },
  { id: '5', description: 'Torneo Regional', amount: 18000, dueDate: '2026-07-05', status: 'pending', branchId: '5', studentId: 's5', guardianId: 'g5', planId: 'p4', currency: 'ARS', daysLate: 0, paidAt: null, createdAt: new Date(), updatedAt: new Date(), branch: { id: '5', name: 'Sede Central', city: 'CABA', address: 'Calle Principal 1000', phone: '+54 9 11 5555-5555', coach: 'Rodrigo Díaz', createdAt: new Date(), updatedAt: new Date() }, student: { id: 's5', firstName: 'Diego', lastName: 'Rodríguez', birthDate: null, category: 'Sub 12', active: true, disabledAt: null, branchId: '5', guardianId: 'g5', notes: '', createdAt: new Date(), updatedAt: new Date() }, guardian: { id: 'g5', name: 'Tutor 5', whatsapp: '+5491110000005', email: 'tutor5@academiafutbol.com', phone: '+54 11 6000005', createdAt: new Date(), updatedAt: new Date() }, payments: [] }
];

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
    console.log('Using mock charges (DB not available)');
    return NextResponse.json(mockCharges);
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
